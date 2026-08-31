package file

import (
	"sync"

	"github.com/pkg/errors"
)

// Service 提供文件操作服务
type Service struct {
	managers map[string]*ProjectManager // projectID -> ProjectManager
	mu       sync.RWMutex
}

// NewService 创建文件服务
func NewService() *Service {
	return &Service{
		managers: make(map[string]*ProjectManager),
	}
}

// GetOrCreateManager 获取或创建项目文件管理器
func (s *Service) GetOrCreateManager(projectDir, projectID string) (*ProjectManager, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if pm, ok := s.managers[projectID]; ok {
		if pm.ProjectDir() == projectDir {
			return pm, nil
		}

		newPM, err := NewProjectManager(projectDir)
		if err != nil {
			return nil, errors.Wrap(err, "failed to recreate project manager")
		}
		s.managers[projectID] = newPM
		return newPM, nil
	}

	pm, err := NewProjectManager(projectDir)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create project manager")
	}

	s.managers[projectID] = pm
	return pm, nil
}

// GetManager 获取项目文件管理器
func (s *Service) GetManager(projectID string) (*ProjectManager, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pm, ok := s.managers[projectID]
	return pm, ok
}

// RemoveManager 移除项目文件管理器
func (s *Service) RemoveManager(projectID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.managers, projectID)
}

// ProjectService 项目文件服务接口
type ProjectService interface {
	// GetFileTree 获取文件树
	GetFileTree(projectID string) (*FileNode, error)
	// ReadFile 读取文件
	ReadFile(projectID, relPath string) (string, error)
	// WriteFile 写入文件
	WriteFile(projectID, relPath, content string) error
	// DeleteFile 删除文件
	DeleteFile(projectID, relPath string) error
	// CreateDir 创建目录
	CreateDir(projectID, relPath string) error
	// DeleteDir 删除目录
	DeleteDir(projectID, relPath string) error
	// Rename 重命名
	Rename(projectID, oldPath, newPath string) error
	// Exists 检查是否存在
	Exists(projectID, relPath string) bool
	// GetProjectSize 获取项目大小
	GetProjectSize(projectID string) (int64, error)
}
