package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/container"
)

// ProjectResourceSnapshotResult describes a read-only project runtime resource observation.
type ProjectResourceSnapshotResult struct {
	Status           string    `json:"status"`
	ProjectID        string    `json:"project_id"`
	AppType          string    `json:"app_type"`
	ContainerStatus  string    `json:"container_status"`
	ContainerID      string    `json:"container_id"`
	ContainerName    string    `json:"container_name"`
	ContainerImage   string    `json:"container_image"`
	ContainerPort    int       `json:"container_port"`
	MetricsAvailable bool      `json:"metrics_available"`
	CPUPercent       float64   `json:"cpu_percent"`
	MemoryUsageBytes int64     `json:"memory_usage_bytes"`
	MemoryLimitBytes int64     `json:"memory_limit_bytes"`
	NetworkRxBytes   int64     `json:"network_rx_bytes"`
	NetworkTxBytes   int64     `json:"network_tx_bytes"`
	DiskUsageBytes   int64     `json:"disk_usage_bytes"`
	ReadTime         time.Time `json:"read_time"`
	Message          string    `json:"message"`
	Recovery         string    `json:"recovery"`
}

// ProjectResourceAlertReadiness describes read-only resource alert policy readiness.
type ProjectResourceAlertReadiness struct {
	Status                    string                         `json:"status"`
	ProjectID                 string                         `json:"project_id"`
	ResourceAlertEnabled      bool                           `json:"resource_alert_enabled"`
	CPUThresholdConfigured    bool                           `json:"cpu_threshold_configured"`
	MemoryThresholdConfigured bool                           `json:"memory_threshold_configured"`
	DiskThresholdConfigured   bool                           `json:"disk_threshold_configured"`
	CPUThresholdPercent       float64                        `json:"cpu_threshold_percent"`
	MemoryThresholdPercent    float64                        `json:"memory_threshold_percent"`
	DiskThresholdBytes        int64                          `json:"disk_threshold_bytes"`
	SnapshotStatus            string                         `json:"snapshot_status"`
	MetricsAvailable          bool                           `json:"metrics_available"`
	CPUPercent                float64                        `json:"cpu_percent"`
	MemoryUsageBytes          int64                          `json:"memory_usage_bytes"`
	MemoryLimitBytes          int64                          `json:"memory_limit_bytes"`
	MemoryUsagePercent        float64                        `json:"memory_usage_percent"`
	DiskUsageBytes            int64                          `json:"disk_usage_bytes"`
	CPUThresholdExceeded      bool                           `json:"cpu_threshold_exceeded"`
	MemoryThresholdExceeded   bool                           `json:"memory_threshold_exceeded"`
	DiskThresholdExceeded     bool                           `json:"disk_threshold_exceeded"`
	AnyThresholdExceeded      bool                           `json:"any_threshold_exceeded"`
	ResourceSnapshot          *ProjectResourceSnapshotResult `json:"resource_snapshot"`
	Message                   string                         `json:"message"`
	Recovery                  string                         `json:"recovery"`
}

// ProjectResourceAlertThresholdPreview describes one threshold in an alert evaluation preview.
type ProjectResourceAlertThresholdPreview struct {
	Name           string  `json:"name"`
	Configured     bool    `json:"configured"`
	CurrentValue   float64 `json:"current_value"`
	ThresholdValue float64 `json:"threshold_value"`
	Unit           string  `json:"unit"`
	Exceeded       bool    `json:"exceeded"`
}

// ProjectResourceAlertEvaluationPreview describes a non-persistent alert evaluation preview.
type ProjectResourceAlertEvaluationPreview struct {
	Status              string                                 `json:"status"`
	ProjectID           string                                 `json:"project_id"`
	EvaluationID        string                                 `json:"evaluation_id"`
	EvaluatedAt         time.Time                              `json:"evaluated_at"`
	ReadinessStatus     string                                 `json:"readiness_status"`
	WouldCreateAlert    bool                                   `json:"would_create_alert"`
	TriggeredCount      int                                    `json:"triggered_count"`
	TriggeredThresholds []ProjectResourceAlertThresholdPreview `json:"triggered_thresholds"`
	Thresholds          []ProjectResourceAlertThresholdPreview `json:"thresholds"`
	Readiness           *ProjectResourceAlertReadiness         `json:"readiness"`
	Message             string                                 `json:"message"`
	Recovery            string                                 `json:"recovery"`
}

// ProjectResourceAlertEventCreateResult describes a controlled append-only alert event creation.
type ProjectResourceAlertEventCreateResult struct {
	Status              string                                 `json:"status"`
	ProjectID           string                                 `json:"project_id"`
	EventCreated        bool                                   `json:"event_created"`
	EventID             int64                                  `json:"event_id"`
	EvaluationID        string                                 `json:"evaluation_id"`
	CreatedAt           time.Time                              `json:"created_at"`
	ReadinessStatus     string                                 `json:"readiness_status"`
	TriggeredCount      int                                    `json:"triggered_count"`
	TriggeredThresholds []ProjectResourceAlertThresholdPreview `json:"triggered_thresholds"`
	Thresholds          []ProjectResourceAlertThresholdPreview `json:"thresholds"`
	EvaluationPreview   *ProjectResourceAlertEvaluationPreview `json:"evaluation_preview"`
	Message             string                                 `json:"message"`
	Recovery            string                                 `json:"recovery"`
}

// ProjectResourceAlertEventListResult describes a read-only alert event list.
type ProjectResourceAlertEventListResult struct {
	Status    string                            `json:"status"`
	ProjectID string                            `json:"project_id"`
	Records   []ProjectResourceAlertEventRecord `json:"records"`
	Total     int64                             `json:"total"`
	Offset    int                               `json:"offset"`
	Limit     int                               `json:"limit"`
	Message   string                            `json:"message"`
	Recovery  string                            `json:"recovery"`
}

// ProjectResourceAlertNotificationReadiness describes read-only notification channel readiness.
type ProjectResourceAlertNotificationReadiness struct {
	Status                   string    `json:"status"`
	ProjectID                string    `json:"project_id"`
	NotificationEnabled      bool      `json:"notification_enabled"`
	Provider                 string    `json:"provider"`
	ProviderSupported        bool      `json:"provider_supported"`
	WebhookConfigured        bool      `json:"webhook_configured"`
	CandidateEventAvailable  bool      `json:"candidate_event_available"`
	CandidateEventID         int64     `json:"candidate_event_id"`
	CandidateEventStatus     string    `json:"candidate_event_status"`
	CandidateEvaluationID    string    `json:"candidate_evaluation_id"`
	CandidateReadinessStatus string    `json:"candidate_readiness_status"`
	CandidateTriggeredCount  int       `json:"candidate_triggered_count"`
	CandidateCreatedAt       time.Time `json:"candidate_created_at"`
	Message                  string    `json:"message"`
	Recovery                 string    `json:"recovery"`
}

