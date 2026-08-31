package container

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/pkg/errors"
)

const podmanStartupHealthTimeout = 15 * time.Second

// Config 容器管理器配置
type Config struct {
	SocketPath     string        // Podman Socket 路径
	ProjectDir     string        // 项目目录
	TemplateDir    string        // 模板目录
	PortRangeStart int           // 端口范围起始
	PortRangeEnd   int           // 端口范围结束
	DefaultMemory  string        // 默认内存限制
	DefaultCPU     float64       // 默认 CPU 限制
	IdleTimeout    time.Duration // 空闲自动停止时间，0 表示禁用
	PreheatImages  []string      // 启动后后台预热的镜像列表
}

type IdleStopCallback func(projectID string, info *ContainerInfo, err error)
type IdleStopPredicate func(projectID string, info *ContainerInfo) bool

// Manager 容器管理器
type Manager struct {
	cfg        *Config
	podman     *PodmanClient
	portPool   *PortPool
	containers map[string]*ContainerInfo // projectID -> ContainerInfo
	mu         sync.RWMutex
}

// NewManager 创建容器管理器
func NewManager(cfg *Config) (*Manager, error) {
	if cfg.ProjectDir == "" {
		cfg.ProjectDir = filepath.Clean("../runtime/projects")
	}
	if cfg.TemplateDir == "" {
		cfg.TemplateDir = filepath.Clean("../runtime/templates")
	}
	if cfg.PortRangeStart == 0 {
		cfg.PortRangeStart = 30000
	}
	if cfg.PortRangeEnd == 0 {
		cfg.PortRangeEnd = 40000
	}
	if cfg.DefaultMemory == "" {
		cfg.DefaultMemory = "1g"
	}
	if cfg.DefaultCPU == 0 {
		cfg.DefaultCPU = 1.0
	}

	// 创建 Podman 客户端
	podman, err := NewPodmanClient(cfg.SocketPath)
	if err != nil {
		return nil, errors.Wrap(err, "create podman client")
	}

	// 检查 Podman 是否可用
	ctx, cancel := context.WithTimeout(
		context.Background(),
		podmanStartupHealthTimeout,
	)
	defer cancel()
	if err := podman.Ping(ctx); err != nil {
		return nil, errors.Wrap(err, "podman not available")
	}

	// 创建目录
	if err := os.MkdirAll(cfg.ProjectDir, 0755); err != nil {
		return nil, errors.Wrap(err, "create project dir")
	}
	if err := os.MkdirAll(cfg.TemplateDir, 0755); err != nil {
		return nil, errors.Wrap(err, "create template dir")
	}

	m := &Manager{
		cfg:        cfg,
		podman:     podman,
		portPool:   NewPortPool(cfg.PortRangeStart, cfg.PortRangeEnd),
		containers: make(map[string]*ContainerInfo),
	}

	// 从已存在的容器恢复状态
	if err := m.recoverContainers(); err != nil {
		// 仅记录错误，不影响启动
		fmt.Printf("Warning: failed to recover containers: %v\n", err)
	}

	return m, nil
}

// recoverContainers 从 Podman 恢复容器状态
func (m *Manager) recoverContainers() error {
	ctx := context.Background()
	containers, err := m.podman.ListContainers(ctx, true)
	if err != nil {
		return err
	}

	for _, c := range containers {
		for _, name := range c.Names {
			projectID := extractProjectID(name)
			if projectID == "" {
				continue
			}

			port := 0
			for _, p := range c.Ports {
				if p.HostPort != "" {
					fmt.Sscanf(p.HostPort, "%d", &port)
					break
				}
			}

			status := ContainerStatusStopped
			if c.State == "running" {
				status = ContainerStatusRunning
			}

			now := time.Now()
			m.containers[projectID] = &ContainerInfo{
				ProjectID:    projectID,
				ContainerID:  c.Id,
				Name:         name,
				Image:        c.Image,
				Port:         port,
				Status:       status,
				LastActiveAt: now,
			}
			if port > 0 {
				if err := m.portPool.Reserve(projectID, port); err != nil {
					log.Printf("Warning: failed to reserve recovered port %d for project %s: %v", port, projectID, err)
				}
			}
		}
	}

	return nil
}

// extractProjectID extracts project ID from container name
func extractProjectID(name string) string {
	name = trimContainerPrefix(name)
	// format: yistack_{project_id} or historical yistack-{project_id}
	if len(name) > 8 && name[:8] == "yistack_" {
		return name[8:]
	}
	if len(name) > 8 && name[:8] == "yistack-" {
		return name[8:]
	}
	return ""
}

// trimContainerPrefix 去除容器名前缀斜杠
func trimContainerPrefix(name string) string {
	if len(name) > 0 && name[0] == '/' {
		return name[1:]
	}
	return name
}

// containerName 生成容器名称
func containerName(projectID string) string {
	return fmt.Sprintf("yistack_%s", projectID)
}

// imageForProjectType 获取项目类型对应的镜像
func imageForProjectType(projectType ProjectType) string {
	return DefaultWorkspaceImage
}

