package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/pkg/container"
)

// HasContainerManager 检查项目服务是否具备容器管理能力。
func (s *ProjectService) HasContainerManager() bool {
	return s.containerMgr != nil
}

// StartContainerIdleReaper 启动后端容器空闲自动停止任务。
func (s *ProjectService) StartContainerIdleReaper(ctx context.Context) {
	if s == nil || s.containerMgr == nil || s.containerCfg == nil || s.containerCfg.IdleTimeoutMin <= 0 {
		return
	}

	s.containerMgr.StartIdleReaper(ctx, time.Minute, func(projectID string, info *container.ContainerInfo) bool {
		protected, err := s.hasActiveGenerationJob(context.Background(), projectID)
		if err != nil {
			log.Printf("Warning: failed to inspect active generation job before idle stop for project %s: %v", projectID, err)
			return false
		}
		if protected {
			s.containerMgr.MarkProjectActive(projectID)
			return false
		}

		status, err := s.GetProjectRuntimeStatus(context.Background(), projectID)
		if err != nil {
			log.Printf("Warning: failed to inspect runtime status for idle stop project %s: %v", projectID, err)
			return true
		}
		if status != nil && (status.Status == "preparing" || status.Status == "starting") {
			return false
		}
		return true
	}, func(projectID string, info *container.ContainerInfo, err error) {
		if err != nil {
			log.Printf("Warning: failed to stop idle container for project %s: %v", projectID, err)
			return
		}
		status := s.persistStoppedRuntimeStatus(ctx, projectID, "开发容器因空闲超时已自动停止")
		if status != nil && status.ContainerStatusPersistence == "failed" {
			log.Printf("Warning: idle stopped container status persistence failed for project %s: %s", projectID, status.ContainerStatusPersistenceError)
		}
		if status != nil && status.PersistenceStatus == "failed" {
			log.Printf("Warning: idle stopped runtime status persistence failed for project %s: %s", projectID, status.PersistenceError)
		}
		log.Printf("Idle container stopped for project %s after %d minute(s)", projectID, s.containerCfg.IdleTimeoutMin)
	})
}

func (s *ProjectService) hasActiveGenerationJob(
	ctx context.Context,
	projectID string,
) (bool, error) {
	if s == nil || s.generationJobRepo == nil || strings.TrimSpace(projectID) == "" {
		return false, nil
	}
	job, err := s.generationJobRepo.FindActiveJobByProjectID(ctx, projectID)
	if err != nil {
		if IsGenerationJobNotFoundError(err) {
			return false, nil
		}
		return false, err
	}
	return job != nil && IsGenerationJobActiveStatus(job.Status), nil
}

// StartProjectContainer 启动或恢复项目对应的开发容器。
func (s *ProjectService) StartProjectContainer(ctx context.Context, projectID string) error {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("project not found: %w", err)
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "同步启动无法连接容器管理器", containerErr)
		return containerErr
	}

	info, err := ensureProjectRuntimeContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return err
	}

	log.Printf("Container started for project %s on port %d", projectID, info.Port)
	return nil
}

// ensureProjectContainerRunning 只确保项目主容器存在且正在运行，不重复执行 runtime verify/install。
// 终端和一次性 exec 需要快速接入已有容器，不能因为运行时校验重新阻塞。
func (s *ProjectService) ensureProjectContainerRunning(ctx context.Context, project *model.Project) (*container.ContainerInfo, error) {
	if s == nil {
		return nil, errors.New("project service is nil")
	}
	if project == nil {
		return nil, errors.New("project is required")
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "容器运行状态确认无法连接容器管理器", containerErr)
		return nil, containerErr
	}

	info, _, err := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return info, nil
}

