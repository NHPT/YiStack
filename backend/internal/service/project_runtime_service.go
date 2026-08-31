package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/container"
)

var projectRuntimeBaseEnsureLocks sync.Map
var projectRuntimePreparationLocks sync.Map

func getProjectRuntimeBaseEnsureLock(projectID string) *sync.Mutex {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil
	}
	lock, _ := projectRuntimeBaseEnsureLocks.LoadOrStore(projectID, &sync.Mutex{})
	mutex, _ := lock.(*sync.Mutex)
	return mutex
}

func getProjectRuntimePreparationLock(projectID string) *sync.Mutex {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil
	}
	lock, _ := projectRuntimePreparationLocks.LoadOrStore(
		projectID,
		&sync.Mutex{},
	)
	mutex, _ := lock.(*sync.Mutex)
	return mutex
}

// ensureProjectRuntimeBaseContainer 确保项目的开发运行时容器存在且处于可用状态，
// 但不等待运行时环境安装完成。
func ensureProjectRuntimeBaseContainer(
	ctx context.Context,
	project *model.Project,
	projectRepo ProjectRepo,
	containerMgr *container.Manager,
	containerCfg *config.ContainerConfig,
	imageResolver func(string) string,
) (*container.ContainerInfo, runtimeEnvironmentSpec, error) {
	if containerMgr == nil {
		return nil, runtimeEnvironmentSpec{}, errors.New("container manager not available")
	}
	if imageResolver == nil {
		return nil, runtimeEnvironmentSpec{}, errors.New("runtime image resolver is not configured")
	}
	if project == nil {
		return nil, runtimeEnvironmentSpec{}, errors.New("project is required")
	}
	if lock := getProjectRuntimeBaseEnsureLock(project.ProjectID); lock != nil {
		lock.Lock()
		defer lock.Unlock()
	}
	if project.DirectoryPath == "" {
		if containerCfg != nil && containerCfg.ProjectDir != "" {
			project.DirectoryPath = filepath.Join(containerCfg.ProjectDir, project.ProjectID)
		} else {
			return nil, runtimeEnvironmentSpec{}, errors.New("project directory is not configured")
		}
	}
	safeProjectDir, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		return nil, runtimeEnvironmentSpec{}, err
	}
	project.DirectoryPath = safeProjectDir
	if err := os.MkdirAll(safeProjectDir, 0755); err != nil {
		return nil, runtimeEnvironmentSpec{}, fmt.Errorf("failed to ensure project directory: %w", err)
	}
	if projectRepo != nil {
		if err := projectRepo.UpdateDirectoryPath(ctx, project.ProjectID, project.DirectoryPath); err != nil {
			log.Printf("Warning: failed to persist project directory path: %v", err)
		}
	}

	runtimeProfile := projectRuntimeProfile(project)
	desiredImage := strings.TrimSpace(project.ContainerImage)
	if desiredImage == "" {
		desiredImage = imageResolver(runtimeProfile)
	}
	desiredImage = normalizeRuntimeImage(desiredImage)
	runtimeStrategy := inferRuntimeImageStrategy(runtimeProfile, desiredImage, containerCfg)
	runtimeSpec := projectRuntimeEnvironmentSpec(project, desiredImage, runtimeStrategy)

	if _, _, err := containerMgr.SyncProject(ctx, project.ProjectID); err != nil {
		log.Printf("Warning: failed to sync project container before ensuring runtime: %v", err)
	}

	networkName, err := containerMgr.EnsureProjectNetwork(ctx, project.ProjectID)
	if err != nil {
		return nil, runtimeSpec, fmt.Errorf("failed to ensure project network: %w", err)
	}

	if existingInfo, exists := containerMgr.GetProject(project.ProjectID); exists {
		if strings.TrimSpace(existingInfo.Image) == strings.TrimSpace(desiredImage) {
			if existingInfo.Status == container.ContainerStatusRunning {
				containerMgr.MarkProjectActive(project.ProjectID)
				if projectRepo != nil {
					_ = projectRepo.UpdateContainerInfo(ctx, project.ProjectID, existingInfo.ContainerID, existingInfo.Name, existingInfo.Image, existingInfo.Port, string(existingInfo.Status))
				}
				return existingInfo, runtimeSpec, nil
			}

			if err := containerMgr.RemoveContainer(ctx, project.ProjectID); err != nil {
				return nil, runtimeSpec, fmt.Errorf("failed to recreate stopped container: %w", err)
			}
			if projectRepo != nil {
				_ = projectRepo.UpdateContainerInfo(ctx, project.ProjectID, "", "", "", 0, "missing")
			}
		} else {
			if err := containerMgr.RemoveContainer(ctx, project.ProjectID); err != nil {
				return nil, runtimeSpec, fmt.Errorf("failed to recreate container with target image: %w", err)
			}
		}
	}

	networkName, err = containerMgr.EnsureProjectNetwork(ctx, project.ProjectID)
	if err != nil {
		return nil, runtimeSpec, fmt.Errorf("failed to ensure project network: %w", err)
	}

	containerName := "yistack_" + project.ProjectID
	internalPort := runtimeApplicationPort(runtimeSpec)
	opts := &container.CreateOptions{
		Name:          containerName,
		Image:         desiredImage,
		Port:          0,
		ContainerPort: internalPort,
		VolumePath:    project.DirectoryPath,
		WorkDir:       "/workspace",
		Network:       networkName,
		Env:           runtimeMainContainerEnv(project.ProjectID, runtimeSpec),
		Cmd:           []string{"/bin/sh", "-c", "trap : TERM INT; while true; do sleep 3600; done"},
		Labels: map[string]string{
			"yistack.project_id": project.ProjectID,
			"yistack.user_id":    project.UserID,
			"yistack.role":       "main",
		},
	}

	info, err := containerMgr.CreateAndStartContainer(ctx, opts)
	if err != nil {
		return nil, runtimeSpec, fmt.Errorf("failed to create container: %w", err)
	}

	if projectRepo != nil {
		if err := projectRepo.UpdateContainerInfo(ctx, project.ProjectID, info.ContainerID, info.Name, info.Image, info.Port, string(info.Status)); err != nil {
			log.Printf("Warning: failed to update container info: %v", err)
		}
	}

	return info, runtimeSpec, nil
}

