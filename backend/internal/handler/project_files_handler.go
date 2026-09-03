package handler

import (
	"context"
	"errors"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

// GetCommits GET /api/project/:id/commits 获取项目 Git 提交历史。
func (h *ProjectHandler) GetCommits(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	commits, err := projectService.GetProjectGitCommits(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project commits",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    commits,
	})
}

// GetBranches GET /api/project/:id/branches 获取项目 Git 分支列表。
func (h *ProjectHandler) GetBranches(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	branches, err := projectService.GetProjectGitBranches(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project branches",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    branches,
	})
}

// GetRemoteBranches GET /api/project/:id/remote-branches 获取项目 Git 远端分支只读列表。
func (h *ProjectHandler) GetRemoteBranches(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	branches, err := projectService.GetProjectGitRemoteBranches(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project remote branches",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    branches,
	})
}

// GetRemotes GET /api/project/:id/remotes 获取项目 Git remote 名称只读列表。
func (h *ProjectHandler) GetRemotes(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	remotes, err := projectService.GetProjectGitRemotes(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get project git remotes",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    remotes,
	})
}

// GetTags GET /api/project/:id/tags 获取项目 Git 标签列表。
func (h *ProjectHandler) GetTags(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	tags, err := projectService.GetProjectGitTags(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project tags",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tags,
	})
}

// GetStashes GET /api/project/:id/stashes 获取项目 Git stash 只读列表。
func (h *ProjectHandler) GetStashes(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	stashes, err := projectService.GetProjectGitStashes(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project stashes",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    stashes,
	})
}

type ApplyStashRequest struct {
	Ref string `json:"ref"`
}

type CreateStashRequest struct {
	Message string `json:"message"`
}

// ApplyStash POST /api/project/:id/stashes/apply 受控应用项目 Git stash。
func (h *ProjectHandler) ApplyStash(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req ApplyStashRequest
	if err := ctx.Bind(&req); err != nil || req.Ref == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Stash ref is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.ApplyProjectGitStash(c, projectID, req.Ref)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to apply project stash",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CreateStash POST /api/project/:id/stashes/create 受控保存当前 dirty worktree 为 Git stash。
func (h *ProjectHandler) CreateStash(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CreateStashRequest
	if err := ctx.Bind(&req); err != nil || req.Message == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Stash message is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CreateProjectGitStash(c, projectID, req.Message)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create project stash",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetWorktreeStatus GET /api/project/:id/worktree-status 获取项目 Git worktree 只读状态。
func (h *ProjectHandler) GetWorktreeStatus(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	status, err := projectService.GetProjectGitWorktreeStatus(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project worktree status",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    status,
	})
}

// GetBranchCompare GET /api/project/:id/branches/compare 获取项目 Git 分支只读对比。
func (h *ProjectHandler) GetBranchCompare(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	baseBranch := ctx.Query("base")
	headBranch := ctx.Query("head")
	if projectID == "" || baseBranch == "" || headBranch == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID, base branch and head branch are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	compare, err := projectService.GetProjectGitBranchCompare(c, projectID, baseBranch, headBranch)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to compare project branches",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    compare,
	})
}

// GetBranchSwitchReadiness GET /api/project/:id/branches/switch-readiness 获取项目 Git 分支切换只读预检。
func (h *ProjectHandler) GetBranchSwitchReadiness(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	targetBranch := ctx.Query("target")
	if projectID == "" || targetBranch == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and target branch are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	readiness, err := projectService.GetProjectGitBranchSwitchReadiness(c, projectID, targetBranch)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to check project branch switch readiness",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    readiness,
	})
}

type SwitchBranchRequest struct {
	Target string `json:"target"`
}

type CreateBranchRequest struct {
	Name string `json:"name"`
}

type CreateTagRequest struct {
	Name string `json:"name"`
}

type CreateBranchFromRemoteRequest struct {
	RemoteBranch string `json:"remote_branch"`
	Name         string `json:"name"`
}

type RefreshRemoteBranchesRequest struct {
	Remote string `json:"remote"`
}

type DeleteBranchRequest struct {
	Name string `json:"name"`
}

type RenameBranchRequest struct {
	PreviousName string `json:"previous_name"`
	Name         string `json:"name"`
}