// CreateProject 创建项目容器
func (m *Manager) CreateProject(ctx context.Context, config *ProjectConfig) (*ContainerInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 检查项目是否已存在
	if info, exists := m.containers[config.ProjectID]; exists {
		return info, nil
	}

	internalPort := config.Port
	if internalPort <= 0 {
		internalPort = 3000
	}

	// 创建项目目录
	projectPath := filepath.Join(m.cfg.ProjectDir, config.ProjectID)
	if err := os.MkdirAll(projectPath, 0755); err != nil {
		return nil, errors.Wrap(err, "create project dir")
	}

	// 初始化 Git 仓库
	if err := initGitRepo(projectPath); err != nil {
		fmt.Printf("Warning: failed to init git repo: %v\n", err)
	}

	// 获取镜像
	image := imageForProjectType(config.ProjectType)

	if err := m.ensureImageAvailable(ctx, image); err != nil {
		return nil, err
	}

	// 创建容器
	name := containerName(config.ProjectID)
	opts := CreateOptions{
		Name:          name,
		Image:         image,
		Port:          0,
		ContainerPort: internalPort,
		VolumePath:    projectPath,
		WorkDir:       "/workspace",
		Cmd:           []string{"/bin/sh", "-c", "trap : TERM INT; while true; do sleep 3600; done"},
		Memory:        m.cfg.DefaultMemory,
		CPU:           m.cfg.DefaultCPU,
		Binds:         []string{fmt.Sprintf("%s:/workspace", projectPath)},
		Labels: map[string]string{
			"yistack.project_id": config.ProjectID,
			"yistack.user_id":    config.UserID,
			"yistack.type":       string(config.ProjectType),
		},
	}

	containerID, err := m.createContainerWithImagePull(ctx, opts)
	if err != nil {
		return nil, errors.Wrap(err, "create container")
	}

	info := &ContainerInfo{
		ProjectID:    config.ProjectID,
		ContainerID:  containerID,
		Name:         name,
		Image:        image,
		Port:         internalPort,
		Status:       ContainerStatusPending,
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	}

	m.containers[config.ProjectID] = info

	return info, nil
}

func (m *Manager) ResolveProjectEndpoint(ctx context.Context, projectID string, internalPort int) (*ProjectEndpoint, error) {
	if strings.TrimSpace(projectID) == "" {
		return nil, errors.New("project id is required")
	}
	if internalPort <= 0 {
		internalPort = 3000
	}

	var containerID string
	if info, exists := m.GetProject(projectID); exists && strings.TrimSpace(info.ContainerID) != "" {
		containerID = strings.TrimSpace(info.ContainerID)
	}
	if containerID == "" {
		synced, exists, err := m.SyncProject(ctx, projectID)
		if err != nil {
			return nil, errors.Wrap(err, "sync project")
		}
		if !exists || synced == nil || strings.TrimSpace(synced.ContainerID) == "" {
			return nil, errors.Errorf("project %s container not found", projectID)
		}
		containerID = strings.TrimSpace(synced.ContainerID)
	}
	if info, exists := m.GetProject(projectID); exists && info != nil && info.Port > 0 {
		return &ProjectEndpoint{
			ProjectID:    projectID,
			ContainerID:  containerID,
			Address:      "127.0.0.1",
			InternalPort: info.Port,
			HostPort:     info.Port,
		}, nil
	}

	inspect, err := m.podman.InspectContainer(ctx, containerID)
	if err != nil {
		return nil, errors.Wrap(err, "inspect project container")
	}
	if inspect == nil {
		return nil, errors.Errorf("project %s container not found", projectID)
	}
	if !inspect.State.Running {
		return nil, errors.Errorf("project %s container is not running", projectID)
	}

	if inspectedInfo, ok := buildProjectInfoFromInspect(projectID, inspect); ok && inspectedInfo != nil && inspectedInfo.Port > 0 {
		m.mu.Lock()
		m.containers[projectID] = m.mergeKnownProjectPort(projectID, inspectedInfo)
		m.mu.Unlock()
		return &ProjectEndpoint{
			ProjectID:    projectID,
			ContainerID:  containerID,
			Address:      "127.0.0.1",
			InternalPort: inspectedInfo.Port,
			HostPort:     inspectedInfo.Port,
		}, nil
	}

	address := ""
	for _, network := range inspect.NetworkSettings.Networks {
		if strings.TrimSpace(network.IPAddress) != "" {
			address = strings.TrimSpace(network.IPAddress)
			break
		}
	}
	if address == "" {
		return nil, errors.Errorf("project %s container address not found", projectID)
	}

	return &ProjectEndpoint{
		ProjectID:    projectID,
		ContainerID:  containerID,
		Address:      address,
		InternalPort: internalPort,
	}, nil
}

// StartProject 启动项目容器
func (m *Manager) StartProject(ctx context.Context, projectID string) (*ContainerInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	info, exists := m.containers[projectID]
	if !exists {
		return nil, errors.Errorf("project %s not found", projectID)
	}

	if info.Status == ContainerStatusRunning {
		return info, nil
	}

	info.Status = ContainerStatusStarting
	if err := m.podman.StartContainer(ctx, info.ContainerID); err != nil {
		info.Status = ContainerStatusError
		return nil, errors.Wrap(err, "start container")
	}

	started := time.Now()
	info.StartedAt = &started
	info.Status = ContainerStatusRunning
	info.LastActiveAt = started

	return info, nil
}