// StartProjectContainerAsync 启动主容器，并在后台准备运行时环境。
func (s *ProjectService) StartProjectContainerAsync(ctx context.Context, projectID string) (*ProjectRuntimeStatus, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	if !projectNeedsRuntime(project.AppType) {
		status := setProjectRuntimeStatus(project.DirectoryPath, ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "ready",
			ContainerStatus: project.ContainerStatus,
			Message:         "当前项目不需要开发容器",
			CompletedAt:     runtimeStatusNow(),
		})
		return s.AttachPreviewStatus(project, &status), nil
	}
	if s.containerMgr == nil {
		err := errors.New("container manager not available")
		failed := s.persistRuntimeUnavailable(ctx, project, "开发容器管理器不可用", err)
		return s.AttachPreviewStatus(project, &failed), nil
	}

	baseImage := normalizeRuntimeImage(project.ContainerImage)
	if strings.TrimSpace(baseImage) == "" {
		baseImage = normalizeRuntimeImage(s.getImageForRuntimeProfile(projectRuntimeProfile(project)))
	}
	runtimeSpec := projectRuntimeEnvironmentSpec(project, baseImage, inferRuntimeImageStrategy(projectRuntimeProfile(project), baseImage, s.containerCfg))

	if strings.EqualFold(project.ContainerStatus, "running") {
		if existingStatus, statusErr := readProjectRuntimeStatus(project.DirectoryPath); statusErr == nil && existingStatus != nil {
			existingStatus.ProjectID = projectID
			if existingStatus.ContainerStatus == "" {
				existingStatus.ContainerStatus = project.ContainerStatus
			}
			if existingStatus.SpecHash == "" {
				existingStatus.SpecHash = runtimeSpecHash(runtimeSpec)
			}
			if existingStatus.Status == "ready" {
				readyStatus := s.prepareProjectPreviewReadyStatus(ctx, project, runtimeSpec, existingStatus.TaskID, existingStatus.StartedAt, existingStatus.ContainerStatus, true)
				return &readyStatus, nil
			}
			return s.AttachPreviewStatus(project, existingStatus), nil
		}
		if runtimeEnvironmentReady(project.DirectoryPath, runtimeSpec) {
			status := s.prepareProjectPreviewReadyStatus(ctx, project, runtimeSpec, "", "", project.ContainerStatus, true)
			return &status, nil
		}
	}

	if existingTask, exists := runtimePreparationTasks.Load(projectID); exists {
		if status, statusErr := s.GetProjectRuntimeStatus(ctx, projectID); statusErr == nil && status != nil {
			if status.TaskID == "" {
				if task, ok := existingTask.(*runtimePreparationTask); ok {
					status.TaskID = task.TaskID
				}
			}
			return status, nil
		}
	}

	task := newRuntimeTask(projectID)
	runtimePreparationTasks.Store(projectID, task)
	startedAt := runtimeStatusNow()
	status := setProjectRuntimeStatus(project.DirectoryPath, ProjectRuntimeStatus{
		ProjectID:       projectID,
		TaskID:          task.TaskID,
		Status:          "starting",
		ContainerStatus: "starting",
		Phase:           "container",
		Message:         "正在启动开发容器",
		SpecHash:        runtimeSpecHash(runtimeSpec),
		StartedAt:       startedAt,
	})

	projectSnapshot := *project
	go func(task *runtimePreparationTask, project model.Project, spec runtimeEnvironmentSpec, startedAt string) {
		defer func() {
			if recovered := recover(); recovered != nil {
				panicErr := fmt.Errorf("start runtime task panic: %v", recovered)
				failed := s.persistRuntimeStartFailure(context.Background(), project.ProjectID, ProjectRuntimeStatus{
					ProjectID:       project.ProjectID,
					TaskID:          task.TaskID,
					Status:          "failed",
					ContainerStatus: "failed",
					Phase:           "container",
					Message:         "开发容器启动失败",
					Error:           panicErr.Error(),
					SpecHash:        runtimeSpecHash(spec),
					StartedAt:       startedAt,
					CompletedAt:     runtimeStatusNow(),
				})
				_ = writeProjectRuntimeStatus(project.DirectoryPath, &failed)
				log.Printf("Start runtime task panic for project %s: %v", project.ProjectID, recovered)
			}
			if current, ok := runtimePreparationTasks.Load(project.ProjectID); ok && current == task {
				runtimePreparationTasks.Delete(project.ProjectID)
			}
		}()

		info, resolvedSpec, err := ensureProjectRuntimeBaseContainer(context.Background(), &project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
		if err != nil {
			failed := s.persistRuntimeStartFailure(context.Background(), project.ProjectID, ProjectRuntimeStatus{
				ProjectID:       project.ProjectID,
				TaskID:          task.TaskID,
				Status:          "failed",
				ContainerStatus: "failed",
				Phase:           "container",
				Message:         "开发容器启动失败",
				Error:           err.Error(),
				SpecHash:        runtimeSpecHash(spec),
				StartedAt:       startedAt,
				CompletedAt:     runtimeStatusNow(),
			})
			_ = writeProjectRuntimeStatus(project.DirectoryPath, &failed)
			log.Printf("Start base container failed for project %s: %v", project.ProjectID, err)
			return
		}
		spec = resolvedSpec

		verifyCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		verifyErr := verifyRuntimeEnvironment(verifyCtx, s.containerMgr, &project, spec)
		cancel()
		if verifyErr == nil {
			ready := s.prepareProjectPreviewReadyStatus(context.Background(), &project, spec, task.TaskID, startedAt, string(info.Status), true)
			if ready.Status == "failed" {
				log.Printf("Preview server start failed for project %s: %s", project.ProjectID, ready.Error)
				return
			}
			log.Printf("Runtime environment and preview server already ready for project %s", project.ProjectID)
			return
		}

		setProjectRuntimeStatus(project.DirectoryPath, ProjectRuntimeStatus{
			ProjectID:       project.ProjectID,
			TaskID:          task.TaskID,
			Status:          "preparing",
			ContainerStatus: string(info.Status),
			Phase:           "installing",
			Message:         "正在安装运行时依赖",
			SpecHash:        runtimeSpecHash(spec),
			StartedAt:       startedAt,
		})

		if err := prepareRuntimeEnvironment(context.Background(), s.containerMgr, &project, spec, runtimeAPTMirrors(s.containerCfg)); err != nil {
			failed := s.persistRuntimeStartFailure(context.Background(), project.ProjectID, ProjectRuntimeStatus{
				ProjectID:       project.ProjectID,
				TaskID:          task.TaskID,
				Status:          "failed",
				ContainerStatus: "running",
				Phase:           "installing",
				Message:         "开发环境准备失败",
				Error:           err.Error(),
				SpecHash:        runtimeSpecHash(spec),
				StartedAt:       startedAt,
				CompletedAt:     runtimeStatusNow(),
			})
			_ = writeProjectRuntimeStatus(project.DirectoryPath, &failed)
			log.Printf("Prepare runtime environment failed for project %s: %v", project.ProjectID, err)
			return
		}

		setProjectRuntimeStatus(project.DirectoryPath, ProjectRuntimeStatus{
			ProjectID:       project.ProjectID,
			TaskID:          task.TaskID,
			Status:          "preparing",
			ContainerStatus: "running",
			Phase:           "verifying",
			Message:         "正在验证运行时环境",
			SpecHash:        runtimeSpecHash(spec),
			StartedAt:       startedAt,
		})

		verifyCtx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
		verifyErr = verifyRuntimeEnvironment(verifyCtx, s.containerMgr, &project, spec)
		cancel()
		if verifyErr != nil {
			failed := s.persistRuntimeStartFailure(context.Background(), project.ProjectID, ProjectRuntimeStatus{
				ProjectID:       project.ProjectID,
				TaskID:          task.TaskID,
				Status:          "failed",
				ContainerStatus: "running",
				Phase:           "verifying",
				Message:         "运行时环境校验失败",
				Error:           verifyErr.Error(),
				SpecHash:        runtimeSpecHash(spec),
				StartedAt:       startedAt,
				CompletedAt:     runtimeStatusNow(),
			})
			_ = writeProjectRuntimeStatus(project.DirectoryPath, &failed)
			log.Printf("Verify runtime environment failed for project %s: %v", project.ProjectID, verifyErr)
			return
		}

		ready := s.prepareProjectPreviewReadyStatus(context.Background(), &project, spec, task.TaskID, startedAt, "running", true)
		if ready.Status == "failed" {
			log.Printf("Preview server start failed for project %s: %s", project.ProjectID, ready.Error)
			return
		}
		log.Printf("Runtime environment and preview server ready for project %s", project.ProjectID)
	}(task, projectSnapshot, runtimeSpec, startedAt)

	return s.AttachPreviewStatus(project, &status), nil
}

