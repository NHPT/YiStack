package container

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
)

// PodmanSocket Podman Unix Socket 地址
const PodmanSocket = "http://d/v4.0.0"
const podmanCompatVersionPrefix = "/v1.40"
const podmanExecControlTimeout = 5 * time.Minute

// PodmanClient Podman API 客户端
type PodmanClient struct {
	socketPath string
	baseURL    string
	client     *http.Client
}

// PodmanResponse Podman API 响应
type PodmanResponse struct {
	Containers []ContainerResponse `json:"Containers"`
}

// ContainerResponse Podman 容器响应
type ContainerResponse struct {
	Id      string            `json:"Id"`
	Names   []string          `json:"Names"`
	Image   string            `json:"Image"`
	ImageID string            `json:"ImageID"`
	Command string            `json:"Command"`
	Created int64             `json:"Created"`
	State   string            `json:"State"`
	Status  string            `json:"Status"`
	Ports   []PortMapping     `json:"Ports"`
	Labels  map[string]string `json:"Labels"`
}

// PortMapping 端口映射
type PortMapping struct {
	HostIP        string `json:"HostIP"`
	HostPort      string `json:"HostPort"`
	ContainerPort string `json:"ContainerPort"`
	Protocol      string `json:"Protocol"`
}

// ContainerInspectResponse 容器详细信息响应
type ContainerInspectResponse struct {
	Id              string          `json:"Id"`
	Name            string          `json:"Name"`
	Image           string          `json:"Image"`
	ImageName       string          `json:"ImageName"`
	Created         string          `json:"Created"`
	State           ContainerState  `json:"State"`
	Config          ContainerConfig `json:"Config"`
	HostConfig      HostConfig      `json:"HostConfig"`
	NetworkSettings NetworkSettings `json:"NetworkSettings"`
}

// ContainerState 容器状态
type ContainerState struct {
	Status     string `json:"Status"`
	Running    bool   `json:"Running"`
	Paused     bool   `json:"Paused"`
	Restarting bool   `json:"Restarting"`
	OOMKilled  bool   `json:"OOMKilled"`
	Dead       bool   `json:"Dead"`
	Pid        int    `json:"Pid"`
	ExitCode   int    `json:"ExitCode"`
	Error      string `json:"Error"`
	StartedAt  string `json:"StartedAt"`
	FinishedAt string `json:"FinishedAt"`
}

// ContainerConfig 容器配置
type ContainerConfig struct {
	Hostname   string            `json:"Hostname"`
	Env        []string          `json:"Env"`
	Cmd        []string          `json:"Cmd"`
	Image      string            `json:"Image"`
	WorkingDir string            `json:"WorkingDir"`
	Labels     map[string]string `json:"Labels"`
}

// HostConfig 主机配置
type HostConfig struct {
	Memory       int64                    `json:"Memory"`
	NanoCpus     int64                    `json:"NanoCpus"`
	PortBindings map[string][]PortBinding `json:"PortBindings"`
	Binds        []string                 `json:"Binds"`
	NetworkMode  string                   `json:"NetworkMode"`
}

// PortBinding 端口绑定
type PortBinding struct {
	HostIP   string `json:"HostIp"`
	HostPort string `json:"HostPort"`
}

// NetworkSettings 网络设置
type NetworkSettings struct {
	Ports    map[string][]PortBinding `json:"Ports"`
	Networks map[string]NetworkInfo   `json:"Networks"`
}

// NetworkInfo 网络信息
type NetworkInfo struct {
	IPAddress string `json:"IPAddress"`
}

// ExecCreateRequest 创建执行请求
type ExecCreateRequest struct {
	AttachStdin  bool     `json:"AttachStdin"`
	AttachStdout bool     `json:"AttachStdout"`
	AttachStderr bool     `json:"AttachStderr"`
	Tty          bool     `json:"Tty"`
	Cmd          []string `json:"Cmd"`
	Env          []string `json:"Env,omitempty"`
	WorkingDir   string   `json:"WorkingDir,omitempty"`
}