// StopProject 停止项目容器
func (m *Manager) StopProject(ctx context.Context, projectID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	info, exists := m.containers[projectID]
	containerIDs, err := m.findProjectContainerIDs(ctx, projectID)
	if err != nil {
		return errors.Wrap(err, "find project containers")
	}
	if len(containerIDs) == 0 {
		return nil
	}

	if exists {
		info.Status = ContainerStatusStopping
	}
	for _, containerID := range containerIDs {
		if err := m.podman.StopContainer(ctx, containerID, 10); err != nil {
			if exists && info.ContainerID == containerID {
				info.Status = ContainerStatusError
			}
			return errors.Wrapf(err, "stop container %s", containerID)
		}
	}

	if exists {
		info.Status = ContainerStatusStopped
	}
	return nil
}

// DeleteProject 删除项目容器
func (m *Manager) DeleteProject(ctx context.Context, projectID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	info, exists := m.containers[projectID]
	if !exists {
		// 项目不存在，尝试清理资源
		m.portPool.Release(projectID)
		projectPath := filepath.Join(m.cfg.ProjectDir, projectID)
		os.RemoveAll(projectPath)
		return nil
	}

	// 停止容器
	m.podman.StopContainer(ctx, info.ContainerID, 5)

	// 删除容器
	if err := m.podman.RemoveContainer(ctx, info.ContainerID, true); err != nil {
		return errors.Wrap(err, "remove container")
	}

	// 释放端口
	m.portPool.Release(projectID)

	// 删除项目目录
	projectPath := filepath.Join(m.cfg.ProjectDir, projectID)
	os.RemoveAll(projectPath)

	// 从内存中移除
	delete(m.containers, projectID)

	return nil
}

// GetProject 获取项目容器信息
func (m *Manager) GetProject(projectID string) (*ContainerInfo, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	info, exists := m.containers[projectID]
	if !exists {
		return nil, false
	}

	// return a copy
	copy := *info
	return &copy, true
}

// SyncProject 从 Podman 实时同步项目容器状态。
// 内存状态只作为缓存，页面和数据库展示前应以 Podman 当前状态为准。
func (m *Manager) SyncProject(ctx context.Context, projectID string) (*ContainerInfo, bool, error) {
	containers, err := m.podman.ListContainers(ctx, true)
	if err != nil {
		if fallback, exists, inspectErr := m.inspectProjectContainerByName(ctx, projectID); inspectErr == nil && exists && fallback != nil {
			return fallback, true, nil
		}
		return nil, false, err
	}
	info, exists := buildProjectInfoFromContainers(projectID, containers)
	if !exists || info == nil {
		if fallback, exists, inspectErr := m.inspectProjectContainerByName(ctx, projectID); inspectErr == nil && exists && fallback != nil {
			fallback = m.mergeKnownProjectPort(projectID, fallback)
			return fallback, true, nil
		}
		m.mu.Lock()
		delete(m.containers, projectID)
		m.mu.Unlock()
		return nil, false, nil
	}
	info = m.mergeKnownProjectPort(projectID, info)

	m.mu.Lock()
	m.containers[projectID] = info
	m.mu.Unlock()

	copy := *info
	return &copy, true, nil
}