func (s *ProjectService) prepareProjectPreviewReadyStatus(
	ctx context.Context,
	project *model.Project,
	spec runtimeEnvironmentSpec,
	taskID string,
	startedAt string,
	containerStatus string,
	allowMissingEntrypoint bool,
) ProjectRuntimeStatus {
	if strings.TrimSpace(containerStatus) == "" {
		containerStatus = "running"
	}

	preparing := ProjectRuntimeStatus{
		ProjectID:       project.ProjectID,
		TaskID:          taskID,
		Status:          "preparing",
		ContainerStatus: containerStatus,
		Phase:           "preview",
		Message:         "正在启动预览服务",
		SpecHash:        runtimeSpecHash(spec),
		StartedAt:       startedAt,
	}
	attachedPreparing := s.AttachPreviewStatus(project, &preparing)
	_ = writeProjectRuntimeStatus(project.DirectoryPath, attachedPreparing)

	err := ensureProjectPreviewServer(ctx, s.containerMgr, project, spec, false)
	if err != nil {
		if allowMissingEntrypoint && errors.Is(err, errProjectPreviewEntrypointMissing) {
			ready := ProjectRuntimeStatus{
				ProjectID:       project.ProjectID,
				TaskID:          taskID,
				Status:          "ready",
				ContainerStatus: containerStatus,
				Phase:           "ready",
				Message:         "开发环境已就绪，等待生成预览入口",
				SpecHash:        runtimeSpecHash(spec),
				StartedAt:       startedAt,
				CompletedAt:     runtimeStatusNow(),
			}
			attachedReady := s.AttachPreviewStatus(project, &ready)
			_ = writeProjectRuntimeStatus(project.DirectoryPath, attachedReady)
			return *attachedReady
		}

		failed := ProjectRuntimeStatus{
			ProjectID:       project.ProjectID,
			TaskID:          taskID,
			Status:          "failed",
			ContainerStatus: containerStatus,
			Phase:           "preview",
			Message:         "预览服务启动失败",
			Error:           err.Error(),
			SpecHash:        runtimeSpecHash(spec),
			StartedAt:       startedAt,
			CompletedAt:     runtimeStatusNow(),
		}
		attachedFailed := s.AttachPreviewStatus(project, &failed)
		_ = writeProjectRuntimeStatus(project.DirectoryPath, attachedFailed)
		return *attachedFailed
	}

	ready := ProjectRuntimeStatus{
		ProjectID:       project.ProjectID,
		TaskID:          taskID,
		Status:          "ready",
		ContainerStatus: containerStatus,
		Phase:           "ready",
		Message:         "开发环境和预览服务已就绪",
		SpecHash:        runtimeSpecHash(spec),
		StartedAt:       startedAt,
		CompletedAt:     runtimeStatusNow(),
	}
	attachedReady := s.AttachPreviewStatus(project, &ready)
	_ = writeProjectRuntimeStatus(project.DirectoryPath, attachedReady)
	return *attachedReady
}

