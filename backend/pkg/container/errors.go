package container

import "github.com/pkg/errors"

// Common errors
var (
	ErrProjectNotFound   = errors.New("project not found")
	ErrProjectExists     = errors.New("project already exists")
	ErrContainerNotFound = errors.New("container not found")
	ErrContainerRunning  = errors.New("container is running")
	ErrContainerStopped  = errors.New("container is stopped")
	ErrPortUnavailable   = errors.New("port is unavailable")
	ErrImageNotFound     = errors.New("image not found")
	ErrImageNotReady     = errors.New("image is not ready")
	ErrCommandTimeout    = errors.New("command execution timeout")
	ErrCommandFailed     = errors.New("command execution failed")
	ErrPodmanNotAvailable = errors.New("podman is not available")
	ErrInvalidProjectType = errors.New("invalid project type")
)

// IsNotFound 检查是否是"未找到"错误
func IsNotFound(err error) bool {
	return errors.Is(err, ErrProjectNotFound) ||
		errors.Is(err, ErrContainerNotFound) ||
		errors.Is(err, ErrImageNotFound)
}

// IsRunning 检查是否是"运行中"错误
func IsRunning(err error) bool {
	return errors.Is(err, ErrContainerRunning)
}

// IsStopped 检查是否是"已停止"错误
func IsStopped(err error) bool {
	return errors.Is(err, ErrContainerStopped)
}