// SwitchBranch POST /api/project/:id/branches/switch 按 readiness guard 切换项目 Git 分支。
func (h *ProjectHandler) SwitchBranch(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req SwitchBranchRequest
	if err := ctx.Bind(&req); err != nil || req.Target == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Target branch is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.SwitchProjectGitBranch(c, projectID, req.Target)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to switch project branch",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CreateBranch POST /api/project/:id/branches/create 创建本地 Git 分支但不切换工作区。
func (h *ProjectHandler) CreateBranch(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CreateBranchRequest
	if err := ctx.Bind(&req); err != nil || req.Name == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Branch name is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CreateProjectGitBranch(c, projectID, req.Name)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create project branch",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CreateTag POST /api/project/:id/tags/create 创建本地 Git 标签但不切换或推送。
func (h *ProjectHandler) CreateTag(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CreateTagRequest
	if err := ctx.Bind(&req); err != nil || req.Name == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Tag name is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CreateProjectGitTag(c, projectID, req.Name)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create project tag",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// DeleteTag POST /api/project/:id/tags/delete 删除本地 Git 标签但不删除远端标签。
func (h *ProjectHandler) DeleteTag(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CreateTagRequest
	if err := ctx.Bind(&req); err != nil || req.Name == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Tag name is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.DeleteProjectGitTag(c, projectID, req.Name)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to delete project tag",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CreateBranchFromRemote POST /api/project/:id/branches/create-from-remote 从本地已有远端引用创建本地跟踪分支。
func (h *ProjectHandler) CreateBranchFromRemote(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CreateBranchFromRemoteRequest
	if err := ctx.Bind(&req); err != nil || req.RemoteBranch == "" || req.Name == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Remote branch and branch name are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CreateProjectGitBranchFromRemote(c, projectID, req.RemoteBranch, req.Name)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to create project branch from remote",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// RefreshRemoteBranches POST /api/project/:id/remote-branches/refresh 受控刷新已配置 remote 的本地远端引用。
func (h *ProjectHandler) RefreshRemoteBranches(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req RefreshRemoteBranchesRequest
	if err := ctx.Bind(&req); err != nil || req.Remote == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Remote name is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.RefreshProjectGitRemoteBranches(c, projectID, req.Remote)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to refresh project remote branches",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// RenameBranch POST /api/project/:id/branches/rename 重命名非当前本地 Git 分支。
func (h *ProjectHandler) RenameBranch(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req RenameBranchRequest
	if err := ctx.Bind(&req); err != nil || req.PreviousName == "" || req.Name == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Previous branch name and branch name are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.RenameProjectGitBranch(c, projectID, req.PreviousName, req.Name)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to rename project branch",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// DeleteBranch POST /api/project/:id/branches/delete 删除非当前本地 Git 分支。
func (h *ProjectHandler) DeleteBranch(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req DeleteBranchRequest
	if err := ctx.Bind(&req); err != nil || req.Name == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Branch name is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.DeleteProjectGitBranch(c, projectID, req.Name)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to delete project branch",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetCommit GET /api/project/:id/commits/:hash 获取单个 Git 提交详情。
func (h *ProjectHandler) GetCommit(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	commitHash := ctx.Param("hash")
	if projectID == "" || commitHash == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and commit hash are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	commit, err := projectService.GetProjectGitCommit(c, projectID, commitHash)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to load project commit",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    commit,
	})
}

type RestoreCommitRequest struct {
	Hash string `json:"hash"`
}

type RestoreCommitFileRequest struct {
	Hash string `json:"hash"`
	Path string `json:"path"`
}

type DiscardWorktreeFileRequest struct {
	Path string `json:"path"`
}

type CommitWorktreeRequest struct {
	Message string `json:"message"`
}

type ApplyBranchCompareFileRequest struct {
	BaseBranch string `json:"base_branch"`
	HeadBranch string `json:"head_branch"`
	Path       string `json:"path"`
}

// RestoreCommit POST /api/project/:id/commits/restore 恢复到指定 Git 提交。
func (h *ProjectHandler) RestoreCommit(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req RestoreCommitRequest
	if err := ctx.Bind(&req); err != nil || req.Hash == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Commit hash is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	if err := projectService.RestoreProjectGitCommit(c, projectID, req.Hash); err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to restore project commit",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Project restored",
	})
}

// RestoreCommitFile POST /api/project/:id/commits/restore-file 恢复指定 Git 提交中的单个文件。
func (h *ProjectHandler) RestoreCommitFile(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req RestoreCommitFileRequest
	if err := ctx.Bind(&req); err != nil || req.Hash == "" || req.Path == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Commit hash and file path are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.RestoreProjectGitCommitFile(c, projectID, req.Hash, req.Path)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to restore project commit file",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// DiscardWorktreeFile POST /api/project/:id/worktree/discard-file 丢弃 Git worktree 中的单个文件变更。
func (h *ProjectHandler) DiscardWorktreeFile(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req DiscardWorktreeFileRequest
	if err := ctx.Bind(&req); err != nil || req.Path == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "File path is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.DiscardProjectGitWorktreeFile(c, projectID, req.Path)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to discard project worktree file",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// CommitWorktree POST /api/project/:id/worktree/commit 提交 Git worktree 中的 dirty 变更。
func (h *ProjectHandler) CommitWorktree(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req CommitWorktreeRequest
	if err := ctx.Bind(&req); err != nil || req.Message == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Commit message is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.CommitProjectGitWorktree(c, projectID, req.Message)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to commit project worktree",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// ApplyBranchCompareFile POST /api/project/:id/branches/compare/apply-file 从目标分支引入单个文件到当前基准分支。
func (h *ProjectHandler) ApplyBranchCompareFile(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req ApplyBranchCompareFileRequest
	if err := ctx.Bind(&req); err != nil || req.BaseBranch == "" || req.HeadBranch == "" || req.Path == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Base branch, head branch and file path are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.ApplyProjectGitBranchCompareFile(c, projectID, req.BaseBranch, req.HeadBranch, req.Path)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to apply project branch compare file",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// GetFileTree GET /api/project/:id/files 获取项目文件树。
func (h *ProjectHandler) GetFileTree(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	tree, err := projectService.GetProjectFileTree(c, projectID)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to get file tree",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data":    tree,
	})
}

// ReadFile GET /api/project/:id/files/content 读取文件内容。
func (h *ProjectHandler) ReadFile(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	filePath := ctx.Query("path")
	if projectID == "" || filePath == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID and file path are required",
		})
		return
	}

	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	content, err := projectService.ReadProjectFile(c, projectID, filePath)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to read file",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"path":              filePath,
			"content":           content,
			"resource_revision": service.ProjectFileContentRevision(content),
		},
	})
}