func (s *ProjectService) persistRuntimeStartFailure(ctx context.Context, projectID string, status ProjectRuntimeStatus) ProjectRuntimeStatus {
	if strings.TrimSpace(status.ContainerStatus) == "" {
		status.ContainerStatus = "failed"
	}
	status.ContainerStatusPersistence = "updated"
	if s == nil || s.projectRepo == nil {
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = "project repository not available"
		return status
	}
	if err := s.projectRepo.UpdateContainerStatus(safeContext(ctx), projectID, "failed"); err != nil {
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = err.Error()
		log.Printf("Warning: failed to persist failed container status for project %s: %v", projectID, err)
	}
	return status
}

func (s *ProjectService) persistRuntimeUnavailable(ctx context.Context, project *model.Project, message string, cause error) ProjectRuntimeStatus {
	status := ProjectRuntimeStatus{
		Status:                     "failed",
		ContainerStatus:            "unavailable",
		Phase:                      "container",
		Message:                    message,
		ContainerStatusPersistence: "updated",
		CompletedAt:                runtimeStatusNow(),
	}
	if project != nil {
		status.ProjectID = project.ProjectID
	}
	if cause != nil {
		status.Error = cause.Error()
	}
	if s == nil || s.projectRepo == nil || project == nil || strings.TrimSpace(project.ProjectID) == "" {
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = "project repository or project id not available"
		return status
	}
	if err := s.projectRepo.UpdateContainerStatus(safeContext(ctx), project.ProjectID, "unavailable"); err != nil {
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = err.Error()
		log.Printf("Warning: failed to persist unavailable container status for project %s: %v", project.ProjectID, err)
	}
	return setProjectRuntimeStatus(project.DirectoryPath, status)
}

