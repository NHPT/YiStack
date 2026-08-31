package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"
)

type ProjectAutomaticBackupSchedulerSummary struct {
	Status              string                                  `json:"status"`
	Source              string                                  `json:"source"`
	AutoBackupEnabled   bool                                    `json:"auto_backup_enabled"`
	BackupDirConfigured bool                                    `json:"backup_dir_configured"`
	BackupDir           string                                  `json:"backup_dir"`
	IntervalSeconds     int                                     `json:"interval_seconds"`
	ProjectCount        int                                     `json:"project_count"`
	CreatedCount        int                                     `json:"created_count"`
	BlockedCount        int                                     `json:"blocked_count"`
	FailedCount         int                                     `json:"failed_count"`
	Results             []ProjectAutomaticBackupSchedulerRecord `json:"results"`
	Message             string                                  `json:"message"`
	Recovery            string                                  `json:"recovery"`
}

type ProjectAutomaticBackupSchedulerRecord struct {
	ProjectID     string `json:"project_id"`
	Status        string `json:"status"`
	BackupID      string `json:"backup_id"`
	BackupCreated bool   `json:"backup_created"`
	Source        string `json:"source"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
	Error         string `json:"error,omitempty"`
}

const projectAutomaticBackupSchedulerSource = "automatic_policy_scheduler"

// RunProjectAutomaticBackupSchedulerOnce 执行一轮自动备份调度。
// 调度器只枚举项目并调用 RunProjectAutomaticBackup，不绕过自动备份策略 guard。
func (s *ProjectService) RunProjectAutomaticBackupSchedulerOnce(ctx context.Context) (*ProjectAutomaticBackupSchedulerSummary, error) {
	if s == nil {
		return &ProjectAutomaticBackupSchedulerSummary{
			Status:          "failed",
			Source:          projectAutomaticBackupSchedulerSource,
			FailedCount:     1,
			Results:         []ProjectAutomaticBackupSchedulerRecord{},
			Message:         "项目服务不可用，自动备份后台调度无法执行",
			Recovery:        "请检查后端服务装配状态；当前调度轮次没有确认任何项目备份已创建。",
			IntervalSeconds: 0,
		}, fmt.Errorf("project service not available")
	}

	projectCfg := s.projectBackupConfig(ctx)
	summary := &ProjectAutomaticBackupSchedulerSummary{
		Status:              "skipped",
		Source:              projectAutomaticBackupSchedulerSource,
		AutoBackupEnabled:   projectCfg.AutoBackup,
		BackupDirConfigured: strings.TrimSpace(projectCfg.BackupDir) != "",
		BackupDir:           strings.TrimSpace(projectCfg.BackupDir),
		IntervalSeconds:     projectCfg.AutoBackupIntervalSeconds,
		Results:             []ProjectAutomaticBackupSchedulerRecord{},
	}

	if !projectCfg.AutoBackup {
		summary.Message = "项目自动备份后台调度已关闭"
		summary.Recovery = "如需启用后台调度，请设置 PROJECT_AUTO_BACKUP=true；当前调度轮次不会枚举项目或创建备份。"
		return summary, nil
	}
	if !summary.BackupDirConfigured {
		summary.Status = "blocked"
		summary.Message = "项目自动备份目录未配置"
		summary.Recovery = "请先配置 PROJECT_BACKUP_DIR；当前调度轮次不会枚举项目、创建备份目录或发布归档。"
		return summary, nil
	}
	if s.projectRepo == nil {
		summary.Status = "failed"
		summary.FailedCount = 1
		summary.Message = "项目仓储不可用，自动备份后台调度无法枚举项目"
		summary.Recovery = "请检查后端数据库或仓储初始化状态；当前调度轮次没有确认任何项目备份已创建。"
		return summary, fmt.Errorf("project repository not available")
	}

	const pageSize = 100
	for page := 1; ; page++ {
		projects, total, err := s.ListProjects(ctx, page, pageSize)
		if err != nil {
			summary.Status = "failed"
			summary.FailedCount++
			summary.Message = fmt.Sprintf("项目自动备份后台调度枚举项目失败：%s", err.Error())
			summary.Recovery = "请检查项目列表仓储和数据库状态；当前调度轮次不会跳过枚举失败继续发布不完整备份。"
			return summary, err
		}
		if len(projects) == 0 {
			break
		}

		for i := range projects {
			projectID := strings.TrimSpace(projects[i].ProjectID)
			if projectID == "" {
				summary.FailedCount++
				summary.Results = append(summary.Results, ProjectAutomaticBackupSchedulerRecord{
					Status:   "failed",
					Message:  "项目记录缺少 project_id，自动备份调度已跳过该记录",
					Recovery: "请修复 projects 表中的项目身份字段后等待下一轮调度。",
				})
				continue
			}

			result, err := s.RunProjectAutomaticBackup(ctx, projectID)
			record := ProjectAutomaticBackupSchedulerRecord{ProjectID: projectID}
			if err != nil {
				summary.FailedCount++
				record.Status = "failed"
				record.Message = "项目自动备份执行失败"
				record.Recovery = "请检查项目目录、备份目录和后端日志；当前项目没有确认创建 automatic_policy 备份。"
				record.Error = err.Error()
				summary.Results = append(summary.Results, record)
				continue
			}
			if result == nil {
				summary.FailedCount++
				record.Status = "failed"
				record.Message = "项目自动备份执行返回空结果"
				record.Recovery = "请检查备份服务实现；当前项目没有确认创建 automatic_policy 备份。"
				summary.Results = append(summary.Results, record)
				continue
			}

			record.Status = result.Status
			record.BackupID = result.BackupID
			record.BackupCreated = result.BackupCreated
			record.Source = result.Source
			record.Message = result.Message
			record.Recovery = result.Recovery
			if result.Status == "created" {
				summary.CreatedCount++
			} else {
				summary.BlockedCount++
			}
			summary.Results = append(summary.Results, record)
		}

		summary.ProjectCount += len(projects)
		if int64(page*pageSize) >= total || len(projects) < pageSize {
			break
		}
	}

	if summary.FailedCount > 0 {
		summary.Status = "partial"
	} else {
		summary.Status = "completed"
	}
	summary.Message = fmt.Sprintf("项目自动备份后台调度完成：创建 %d 个，阻断 %d 个，失败 %d 个", summary.CreatedCount, summary.BlockedCount, summary.FailedCount)
	summary.Recovery = "后台调度只调用受控自动备份入口；请在本地备份目录按 automatic_policy 来源核验归档和 manifest。"
	return summary, nil
}

// StartProjectAutomaticBackupScheduler 启动自动备份后台调度循环。
func (s *ProjectService) StartProjectAutomaticBackupScheduler(ctx context.Context) {
	if s == nil {
		log.Println("Project automatic backup scheduler disabled: project service not available")
		return
	}

	projectCfg := s.projectBackupConfig(ctx)
	intervalSeconds := projectCfg.AutoBackupIntervalSeconds
	if !projectCfg.AutoBackup {
		log.Println("Project automatic backup scheduler disabled: PROJECT_AUTO_BACKUP=false")
		return
	}
	if strings.TrimSpace(projectCfg.BackupDir) == "" {
		log.Println("Project automatic backup scheduler blocked: PROJECT_BACKUP_DIR is empty")
		return
	}
	if intervalSeconds <= 0 {
		log.Println("Project automatic backup scheduler disabled: PROJECT_AUTO_BACKUP_INTERVAL_SECONDS<=0")
		return
	}

	interval := time.Duration(intervalSeconds) * time.Second
	log.Printf("Project automatic backup scheduler enabled: interval=%s backup_dir=%s", interval, strings.TrimSpace(projectCfg.BackupDir))
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("Project automatic backup scheduler stopped")
				return
			case <-ticker.C:
				summary, err := s.RunProjectAutomaticBackupSchedulerOnce(ctx)
				if err != nil {
					log.Printf("Project automatic backup scheduler run failed: %v", err)
					continue
				}
				log.Printf(
					"Project automatic backup scheduler run %s: projects=%d created=%d blocked=%d failed=%d",
					summary.Status,
					summary.ProjectCount,
					summary.CreatedCount,
					summary.BlockedCount,
					summary.FailedCount,
				)
			}
		}
	}()
}