// ExecCreateResponse 创建执行响应
type ExecCreateResponse struct {
	Id string `json:"Id"`
}

// ExecStartRequest 开始执行请求
type ExecStartRequest struct {
	Detach bool `json:"Detach"`
	Tty    bool `json:"Tty"`
}

// ExecResizeRequest 调整大小请求
type ExecResizeRequest struct {
	Width  int `json:"Width"`
	Height int `json:"Height"`
}

// ExecInspectResponse 执行检查响应
type ExecInspectResponse struct {
	Running      bool   `json:"Running"`
	ExitCode     int    `json:"ExitCode"`
	ProcessAlive bool   `json:"ProcessAlive"`
	OpenStdin    bool   `json:"OpenStdin"`
	OpenStdout   bool   `json:"OpenStdout"`
	OpenStderr   bool   `json:"OpenStderr"`
	ContainerID  string `json:"ContainerID"`
	Pid          int    `json:"Pid"`
}

// StatsResponse 统计信息响应
type StatsResponse struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryUsage   int64   `json:"memory_usage"`
	MemoryLimit   int64   `json:"memory_limit"`
	NetworkRx     int64   `json:"network_rx"`
	NetworkTx     int64   `json:"network_tx"`
}

// SystemVersion 系统版本信息
type SystemVersion struct {
	Version    string `json:"Version"`
	APIVersion string `json:"ApiVersion"`
	OSType     string `json:"Os"`
	Arch       string `json:"Arch"`
}

// ImageListResponse 镜像列表响应
type ImageListResponse struct {
	Id      string   `json:"Id"`
	Names   []string `json:"Names"`
	Size    int64    `json:"Size"`
	Created int64    `json:"Created"`
}

// NewPodmanClient 创建 Podman 客户端
func NewPodmanClient(socketPath string) (*PodmanClient, error) {
	if socketPath == "" {
		// 尝试常见 socket 路径
		socketPath = fmt.Sprintf("/run/user/%d/podman/podman.sock", os.Getuid())
		if _, err := os.Stat(socketPath); os.IsNotExist(err) {
			socketPath = "/var/run/podman/podman.sock"
		}
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var dialer net.Dialer
			return dialer.DialContext(ctx, "unix", socketPath)
		},
	}

	pc := &PodmanClient{
		socketPath: socketPath,
		baseURL:    "http://d",
		client: &http.Client{
			Transport: transport,
		},
	}

	return pc, nil
}

// doRequest 发送 HTTP 请求到 Podman Socket
func (pc *PodmanClient) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, errors.Wrap(err, "marshal request body")
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, pc.baseURL+path, reqBody)
	if err != nil {
		return nil, errors.Wrap(err, "create request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	return pc.client.Do(req)
}

func (pc *PodmanClient) doRawRequest(ctx context.Context, method, path string, body io.Reader, contentType string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, pc.baseURL+path, body)
	if err != nil {
		return nil, errors.Wrap(err, "create request")
	}

	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	return pc.client.Do(req)
}

func readErrorDetail(resp *http.Response) string {
	if resp == nil || resp.Body == nil {
		return ""
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	detail := strings.TrimSpace(string(body))
	if detail == "" {
		return ""
	}

	if len(detail) > 400 {
		detail = detail[:400]
	}

	return detail
}

func truncateDetail(detail string) string {
	detail = strings.TrimSpace(detail)
	if len(detail) > 400 {
		return detail[:400]
	}
	return detail
}

func pullImageErrorDetail(body []byte) string {
	text := strings.TrimSpace(string(body))
	if text == "" {
		return ""
	}

	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var value interface{}
		if err := json.Unmarshal([]byte(line), &value); err != nil {
			continue
		}
		if detail := pullImageErrorFromValue(value); detail != "" {
			return truncateDetail(detail)
		}
	}

	var value interface{}
	if err := json.Unmarshal(body, &value); err == nil {
		if detail := pullImageErrorFromValue(value); detail != "" {
			return truncateDetail(detail)
		}
	}

	return ""
}