// GetProjectRuntimeStatus 返回项目主开发容器和运行时准备状态。
func (s *ProjectService) GetProjectRuntimeStatus(ctx context.Context, projectID string) (*ProjectRuntimeStatus, error) {
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if s.projectRepo == nil {
		return nil, errors.New("project repository not available")
	}
	if strings.TrimSpace(projectID) == "" {
		return nil, errors.New("project id is required")
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	return s.GetProjectRuntimeStatusForProject(ctx, project)
}

func (s *ProjectService) TouchProjectRuntimeActivity(ctx context.Context, project *model.Project, source string) ProjectRuntimeActivityStatus {
	status := ProjectRuntimeActivityStatus{
		ActivityStatus: "failed",
		Source:         strings.TrimSpace(source),
		UpdatedAt:      runtimeStatusNow(),
	}
	if status.Source == "" {
		status.Source = "runtime_activity"
	}
	if s == nil {
		status.Message = "项目服务不可用，无法刷新运行时活动时间"
		status.Error = "project service not available"
		return status
	}
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		status.Message = "项目缺失，无法刷新运行时活动时间"
		status.Error = "project is required"
		return status
	}
	status.ProjectID = project.ProjectID
	if !projectNeedsRuntime(project.AppType) {
		status.ActivityStatus = "not_required"
		status.ContainerStatus = project.ContainerStatus
		status.Message = "当前项目类型不需要开发运行时"
		return status
	}
	if s.containerMgr == nil {
		status.ActivityStatus = "unavailable"
		status.ContainerStatus = "unavailable"
		status.Message = "容器管理器不可用，无法刷新运行时活动时间"
		status.Error = "container manager not available"
		return status
	}

	syncCtx, cancel := context.WithTimeout(safeContext(ctx), 5*time.Second)
	info, exists, err := s.containerMgr.InspectProject(syncCtx, project.ProjectID)
	cancel()
	if err != nil {
		status.ActivityStatus = "inspect_failed"
		status.ContainerStatus = project.ContainerStatus
		status.Message = "运行时活动时间刷新前检查容器状态失败"
		status.Error = err.Error()
		return status
	}
	applyContainerStateInMemory(project, info, exists)
	status.ContainerStatus = project.ContainerStatus
	if !exists || info == nil {
		status.ActivityStatus = "missing"
		status.Message = "未找到项目运行时容器，活动时间未刷新"
		return status
	}
	status.ContainerStatus = string(info.Status)
	if info.Status != container.ContainerStatusRunning {
		status.ActivityStatus = "inactive"
		status.Message = "项目运行时容器未运行，活动时间未刷新"
		return status
	}

	s.containerMgr.MarkProjectActive(project.ProjectID)
	status.ActivityStatus = "touched"
	status.Message = "项目运行时活动时间已刷新"
	return status
}

// GetStoredProjectRuntimeStatusForProject 只读取项目目录中已有的 runtime-status 快照。
// 它不 inspect 容器、不生成 preview URL，也不写入 runtime 状态，专用于 Admin 只读观测聚合。
func (s *ProjectService) GetStoredProjectRuntimeStatusForProject(project *model.Project) (*ProjectRuntimeStatus, error) {
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return nil, errors.New("project is required")
	}

	status, err := readProjectRuntimeStatus(project.DirectoryPath)
	if err != nil || status == nil {
		return status, err
	}
	status.ProjectID = project.ProjectID
	status.ContainerStatus = project.ContainerStatus
	return status, nil
}

