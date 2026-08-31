package container

import (
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/pkg/errors"
)

// PortPool 端口池
type PortPool struct {
	mu           sync.RWMutex
	rangeStart   int
	rangeEnd     int
	allocated    map[int]*PortAllocation // 已分配的端口
	reserved     map[string]int          // 保留的端口 (token -> port)
	projectPorts map[string]int          // 项目ID -> 端口
}

// PortAllocation 端口分配信息
type PortAllocation struct {
	Port        int        `json:"port"`
	ProjectID   string     `json:"project_id"`
	Token       string     `json:"token"`
	AllocatedAt time.Time  `json:"allocated_at"`
	ReleasedAt  *time.Time `json:"released_at,omitempty"`
}

// NewPortPool 创建新的端口池
func NewPortPool(rangeStart, rangeEnd int) *PortPool {
	return &PortPool{
		rangeStart:   rangeStart,
		rangeEnd:     rangeEnd,
		allocated:    make(map[int]*PortAllocation),
		reserved:     make(map[string]int),
		projectPorts: make(map[string]int),
	}
}

// Allocate 分配一个可用端口
func (p *PortPool) Allocate(projectID string) (int, string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 检查项目是否已有分配
	if port, exists := p.projectPorts[projectID]; exists {
		if alloc, ok := p.allocated[port]; ok {
			return port, alloc.Token, nil
		}
	}

	// 查找可用端口
	usedPorts := make(map[int]bool)
	for _, alloc := range p.allocated {
		if alloc.ReleasedAt == nil {
			usedPorts[alloc.Port] = true
		}
	}

	for port := p.rangeStart; port <= p.rangeEnd; port++ {
		if !usedPorts[port] && isHostPortFree(port) {
			token := uuid.New().String()
			alloc := &PortAllocation{
				Port:        port,
				ProjectID:   projectID,
				Token:       token,
				AllocatedAt: time.Now(),
			}
			p.allocated[port] = alloc
			p.projectPorts[projectID] = port
			p.reserved[token] = port
			return port, token, nil
		}
	}

	return 0, "", errors.New("no available ports in pool")
}

// Reserve 将已存在项目占用的端口重新登记到池中，用于服务重启后的状态恢复。
func (p *PortPool) Reserve(projectID string, port int) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if projectID == "" {
		return errors.New("project id is required")
	}
	if port < p.rangeStart || port > p.rangeEnd {
		return errors.Errorf("port %d out of range [%d-%d]", port, p.rangeStart, p.rangeEnd)
	}
	if existingPort, exists := p.projectPorts[projectID]; exists && existingPort == port {
		return nil
	}
	if alloc, exists := p.allocated[port]; exists && alloc.ReleasedAt == nil && alloc.ProjectID != projectID {
		return errors.Errorf("port %d is already allocated to project %s", port, alloc.ProjectID)
	}

	token := uuid.New().String()
	p.allocated[port] = &PortAllocation{
		Port:        port,
		ProjectID:   projectID,
		Token:       token,
		AllocatedAt: time.Now(),
	}
	p.projectPorts[projectID] = port
	p.reserved[token] = port
	return nil
}

// AllocateSpecific 分配指定端口
func (p *PortPool) AllocateSpecific(projectID string, port int) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if port < p.rangeStart || port > p.rangeEnd {
		return "", errors.Errorf("port %d out of range [%d-%d]", port, p.rangeStart, p.rangeEnd)
	}

	// 检查端口是否已被使用
	if alloc, exists := p.allocated[port]; exists && alloc.ReleasedAt == nil {
		return "", errors.Errorf("port %d is already allocated to project %s", port, alloc.ProjectID)
	}

	token := uuid.New().String()
	alloc := &PortAllocation{
		Port:        port,
		ProjectID:   projectID,
		Token:       token,
		AllocatedAt: time.Now(),
	}
	p.allocated[port] = alloc
	p.projectPorts[projectID] = port
	p.reserved[token] = port

	return token, nil
}