func (m *Manager) mergeKnownProjectPort(projectID string, info *ContainerInfo) *ContainerInfo {
	if m == nil || info == nil || info.Port > 0 {
		return info
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	if existing, ok := m.containers[projectID]; ok && existing != nil && existing.Port > 0 {
		cloned := *info
		cloned.Port = existing.Port
		return &cloned
	}
	return info
}

// SyncProjects 从 Podman 批量同步多个项目容器状态，避免重复请求容器运行时。
func (m *Manager) SyncProjects(ctx context.Context, projectIDs []string) (map[string]*ContainerInfo, error) {
	result := make(map[string]*ContainerInfo, len(projectIDs))
	if len(projectIDs) == 0 {
		return result, nil
	}

	containers, err := m.podman.ListContainers(ctx, true)
	if err != nil {
		return nil, err
	}

	for _, projectID := range projectIDs {
		if info, exists := buildProjectInfoFromContainers(projectID, containers); exists && info != nil {
			m.mu.Lock()
			m.containers[projectID] = info
			m.mu.Unlock()

			result[projectID] = info
			continue
		}
		m.mu.Lock()
		delete(m.containers, projectID)
		m.mu.Unlock()
	}
	return result, nil
}

// InspectProject 直接从 Podman 读取项目容器状态，不依赖内部缓存锁。
func (m *Manager) InspectProject(ctx context.Context, projectID string) (*ContainerInfo, bool, error) {
	containers, err := m.podman.ListContainers(ctx, true)
	if err != nil {
		return nil, false, err
	}
	info, exists := buildProjectInfoFromContainers(projectID, containers)
	if !exists || info == nil {
		return nil, false, nil
	}
	copy := *info
	return &copy, true, nil
}

func buildProjectInfoFromContainers(projectID string, containers []ContainerResponse) (*ContainerInfo, bool) {
	for _, c := range containers {
		if !matchesProjectContainer(c, projectID) {
			continue
		}

		containerDisplayName := ""
		for _, name := range c.Names {
			normalized := trimContainerPrefix(name)
			if containerDisplayName == "" {
				containerDisplayName = normalized
			}
		}

		port := 0
		for _, p := range c.Ports {
			if p.HostPort != "" {
				fmt.Sscanf(p.HostPort, "%d", &port)
				break
			}
		}

		status := ContainerStatusStopped
		switch strings.ToLower(c.State) {
		case "running":
			status = ContainerStatusRunning
		case "created", "configured", "initialized":
			status = ContainerStatusPending
		case "paused":
			status = ContainerStatusStopped
		case "exited", "stopped":
			status = ContainerStatusStopped
		default:
			if c.State != "" {
				status = ContainerStatus(c.State)
			}
		}

		info := &ContainerInfo{
			ProjectID:    projectID,
			ContainerID:  c.Id,
			Name:         containerDisplayName,
			Image:        c.Image,
			Port:         port,
			Status:       status,
			LastActiveAt: time.Now(),
		}

		return info, true
	}

	return nil, false
}

func buildProjectInfoFromInspect(projectID string, inspect *ContainerInspectResponse) (*ContainerInfo, bool) {
	if inspect == nil {
		return nil, false
	}

	labelProjectID := ""
	if inspect.Config.Labels != nil {
		labelProjectID = strings.TrimSpace(inspect.Config.Labels["yistack.project_id"])
	}
	name := trimContainerPrefix(inspect.Name)
	if labelProjectID != projectID && name != containerName(projectID) && name != "yistack-"+projectID {
		return nil, false
	}

	status := ContainerStatusStopped
	switch strings.ToLower(strings.TrimSpace(inspect.State.Status)) {
	case "running":
		status = ContainerStatusRunning
	case "created", "configured", "initialized":
		status = ContainerStatusPending
	case "paused":
		status = ContainerStatusStopped
	case "exited", "stopped":
		status = ContainerStatusStopped
	default:
		if strings.TrimSpace(inspect.State.Status) != "" {
			status = ContainerStatus(inspect.State.Status)
		}
	}

	port := 0
	for _, bindings := range inspect.NetworkSettings.Ports {
		if len(bindings) == 0 {
			continue
		}
		if _, err := fmt.Sscanf(bindings[0].HostPort, "%d", &port); err == nil && port > 0 {
			break
		}
	}
	if port == 0 {
		for _, bindings := range inspect.HostConfig.PortBindings {
			if len(bindings) == 0 {
				continue
			}
			if _, err := fmt.Sscanf(bindings[0].HostPort, "%d", &port); err == nil && port > 0 {
				break
			}
		}
	}

	info := &ContainerInfo{
		ProjectID:    projectID,
		ContainerID:  inspect.Id,
		Name:         name,
		Image:        strings.TrimSpace(inspect.ImageName),
		Port:         port,
		Status:       status,
		LastActiveAt: time.Now(),
	}
	if info.Image == "" {
		info.Image = strings.TrimSpace(inspect.Image)
	}
	return info, true
}

func isContainerInspectNotFound(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "no such container") ||
		strings.Contains(message, "not found") ||
		strings.Contains(message, "status 404")
}

func (m *Manager) inspectProjectContainerByName(ctx context.Context, projectID string) (*ContainerInfo, bool, error) {
	candidates := []string{
		containerName(projectID),
		"yistack-" + projectID,
	}
	for _, candidate := range candidates {
		inspect, err := m.podman.InspectContainer(ctx, candidate)
		if err != nil {
			if isContainerInspectNotFound(err) {
				continue
			}
			return nil, false, err
		}
		info, exists := buildProjectInfoFromInspect(projectID, inspect)
		if !exists || info == nil {
			continue
		}
		m.mu.Lock()
		m.containers[projectID] = info
		m.mu.Unlock()
		copy := *info
		return &copy, true, nil
	}
	return nil, false, nil
}

// ListProjects 列出所有项目
func (m *Manager) ListProjects() []*ContainerInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]*ContainerInfo, 0, len(m.containers))
	for _, info := range m.containers {
		copy := *info
		infos = append(infos, &copy)
	}
	return infos
}

// MarkProjectActive 标记项目容器仍在使用。
func (m *Manager) MarkProjectActive(projectID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if info, exists := m.containers[projectID]; exists {
		info.LastActiveAt = time.Now()
	}
}

// StartIdleReaper 启动后端空闲容器回收循环。
func (m *Manager) StartIdleReaper(ctx context.Context, interval time.Duration, shouldStop IdleStopPredicate, callback IdleStopCallback) {
	if m == nil || m.cfg == nil || m.cfg.IdleTimeout <= 0 {
		return
	}
	if interval <= 0 {
		interval = time.Minute
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				m.stopIdleContainers(ctx, now, shouldStop, callback)
			}
		}
	}()
}