func (s *ProjectService) GetProjectRuntimeStatusForProject(ctx context.Context, project *model.Project) (*ProjectRuntimeStatus, error) {
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if project == nil || strings.TrimSpace(project.ProjectID) == "" {
		return nil, errors.New("project is required")
	}

	if s.containerMgr != nil {
		syncCtx, cancel := context.WithTimeout(safeContext(ctx), 5*time.Second)
		info, exists, err := s.containerMgr.InspectProject(syncCtx, project.ProjectID)
		cancel()
		if err != nil {
			log.Printf("Warning: failed to sync container state for project %s: %v", project.ProjectID, err)
		} else {
			applyContainerStateInMemory(project, info, exists)
		}
	}

	projectID := project.ProjectID
	baseImage := normalizeRuntimeImage(project.ContainerImage)
	if strings.TrimSpace(baseImage) == "" {
		baseImage = normalizeRuntimeImage(s.getImageForRuntimeProfile(projectRuntimeProfile(project)))
	}
	spec := projectRuntimeEnvironmentSpec(project, baseImage, inferRuntimeImageStrategy(projectRuntimeProfile(project), baseImage, s.containerCfg))
	status, err := readProjectRuntimeStatus(project.DirectoryPath)
	if err != nil {
		log.Printf("Warning: failed to read runtime status for project %s: %v", projectID, err)
		return s.AttachPreviewStatus(project, &ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "failed",
			ContainerStatus: project.ContainerStatus,
			Phase:           "status_snapshot",
			Message:         "运行时状态快照读取失败",
			Error:           err.Error(),
			SpecHash:        runtimeSpecHash(spec),
			CompletedAt:     runtimeStatusNow(),
		}), nil
	}
	if status != nil {
		status.ProjectID = projectID
		status.ContainerStatus = project.ContainerStatus
		if status.SpecHash == "" {
			status.SpecHash = runtimeSpecHash(spec)
		}
		return s.AttachPreviewStatus(project, status), nil
	}

	if _, exists := runtimePreparationTasks.Load(projectID); exists {
		return s.AttachPreviewStatus(project, &ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "preparing",
			ContainerStatus: project.ContainerStatus,
			Phase:           "installing",
			Message:         "正在准备开发环境",
			SpecHash:        runtimeSpecHash(spec),
		}), nil
	}

	if strings.EqualFold(project.ContainerStatus, "running") {
		if runtimeEnvironmentReady(project.DirectoryPath, spec) {
			ready := ProjectRuntimeStatus{
				ProjectID:       projectID,
				Status:          "ready",
				ContainerStatus: project.ContainerStatus,
				Phase:           "ready",
				Message:         "开发环境已就绪",
				SpecHash:        runtimeSpecHash(spec),
			}
			return s.AttachPreviewStatus(project, &ready), nil
		}
		return s.AttachPreviewStatus(project, &ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "preparing",
			ContainerStatus: project.ContainerStatus,
			Phase:           "installing",
			Message:         "开发环境准备中",
			SpecHash:        runtimeSpecHash(spec),
		}), nil
	}

	switch strings.ToLower(strings.TrimSpace(project.ContainerStatus)) {
	case "running":
		return s.AttachPreviewStatus(project, &ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "preparing",
			ContainerStatus: project.ContainerStatus,
			Phase:           "installing",
			Message:         "开发环境准备中",
			SpecHash:        runtimeSpecHash(spec),
		}), nil
	case "starting", "creating":
		return s.AttachPreviewStatus(project, &ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "starting",
			ContainerStatus: project.ContainerStatus,
			Phase:           "container",
			Message:         "正在启动开发容器",
			SpecHash:        runtimeSpecHash(spec),
		}), nil
	default:
		return s.AttachPreviewStatus(project, &ProjectRuntimeStatus{
			ProjectID:       projectID,
			Status:          "stopped",
			ContainerStatus: project.ContainerStatus,
			Phase:           "stopped",
			Message:         "开发容器未启动",
			SpecHash:        runtimeSpecHash(spec),
		}), nil
	}
}

type ProjectContainerStopResult struct {
	ProjectID                       string                `json:"project_id"`
	StopStatus                      string                `json:"stop_status"`
	ContainerStatus                 string                `json:"container_status"`
	ContainerStatusPersistence      string                `json:"container_status_persistence"`
	ContainerStatusPersistenceError string                `json:"container_status_persistence_error,omitempty"`
	RuntimeStatus                   *ProjectRuntimeStatus `json:"runtime_status,omitempty"`
}