func pullImageErrorFromValue(value interface{}) string {
	switch typed := value.(type) {
	case []interface{}:
		for _, item := range typed {
			if detail := pullImageErrorFromValue(item); detail != "" {
				return detail
			}
		}
	case map[string]interface{}:
		if detail := stringMapValue(typed, "error"); detail != "" {
			return detail
		}
		if errorDetail, ok := typed["errorDetail"].(map[string]interface{}); ok {
			if detail := stringMapValue(errorDetail, "message"); detail != "" {
				return detail
			}
		}

		message := stringMapValue(typed, "message")
		cause := stringMapValue(typed, "cause")
		if numericMapValue(typed, "response") >= 400 {
			if message != "" && cause != "" && message != cause {
				return message + ": " + cause
			}
			if message != "" {
				return message
			}
			return cause
		}

		combined := strings.ToLower(message + " " + cause)
		if strings.Contains(combined, "image not known") ||
			strings.Contains(combined, "no such image") ||
			strings.Contains(combined, "manifest unknown") ||
			strings.Contains(combined, "not found") {
			if message != "" {
				return message
			}
			return cause
		}
	}
	return ""
}

func stringMapValue(values map[string]interface{}, key string) string {
	value, ok := values[key]
	if !ok {
		return ""
	}
	if text, ok := value.(string); ok {
		return strings.TrimSpace(text)
	}
	return ""
}

func numericMapValue(values map[string]interface{}, key string) float64 {
	value, ok := values[key]
	if !ok {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return typed
	case int:
		return float64(typed)
	default:
		return 0
	}
}

// Ping 检查 Podman 是否可用
func (pc *PodmanClient) Ping(ctx context.Context) error {
	resp, err := pc.doRequest(ctx, http.MethodGet, "/_ping", nil)
	if err != nil {
		return errors.Wrap(err, "ping podman")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("podman ping failed: status %d", resp.StatusCode)
	}
	return nil
}

// SystemVersion 获取系统版本
func (pc *PodmanClient) SystemVersion(ctx context.Context) (*SystemVersion, error) {
	resp, err := pc.doRequest(ctx, http.MethodGet, "/version", nil)
	if err != nil {
		return nil, errors.Wrap(err, "get system version")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get version failed: status %d", resp.StatusCode)
	}

	var version SystemVersion
	if err := json.NewDecoder(resp.Body).Decode(&version); err != nil {
		return nil, errors.Wrap(err, "decode version response")
	}

	return &version, nil
}

// ListContainers 列出所有容器
func (pc *PodmanClient) ListContainers(ctx context.Context, all bool) ([]ContainerResponse, error) {
	path := podmanCompatVersionPrefix + "/containers/json"
	if all {
		path += "?all=true"
	}

	resp, err := pc.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, errors.Wrap(err, "list containers")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list containers failed: status %d", resp.StatusCode)
	}

	var containers []ContainerResponse
	if err := json.NewDecoder(resp.Body).Decode(&containers); err != nil {
		return nil, errors.Wrap(err, "decode containers response")
	}

	return containers, nil
}

// ContainerExists 检查容器是否存在
func (pc *PodmanClient) ContainerExists(ctx context.Context, name string) (bool, error) {
	containers, err := pc.ListContainers(ctx, true)
	if err != nil {
		return false, err
	}

	for _, c := range containers {
		for _, n := range c.Names {
			if strings.TrimPrefix(n, "/") == name {
				return true, nil
			}
		}
	}

	return false, nil
}

// InspectContainer 获取容器详细信息
func (pc *PodmanClient) InspectContainer(ctx context.Context, id string) (*ContainerInspectResponse, error) {
	resp, err := pc.doRequest(ctx, http.MethodGet, fmt.Sprintf("%s/containers/%s/json", podmanCompatVersionPrefix, id), nil)
	if err != nil {
		return nil, errors.Wrap(err, "inspect container")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("inspect container failed: status %d", resp.StatusCode)
	}

	var info ContainerInspectResponse
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, errors.Wrap(err, "decode inspect response")
	}

	return &info, nil
}