// ensureProjectRuntimeContainer 确保项目的开发运行时容器存在且对当前规格已完成环境准备。
// 当前开发阶段统一以预构建 devbox 镜像为目标状态，校验失败应直接暴露问题，而不是走隐式兼容安装。
func ensureProjectRuntimeContainer(
	ctx context.Context,
	project *model.Project,
	projectRepo ProjectRepo,
	containerMgr *container.Manager,
	containerCfg *config.ContainerConfig,
	imageResolver func(string) string,
) (*container.ContainerInfo, error) {
	info, runtimeSpec, err := ensureProjectRuntimeBaseContainer(ctx, project, projectRepo, containerMgr, containerCfg, imageResolver)
	if err != nil {
		return nil, err
	}
	if err := prepareRuntimeEnvironment(ctx, containerMgr, project, runtimeSpec, runtimeAPTMirrors(containerCfg)); err != nil {
		return nil, err
	}
	return info, nil
}

// shellSingleQuote 安全包装 shell 单引号字符串，避免容器内命令拼接时被截断。
func shellSingleQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", `'"'"'`) + "'"
}

func runtimeAPTMirrors(containerCfg *config.ContainerConfig) []string {
	if containerCfg == nil {
		return nil
	}
	return normalizeRuntimeAPTMirrors(containerCfg.APTMirrors, containerCfg.APTMirror)
}

func normalizeRuntimeAPTMirrors(values []string, fallback string) []string {
	candidates := make([]string, 0, len(values)+1)
	seen := make(map[string]struct{}, len(values)+1)
	appendCandidate := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, exists := seen[value]; exists {
			return
		}
		seen[value] = struct{}{}
		candidates = append(candidates, value)
	}

	for _, value := range values {
		appendCandidate(value)
	}
	appendCandidate(fallback)

	if len(candidates) == 0 {
		return nil
	}
	return candidates
}