func (m *Manager) stopIdleContainers(ctx context.Context, now time.Time, shouldStop IdleStopPredicate, callback IdleStopCallback) {
	timeout := m.cfg.IdleTimeout
	if timeout <= 0 {
		return
	}

	m.mu.RLock()
	idleCandidates := make([]*ContainerInfo, 0)
	for _, info := range m.containers {
		if info.Status != ContainerStatusRunning {
			continue
		}
		lastActiveAt := info.LastActiveAt
		if lastActiveAt.IsZero() {
			lastActiveAt = info.CreatedAt
		}
		if lastActiveAt.IsZero() {
			lastActiveAt = now
		}
		if now.Sub(lastActiveAt) < timeout {
			continue
		}
		copy := *info
		idleCandidates = append(idleCandidates, &copy)
	}
	m.mu.RUnlock()

	candidates := make([]*ContainerInfo, 0, len(idleCandidates))
	for _, info := range idleCandidates {
		if shouldStop != nil && !shouldStop(info.ProjectID, info) {
			continue
		}

		m.mu.RLock()
		current, exists := m.containers[info.ProjectID]
		stillIdle := exists &&
			current.ContainerID == info.ContainerID &&
			current.Status == ContainerStatusRunning
		if stillIdle {
			lastActiveAt := current.LastActiveAt
			if lastActiveAt.IsZero() {
				lastActiveAt = current.CreatedAt
			}
			stillIdle = !lastActiveAt.IsZero() &&
				now.Sub(lastActiveAt) >= timeout
		}
		m.mu.RUnlock()
		if stillIdle {
			candidates = append(candidates, info)
		}
	}

	for _, info := range candidates {
		err := m.StopProject(ctx, info.ProjectID)
		m.mu.Lock()
		if current, exists := m.containers[info.ProjectID]; exists && current.ContainerID == info.ContainerID {
			if err != nil {
				current.Status = ContainerStatusError
			} else {
				current.Status = ContainerStatusStopped
			}
		}
		m.mu.Unlock()

		if callback != nil {
			callback(info.ProjectID, info, err)
		}
	}
}

// RunCommand 在容器中执行命令
func (m *Manager) RunCommand(ctx context.Context, projectID string, opts RunOptions) (*ExecResult, error) {
	m.mu.Lock()
	info, exists := m.containers[projectID]
	if exists {
		info.LastActiveAt = time.Now()
	}
	m.mu.Unlock()

	if !exists || info == nil || strings.TrimSpace(info.ContainerID) == "" || info.Status != ContainerStatusRunning {
		synced, syncedExists, err := m.SyncProject(ctx, projectID)
		if err != nil {
			log.Printf("[container-run] project=%s sync-before-run failed: %v", projectID, err)
			return nil, errors.Wrap(err, "sync project before run command")
		}
		if !syncedExists || synced == nil || strings.TrimSpace(synced.ContainerID) == "" {
			containerSummary := ""
			if containers, listErr := m.podman.ListContainers(ctx, true); listErr == nil {
				parts := make([]string, 0, len(containers))
				for _, c := range containers {
					labelProjectID := ""
					if c.Labels != nil {
						labelProjectID = c.Labels["yistack.project_id"]
					}
					parts = append(parts, fmt.Sprintf("id=%s names=%v state=%s labelProjectID=%s", c.Id, c.Names, c.State, labelProjectID))
				}
				containerSummary = strings.Join(parts, " | ")
			}
			log.Printf("[container-run] project=%s not found before run command; cachedExists=%t cachedInfoNil=%t syncedExists=%t summary=%s", projectID, exists, info == nil, syncedExists, containerSummary)
			return nil, errors.Errorf("project %s not found", projectID)
		}
		info = synced
		if info.Status != ContainerStatusRunning {
			log.Printf("[container-run] project=%s is not running before run command; containerID=%s status=%s", projectID, info.ContainerID, info.Status)
			return nil, errors.Errorf("project %s is not running", projectID)
		}
	}
	runOpts := RunOptions{
		ProjectID: projectID,
		Command:   opts.Command,
		Args:      opts.Args,
		Env:       opts.Env,
		WorkDir:   opts.WorkDir,
		Timeout:   opts.Timeout,
	}
	if runOpts.Timeout == 0 {
		runOpts.Timeout = 300
	}
	if runOpts.WorkDir == "" {
		runOpts.WorkDir = "/workspace"
	}

	result, err := m.podman.ExecRun(ctx, info.ContainerID, runOpts)
	m.MarkProjectActive(projectID)
	return result, err
}

func (m *Manager) RunCommandArgs(ctx context.Context, projectID string, args []string, workDir string, timeout int) (*ExecResult, error) {
	return m.RunCommand(ctx, projectID, RunOptions{
		ProjectID: projectID,
		Args:      args,
		WorkDir:   workDir,
		Timeout:   timeout,
	})
}

func (m *Manager) CopyFromContainer(ctx context.Context, projectID string, containerPath string) ([]byte, error) {
	info, err := m.runningContainerInfo(ctx, projectID, "copy from container")
	if err != nil {
		return nil, err
	}
	archive, err := m.podman.CopyFromContainer(ctx, info.ContainerID, containerPath)
	m.MarkProjectActive(projectID)
	return archive, err
}