// CreateNetwork 创建项目专属网络。
func (pc *PodmanClient) CreateNetwork(ctx context.Context, name string, labels map[string]string) error {
	req := map[string]interface{}{
		"Name":   name,
		"Labels": labels,
	}
	resp, err := pc.doRequest(ctx, http.MethodPost, podmanCompatVersionPrefix+"/networks/create", req)
	if err != nil {
		return errors.Wrap(err, "create network")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		return nil
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		detail := readErrorDetail(resp)
		if detail != "" {
			if isAlreadyExistsDetail(detail) {
				return nil
			}
			return fmt.Errorf("create network failed: status %d: %s", resp.StatusCode, detail)
		}
		return fmt.Errorf("create network failed: status %d", resp.StatusCode)
	}
	return nil
}

func isAlreadyExistsDetail(detail string) bool {
	detail = strings.ToLower(detail)
	return strings.Contains(detail, "already exists") ||
		strings.Contains(detail, "already used") ||
		strings.Contains(detail, "is already in use")
}

// RemoveNetwork 删除项目专属网络。
func (pc *PodmanClient) RemoveNetwork(ctx context.Context, name string) error {
	resp, err := pc.doRequest(ctx, http.MethodDelete, podmanCompatVersionPrefix+"/networks/"+url.PathEscape(name), nil)
	if err != nil {
		return errors.Wrap(err, "remove network")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		detail := readErrorDetail(resp)
		if detail != "" {
			return fmt.Errorf("remove network failed: status %d: %s", resp.StatusCode, detail)
		}
		return fmt.Errorf("remove network failed: status %d", resp.StatusCode)
	}
	return nil
}

// CreateContainer 创建容器
func (pc *PodmanClient) CreateContainer(ctx context.Context, opts CreateOptions) (string, error) {
	hostConfig := map[string]interface{}{}
	exposedPorts := map[string]map[string]string{}
	containerPort := opts.ContainerPort
	if containerPort == 0 {
		containerPort = 3000
	}
	if containerPort > 0 {
		portKey := fmt.Sprintf("%d/tcp", containerPort)
		exposedPorts[portKey] = map[string]string{}
		if opts.Port > 0 {
			hostConfig["PortBindings"] = map[string][]PortBinding{
				portKey: {{HostPort: fmt.Sprintf("%d", opts.Port)}},
			}
		}
	}

	if opts.Memory != "" {
		// 解析内存限制
		memory, err := parseMemory(opts.Memory)
		if err == nil {
			hostConfig["Memory"] = memory
		}
	}

	if opts.CPU > 0 {
		hostConfig["NanoCpus"] = int64(opts.CPU * 1e9)
	}

	binds := append([]string{}, opts.Binds...)
	if opts.VolumePath != "" {
		binds = append(binds, fmt.Sprintf("%s:%s", opts.VolumePath, opts.WorkDir))
	}
	if len(binds) > 0 {
		hostConfig["Binds"] = binds
	}
	if opts.Network != "" {
		hostConfig["NetworkMode"] = opts.Network
	}

	// 构建容器配置
	containerConfig := map[string]interface{}{
		"Image":      opts.Image,
		"HostConfig": hostConfig,
		"Labels":     opts.Labels,
	}
	if len(exposedPorts) > 0 {
		containerConfig["ExposedPorts"] = exposedPorts
	}

	if opts.WorkDir != "" {
		containerConfig["WorkingDir"] = opts.WorkDir
	}

	if len(opts.Env) > 0 {
		containerConfig["Env"] = opts.Env
	}

	if len(opts.Cmd) > 0 {
		containerConfig["Cmd"] = opts.Cmd
	}

	resp, err := pc.doRequest(ctx, http.MethodPost, podmanCompatVersionPrefix+"/containers/create?name="+url.QueryEscape(opts.Name), containerConfig)
	if err != nil {
		return "", errors.Wrap(err, "create container")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		return "", fmt.Errorf("container %s already exists", opts.Name)
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		detail := readErrorDetail(resp)
		if detail != "" {
			return "", fmt.Errorf("create container failed: status %d: %s", resp.StatusCode, detail)
		}
		return "", fmt.Errorf("create container failed: status %d", resp.StatusCode)
	}

	var result struct {
		Id string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", errors.Wrap(err, "decode create response")
	}

	return result.Id, nil
}