// ProjectResourceAlertNotificationSendResult describes a controlled webhook notification attempt.
type ProjectResourceAlertNotificationSendResult struct {
	Status                   string                                     `json:"status"`
	ProjectID                string                                     `json:"project_id"`
	Provider                 string                                     `json:"provider"`
	WebhookConfigured        bool                                       `json:"webhook_configured"`
	NotificationSent         bool                                       `json:"notification_sent"`
	NotificationEventCreated bool                                       `json:"notification_event_created"`
	NotificationEventID      int64                                      `json:"notification_event_id"`
	CandidateEventID         int64                                      `json:"candidate_event_id"`
	CandidateEvaluationID    string                                     `json:"candidate_evaluation_id"`
	HTTPStatusCode           int                                        `json:"http_status_code"`
	Readiness                *ProjectResourceAlertNotificationReadiness `json:"readiness"`
	Message                  string                                     `json:"message"`
	Recovery                 string                                     `json:"recovery"`
	CreatedAt                time.Time                                  `json:"created_at"`
}

// ProjectResourceAlertEnforcementReadiness describes read-only readiness for a future hard-quota action.
type ProjectResourceAlertEnforcementReadiness struct {
	Status                    string `json:"status"`
	ProjectID                 string `json:"project_id"`
	EnforcementEnabled        bool   `json:"enforcement_enabled"`
	EnforcementMode           string `json:"enforcement_mode"`
	EnforcementModeSupported  bool   `json:"enforcement_mode_supported"`
	NotificationSentRequired  bool   `json:"notification_sent_required"`
	NotificationSentAvailable bool   `json:"notification_sent_available"`
	CandidateEventAvailable   bool   `json:"candidate_event_available"`
	CandidateEventID          int64  `json:"candidate_event_id"`
	CandidateEvaluationID     string `json:"candidate_evaluation_id"`
	CandidateReadinessStatus  string `json:"candidate_readiness_status"`
	CandidateTriggeredCount   int    `json:"candidate_triggered_count"`
	WouldEnforce              bool   `json:"would_enforce"`
	Message                   string `json:"message"`
	Recovery                  string `json:"recovery"`
}

// ProjectResourceAlertEnforcementExecuteResult describes one explicitly controlled hard-quota enforcement attempt.
type ProjectResourceAlertEnforcementExecuteResult struct {
	Status                  string                                    `json:"status"`
	ProjectID               string                                    `json:"project_id"`
	EnforcementExecuted     bool                                      `json:"enforcement_executed"`
	EnforcementEventCreated bool                                      `json:"enforcement_event_created"`
	EnforcementEventID      int64                                     `json:"enforcement_event_id"`
	CandidateEventID        int64                                     `json:"candidate_event_id"`
	CandidateEvaluationID   string                                    `json:"candidate_evaluation_id"`
	Mode                    string                                    `json:"mode"`
	Readiness               *ProjectResourceAlertEnforcementReadiness `json:"readiness"`
	StopResult              *ProjectContainerStopResult               `json:"stop_result"`
	Message                 string                                    `json:"message"`
	Recovery                string                                    `json:"recovery"`
	CreatedAt               time.Time                                 `json:"created_at"`
}

type projectResourceAlertNotificationWebhookPayload struct {
	Type                 string                                 `json:"type"`
	ProjectID            string                                 `json:"project_id"`
	SourceEventID        int64                                  `json:"source_event_id"`
	EvaluationID         string                                 `json:"evaluation_id"`
	ReadinessStatus      string                                 `json:"readiness_status"`
	TriggeredCount       int                                    `json:"triggered_count"`
	TriggeredThresholds  []ProjectResourceAlertThresholdPreview `json:"triggered_thresholds"`
	Thresholds           []ProjectResourceAlertThresholdPreview `json:"thresholds"`
	SourceEventCreatedAt time.Time                              `json:"source_event_created_at"`
	Message              string                                 `json:"message"`
}

// ProjectResourceAlertEventRecord describes one persisted alert event with parsed evidence.
type ProjectResourceAlertEventRecord struct {
	ID                            int64                                  `json:"id"`
	ProjectID                     string                                 `json:"project_id"`
	UserID                        string                                 `json:"user_id"`
	Status                        string                                 `json:"status"`
	EvaluationID                  string                                 `json:"evaluation_id"`
	ReadinessStatus               string                                 `json:"readiness_status"`
	TriggeredCount                int                                    `json:"triggered_count"`
	TriggeredThresholds           []ProjectResourceAlertThresholdPreview `json:"triggered_thresholds"`
	Thresholds                    []ProjectResourceAlertThresholdPreview `json:"thresholds"`
	EvaluationPreview             *ProjectResourceAlertEvaluationPreview `json:"evaluation_preview"`
	TriggeredThresholdsParseError string                                 `json:"triggered_thresholds_parse_error"`
	ThresholdsParseError          string                                 `json:"thresholds_parse_error"`
	EvaluationPreviewParseError   string                                 `json:"evaluation_preview_parse_error"`
	RawTriggeredThresholds        string                                 `json:"raw_triggered_thresholds"`
	RawThresholds                 string                                 `json:"raw_thresholds"`
	RawEvaluationPreview          string                                 `json:"raw_evaluation_preview"`
	Message                       string                                 `json:"message"`
	Recovery                      string                                 `json:"recovery"`
	CreatedAt                     time.Time                              `json:"created_at"`
}

// GetProjectResourceSnapshot returns a read-only project runtime resource snapshot.
func (s *ProjectService) GetProjectResourceSnapshot(ctx context.Context, projectID string) (*ProjectResourceSnapshotResult, error) {
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

	result := buildProjectResourceSnapshotBase(project)
	if !projectNeedsRuntime(project.AppType) {
		result.Status = "not_required"
		result.Message = "当前项目类型不需要开发运行时资源监控"
		result.Recovery = "无需启动容器；如项目类型调整为需要运行时，重新读取资源快照。"
		return result, nil
	}
	if s.containerMgr == nil {
		result.Status = "unavailable"
		result.ContainerStatus = "unavailable"
		result.Message = "容器管理器不可用，无法读取项目资源快照"
		result.Recovery = "请检查容器运行时配置和 Podman socket 后重试；当前未启动或停止容器。"
		return result, nil
	}

	syncCtx, cancel := context.WithTimeout(safeContext(ctx), 5*time.Second)
	info, exists, syncErr := s.containerMgr.SyncProject(syncCtx, project.ProjectID)
	cancel()
	if syncErr != nil {
		result.Status = "failed"
		result.ContainerStatus = fallbackText(project.ContainerStatus, "unknown")
		result.Message = "同步项目容器状态失败，资源快照未确认"
		result.Recovery = "请检查容器运行时连接和项目容器状态后重试；当前未启动或停止容器。"
		return result, nil
	}

	applyContainerStateInMemory(project, info, exists)
	applyProjectResourceSnapshotContainerInfo(result, project, info, exists)
	if !exists || info == nil {
		result.Status = "blocked"
		result.Message = "未找到项目运行时容器，无法读取资源快照"
		result.Recovery = "如需监控资源，请先显式启动项目运行时；当前只返回项目已知容器状态。"
		return result, nil
	}
	if info.Status != container.ContainerStatusRunning {
		result.Status = "blocked"
		result.Message = "项目运行时容器未运行，资源快照读取被阻断"
		result.Recovery = "请先显式启动项目运行时，再读取 CPU、内存、网络和磁盘使用情况。"
		return result, nil
	}

	statsCtx, statsCancel := context.WithTimeout(safeContext(ctx), 5*time.Second)
	stats, statsErr := s.containerMgr.GetProjectStats(statsCtx, project.ProjectID)
	statsCancel()
	if statsErr != nil || stats == nil {
		result.Status = "failed"
		result.Message = "读取项目运行时资源指标失败"
		if statsErr != nil {
			result.Message = fmt.Sprintf("读取项目运行时资源指标失败：%s", statsErr.Error())
		}
		result.Recovery = "请检查容器 stats 接口和运行时状态后重试；当前未修改项目资源。"
		return result, nil
	}

	result.Status = "ready"
	result.MetricsAvailable = true
	result.CPUPercent = stats.CPUPercent
	result.MemoryUsageBytes = stats.MemoryUsage
	result.MemoryLimitBytes = stats.MemoryLimit
	result.NetworkRxBytes = stats.NetworkRx
	result.NetworkTxBytes = stats.NetworkTx
	result.DiskUsageBytes = stats.DiskUsage
	result.ReadTime = stats.ReadTime
	result.Message = "项目运行时资源快照已读取"
	result.Recovery = "如指标异常，请结合运行时状态、日志和后续告警策略继续诊断。"
	return result, nil
}