// StopProjectContainer 停止项目开发容器，并同步更新数据库状态。
func (s *ProjectService) StopProjectContainer(ctx context.Context, projectID string) (*ProjectContainerStopResult, error) {
	result := &ProjectContainerStopResult{
		ProjectID:                  projectID,
		StopStatus:                 "stopped",
		ContainerStatus:            "stopped",
		ContainerStatusPersistence: "updated",
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		result.StopStatus = "failed"
		result.ContainerStatus = "unavailable"
		if s.projectRepo == nil || strings.TrimSpace(projectID) == "" {
			result.ContainerStatusPersistence = "failed"
			result.ContainerStatusPersistenceError = "project repository or project id not available"
			return result, containerErr
		}
		project, findErr := s.projectRepo.FindByProjectID(safeContext(ctx), projectID)
		if findErr != nil {
			log.Printf("Warning: failed to load project before persisting unavailable stop status for project %s: %v", projectID, findErr)
		}
		if project != nil {
			status := s.persistRuntimeUnavailable(ctx, project, "停止运行时无法连接容器管理器", containerErr)
			result.ContainerStatusPersistence = status.ContainerStatusPersistence
			result.ContainerStatusPersistenceError = status.ContainerStatusPersistenceError
			result.RuntimeStatus = &status
			return result, containerErr
		}
		if err := s.projectRepo.UpdateContainerStatus(safeContext(ctx), projectID, "unavailable"); err != nil {
			result.ContainerStatusPersistence = "failed"
			result.ContainerStatusPersistenceError = err.Error()
			log.Printf("Warning: failed to persist unavailable container status for project %s: %v", projectID, err)
		}
		return result, containerErr
	}

	if err := s.containerMgr.StopContainer(ctx, projectID); err != nil {
		return nil, fmt.Errorf("failed to stop container: %w", err)
	}

	status := s.persistStoppedRuntimeStatus(ctx, projectID, "开发容器已停止")
	if status != nil {
		result.ContainerStatusPersistence = status.ContainerStatusPersistence
		result.ContainerStatusPersistenceError = status.ContainerStatusPersistenceError
		result.RuntimeStatus = status
	}

	return result, nil
}

func (s *ProjectService) persistStoppedRuntimeStatus(ctx context.Context, projectID, message string) *ProjectRuntimeStatus {
	status := &ProjectRuntimeStatus{
		ProjectID:                  projectID,
		Status:                     "stopped",
		ContainerStatus:            "stopped",
		Phase:                      "stopped",
		Message:                    message,
		ContainerStatusPersistence: "updated",
		CompletedAt:                runtimeStatusNow(),
	}
	if s == nil || s.projectRepo == nil {
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = "project repository not available"
		status.PersistenceStatus = "failed"
		status.PersistenceError = "project repository not available"
		return status
	}
	if err := s.projectRepo.UpdateContainerStatus(safeContext(ctx), projectID, "stopped"); err != nil {
		log.Printf("Warning: failed to update container status: %v", err)
		status.ContainerStatusPersistence = "failed"
		status.ContainerStatusPersistenceError = err.Error()
	}
	project, findErr := s.projectRepo.FindByProjectID(safeContext(ctx), projectID)
	if findErr != nil {
		status.PersistenceStatus = "failed"
		status.PersistenceError = findErr.Error()
		return status
	}
	if project == nil {
		status.PersistenceStatus = "failed"
		status.PersistenceError = "project not found for runtime status"
		return status
	}
	_ = writeProjectRuntimeStatus(project.DirectoryPath, status)
	return status
}

// ExecuteInContainer 在项目容器内执行命令。
// 执行前会先确保容器已经启动且 runtime 对当前项目运行配置可用。
func (s *ProjectService) ExecuteInContainer(ctx context.Context, projectID, command string) (*container.ExecResult, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, errors.New("runtime is disabled for this app type")
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "开发容器管理器不可用", containerErr)
		return nil, containerErr
	}

	if _, err := s.ensureProjectContainerRunning(ctx, project); err != nil {
		return nil, fmt.Errorf("failed to ensure project container is running: %w", err)
	}

	opts := &container.RunOptions{
		ProjectID: projectID,
		Command:   command,
		WorkDir:   "/workspace",
		Timeout:   300,
	}

	return s.containerMgr.ExecuteInContainer(ctx, opts)
}