// StartContainer 启动容器
func (pc *PodmanClient) StartContainer(ctx context.Context, id string) error {
	resp, err := pc.doRequest(ctx, http.MethodPost, fmt.Sprintf("%s/containers/%s/start", podmanCompatVersionPrefix, id), nil)
	if err != nil {
		return errors.Wrap(err, "start container")
	}
	defer resp.Body.Close()

	// 204 = 成功, 304 = 已经运行中, 404 = 未找到
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotModified {
		detail := readErrorDetail(resp)
		if detail != "" {
			return fmt.Errorf("start container failed: status %d: %s", resp.StatusCode, detail)
		}
		return fmt.Errorf("start container failed: status %d", resp.StatusCode)
	}

	return nil
}

// StopContainer 停止容器
func (pc *PodmanClient) StopContainer(ctx context.Context, id string, timeout int) error {
	path := fmt.Sprintf("%s/containers/%s/stop", podmanCompatVersionPrefix, id)
	if timeout > 0 {
		path += fmt.Sprintf("?t=%d", timeout)
	}

	resp, err := pc.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return errors.Wrap(err, "stop container")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotModified {
		return fmt.Errorf("stop container failed: status %d", resp.StatusCode)
	}

	return nil
}

// RemoveContainer 删除容器
func (pc *PodmanClient) RemoveContainer(ctx context.Context, id string, force bool) error {
	path := fmt.Sprintf("%s/containers/%s", podmanCompatVersionPrefix, id)
	if force {
		path += "?force=true"
	}

	resp, err := pc.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return errors.Wrap(err, "remove container")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil // 容器不存在，视为删除成功
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("remove container failed: status %d", resp.StatusCode)
	}

	return nil
}

// ExecCreate 创建执行实例
func (pc *PodmanClient) ExecCreate(ctx context.Context, containerID string, req ExecCreateRequest) (string, error) {
	resp, err := pc.doRequest(ctx, http.MethodPost, fmt.Sprintf("%s/containers/%s/exec", podmanCompatVersionPrefix, containerID), req)
	if err != nil {
		return "", errors.Wrap(err, "exec create")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf("exec create failed: status %d", resp.StatusCode)
	}

	var result ExecCreateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", errors.Wrap(err, "decode exec create response")
	}

	return result.Id, nil
}