// GetProjectResourceAlertReadiness returns read-only alert policy readiness for runtime resources.
func (s *ProjectService) GetProjectResourceAlertReadiness(ctx context.Context, projectID string) (*ProjectResourceAlertReadiness, error) {
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
	projectCfg := s.projectResourceConfig(ctx)
	result := &ProjectResourceAlertReadiness{
		Status:                    "blocked",
		ProjectID:                 project.ProjectID,
		ResourceAlertEnabled:      projectCfg.ResourceAlertEnabled,
		CPUThresholdConfigured:    projectCfg.ResourceAlertCPUPercent > 0,
		MemoryThresholdConfigured: projectCfg.ResourceAlertMemoryPercent > 0,
		DiskThresholdConfigured:   projectCfg.ResourceAlertDiskBytes > 0,
		CPUThresholdPercent:       projectCfg.ResourceAlertCPUPercent,
		MemoryThresholdPercent:    projectCfg.ResourceAlertMemoryPercent,
		DiskThresholdBytes:        projectCfg.ResourceAlertDiskBytes,
		SnapshotStatus:            "not_checked",
		Message:                   "项目资源告警策略尚未就绪",
		Recovery:                  "请启用 PROJECT_RESOURCE_ALERT_ENABLED 并至少配置一个资源阈值；当前只读检查不会启动容器、写项目或创建告警。",
	}
	if !result.ResourceAlertEnabled {
		result.Status = "disabled"
		result.Message = "项目资源告警策略已关闭"
		result.Recovery = "如需启用资源告警 readiness，请将 PROJECT_RESOURCE_ALERT_ENABLED 设置为 true；当前不会读取容器或创建告警。"
		return result, nil
	}
	if !result.CPUThresholdConfigured && !result.MemoryThresholdConfigured && !result.DiskThresholdConfigured {
		result.Message = "项目资源告警策略未配置任何阈值"
		result.Recovery = "请至少配置 PROJECT_RESOURCE_ALERT_CPU_PERCENT、PROJECT_RESOURCE_ALERT_MEMORY_PERCENT 或 PROJECT_RESOURCE_ALERT_DISK_BYTES 之一；当前不会启动容器或创建告警。"
		return result, nil
	}

	snapshot, err := s.GetProjectResourceSnapshot(ctx, project.ProjectID)
	if err != nil {
		return nil, err
	}
	result.ResourceSnapshot = snapshot
	result.SnapshotStatus = snapshot.Status
	result.MetricsAvailable = snapshot.MetricsAvailable
	if snapshot.Status != "ready" || !snapshot.MetricsAvailable {
		result.Status = "unavailable"
		result.Message = "项目资源告警策略已配置，但当前资源快照不可用"
		result.Recovery = "请先让项目运行时进入可读取资源快照的状态；当前不会启动容器、持久化快照或创建告警。"
		return result, nil
	}

	result.CPUPercent = snapshot.CPUPercent
	result.MemoryUsageBytes = snapshot.MemoryUsageBytes
	result.MemoryLimitBytes = snapshot.MemoryLimitBytes
	result.DiskUsageBytes = snapshot.DiskUsageBytes
	if snapshot.MemoryLimitBytes > 0 {
		result.MemoryUsagePercent = float64(snapshot.MemoryUsageBytes) / float64(snapshot.MemoryLimitBytes) * 100
	}
	result.CPUThresholdExceeded = result.CPUThresholdConfigured && result.CPUPercent >= result.CPUThresholdPercent
	result.MemoryThresholdExceeded = result.MemoryThresholdConfigured && result.MemoryUsagePercent >= result.MemoryThresholdPercent
	result.DiskThresholdExceeded = result.DiskThresholdConfigured && result.DiskUsageBytes >= result.DiskThresholdBytes
	result.AnyThresholdExceeded = result.CPUThresholdExceeded || result.MemoryThresholdExceeded || result.DiskThresholdExceeded
	if result.AnyThresholdExceeded {
		result.Status = "alerting"
		result.Message = "项目资源告警策略可评估，当前已有阈值被触发"
		result.Recovery = "请结合资源快照、运行时日志和后续告警策略处理；当前只返回 readiness，不持久化告警、不发送通知、不执行硬配额限制。"
		return result, nil
	}

	result.Status = "ready"
	result.Message = "项目资源告警策略可评估，当前未触发阈值"
	result.Recovery = "该 readiness 只读取配置和运行时资源快照，不创建告警、不发送通知、不写项目目录、不执行硬配额限制。"
	return result, nil
}

// GetProjectResourceAlertEvaluationPreview returns a non-persistent alert evaluation preview.
func (s *ProjectService) GetProjectResourceAlertEvaluationPreview(ctx context.Context, projectID string) (*ProjectResourceAlertEvaluationPreview, error) {
	readiness, err := s.GetProjectResourceAlertReadiness(ctx, projectID)
	if err != nil {
		return nil, err
	}

	evaluatedAt := time.Now().UTC()
	result := &ProjectResourceAlertEvaluationPreview{
		Status:          readiness.Status,
		ProjectID:       readiness.ProjectID,
		EvaluationID:    fmt.Sprintf("resource-alert-preview-%s-%d", readiness.ProjectID, evaluatedAt.UnixNano()),
		EvaluatedAt:     evaluatedAt,
		ReadinessStatus: readiness.Status,
		Thresholds:      buildProjectResourceAlertThresholdPreviews(readiness),
		Readiness:       readiness,
		Message:         "项目资源告警评估预览已生成",
		Recovery:        "该预览只计算当前阈值事实，不创建或持久化告警、不发送通知、不执行硬配额限制。",
	}
	for _, threshold := range result.Thresholds {
		if threshold.Exceeded {
			result.TriggeredThresholds = append(result.TriggeredThresholds, threshold)
		}
	}
	result.TriggeredCount = len(result.TriggeredThresholds)
	result.WouldCreateAlert = readiness.Status == "alerting" && result.TriggeredCount > 0
	if !result.WouldCreateAlert {
		result.Message = "项目资源告警评估预览未发现需要创建告警的当前事实"
		result.Recovery = readiness.Recovery
		return result, nil
	}

	result.Status = "would_alert"
	result.Message = "项目资源告警评估预览发现当前阈值已触发"
	result.Recovery = "后续若接入告警事件写入或通知，必须通过单独受控入口执行；当前预览不会持久化告警、发送通知或限制资源。"
	return result, nil
}