func (m *Manager) CopyToContainer(ctx context.Context, projectID string, containerPath string, archive []byte) error {
	info, err := m.runningContainerInfo(ctx, projectID, "copy to container")
	if err != nil {
		return err
	}
	err = m.podman.CopyToContainer(ctx, info.ContainerID, containerPath, archive)
	m.MarkProjectActive(projectID)
	return err
}

func (m *Manager) runningContainerInfo(ctx context.Context, projectID string, operation string) (*ContainerInfo, error) {
	m.mu.Lock()
	info, exists := m.containers[projectID]
	if exists {
		info.LastActiveAt = time.Now()
	}
	m.mu.Unlock()

	if !exists || info == nil || strings.TrimSpace(info.ContainerID) == "" || info.Status != ContainerStatusRunning {
		synced, syncedExists, err := m.SyncProject(ctx, projectID)
		if err != nil {
			return nil, errors.Wrapf(err, "sync project before %s", operation)
		}
		if !syncedExists || synced == nil || strings.TrimSpace(synced.ContainerID) == "" {
			return nil, errors.Errorf("project %s not found", projectID)
		}
		info = synced
		if info.Status != ContainerStatusRunning {
			return nil, errors.Errorf("project %s is not running", projectID)
		}
	}

	return info, nil
}

// GetProjectStats 获取项目资源使用统计
func (m *Manager) GetProjectStats(ctx context.Context, projectID string) (*ContainerStats, error) {
	m.mu.RLock()
	_, exists := m.containers[projectID]
	m.mu.RUnlock()

	if !exists {
		return nil, errors.Errorf("project %s not found", projectID)
	}

	// simplified implementation, return basic stats
	return &ContainerStats{
		ProjectID: projectID,
		ReadTime:  time.Now(),
	}, nil
}

// GetPortPoolStats 获取端口池统计
func (m *Manager) GetPortPoolStats() *PortPoolStats {
	return m.portPool.GetStats()
}

// initGitRepo 初始化 Git 仓库
func initGitRepo(path string) error {
	gitDir := filepath.Join(path, ".git")
	if _, err := os.Stat(gitDir); err == nil {
		// 已经是 Git 仓库
		return nil
	}

	// 创建 .gitignore
	gitignore := `# Dependencies
node_modules/
__pycache__/
*.pyc
.env

# Build output
dist/
build/
.next/
.nuxt/

# IDE
.vscode/
.idea/

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db
`
	if err := os.WriteFile(filepath.Join(path, ".gitignore"), []byte(gitignore), 0644); err != nil {
		return err
	}

	if _, err := exec.LookPath("git"); err != nil {
		return err
	}
	if err := runGitCommand(path, "init"); err != nil {
		return err
	}
	if err := runGitCommand(path, "symbolic-ref", "HEAD", "refs/heads/main"); err != nil {
		return err
	}

	return nil
}

func runGitCommand(path string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = path
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git %s failed: %s: %w", strings.Join(args, " "), strings.TrimSpace(string(output)), err)
	}
	return nil
}

// HealthCheck 健康检查
func (m *Manager) HealthCheck(ctx context.Context) error {
	if err := m.podman.Ping(ctx); err != nil {
		return errors.Wrap(err, "podman health check")
	}
	return nil
}

// ============================================
// 桥接方法：供 service 层调用的简化接口
// ============================================

// AllocatePort 为项目分配端口
func (m *Manager) AllocatePort(ctx context.Context, projectID string) (int, error) {
	port, _, err := m.portPool.Allocate(projectID)
	return port, err
}

// ReleasePort 释放项目端口
func (m *Manager) ReleasePort(ctx context.Context, projectID string) {
	m.portPool.Release(projectID)
}

func projectNetworkName(projectID string) string {
	return fmt.Sprintf("yistack_%s_net", projectID)
}

// EnsureProjectNetwork 确保项目专属网络存在。
func (m *Manager) EnsureProjectNetwork(ctx context.Context, projectID string) (string, error) {
	name := projectNetworkName(projectID)
	err := m.podman.CreateNetwork(ctx, name, map[string]string{
		"yistack.project_id": projectID,
		"yistack.role":       "network",
	})
	if err != nil {
		return "", err
	}
	return name, nil
}