// Release 释放端口
func (p *PortPool) Release(projectID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	port, exists := p.projectPorts[projectID]
	if !exists {
		return nil // 项目没有分配端口
	}

	alloc, ok := p.allocated[port]
	if !ok {
		return nil
	}

	now := time.Now()
	alloc.ReleasedAt = &now
	delete(p.projectPorts, projectID)
	delete(p.reserved, alloc.Token)

	return nil
}

// ReleaseByToken 通过 Token 释放端口
func (p *PortPool) ReleaseByToken(token string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	port, exists := p.reserved[token]
	if !exists {
		return errors.Errorf("token %s not found", token)
	}

	alloc, ok := p.allocated[port]
	if !ok {
		return nil
	}

	now := time.Now()
	alloc.ReleasedAt = &now
	delete(p.projectPorts, alloc.ProjectID)
	delete(p.reserved, token)

	return nil
}

// GetPort 获取项目对应的端口
func (p *PortPool) GetPort(projectID string) (int, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	port, exists := p.projectPorts[projectID]
	return port, exists
}

// GetInfo 获取端口分配信息
func (p *PortPool) GetInfo(port int) (*PortAllocation, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	alloc, exists := p.allocated[port]
	return alloc, exists
}

// IsPortAvailable 检查端口是否可用
func (p *PortPool) IsPortAvailable(port int) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if port < p.rangeStart || port > p.rangeEnd {
		return false
	}

	if alloc, exists := p.allocated[port]; exists && alloc.ReleasedAt == nil {
		return false
	}

	return true
}

// GetStats 获取端口池统计信息
func (p *PortPool) GetStats() *PortPoolStats {
	p.mu.RLock()
	defer p.mu.RUnlock()

	total := p.rangeEnd - p.rangeStart + 1
	used := 0
	released := 0

	for _, alloc := range p.allocated {
		if alloc.ReleasedAt == nil {
			used++
		} else {
			released++
		}
	}

	return &PortPoolStats{
		TotalPorts:     total,
		UsedPorts:      used,
		AvailablePorts: total - used,
		ReleasedPorts:  released,
		RangeStart:     p.rangeStart,
		RangeEnd:       p.rangeEnd,
		ProjectCount:   len(p.projectPorts),
	}
}

// PortPoolStats 端口池统计信息
type PortPoolStats struct {
	TotalPorts     int `json:"total_ports"`
	UsedPorts      int `json:"used_ports"`
	AvailablePorts int `json:"available_ports"`
	ReleasedPorts  int `json:"released_ports"`
	RangeStart     int `json:"range_start"`
	RangeEnd       int `json:"range_end"`
	ProjectCount   int `json:"project_count"`
}

// ListAllocations 列出所有分配
func (p *PortPool) ListAllocations() []*PortAllocation {
	p.mu.RLock()
	defer p.mu.RUnlock()

	allocs := make([]*PortAllocation, 0, len(p.allocated))
	for _, alloc := range p.allocated {
		allocs = append(allocs, alloc)
	}
	return allocs
}

// ListActiveAllocations 列出活跃的分配
func (p *PortPool) ListActiveAllocations() []*PortAllocation {
	p.mu.RLock()
	defer p.mu.RUnlock()

	allocs := make([]*PortAllocation, 0)
	for _, alloc := range p.allocated {
		if alloc.ReleasedAt == nil {
			allocs = append(allocs, alloc)
		}
	}
	return allocs
}

// CleanupReleased 清理已释放的端口记录
func (p *PortPool) CleanupReleased(maxAge time.Duration) int {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	cleaned := 0

	for port, alloc := range p.allocated {
		if alloc.ReleasedAt != nil {
			age := now.Sub(*alloc.ReleasedAt)
			if age > maxAge {
				delete(p.allocated, port)
				delete(p.reserved, alloc.Token)
				cleaned++
			}
		}
	}

	return cleaned
}

// ValidatePort 验证端口是否在有效范围内
func ValidatePort(port int) error {
	if port < 30000 || port > 65535 {
		return fmt.Errorf("port %d out of valid range (30000-65535)", port)
	}
	return nil
}

func isHostPortFree(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}