// CreateProjectResourceAlertEvent creates an append-only resource alert event through an explicit controlled entry.
func (s *ProjectService) CreateProjectResourceAlertEvent(ctx context.Context, projectID, userID string, confirmCreate bool) (*ProjectResourceAlertEventCreateResult, error) {
	result := &ProjectResourceAlertEventCreateResult{
		Status:    "blocked",
		ProjectID: projectID,
		Message:   "项目资源告警事件未创建",
		Recovery:  "请先生成资源告警评估预览，并在确认当前阈值事实需要记录后带 confirm_create=true 重新发起。",
	}
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if strings.TrimSpace(projectID) == "" {
		return nil, errors.New("project id is required")
	}
	if !confirmCreate {
		result.Message = "项目资源告警事件创建需要显式确认"
		result.Recovery = "该入口只写 append-only 告警事件；请先查看评估预览，确认后带 confirm_create=true 重试。"
		return result, nil
	}
	if s.resourceAlertEventRepo == nil {
		result.Status = "unavailable"
		result.Message = "项目资源告警事件仓储不可用，未创建事件"
		result.Recovery = "请检查数据库仓储配置后重试；当前未发送通知、不执行硬配额、不启动或停止容器、不写项目目录、不执行 Git。"
		return result, nil
	}

	preview, err := s.GetProjectResourceAlertEvaluationPreview(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result.ProjectID = preview.ProjectID
	result.Status = preview.Status
	result.EvaluationID = preview.EvaluationID
	result.ReadinessStatus = preview.ReadinessStatus
	result.TriggeredCount = preview.TriggeredCount
	result.TriggeredThresholds = preview.TriggeredThresholds
	result.Thresholds = preview.Thresholds
	result.EvaluationPreview = preview
	result.Message = "项目资源告警事件未创建：当前评估不会创建告警"
	result.Recovery = preview.Recovery
	if !preview.WouldCreateAlert {
		return result, nil
	}

	triggeredThresholdsJSON, err := json.Marshal(preview.TriggeredThresholds)
	if err != nil {
		return nil, fmt.Errorf("marshal triggered thresholds: %w", err)
	}
	thresholdsJSON, err := json.Marshal(preview.Thresholds)
	if err != nil {
		return nil, fmt.Errorf("marshal alert thresholds: %w", err)
	}
	previewJSON, err := json.Marshal(preview)
	if err != nil {
		return nil, fmt.Errorf("marshal alert evaluation preview: %w", err)
	}

	createdAt := time.Now().UTC()
	event := &model.ProjectResourceAlertEvent{
		ProjectID:           preview.ProjectID,
		UserID:              userID,
		Status:              "created",
		EvaluationID:        preview.EvaluationID,
		ReadinessStatus:     preview.ReadinessStatus,
		TriggeredCount:      preview.TriggeredCount,
		TriggeredThresholds: string(triggeredThresholdsJSON),
		Thresholds:          string(thresholdsJSON),
		EvaluationPreview:   string(previewJSON),
		Message:             "项目资源告警事件已受控创建",
		Recovery:            "该事件仅记录当前资源告警事实；未发送通知、未执行硬配额、未启动或停止容器、未写项目目录、未执行 Git。",
		CreatedAt:           createdAt,
	}
	if err := s.resourceAlertEventRepo.Create(ctx, event); err != nil {
		return nil, fmt.Errorf("create project resource alert event: %w", err)
	}

	result.Status = "created"
	result.EventCreated = true
	result.EventID = event.ID
	result.CreatedAt = event.CreatedAt
	result.Message = event.Message
	result.Recovery = event.Recovery
	return result, nil
}

// ListProjectResourceAlertEvents returns append-only resource alert events without evaluating runtime facts.
func (s *ProjectService) ListProjectResourceAlertEvents(ctx context.Context, projectID, status string, offset, limit int) (*ProjectResourceAlertEventListResult, error) {
	projectID = strings.TrimSpace(projectID)
	status = strings.TrimSpace(status)
	result := &ProjectResourceAlertEventListResult{
		Status:    "empty",
		ProjectID: projectID,
		Records:   []ProjectResourceAlertEventRecord{},
		Offset:    normalizeResourceAlertEventOffset(offset),
		Limit:     normalizeResourceAlertEventLimit(limit),
		Message:   "项目资源告警事件列表为空",
		Recovery:  "该入口只读取 append-only 告警事件记录；不会重新评估资源、发送通知、执行硬配额、启动或停止容器、写项目目录或执行 Git。",
	}
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if projectID == "" {
		return nil, errors.New("project id is required")
	}
	if s.resourceAlertEventRepo == nil {
		result.Status = "unavailable"
		result.Message = "项目资源告警事件仓储不可用，无法读取事件列表"
		result.Recovery = "请检查数据库仓储配置后重试；当前未重新评估资源、未发送通知、不执行硬配额、不启动或停止容器、不写项目目录、不执行 Git。"
		return result, nil
	}

	records, total, err := s.resourceAlertEventRepo.ListByProjectID(ctx, projectID, status, result.Offset, result.Limit)
	if err != nil {
		return nil, fmt.Errorf("list project resource alert events: %w", err)
	}
	result.Total = total
	result.Records = make([]ProjectResourceAlertEventRecord, 0, len(records))
	for _, record := range records {
		result.Records = append(result.Records, buildProjectResourceAlertEventRecord(record))
	}
	if len(result.Records) > 0 {
		result.Status = "ready"
		result.Message = "项目资源告警事件列表已读取"
		result.Recovery = "该列表只用于查证已受控创建的 append-only 告警事件；不会重新评估资源、发送通知、执行硬配额或修改项目运行时。"
	}
	return result, nil
}

// GetProjectResourceAlertNotificationReadiness checks notification channel configuration without sending notifications.
func (s *ProjectService) GetProjectResourceAlertNotificationReadiness(ctx context.Context, projectID string) (*ProjectResourceAlertNotificationReadiness, error) {
	projectID = strings.TrimSpace(projectID)
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if s.projectRepo == nil {
		return nil, errors.New("project repository not available")
	}
	if projectID == "" {
		return nil, errors.New("project id is required")
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	projectCfg := s.projectResourceConfig(ctx)
	secretCfg := s.projectSecretConfig()
	provider := strings.ToLower(strings.TrimSpace(projectCfg.ResourceAlertNotificationProvider))
	result := &ProjectResourceAlertNotificationReadiness{
		Status:              "blocked",
		ProjectID:           project.ProjectID,
		NotificationEnabled: projectCfg.ResourceAlertNotificationEnabled,
		Provider:            provider,
		WebhookConfigured:   strings.TrimSpace(secretCfg.ResourceAlertNotificationWebhookURL) != "",
		Message:             "项目资源告警通知通道尚未就绪",
		Recovery:            "请启用 PROJECT_RESOURCE_ALERT_NOTIFICATION_ENABLED，配置 provider=webhook，并设置 PROJECT_RESOURCE_ALERT_NOTIFICATION_WEBHOOK_URL；当前只读检查不会发送通知。",
	}
	if !result.NotificationEnabled {
		result.Status = "disabled"
		result.Message = "项目资源告警通知通道已关闭"
		result.Recovery = "如需启用通知通道 readiness，请设置 PROJECT_RESOURCE_ALERT_NOTIFICATION_ENABLED=true；当前不会读取事件候选或发送通知。"
		return result, nil
	}
	if provider == "" {
		result.Message = "项目资源告警通知通道未配置 provider"
		result.Recovery = "请设置 PROJECT_RESOURCE_ALERT_NOTIFICATION_PROVIDER=webhook；当前不会发送通知或修改告警事件。"
		return result, nil
	}
	result.ProviderSupported = provider == "webhook"
	if !result.ProviderSupported {
		result.Message = "项目资源告警通知通道 provider 暂不支持"
		result.Recovery = "当前只支持 webhook provider；请调整 PROJECT_RESOURCE_ALERT_NOTIFICATION_PROVIDER 后重试。"
		return result, nil
	}
	if !result.WebhookConfigured {
		result.Message = "项目资源告警 webhook 目标未配置"
		result.Recovery = "请设置 PROJECT_RESOURCE_ALERT_NOTIFICATION_WEBHOOK_URL；readiness 只返回 webhook_configured 布尔事实，不暴露 URL。"
		return result, nil
	}
	if s.resourceAlertEventRepo == nil {
		result.Status = "unavailable"
		result.Message = "项目资源告警事件仓储不可用，无法确认通知候选事件"
		result.Recovery = "请检查数据库仓储配置后重试；当前未发送通知、不更新事件、不重新评估资源、不执行硬配额。"
		return result, nil
	}

	records, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, project.ProjectID, "created", 0, 1)
	if err != nil {
		return nil, fmt.Errorf("list project resource alert notification candidate events: %w", err)
	}
	if len(records) == 0 {
		result.Status = "empty"
		result.Message = "项目资源告警通知通道配置可用，但没有可通知的已创建告警事件"
		result.Recovery = "请先通过受控入口创建 append-only 资源告警事件；当前 readiness 不会创建事件或发送通知。"
		return result, nil
	}

	candidate := records[0]
	result.Status = "ready"
	result.CandidateEventAvailable = true
	result.CandidateEventID = candidate.ID
	result.CandidateEventStatus = candidate.Status
	result.CandidateEvaluationID = candidate.EvaluationID
	result.CandidateReadinessStatus = candidate.ReadinessStatus
	result.CandidateTriggeredCount = candidate.TriggeredCount
	result.CandidateCreatedAt = candidate.CreatedAt
	result.Message = "项目资源告警通知通道 readiness 已确认"
	result.Recovery = "该 readiness 只证明 webhook 配置和最近可通知事件候选存在；不会发送通知、更新事件、重新评估资源或执行硬配额。"
	return result, nil
}

// SendProjectResourceAlertNotification sends one controlled webhook notification for the latest created alert event.
func (s *ProjectService) SendProjectResourceAlertNotification(ctx context.Context, projectID, userID string, confirmSend bool) (*ProjectResourceAlertNotificationSendResult, error) {
	projectID = strings.TrimSpace(projectID)
	result := &ProjectResourceAlertNotificationSendResult{
		Status:    "blocked",
		ProjectID: projectID,
		Message:   "项目资源告警通知未发送",
		Recovery:  "请先确认通知通道 readiness 和候选事件，再带 confirm_send=true 通过受控入口发送 webhook 通知。",
	}
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if projectID == "" {
		return nil, errors.New("project id is required")
	}
	if !confirmSend {
		result.Message = "项目资源告警通知发送需要显式确认"
		result.Recovery = "该入口会向已配置 webhook 发送通知；请先查看通知通道 readiness，确认后带 confirm_send=true 重试。"
		return result, nil
	}

	readiness, err := s.GetProjectResourceAlertNotificationReadiness(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result.ProjectID = readiness.ProjectID
	result.Provider = readiness.Provider
	result.WebhookConfigured = readiness.WebhookConfigured
	result.CandidateEventID = readiness.CandidateEventID
	result.CandidateEvaluationID = readiness.CandidateEvaluationID
	result.Readiness = readiness
	if readiness.Status != "ready" {
		result.Status = readiness.Status
		result.Message = "项目资源告警通知未发送：通知通道或候选事件未就绪"
		result.Recovery = readiness.Recovery
		return result, nil
	}
	if s.resourceAlertEventRepo == nil {
		result.Status = "unavailable"
		result.Message = "项目资源告警事件仓储不可用，无法发送通知"
		result.Recovery = "请检查数据库仓储配置后重试；当前未发送通知、未更新事件、未重新评估资源、未执行硬配额。"
		return result, nil
	}

	createdEvents, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, readiness.ProjectID, "created", 0, 1)
	if err != nil {
		return nil, fmt.Errorf("load project resource alert notification source event: %w", err)
	}
	if len(createdEvents) == 0 || createdEvents[0].ID != readiness.CandidateEventID {
		result.Status = "blocked"
		result.Message = "项目资源告警通知候选事件已变化，未发送通知"
		result.Recovery = "请重新读取通知通道 readiness 后再发送；当前未发送通知、未更新事件、未重新评估资源。"
		return result, nil
	}
	sourceEvent := createdEvents[0]
	sentEvents, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, readiness.ProjectID, "notification_sent", 0, 20)
	if err != nil {
		return nil, fmt.Errorf("check project resource alert notification delivery events: %w", err)
	}
	if hasNotificationDeliveryForCandidate(sentEvents, sourceEvent) {
		result.Status = "blocked"
		result.Message = "项目资源告警通知已存在成功发送记录，未重复发送"
		result.Recovery = "append-only 事件流已记录该候选事件的 notification_sent 结果；如需再次通知，请先创建新的资源告警事件。"
		return result, nil
	}

	payload, err := buildProjectResourceAlertNotificationWebhookPayload(sourceEvent)
	if err != nil {
		return nil, err
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal project resource alert notification payload: %w", err)
	}

	secretCfg := s.projectSecretConfig()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSpace(secretCfg.ResourceAlertNotificationWebhookURL), bytes.NewReader(payloadBytes))
	if err != nil {
		return s.recordProjectResourceAlertNotificationFailure(ctx, result, sourceEvent, userID, 0, "项目资源告警 webhook 请求构造失败"), nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-YiStack-Resource-Alert-Event-ID", fmt.Sprintf("%d", sourceEvent.ID))
	req.Header.Set("X-YiStack-Resource-Alert-Evaluation-ID", sourceEvent.EvaluationID)

	httpClient := s.notificationHTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return s.recordProjectResourceAlertNotificationFailure(ctx, result, sourceEvent, userID, 0, "项目资源告警 webhook 请求失败"), nil
	}
	defer resp.Body.Close()
	result.HTTPStatusCode = resp.StatusCode
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return s.recordProjectResourceAlertNotificationFailure(ctx, result, sourceEvent, userID, resp.StatusCode, "项目资源告警 webhook 返回非 2xx 状态"), nil
	}

	event, err := s.createProjectResourceAlertNotificationDeliveryEvent(ctx, sourceEvent, userID, "notification_sent", "项目资源告警 webhook 通知已受控发送", "该结果是 append-only 通知发送记录；未更新源告警事件、未重新评估资源、未执行硬配额、未启动或停止容器、未写项目目录、未执行 Git。")
	if err != nil {
		return nil, err
	}
	result.Status = "sent"
	result.NotificationSent = true
	result.NotificationEventCreated = true
	result.NotificationEventID = event.ID
	result.CreatedAt = event.CreatedAt
	result.Message = event.Message
	result.Recovery = event.Recovery
	return result, nil
}