// ExecStart 开始执行
func (pc *PodmanClient) ExecStart(ctx context.Context, execID string, req ExecStartRequest) (string, string, error) {
	resp, err := pc.doRequest(ctx, http.MethodPost, fmt.Sprintf("%s/exec/%s/start", podmanCompatVersionPrefix, execID), req)
	if err != nil {
		return "", "", errors.Wrap(err, "exec start")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return "", "", fmt.Errorf("exec start failed: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", errors.Wrap(err, "read exec output")
	}

	if stdout, stderr, ok := demuxDockerRawStream(body); ok {
		return stdout, stderr, nil
	}

	return string(body), "", nil
}

func demuxDockerRawStream(body []byte) (string, string, bool) {
	if len(body) == 0 {
		return "", "", true
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	offset := 0
	for offset < len(body) {
		if len(body)-offset < 8 {
			return "", "", false
		}

		streamType := body[offset]
		isKnownStream := streamType == 1 || streamType == 2 || streamType == 3
		if isKnownStream == false || body[offset+1] != 0 || body[offset+2] != 0 || body[offset+3] != 0 {
			return "", "", false
		}

		frameSize := int(binary.BigEndian.Uint32(body[offset+4 : offset+8]))
		offset += 8
		if frameSize < 0 || frameSize > len(body)-offset {
			return "", "", false
		}

		frame := body[offset : offset+frameSize]
		if streamType == 1 {
			stdout.Write(frame)
		} else {
			stderr.Write(frame)
		}
		offset += frameSize
	}

	return stdout.String(), stderr.String(), true
}

// ExecRun 执行命令并返回结果（组合调用）
func (pc *PodmanClient) ExecRun(ctx context.Context, containerID string, opts RunOptions) (*ExecResult, error) {
	// 创建执行实例
	cmd := opts.Args
	if len(cmd) == 0 {
		cmd = []string{"/bin/sh", "-c", opts.Command}
	}

	createCtx, cancelCreate := context.WithTimeout(ctx, podmanExecControlTimeout)
	execID, err := pc.ExecCreate(createCtx, containerID, ExecCreateRequest{
		AttachStdin:  false,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          false,
		Cmd:          cmd,
		Env:          opts.Env,
		WorkingDir:   opts.WorkDir,
	})
	cancelCreate()
	if err != nil {
		return nil, errors.Wrap(err, "create exec instance")
	}

	// 开始执行
	commandCtx := ctx
	var cancelCommand context.CancelFunc = func() {}
	if opts.Timeout > 0 {
		commandCtx, cancelCommand = context.WithTimeout(ctx, time.Duration(opts.Timeout)*time.Second)
	}
	stdout, stderr, err := pc.ExecStart(commandCtx, execID, ExecStartRequest{
		Detach: false,
		Tty:    false,
	})
	cancelCommand()
	if err != nil {
		return nil, errors.Wrap(err, "start exec")
	}

	// 获取执行结果
	inspectCtx, cancelInspect := context.WithTimeout(ctx, podmanExecControlTimeout)
	result, err := pc.ExecInspect(inspectCtx, execID)
	cancelInspect()
	if err != nil {
		return nil, errors.Wrap(err, "inspect exec")
	}

	return &ExecResult{
		ExitCode: result.ExitCode,
		Stdout:   stdout,
		Stderr:   stderr,
	}, nil
}

// ExecInspect 检查执行实例
func (pc *PodmanClient) ExecInspect(ctx context.Context, execID string) (*ExecInspectResponse, error) {
	resp, err := pc.doRequest(ctx, http.MethodGet, fmt.Sprintf("%s/exec/%s/json", podmanCompatVersionPrefix, execID), nil)
	if err != nil {
		return nil, errors.Wrap(err, "exec inspect")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("exec inspect failed: status %d", resp.StatusCode)
	}

	var result ExecInspectResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, errors.Wrap(err, "decode exec inspect response")
	}

	return &result, nil
}

func (pc *PodmanClient) CopyFromContainer(ctx context.Context, containerID, containerPath string) ([]byte, error) {
	archivePath := fmt.Sprintf("%s/containers/%s/archive?path=%s", podmanCompatVersionPrefix, url.PathEscape(containerID), url.QueryEscape(containerPath))
	resp, err := pc.doRawRequest(ctx, http.MethodGet, archivePath, nil, "")
	if err != nil {
		return nil, errors.Wrap(err, "copy from container")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		detail := readErrorDetail(resp)
		if detail != "" {
			return nil, fmt.Errorf("copy from container failed: status %d: %s", resp.StatusCode, detail)
		}
		return nil, fmt.Errorf("copy from container failed: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.Wrap(err, "read container archive")
	}
	return body, nil
}

func (pc *PodmanClient) CopyToContainer(ctx context.Context, containerID, containerPath string, archive []byte) error {
	archivePath := fmt.Sprintf("%s/containers/%s/archive?path=%s", podmanCompatVersionPrefix, url.PathEscape(containerID), url.QueryEscape(containerPath))
	resp, err := pc.doRawRequest(ctx, http.MethodPut, archivePath, bytes.NewReader(archive), "application/x-tar")
	if err != nil {
		return errors.Wrap(err, "copy to container")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		detail := readErrorDetail(resp)
		if detail != "" {
			return fmt.Errorf("copy to container failed: status %d: %s", resp.StatusCode, detail)
		}
		return fmt.Errorf("copy to container failed: status %d", resp.StatusCode)
	}

	return nil
}

// GetContainerPort 获取容器映射的端口
func (pc *PodmanClient) GetContainerPort(ctx context.Context, id string) (int, error) {
	info, err := pc.InspectContainer(ctx, id)
	if err != nil {
		return 0, err
	}
	if info == nil {
		return 0, fmt.Errorf("container not found")
	}

	// 从 HostConfig.PortBindings 获取端口映射
	if ports, ok := info.HostConfig.PortBindings["3000/tcp"]; ok && len(ports) > 0 {
		portStr := ports[0].HostPort
		var port int
		fmt.Sscanf(portStr, "%d", &port)
		return port, nil
	}

	return 0, fmt.Errorf("port mapping not found")
}

// PullImage 拉取镜像
func (pc *PodmanClient) PullImage(ctx context.Context, image string, auth string) error {
	path := fmt.Sprintf("/v4.0.0/libpod/images/pull?reference=%s", url.QueryEscape(image))
	if auth != "" {
		path = fmt.Sprintf("%s&X-Registry-Auth=%s", path, url.QueryEscape(auth))
	}

	resp, err := pc.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return errors.Wrap(err, "pull image")
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return errors.Wrap(readErr, "read pull response")
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		detail := truncateDetail(string(body))
		if detail != "" {
			return fmt.Errorf("pull image failed: status %d: %s", resp.StatusCode, detail)
		}
		return fmt.Errorf("pull image failed: status %d", resp.StatusCode)
	}

	if detail := pullImageErrorDetail(body); detail != "" {
		return fmt.Errorf("pull image failed: %s", detail)
	}

	return nil
}

// ImageExists 检查镜像是否存在
func (pc *PodmanClient) ImageExists(ctx context.Context, image string) (bool, error) {
	path := fmt.Sprintf("%s/images/%s/json", podmanCompatVersionPrefix, url.PathEscape(image))
	resp, err := pc.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return false, errors.Wrap(err, "check image exists")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return true, nil
	}
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}

	detail := readErrorDetail(resp)
	if detail != "" {
		return false, fmt.Errorf("check image exists failed: status %d: %s", resp.StatusCode, detail)
	}
	return false, fmt.Errorf("check image exists failed: status %d", resp.StatusCode)
}

// ListImages 列出所有镜像
func (pc *PodmanClient) ListImages(ctx context.Context) ([]ImageListResponse, error) {
	resp, err := pc.doRequest(ctx, http.MethodGet, podmanCompatVersionPrefix+"/images/json", nil)
	if err != nil {
		return nil, errors.Wrap(err, "list images")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("list images failed: status %d", resp.StatusCode)
	}

	var images []ImageListResponse
	if err := json.NewDecoder(resp.Body).Decode(&images); err != nil {
		return nil, errors.Wrap(err, "decode images response")
	}

	return images, nil
}

// parseMemory 解析内存字符串
func parseMemory(mem string) (int64, error) {
	mem = strings.TrimSpace(mem)

	multipliers := map[rune]int64{
		'B': 1,
		'K': 1024,
		'M': 1024 * 1024,
		'G': 1024 * 1024 * 1024,
	}

	var value float64
	var unit rune
	fmt.Sscanf(mem, "%f%c", &value, &unit)

	if mult, ok := multipliers[unit]; ok {
		return int64(value * float64(mult)), nil
	}

	// 默认为字节
	val, _ := strconv.ParseInt(mem, 10, 64)
	return val, nil
}
