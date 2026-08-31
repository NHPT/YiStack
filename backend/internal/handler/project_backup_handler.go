package handler

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

type projectBackupRestorePreflightRequest struct {
	BackupID string `json:"backup_id"`
}

type projectBackupRemoteUploadRequest struct {
	BackupID string `json:"backup_id"`
}

type projectBackupRemoteDownloadRequest struct {
	BackupID string `json:"backup_id"`
}

type projectBackupRemoteRestoreRequest struct {
	BackupID       string `json:"backup_id"`
	ConfirmRestore bool   `json:"confirm_restore"`
}

type projectBackupRestoreRequest struct {
	BackupID       string `json:"backup_id"`
	ConfirmRestore bool   `json:"confirm_restore"`
}

// ListBackups GET /api/project/:id/backups 列出项目本地备份 manifest。
func (h *ProjectHandler) ListBackups(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.ListProjectBackups(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to list project backups",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// GetBackupPolicyReadiness GET /api/project/:id/backups/policy-readiness 只读查看自动备份策略就绪度。
func (h *ProjectHandler) GetBackupPolicyReadiness(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.GetProjectBackupPolicyReadiness(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to read project backup policy readiness",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// GetBackupRemoteStorageReadiness GET /api/project/:id/backups/remote-storage-readiness 只读查看备份远端存储前置条件。
func (h *ProjectHandler) GetBackupRemoteStorageReadiness(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.GetProjectBackupRemoteStorageReadiness(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to read project backup remote storage readiness",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// ListBackupRemoteInventory GET /api/project/:id/backups/remote-inventory 只读列举远端备份对象候选。
func (h *ProjectHandler) ListBackupRemoteInventory(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.ListProjectBackupRemoteInventory(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to list project backup remote inventory",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// UploadBackupToRemoteStorage POST /api/project/:id/backups/remote-upload 上传已校验的本地备份归档和 manifest 到远端存储。
func (h *ProjectHandler) UploadBackupToRemoteStorage(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	var req projectBackupRemoteUploadRequest
	if err := ctx.Bind(&req); err != nil || strings.TrimSpace(req.BackupID) == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "backup_id is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.UploadProjectBackupToRemoteStorage(c, projectID, req.BackupID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to upload project backup to remote storage",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// DownloadBackupFromRemoteStorage POST /api/project/:id/backups/remote-download 下载远端完整候选到本地备份目录。
func (h *ProjectHandler) DownloadBackupFromRemoteStorage(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	var req projectBackupRemoteDownloadRequest
	if err := ctx.Bind(&req); err != nil || strings.TrimSpace(req.BackupID) == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "backup_id is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.DownloadProjectBackupFromRemoteStorage(c, projectID, req.BackupID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to download project backup from remote storage",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// RestoreBackupFromRemoteStorage POST /api/project/:id/backups/remote-restore 下载远端完整候选并执行受控恢复。
func (h *ProjectHandler) RestoreBackupFromRemoteStorage(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	var req projectBackupRemoteRestoreRequest
	if err := ctx.Bind(&req); err != nil || strings.TrimSpace(req.BackupID) == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "backup_id is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.RestoreProjectBackupFromRemoteStorage(c, projectID, req.BackupID, req.ConfirmRestore)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to restore project backup from remote storage",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// RunAutomaticBackup POST /api/project/:id/backups/automatic-run 按自动备份策略执行一次受控本地备份。
func (h *ProjectHandler) RunAutomaticBackup(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.RunProjectAutomaticBackup(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to run project automatic backup",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// PreflightBackupRestore POST /api/project/:id/backups/restore-preflight 只读预检项目备份恢复风险。
func (h *ProjectHandler) PreflightBackupRestore(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	var req projectBackupRestorePreflightRequest
	if err := ctx.Bind(&req); err != nil || strings.TrimSpace(req.BackupID) == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "backup_id is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.PreflightProjectBackupRestore(c, projectID, req.BackupID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to preflight project backup restore",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// DownloadBackup GET /api/project/:id/backups/:backup_id/download 下载项目本地备份归档。
func (h *ProjectHandler) DownloadBackup(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	backupID := ctx.Param("backup_id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}
	if strings.TrimSpace(backupID) == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "backup_id is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	download, err := projectService.PrepareProjectBackupDownload(c, projectID, backupID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to download project backup",
			"details": err.Error(),
		})
		return
	}

	ctx.Response.Header.Set("Content-Type", "application/gzip")
	ctx.Response.Header.Set("X-YiStack-Project-ID", download.ProjectID)
	ctx.Response.Header.Set("X-YiStack-Backup-ID", download.BackupID)
	ctx.Response.Header.Set("X-YiStack-Backup-Manifest", download.ManifestName)
	ctx.Response.Header.Set("X-YiStack-Backup-Checksum-SHA256", download.ChecksumSHA256)
	ctx.Response.Header.Set("X-YiStack-Backup-Checksum-Verified", fmt.Sprintf("%t", download.ChecksumVerified))
	ctx.FileAttachment(download.ArchivePath, download.FileName)
}

// RestoreBackup POST /api/project/:id/backups/restore 受控恢复项目本地备份。
func (h *ProjectHandler) RestoreBackup(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	var req projectBackupRestoreRequest
	if err := ctx.Bind(&req); err != nil || strings.TrimSpace(req.BackupID) == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "backup_id is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.RestoreProjectBackup(c, projectID, req.BackupID, req.ConfirmRestore)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to restore project backup",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}

// CreateBackup POST /api/project/:id/backups/create 创建项目目录本地备份。
func (h *ProjectHandler) CreateBackup(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]any{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CreateProjectBackup(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]any{
			"error":   "Failed to create project backup",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    result,
	})
}