// GetProjectResourceAlertEnforcementReadiness checks hard-quota enforcement readiness without executing it.
func (s *ProjectService) GetProjectResourceAlertEnforcementReadiness(ctx context.Context, projectID string) (*ProjectResourceAlertEnforcementReadiness, error) {
	projectID = strings.TrimSpace(projectID)
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if s.projectRepo == nil {
		return nil, errors.New("project repository not available")
	}
	if projectID == "" {
		return nil, errors.New("project id is required")
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	projectCfg := s.projectResourceConfig(ctx)
	mode := strings.ToLower(strings.TrimSpace(projectCfg.ResourceAlertEnforcementMode))
	result := &ProjectResourceAlertEnforcementReadiness{
		Status:                   "blocked",
		ProjectID:                project.ProjectID,
		EnforcementEnabled:       projectCfg.ResourceAlertEnforcementEnabled,
		EnforcementMode:          mode,
		EnforcementModeSupported: mode == "stop_container",
		NotificationSentRequired: true,
		Message:                  "项目资源告警硬配额执行 readiness 尚未就绪",
		Recovery:                 "请启用 PROJECT_RESOURCE_ALERT_ENFORCEMENT_ENABLED，设置 PROJECT_RESOURCE_ALERT_ENFORCEMENT_MODE=stop_container，并确认已有告警事件和通知发送记录；当前只读检查不会执行硬配额或停止容器。",
	}
	if !result.EnforcementEnabled {
		result.Status = "disabled"
		result.Message = "项目资源告警硬配额执行 readiness 已关闭"
		result.Recovery = "如需检查硬配额执行前置条件，请设置 PROJECT_RESOURCE_ALERT_ENFORCEMENT_ENABLED=true；当前不会读取告警事件、重新评估资源或操作容器。"
		return result, nil
	}
	if mode == "" {
		result.Message = "项目资源告警硬配额执行模式未配置"
		result.Recovery = "请设置 PROJECT_RESOURCE_ALERT_ENFORCEMENT_MODE=stop_container；当前只读检查不会执行硬配额、停止容器或写项目目录。"
		return result, nil
	}
	if !result.EnforcementModeSupported {
		result.Message = "项目资源告警硬配额执行模式暂不支持"
		result.Recovery = "当前 readiness 仅识别 stop_container 模式作为后续受控执行前置条件；当前不会执行硬配额、启动或停止容器。"
		return result, nil
	}
	if s.resourceAlertEventRepo == nil {
		result.Status = "unavailable"
		result.Message = "项目资源告警事件仓储不可用，无法确认硬配额执行前置事件"
		result.Recovery = "请检查数据库仓储配置后重试；当前未重新评估资源、未执行硬配额、未启动或停止容器、未写项目目录、未执行 Git。"
		return result, nil
	}

	createdEvents, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, project.ProjectID, "created", 0, 1)
	if err != nil {
		return nil, fmt.Errorf("load project resource alert enforcement candidate event: %w", err)
	}
	if len(createdEvents) == 0 {
		result.Status = "empty"
		result.Message = "项目资源告警硬配额执行 readiness 未发现候选告警事件"
		result.Recovery = "请先通过资源告警评估和受控创建入口写入 append-only 告警事件；当前不会重新评估资源或执行硬配额。"
		return result, nil
	}
	candidate := createdEvents[0]
	result.CandidateEventAvailable = true
	result.CandidateEventID = candidate.ID
	result.CandidateEvaluationID = candidate.EvaluationID
	result.CandidateReadinessStatus = candidate.ReadinessStatus
	result.CandidateTriggeredCount = candidate.TriggeredCount
	if candidate.ReadinessStatus != "alerting" || candidate.TriggeredCount <= 0 {
		result.Message = "项目资源告警候选事件不满足硬配额执行前置条件"
		result.Recovery = "硬配额执行 readiness 只接受 readiness=alerting 且存在触发阈值的候选事件；当前不会重新评估资源或执行硬配额。"
		return result, nil
	}

	sentEvents, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, project.ProjectID, "notification_sent", 0, 20)
	if err != nil {
		return nil, fmt.Errorf("load project resource alert notification delivery events for enforcement readiness: %w", err)
	}
	result.NotificationSentAvailable = hasNotificationDeliveryForCandidate(sentEvents, candidate)
	if !result.NotificationSentAvailable {
		result.Message = "项目资源告警硬配额执行 readiness 缺少通知发送证据"
		result.Recovery = "请先通过受控通知入口发送 webhook 并产生 notification_sent 事件；当前不会执行硬配额、启动或停止容器。"
		return result, nil
	}

	result.Status = "ready"
	result.WouldEnforce = true
	result.Message = "项目资源告警硬配额执行前置条件已就绪"
	result.Recovery = "该 readiness 只说明后续可进入显式受控硬配额执行流程；当前没有执行 stop_container、没有重新评估资源、没有写项目目录、没有执行 Git。"
	return result, nil
}

