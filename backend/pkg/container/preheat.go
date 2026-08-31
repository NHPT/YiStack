package container

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/pkg/errors"
)

// PreheatStatus 预热状态
type PreheatStatus string

const (
	PreheatStatusPending   PreheatStatus = "pending"
	PreheatStatusPulling   PreheatStatus = "pulling"
	PreheatStatusCompleted PreheatStatus = "completed"
	PreheatStatusFailed    PreheatStatus = "failed"
)

// ImagePreheatInfo 镜像预热信息
type ImagePreheatInfo struct {
	Name       string        `json:"name"`
	Alias      string        `json:"alias"`
	Status     PreheatStatus `json:"status"`
	Progress   int           `json:"progress"`   // 0-100
	Message    string        `json:"message"`     // 状态消息
	PulledAt   *time.Time    `json:"pulled_at"`  // 拉取完成时间
	Error      string        `json:"error"`      // 错误信息
}

// PreheatManager 预热管理器
type PreheatManager struct {
	podman      *PodmanClient
	images      []PreheatImage
	imageStatus map[string]*ImagePreheatInfo
	mu          sync.RWMutex
	stopCh      chan struct{}
}

// NewPreheatManager 创建预热管理器
func NewPreheatManager(podman *PodmanClient) *PreheatManager {
	return &PreheatManager{
		podman:      podman,
		images:      SupportedImages,
		imageStatus: make(map[string]*ImagePreheatInfo),
		stopCh:      make(chan struct{}),
	}
}

// GetStatus 获取所有镜像的预热状态
func (pm *PreheatManager) GetStatus() map[string]*ImagePreheatInfo {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	status := make(map[string]*ImagePreheatInfo)
	for name, info := range pm.imageStatus {
		status[name] = info
	}
	return status
}

// GetImageStatus 获取单个镜像的预热状态
func (pm *PreheatManager) GetImageStatus(name string) *ImagePreheatInfo {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	info, exists := pm.imageStatus[name]
	if !exists {
		return nil
	}
	return info
}

// PreheatAll 预热所有镜像
func (pm *PreheatManager) PreheatAll(ctx context.Context) error {
	for _, img := range pm.images {
		if err := pm.preheatImage(ctx, img.Name); err != nil {
			pm.updateStatus(img.Name, PreheatStatusFailed, 0, "", err.Error())
			// 继续预热其他镜像
			fmt.Printf("Warning: failed to preheat image %s: %v\n", img.Name, err)
		}
	}
	return nil
}

// PreheatImage 预热单个镜像
func (pm *PreheatManager) PreheatImage(ctx context.Context, name string) error {
	// 查找镜像配置
	for _, img := range pm.images {
		if img.Name == name || img.Alias == name {
			return pm.preheatImage(ctx, img.Name)
		}
	}
	return fmt.Errorf("image %s not found in supported images", name)
}

// preheatImage 预热镜像（内部方法）
func (pm *PreheatManager) preheatImage(ctx context.Context, name string) error {
	pm.updateStatus(name, PreheatStatusPending, 0, "Checking image...", "")

	// 检查镜像是否已存在
	exists, err := pm.podman.ImageExists(ctx, name)
	if err != nil {
		return errors.Wrap(err, "check image exists")
	}

	if exists {
		pm.updateStatus(name, PreheatStatusPulling, 50, "Image exists, verifying...", "")
		// 验证镜像可以正常使用
		if err := pm.verifyImage(ctx, name); err != nil {
			pm.updateStatus(name, PreheatStatusPulling, 60, "Re-pulling image...", "")
			return pm.pullImage(ctx, name)
		}
		pm.updateStatus(name, PreheatStatusCompleted, 100, "Image ready", "")
		now := time.Now()
		pm.imageStatus[name].PulledAt = &now
		return nil
	}

	// 拉取镜像
	pm.updateStatus(name, PreheatStatusPulling, 10, "Pulling image...", "")
	return pm.pullImage(ctx, name)
}

// pullImage 拉取镜像
func (pm *PreheatManager) pullImage(ctx context.Context, name string) error {
	pm.updateStatus(name, PreheatStatusPulling, 20, fmt.Sprintf("Pulling %s...", name), "")

	// 拉取镜像
	if err := pm.podman.PullImage(ctx, name, ""); err != nil {
		pm.updateStatus(name, PreheatStatusFailed, 0, "", err.Error())
		return errors.Wrap(err, "pull image")
	}

	pm.updateStatus(name, PreheatStatusPulling, 90, "Verifying image...", "")

	// 验证镜像
	if err := pm.verifyImage(ctx, name); err != nil {
		pm.updateStatus(name, PreheatStatusFailed, 0, "", err.Error())
		return errors.Wrap(err, "verify image")
	}

	now := time.Now()
	pm.updateStatus(name, PreheatStatusCompleted, 100, "Image ready", "")
	pm.imageStatus[name].PulledAt = &now
	return nil
}

// verifyImage 验证镜像
func (pm *PreheatManager) verifyImage(ctx context.Context, name string) error {
	// 简单验证：检查镜像是否可以列出
	images, err := pm.podman.ListImages(ctx)
	if err != nil {
		return err
	}

	for _, img := range images {
		for _, imgName := range img.Names {
			if imgName == name || imgName == "localhost/"+name {
				return nil
			}
		}
	}

	return fmt.Errorf("image %s not found after pull", name)
}

// updateStatus 更新镜像状态
func (pm *PreheatManager) updateStatus(name string, status PreheatStatus, progress int, message, errMsg string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	info, exists := pm.imageStatus[name]
	if !exists {
		info = &ImagePreheatInfo{Name: name}
		pm.imageStatus[name] = info
	}

	info.Status = status
	info.Progress = progress
	info.Message = message
	if errMsg != "" {
		info.Error = errMsg
	}
}

// IsImageReady 检查镜像是否已准备就绪
func (pm *PreheatManager) IsImageReady(name string) bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	info, exists := pm.imageStatus[name]
	if !exists {
		return false
	}
	return info.Status == PreheatStatusCompleted && info.Error == ""
}

// GetReadyImages 获取已就绪的镜像列表
func (pm *PreheatManager) GetReadyImages() []string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	var ready []string
	for name, info := range pm.imageStatus {
		if info.Status == PreheatStatusCompleted && info.Error == "" {
			ready = append(ready, name)
		}
	}
	return ready
}

// GetRequiredImages 获取必需的镜像列表
func (pm *PreheatManager) GetRequiredImages() []string {
	var required []string
	for _, img := range pm.images {
		if img.Required {
			required = append(required, img.Name)
		}
	}
	return required
}

// IsReadyForUse 检查是否所有必需镜像都已就绪
func (pm *PreheatManager) IsReadyForUse() bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	for _, img := range pm.images {
		if img.Required {
			info, exists := pm.imageStatus[img.Name]
			if !exists || info.Status != PreheatStatusCompleted {
				return false
			}
		}
	}
	return true
}

// StartBackgroundPreheat 启动后台预热
func (pm *PreheatManager) StartBackgroundPreheat(ctx context.Context) {
	go func() {
		fmt.Println("Starting background image preheat...")
		if err := pm.PreheatAll(ctx); err != nil {
			fmt.Printf("Background preheat completed with errors: %v\n", err)
		} else {
			fmt.Println("Background preheat completed successfully")
		}
	}()
}

// Stop 停止预热管理器
func (pm *PreheatManager) Stop() {
	close(pm.stopCh)
}