// WriteFileRequest 写入文件请求。
type WriteFileRequest struct {
	Path             string `json:"path"`
	Content          string `json:"content"`
	ExpectedRevision string `json:"expected_revision"`
}

type ProjectFileOperationRequest struct {
	Operation  string `json:"operation"`
	Path       string `json:"path"`
	TargetPath string `json:"target_path"`
	Content    string `json:"content"`
}

// WriteFile PUT /api/project/:id/files/content 写入文件。
func (h *ProjectHandler) WriteFile(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req WriteFileRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	if req.Path == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "File path is required",
		})
		return
	}

	userID, ok := h.currentUserID(ctx)
	if !ok {
		return
	}
	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.WriteProjectFileAsUser(
		c,
		userID,
		projectID,
		req.Path,
		req.Content,
		req.ExpectedRevision,
	)
	if err != nil {
		var validationErr *service.ProjectFileRevisionValidationError
		if errors.As(err, &validationErr) {
			ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
				"error":       "Invalid expected file revision",
				"code":        "file_revision_invalid",
				"reason_code": "file_revision_invalid",
			})
			return
		}
		var conflictErr *service.ProjectFileRevisionConflictError
		if errors.As(err, &conflictErr) {
			ctx.JSON(consts.StatusConflict, map[string]interface{}{
				"error":       "File changed since it was opened",
				"code":        "file_revision_conflict",
				"reason_code": "file_revision_conflict",
				"data": map[string]interface{}{
					"expected_revision": conflictErr.ExpectedRevision,
					"current_revision":  conflictErr.CurrentRevision,
				},
			})
			return
		}
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to write file",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "File written",
		"data":    result,
	})
}

// ApplyFileOperation POST /api/project/:id/files/operation 执行文件系统事务。
func (h *ProjectHandler) ApplyFileOperation(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	var req ProjectFileOperationRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}
	if req.Operation == "" || req.Path == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "File operation and path are required",
		})
		return
	}

	userID, ok := h.currentUserID(ctx)
	if !ok {
		return
	}
	projectService, _, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	result, err := projectService.PerformProjectFileOperationAsUser(
		c,
		userID,
		projectID,
		req.Operation,
		req.Path,
		req.TargetPath,
		req.Content,
	)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to apply file operation",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"message": "File operation applied",
		"data":    result,
	})
}