// ExecuteProjectResourceAlertEnforcement executes the configured hard-quota action after re-checking readiness.
func (s *ProjectService) ExecuteProjectResourceAlertEnforcement(ctx context.Context, projectID, userID string, confirmExecute bool) (*ProjectResourceAlertEnforcementExecuteResult, error) {
	projectID = strings.TrimSpace(projectID)
	result := &ProjectResourceAlertEnforcementExecuteResult{
		Status:    "blocked",
		ProjectID: projectID,
		Message:   "项目资源告警硬配额执行未触发",
		Recovery:  "请先确认硬配额执行 readiness，再带 confirm_execute=true 通过受控入口执行。",
	}
	if s == nil {
		return nil, errors.New("project service not available")
	}
	if projectID == "" {
		return nil, errors.New("project id is required")
	}
	if !confirmExecute {
		result.Message = "项目资源告警硬配额执行需要显式确认"
		result.Recovery = "该入口可能按配置停止项目容器；请先查看硬配额执行 readiness，确认后带 confirm_execute=true 重试。"
		return result, nil
	}

	readiness, err := s.GetProjectResourceAlertEnforcementReadiness(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result.ProjectID = readiness.ProjectID
	result.CandidateEventID = readiness.CandidateEventID
	result.CandidateEvaluationID = readiness.CandidateEvaluationID
	result.Mode = readiness.EnforcementMode
	result.Readiness = readiness
	if readiness.Status != "ready" || !readiness.WouldEnforce {
		result.Status = readiness.Status
		result.Message = "项目资源告警硬配额执行被 readiness guard 阻断"
		result.Recovery = readiness.Recovery
		return result, nil
	}
	if readiness.EnforcementMode != "stop_container" {
		result.Status = "blocked"
		result.Message = "项目资源告警硬配额执行模式暂不支持"
		result.Recovery = "当前执行入口只允许 stop_container 模式；未执行停止容器、未写入执行事件。"
		return result, nil
	}
	if s.resourceAlertEventRepo == nil {
		result.Status = "unavailable"
		result.Message = "项目资源告警事件仓储不可用，无法记录硬配额执行事件"
		result.Recovery = "请检查数据库仓储配置后重试；当前不会在缺少 append-only 记录能力时执行 stop_container。"
		return result, nil
	}

	createdEvents, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, readiness.ProjectID, "created", 0, 1)
	if err != nil {
		return nil, fmt.Errorf("load project resource alert enforcement source event: %w", err)
	}
	if len(createdEvents) == 0 || createdEvents[0].ID != readiness.CandidateEventID {
		result.Status = "blocked"
		result.Message = "项目资源告警硬配额执行候选事件已变化，未执行 stop_container"
		result.Recovery = "请重新读取硬配额执行 readiness 后再执行；当前未停止容器、未更新事件、未重新评估资源。"
		return result, nil
	}
	sourceEvent := createdEvents[0]
	executedEvents, _, err := s.resourceAlertEventRepo.ListByProjectID(ctx, readiness.ProjectID, "enforcement_executed", 0, 20)
	if err != nil {
		return nil, fmt.Errorf("check project resource alert enforcement execution events: %w", err)
	}
	if hasEnforcementExecutionForCandidate(executedEvents, sourceEvent) {
		result.Status = "blocked"
		result.Message = "项目资源告警硬配额执行已存在成功记录，未重复停止容器"
		result.Recovery = "append-only 事件流已记录该候选事件的 enforcement_executed 结果；如需再次执行，请先创建新的资源告警事件。"
		return result, nil
	}

	stopResult, err := s.StopProjectContainer(ctx, readiness.ProjectID)
	result.StopResult = stopResult
	if err != nil {
		result.Status = "failed"
		result.Message = "项目资源告警硬配额执行 stop_container 失败"
		result.Recovery = "停止容器失败，未写入 enforcement_executed 事件；请检查 Runtime Health 和容器管理器后重试。"
		return result, nil
	}

	event, err := s.createProjectResourceAlertEnforcementExecutionEvent(ctx, sourceEvent, userID, stopResult)
	if err != nil {
		return nil, err
	}
	result.Status = "executed"
	result.EnforcementExecuted = true
	result.EnforcementEventCreated = true
	result.EnforcementEventID = event.ID
	result.CreatedAt = event.CreatedAt
	result.Message = event.Message
	result.Recovery = event.Recovery
	return result, nil
}