// CreateAndStartContainer 创建并启动容器
func (m *Manager) CreateAndStartContainer(ctx context.Context, opts *CreateOptions) (*ContainerInfo, error) {
	candidates := buildImageCandidates(opts.Image)
	var lastErr error

	for _, candidate := range candidates {
		localOpts := *opts
		localOpts.Image = candidate
		projectID := strings.TrimSpace(localOpts.Labels["yistack.project_id"])
		shouldExposePort := strings.TrimSpace(localOpts.Labels["yistack.role"]) == "main" && localOpts.ContainerPort > 0
		allocatedPort := 0
		if shouldExposePort && localOpts.Port <= 0 {
			port, _, err := m.portPool.Allocate(projectID)
			if err != nil {
				return nil, errors.Wrap(err, "allocate project port")
			}
			localOpts.Port = port
			allocatedPort = port
		}

		containerID, err := m.createContainerWithImagePull(ctx, localOpts)
		if err != nil {
			if allocatedPort > 0 {
				m.portPool.Release(projectID)
			}
			if recovered, recoverErr := m.recoverConflictingProjectContainer(ctx, &localOpts, err); recoverErr == nil && recovered != nil {
				return recovered, nil
			}
			lastErr = errors.Wrap(err, "create container")
			if isImageResolutionError(err) {
				continue
			}
			return nil, lastErr
		}

		if err := m.podman.StartContainer(ctx, containerID); err != nil {
			m.podman.RemoveContainer(ctx, containerID, true)
			if allocatedPort > 0 {
				m.portPool.Release(projectID)
			}
			return nil, errors.Wrap(err, "start container")
		}

		now := time.Now()
		info := &ContainerInfo{
			ProjectID:    projectID,
			ContainerID:  containerID,
			Name:         opts.Name,
			Image:        candidate,
			Port:         localOpts.Port,
			Status:       ContainerStatusRunning,
			CreatedAt:    now,
			StartedAt:    &now,
			LastActiveAt: now,
		}

		if projectID != "" {
			m.mu.Lock()
			m.containers[projectID] = info
			m.mu.Unlock()
		}

		return info, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("no image candidate available")
}

func (m *Manager) recoverConflictingProjectContainer(ctx context.Context, opts *CreateOptions, createErr error) (*ContainerInfo, error) {
	if m == nil || opts == nil || createErr == nil || !isContainerNameConflictError(createErr) {
		return nil, createErr
	}

	projectID := ""
	if opts.Labels != nil {
		projectID = strings.TrimSpace(opts.Labels["yistack.project_id"])
	}
	if projectID == "" {
		return nil, createErr
	}

	info, exists, err := m.SyncProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !exists || info == nil || strings.TrimSpace(info.ContainerID) == "" {
		return nil, createErr
	}

	if info.Status != ContainerStatusRunning {
		if err := m.podman.StartContainer(ctx, info.ContainerID); err != nil {
			return nil, errors.Wrap(err, "start recovered container")
		}
		info, exists, err = m.SyncProject(ctx, projectID)
		if err != nil {
			return nil, err
		}
		if !exists || info == nil {
			return nil, createErr
		}
	}

	m.MarkProjectActive(projectID)
	return info, nil
}

func isContainerNameConflictError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "already exists") || strings.Contains(message, "name is already in use")
}

// EnsureDependencyContainer 确保项目依赖服务容器存在并运行。
func (m *Manager) EnsureDependencyContainer(ctx context.Context, projectID string, opts *CreateOptions) error {
	if opts == nil {
		return errors.New("container options is required")
	}
	if strings.TrimSpace(opts.Name) == "" {
		return errors.New("container name is required")
	}
	if strings.TrimSpace(opts.Image) == "" {
		return errors.New("container image is required")
	}

	containers, err := m.podman.ListContainers(ctx, true)
	if err != nil {
		return err
	}
	for _, existing := range containers {
		for _, name := range existing.Names {
			if trimContainerPrefix(name) != opts.Name {
				continue
			}
			if strings.EqualFold(existing.State, "running") {
				return nil
			}
			return m.podman.StartContainer(ctx, existing.Id)
		}
	}

	candidates := buildImageCandidates(opts.Image)
	var lastErr error
	for _, candidate := range candidates {
		localOpts := *opts
		localOpts.Image = candidate

		containerID, err := m.createContainerWithImagePull(ctx, localOpts)
		if err != nil {
			lastErr = errors.Wrap(err, "create dependency container")
			if isImageResolutionError(err) {
				continue
			}
			return lastErr
		}
		if err := m.podman.StartContainer(ctx, containerID); err != nil {
			_ = m.podman.RemoveContainer(ctx, containerID, true)
			return errors.Wrap(err, "start dependency container")
		}
		return nil
	}

	if lastErr != nil {
		return lastErr
	}
	return errors.New("no image candidate available")
}

func (m *Manager) ensureImageAvailable(ctx context.Context, image string) error {
	exists, err := m.podman.ImageExists(ctx, image)
	if err != nil {
		return errors.Wrap(err, "check image exists")
	}
	if exists {
		return nil
	}
	if err := m.podman.PullImage(ctx, image, ""); err != nil {
		return errors.Wrap(err, "pull image")
	}
	return nil
}

func (m *Manager) createContainerWithImagePull(ctx context.Context, opts CreateOptions) (string, error) {
	if err := m.ensureImageAvailable(ctx, opts.Image); err != nil {
		return "", err
	}

	containerID, err := m.podman.CreateContainer(ctx, opts)
	if err == nil {
		return containerID, nil
	}
	if !isImageResolutionError(err) {
		return "", err
	}

	// Podman may report an image-resolution failure from create even after
	// ImageExists returned success. Pull once and retry so the start path is
	// self-healing when the local image cache is stale or incomplete.
	if pullErr := m.podman.PullImage(ctx, opts.Image, ""); pullErr != nil {
		return "", errors.Wrap(pullErr, "pull image after create image resolution failure")
	}

	return m.podman.CreateContainer(ctx, opts)
}