func buildProjectResourceSnapshotBase(project *model.Project) *ProjectResourceSnapshotResult {
	result := &ProjectResourceSnapshotResult{
		Status:          "blocked",
		ProjectID:       project.ProjectID,
		AppType:         project.AppType,
		ContainerStatus: fallbackText(project.ContainerStatus, "unknown"),
		ContainerID:     project.ContainerID,
		ContainerName:   project.ContainerName,
		ContainerImage:  project.ContainerImage,
		ContainerPort:   project.ContainerPort,
		ReadTime:        time.Now().UTC(),
		Message:         "项目资源快照未读取",
		Recovery:        "请确认项目运行时状态后重试。",
	}
	return result
}

func buildProjectResourceAlertThresholdPreviews(readiness *ProjectResourceAlertReadiness) []ProjectResourceAlertThresholdPreview {
	if readiness == nil {
		return nil
	}
	return []ProjectResourceAlertThresholdPreview{
		{
			Name:           "cpu",
			Configured:     readiness.CPUThresholdConfigured,
			CurrentValue:   readiness.CPUPercent,
			ThresholdValue: readiness.CPUThresholdPercent,
			Unit:           "percent",
			Exceeded:       readiness.CPUThresholdExceeded,
		},
		{
			Name:           "memory",
			Configured:     readiness.MemoryThresholdConfigured,
			CurrentValue:   readiness.MemoryUsagePercent,
			ThresholdValue: readiness.MemoryThresholdPercent,
			Unit:           "percent",
			Exceeded:       readiness.MemoryThresholdExceeded,
		},
		{
			Name:           "disk",
			Configured:     readiness.DiskThresholdConfigured,
			CurrentValue:   float64(readiness.DiskUsageBytes),
			ThresholdValue: float64(readiness.DiskThresholdBytes),
			Unit:           "bytes",
			Exceeded:       readiness.DiskThresholdExceeded,
		},
	}
}

func normalizeResourceAlertEventOffset(offset int) int {
	if offset < 0 {
		return 0
	}
	return offset
}

func normalizeResourceAlertEventLimit(limit int) int {
	if limit <= 0 {
		return 20
	}
	if limit > 100 {
		return 100
	}
	return limit
}

func buildProjectResourceAlertEventRecord(event model.ProjectResourceAlertEvent) ProjectResourceAlertEventRecord {
	record := ProjectResourceAlertEventRecord{
		ID:                     event.ID,
		ProjectID:              event.ProjectID,
		UserID:                 event.UserID,
		Status:                 event.Status,
		EvaluationID:           event.EvaluationID,
		ReadinessStatus:        event.ReadinessStatus,
		TriggeredCount:         event.TriggeredCount,
		RawTriggeredThresholds: event.TriggeredThresholds,
		RawThresholds:          event.Thresholds,
		RawEvaluationPreview:   event.EvaluationPreview,
		Message:                event.Message,
		Recovery:               event.Recovery,
		CreatedAt:              event.CreatedAt,
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(event.TriggeredThresholds)), &record.TriggeredThresholds); err != nil && strings.TrimSpace(event.TriggeredThresholds) != "" {
		record.TriggeredThresholdsParseError = err.Error()
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(event.Thresholds)), &record.Thresholds); err != nil && strings.TrimSpace(event.Thresholds) != "" {
		record.ThresholdsParseError = err.Error()
	}
	if strings.TrimSpace(event.EvaluationPreview) != "" {
		var preview ProjectResourceAlertEvaluationPreview
		if err := json.Unmarshal([]byte(strings.TrimSpace(event.EvaluationPreview)), &preview); err != nil {
			record.EvaluationPreviewParseError = err.Error()
		} else {
			record.EvaluationPreview = &preview
		}
	}
	return record
}

func buildProjectResourceAlertNotificationWebhookPayload(event model.ProjectResourceAlertEvent) (*projectResourceAlertNotificationWebhookPayload, error) {
	record := buildProjectResourceAlertEventRecord(event)
	if record.TriggeredThresholdsParseError != "" {
		return nil, fmt.Errorf("parse notification source triggered thresholds: %s", record.TriggeredThresholdsParseError)
	}
	if record.ThresholdsParseError != "" {
		return nil, fmt.Errorf("parse notification source thresholds: %s", record.ThresholdsParseError)
	}
	return &projectResourceAlertNotificationWebhookPayload{
		Type:                 "project_resource_alert",
		ProjectID:            event.ProjectID,
		SourceEventID:        event.ID,
		EvaluationID:         event.EvaluationID,
		ReadinessStatus:      event.ReadinessStatus,
		TriggeredCount:       event.TriggeredCount,
		TriggeredThresholds:  record.TriggeredThresholds,
		Thresholds:           record.Thresholds,
		SourceEventCreatedAt: event.CreatedAt,
		Message:              "YiStack 项目资源告警通知",
	}, nil
}

func hasNotificationDeliveryForCandidate(records []model.ProjectResourceAlertEvent, candidate model.ProjectResourceAlertEvent) bool {
	sourceMarker := fmt.Sprintf("source_event_id=%d", candidate.ID)
	for _, record := range records {
		if record.Status != "notification_sent" {
			continue
		}
		if record.EvaluationID != candidate.EvaluationID {
			continue
		}
		if strings.Contains(record.Message, sourceMarker) {
			return true
		}
	}
	return false
}

func hasEnforcementExecutionForCandidate(records []model.ProjectResourceAlertEvent, candidate model.ProjectResourceAlertEvent) bool {
	sourceMarker := fmt.Sprintf("source_event_id=%d", candidate.ID)
	for _, record := range records {
		if record.Status != "enforcement_executed" {
			continue
		}
		if record.EvaluationID != candidate.EvaluationID {
			continue
		}
		if strings.Contains(record.Message, sourceMarker) {
			return true
		}
	}
	return false
}

func (s *ProjectService) recordProjectResourceAlertNotificationFailure(ctx context.Context, result *ProjectResourceAlertNotificationSendResult, sourceEvent model.ProjectResourceAlertEvent, userID string, httpStatusCode int, message string) *ProjectResourceAlertNotificationSendResult {
	recovery := "该失败结果已作为 append-only 通知发送记录保存；可修复 webhook 服务或配置后重试。当前未更新源告警事件、未重新评估资源、未执行硬配额、未启动或停止容器、未写项目目录、未执行 Git。"
	if httpStatusCode > 0 {
		message = fmt.Sprintf("%s：http_status=%d", message, httpStatusCode)
	}
	event, err := s.createProjectResourceAlertNotificationDeliveryEvent(ctx, sourceEvent, userID, "notification_failed", message, recovery)
	result.Status = "failed"
	result.NotificationSent = false
	result.HTTPStatusCode = httpStatusCode
	result.Message = message
	result.Recovery = recovery
	if err != nil {
		result.Message = "项目资源告警 webhook 通知发送失败，且失败事件写入失败"
		result.Recovery = "请检查告警事件仓储和 webhook 配置；当前未更新源告警事件、未重新评估资源、未执行硬配额。"
		return result
	}
	result.NotificationEventCreated = true
	result.NotificationEventID = event.ID
	result.CreatedAt = event.CreatedAt
	return result
}

func (s *ProjectService) createProjectResourceAlertNotificationDeliveryEvent(ctx context.Context, sourceEvent model.ProjectResourceAlertEvent, userID, status, message, recovery string) (*model.ProjectResourceAlertEvent, error) {
	if s.resourceAlertEventRepo == nil {
		return nil, errors.New("project resource alert event repository not available")
	}
	createdAt := time.Now().UTC()
	event := &model.ProjectResourceAlertEvent{
		ProjectID:           sourceEvent.ProjectID,
		UserID:              userID,
		Status:              status,
		EvaluationID:        sourceEvent.EvaluationID,
		ReadinessStatus:     sourceEvent.ReadinessStatus,
		TriggeredCount:      sourceEvent.TriggeredCount,
		TriggeredThresholds: sourceEvent.TriggeredThresholds,
		Thresholds:          sourceEvent.Thresholds,
		EvaluationPreview:   sourceEvent.EvaluationPreview,
		Message:             fmt.Sprintf("%s；source_event_id=%d", message, sourceEvent.ID),
		Recovery:            recovery,
		CreatedAt:           createdAt,
	}
	if err := s.resourceAlertEventRepo.Create(ctx, event); err != nil {
		return nil, fmt.Errorf("create project resource alert notification delivery event: %w", err)
	}
	return event, nil
}

func (s *ProjectService) createProjectResourceAlertEnforcementExecutionEvent(ctx context.Context, sourceEvent model.ProjectResourceAlertEvent, userID string, stopResult *ProjectContainerStopResult) (*model.ProjectResourceAlertEvent, error) {
	if s.resourceAlertEventRepo == nil {
		return nil, errors.New("project resource alert event repository not available")
	}
	stopStatus := ""
	containerStatus := ""
	if stopResult != nil {
		stopStatus = stopResult.StopStatus
		containerStatus = stopResult.ContainerStatus
	}
	createdAt := time.Now().UTC()
	event := &model.ProjectResourceAlertEvent{
		ProjectID:           sourceEvent.ProjectID,
		UserID:              userID,
		Status:              "enforcement_executed",
		EvaluationID:        sourceEvent.EvaluationID,
		ReadinessStatus:     sourceEvent.ReadinessStatus,
		TriggeredCount:      sourceEvent.TriggeredCount,
		TriggeredThresholds: sourceEvent.TriggeredThresholds,
		Thresholds:          sourceEvent.Thresholds,
		EvaluationPreview:   sourceEvent.EvaluationPreview,
		Message:             fmt.Sprintf("项目资源告警硬配额 stop_container 已受控执行；source_event_id=%d；stop_status=%s；container_status=%s", sourceEvent.ID, stopStatus, containerStatus),
		Recovery:            "该结果是 append-only 硬配额执行记录；已复用受控停止容器链路并写入 runtime stop 状态。未更新源告警事件、未重新评估资源、未写项目目录、未执行 Git。",
		CreatedAt:           createdAt,
	}
	if err := s.resourceAlertEventRepo.Create(ctx, event); err != nil {
		return nil, fmt.Errorf("create project resource alert enforcement execution event: %w", err)
	}
	return event, nil
}

func applyProjectResourceSnapshotContainerInfo(result *ProjectResourceSnapshotResult, project *model.Project, info *container.ContainerInfo, exists bool) {
	result.ContainerStatus = fallbackText(project.ContainerStatus, "unknown")
	result.ContainerID = project.ContainerID
	result.ContainerName = project.ContainerName
	result.ContainerImage = project.ContainerImage
	result.ContainerPort = project.ContainerPort
	if !exists || info == nil {
		return
	}
	result.ContainerStatus = string(info.Status)
	result.ContainerID = info.ContainerID
	result.ContainerName = info.Name
	result.ContainerImage = info.Image
	result.ContainerPort = info.Port
}

func (s *ProjectService) projectResourceConfig(ctx context.Context) config.ProjectConfig {
	cfg := config.Get().Project
	if s.projectCfg != nil {
		cfg = *s.projectCfg
	}
	if s != nil && s.systemConfigSvc != nil {
		if items, err := s.systemConfigSvc.ListConfigItems(ctx); err == nil {
			ApplyProjectRuntimeConfigItems(&cfg, items)
		}
	}
	return cfg
}