func buildImageCandidates(image string) []string {
	trimmed := strings.TrimSpace(image)
	if trimmed == "" {
		return nil
	}

	seen := make(map[string]struct{})
	candidates := make([]string, 0, 3)
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		candidates = append(candidates, value)
	}

	normalizeDockerHubImage := func(value string) string {
		if value == "" {
			return value
		}
		if strings.Contains(value, "://") {
			return value
		}
		firstSegment := value
		if idx := strings.IndexRune(value, '/'); idx >= 0 {
			firstSegment = value[:idx]
		}
		if strings.Contains(firstSegment, ".") || strings.Contains(firstSegment, ":") || firstSegment == "localhost" {
			return value
		}
		if !strings.Contains(value, "/") {
			return "docker.io/library/" + value
		}
		return "docker.io/" + value
	}

	if strings.HasPrefix(trimmed, "docker.m.daocloud.io/") {
		remainder := strings.TrimPrefix(trimmed, "docker.m.daocloud.io/")
		add("docker.io/" + remainder)
		return candidates
	}

	normalized := normalizeDockerHubImage(trimmed)
	add(normalized)
	if normalized == trimmed {
		add(trimmed)
	}

	if strings.HasPrefix(trimmed, "docker.io/") {
		return candidates
	}

	if strings.HasPrefix(trimmed, "docker.io/library/") || strings.HasPrefix(trimmed, "docker.io/") {
		return candidates
	}

	return candidates
}

func isImageResolutionError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "image not known") ||
		strings.Contains(message, "no such image") ||
		strings.Contains(message, "manifest unknown") ||
		strings.Contains(message, "not found")
}

// StopContainer 停止项目容器（StopProject 的别名）
func (m *Manager) StopContainer(ctx context.Context, projectID string) error {
	return m.StopProject(ctx, projectID)
}

// RemoveContainer 删除项目容器（DeleteProject 的别名，但不删除目录）
func (m *Manager) RemoveContainer(ctx context.Context, projectID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	containerIDs, err := m.findProjectContainerIDs(ctx, projectID)
	if err != nil {
		return errors.Wrap(err, "find project containers")
	}

	for _, containerID := range containerIDs {
		if err := m.podman.RemoveContainer(ctx, containerID, true); err != nil {
			return errors.Wrapf(err, "remove container %s", containerID)
		}
	}
	if err := m.podman.RemoveNetwork(ctx, projectNetworkName(projectID)); err != nil {
		log.Printf("Warning: failed to remove network for project %s: %v", projectID, err)
	}

	// 释放端口
	m.portPool.Release(projectID)

	// 从内存中移除
	delete(m.containers, projectID)

	return nil
}

func (m *Manager) findProjectContainerIDs(ctx context.Context, projectID string) ([]string, error) {
	seen := make(map[string]struct{})
	containerIDs := make([]string, 0, 2)
	add := func(id string) {
		id = strings.TrimSpace(id)
		if id == "" {
			return
		}
		if _, exists := seen[id]; exists {
			return
		}
		seen[id] = struct{}{}
		containerIDs = append(containerIDs, id)
	}

	if info, exists := m.containers[projectID]; exists {
		add(info.ContainerID)
	}

	containers, err := m.podman.ListContainers(ctx, true)
	if err != nil {
		return containerIDs, err
	}

	for _, candidate := range containers {
		if matchesProjectContainer(candidate, projectID) {
			add(candidate.Id)
		}
	}

	return containerIDs, nil
}

func matchesProjectContainer(candidate ContainerResponse, projectID string) bool {
	if candidate.Labels != nil && candidate.Labels["yistack.project_id"] == projectID {
		return true
	}

	expectedNames := map[string]struct{}{
		containerName(projectID): {},
		"yistack-" + projectID:   {},
	}
	for _, name := range candidate.Names {
		normalized := trimContainerPrefix(name)
		if _, exists := expectedNames[normalized]; exists {
			return true
		}
	}

	return false
}

// ExecuteInContainer 在容器中执行命令（RunCommand 的别名）
func (m *Manager) ExecuteInContainer(ctx context.Context, opts *RunOptions) (*ExecResult, error) {
	projectID := opts.ProjectID
	return m.RunCommand(ctx, projectID, *opts)
}

// PreheatImages 预热镜像。
// 预热列表来自运行时配置中的可用镜像，而不是硬编码单一基础镜像。
func (m *Manager) PreheatImages(ctx context.Context) error {
	images := m.cfg.PreheatImages
	if len(images) == 0 {
		return nil
	}

	for _, image := range images {
		// 检查镜像是否存在
		exists, err := m.podman.ImageExists(ctx, image)
		if err != nil {
			log.Printf("Failed to check image %s: %v", image, err)
			continue
		}

		if !exists {
			// 拉取镜像
			log.Printf("Pulling image: %s", image)
			if err := m.podman.PullImage(ctx, image, ""); err != nil {
				log.Printf("Failed to pull image %s: %v", image, err)
				continue
			}
		}
	}

	return nil
}
