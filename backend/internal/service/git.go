package service

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/pkg/container"
)

type GitCommitDiff struct {
	Path      string `json:"path"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	Content   string `json:"content"`
}

type GitCommitRecord struct {
	Hash     string          `json:"hash"`
	Message  string          `json:"message"`
	Author   string          `json:"author"`
	Email    string          `json:"email"`
	Time     string          `json:"time"`
	Files    int             `json:"files"`
	Branches []string        `json:"branches"`
	Diff     []GitCommitDiff `json:"diff,omitempty"`
}

type GitBranchRecord struct {
	Name           string `json:"name"`
	IsCurrent      bool   `json:"is_current"`
	LastCommit     string `json:"last_commit"`
	Upstream       string `json:"upstream"`
	HasUpstream    bool   `json:"has_upstream"`
	Ahead          int    `json:"ahead"`
	Behind         int    `json:"behind"`
	TrackingStatus string `json:"tracking_status"`
}

type GitRemoteRecord struct {
	Name string `json:"name"`
}

type GitRemoteBranchRecord struct {
	Name       string `json:"name"`
	Remote     string `json:"remote"`
	Branch     string `json:"branch"`
	LastCommit string `json:"last_commit"`
}

type GitRemoteBranchRefreshResultRecord struct {
	Remote   string `json:"remote"`
	Status   string `json:"status"`
	Fetched  bool   `json:"fetched"`
	Message  string `json:"message"`
	Recovery string `json:"recovery"`
}

type GitTagRecord struct {
	Name         string `json:"name"`
	TargetCommit string `json:"target_commit"`
	Message      string `json:"message"`
}

type GitTagCreateResultRecord struct {
	Name          string `json:"name"`
	CurrentBranch string `json:"current_branch"`
	Status        string `json:"status"`
	Created       bool   `json:"created"`
	TargetCommit  string `json:"target_commit"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitTagDeleteResultRecord struct {
	Name          string `json:"name"`
	CurrentBranch string `json:"current_branch"`
	Status        string `json:"status"`
	Deleted       bool   `json:"deleted"`
	TargetCommit  string `json:"target_commit"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitStashRecord struct {
	Ref          string `json:"ref"`
	TargetCommit string `json:"target_commit"`
	Branch       string `json:"branch"`
	Message      string `json:"message"`
}

type GitStashApplyResultRecord struct {
	Ref           string `json:"ref"`
	Status        string `json:"status"`
	DirtyFiles    int    `json:"dirty_files"`
	CommitCreated bool   `json:"commit_created"`
	CommitHash    string `json:"commit_hash"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitStashCreateResultRecord struct {
	Ref          string `json:"ref"`
	Status       string `json:"status"`
	DirtyFiles   int    `json:"dirty_files"`
	StashCreated bool   `json:"stash_created"`
	Message      string `json:"message"`
	Recovery     string `json:"recovery"`
}

type GitWorktreeFileRecord struct {
	Path           string `json:"path"`
	OriginalPath   string `json:"original_path,omitempty"`
	Status         string `json:"status"`
	IndexStatus    string `json:"index_status"`
	WorktreeStatus string `json:"worktree_status"`
}

type GitWorktreeStatusRecord struct {
	CurrentBranch string                  `json:"current_branch"`
	Status        string                  `json:"status"`
	DirtyFiles    int                     `json:"dirty_files"`
	Files         []GitWorktreeFileRecord `json:"files"`
	DiffFiles     int                     `json:"diff_files"`
	Additions     int                     `json:"additions"`
	Deletions     int                     `json:"deletions"`
	Diff          []GitCommitDiff         `json:"diff"`
	Message       string                  `json:"message"`
	Recovery      string                  `json:"recovery"`
}

type GitWorktreeFileDiscardResultRecord struct {
	Path       string `json:"path"`
	Status     string `json:"status"`
	DirtyFiles int    `json:"dirty_files"`
	Message    string `json:"message"`
	Recovery   string `json:"recovery"`
}

type GitWorktreeCommitResultRecord struct {
	Status        string `json:"status"`
	DirtyFiles    int    `json:"dirty_files"`
	CommitCreated bool   `json:"commit_created"`
	CommitHash    string `json:"commit_hash"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitBranchCompareCommitRecord struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Author  string `json:"author"`
	Email   string `json:"email"`
	Time    string `json:"time"`
}

type GitBranchCompareFileRecord struct {
	Path      string `json:"path"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
	IsBinary  bool   `json:"is_binary"`
	Content   string `json:"content"`
}

type GitBranchCompareRecord struct {
	BaseBranch   string                         `json:"base_branch"`
	HeadBranch   string                         `json:"head_branch"`
	CommitsAhead int                            `json:"commits_ahead"`
	FilesChanged int                            `json:"files_changed"`
	Additions    int                            `json:"additions"`
	Deletions    int                            `json:"deletions"`
	Files        []GitBranchCompareFileRecord   `json:"files"`
	Commits      []GitBranchCompareCommitRecord `json:"commits"`
}

type GitBranchSwitchReadinessRecord struct {
	CurrentBranch string `json:"current_branch"`
	TargetBranch  string `json:"target_branch"`
	Status        string `json:"status"`
	CanSwitch     bool   `json:"can_switch"`
	DirtyFiles    int    `json:"dirty_files"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitBranchSwitchResultRecord struct {
	PreviousBranch string                          `json:"previous_branch"`
	CurrentBranch  string                          `json:"current_branch"`
	TargetBranch   string                          `json:"target_branch"`
	Status         string                          `json:"status"`
	Readiness      *GitBranchSwitchReadinessRecord `json:"readiness"`
	Message        string                          `json:"message"`
	Recovery       string                          `json:"recovery"`
}

type GitBranchCreateResultRecord struct {
	Name       string `json:"name"`
	FromBranch string `json:"from_branch"`
	Status     string `json:"status"`
	Created    bool   `json:"created"`
	LastCommit string `json:"last_commit"`
	Message    string `json:"message"`
	Recovery   string `json:"recovery"`
}

type GitBranchCreateFromRemoteResultRecord struct {
	Name          string `json:"name"`
	RemoteBranch  string `json:"remote_branch"`
	Remote        string `json:"remote"`
	Branch        string `json:"branch"`
	CurrentBranch string `json:"current_branch"`
	Status        string `json:"status"`
	Created       bool   `json:"created"`
	Tracking      bool   `json:"tracking"`
	LastCommit    string `json:"last_commit"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitBranchDeleteResultRecord struct {
	Name          string `json:"name"`
	CurrentBranch string `json:"current_branch"`
	Status        string `json:"status"`
	Deleted       bool   `json:"deleted"`
	LastCommit    string `json:"last_commit"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitBranchRenameResultRecord struct {
	PreviousName  string `json:"previous_name"`
	Name          string `json:"name"`
	CurrentBranch string `json:"current_branch"`
	Status        string `json:"status"`
	Renamed       bool   `json:"renamed"`
	LastCommit    string `json:"last_commit"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitCommitFileRestoreResultRecord struct {
	Hash          string `json:"hash"`
	Path          string `json:"path"`
	Status        string `json:"status"`
	DirtyFiles    int    `json:"dirty_files"`
	CommitCreated bool   `json:"commit_created"`
	CommitHash    string `json:"commit_hash"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type GitBranchCompareFileApplyResultRecord struct {
	BaseBranch    string `json:"base_branch"`
	HeadBranch    string `json:"head_branch"`
	Path          string `json:"path"`
	Status        string `json:"status"`
	DirtyFiles    int    `json:"dirty_files"`
	CommitCreated bool   `json:"commit_created"`
	CommitHash    string `json:"commit_hash"`
	Message       string `json:"message"`
	Recovery      string `json:"recovery"`
}

type gitCommitSnapshot struct {
	Hash       string
	Message    string
	ParentHash string
	CreatedAt  time.Time
}

func (s *ProjectService) GetProjectGitCommits(ctx context.Context, projectID string) ([]GitCommitRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return []GitCommitRecord{}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 提交列表无法连接容器管理器", containerErr)
		return []GitCommitRecord{}, nil
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return []GitCommitRecord{}, nil
	}
	commits, err := listGitCommitsInContainer(ctx, s.containerMgr, projectID, 20)
	if err != nil {
		return []GitCommitRecord{}, nil
	}
	return commits, nil
}

func (s *ProjectService) GetProjectGitBranches(ctx context.Context, projectID string) ([]GitBranchRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return []GitBranchRecord{}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支列表无法连接容器管理器", containerErr)
		return []GitBranchRecord{}, nil
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return []GitBranchRecord{}, nil
	}
	branches, err := listGitBranchesInContainer(ctx, s.containerMgr, projectID)
	if err != nil {
		return []GitBranchRecord{}, nil
	}
	return branches, nil
}

func (s *ProjectService) GetProjectGitRemoteBranches(ctx context.Context, projectID string) ([]GitRemoteBranchRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return []GitRemoteBranchRecord{}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 远端分支列表无法连接容器管理器", containerErr)
		return []GitRemoteBranchRecord{}, nil
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return []GitRemoteBranchRecord{}, nil
	}
	branches, err := listGitRemoteBranchesInContainer(ctx, s.containerMgr, projectID)
	if err != nil {
		return []GitRemoteBranchRecord{}, nil
	}
	return branches, nil
}

func (s *ProjectService) GetProjectGitRemotes(ctx context.Context, projectID string) ([]GitRemoteRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return []GitRemoteRecord{}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git remote 列表无法连接容器管理器", containerErr)
		return []GitRemoteRecord{}, nil
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return []GitRemoteRecord{}, nil
	}
	remotes, err := listGitRemotesInContainer(ctx, s.containerMgr, projectID)
	if err != nil {
		return []GitRemoteRecord{}, nil
	}
	return remotes, nil
}

func (s *ProjectService) RefreshProjectGitRemoteBranches(ctx context.Context, projectID, remoteName string) (*GitRemoteBranchRefreshResultRecord, error) {
	remoteName, err := normalizeGitRemoteName(remoteName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git remote branch refresh")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 远端引用刷新无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return refreshGitRemoteBranchesInContainer(ctx, s.containerMgr, projectID, remoteName)
}

func (s *ProjectService) GetProjectGitTags(ctx context.Context, projectID string) ([]GitTagRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return []GitTagRecord{}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 标签列表无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return listGitTagsInContainer(ctx, s.containerMgr, projectID)
}

func (s *ProjectService) CreateProjectGitTag(ctx context.Context, projectID, tagName string) (*GitTagCreateResultRecord, error) {
	tagName, err := normalizeGitTagName(tagName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git tag create")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 标签创建无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return createGitTagInContainer(ctx, s.containerMgr, projectID, tagName)
}

func (s *ProjectService) DeleteProjectGitTag(ctx context.Context, projectID, tagName string) (*GitTagDeleteResultRecord, error) {
	tagName, err := normalizeGitTagName(tagName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git tag delete")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 标签删除无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return deleteGitTagInContainer(ctx, s.containerMgr, projectID, tagName)
}

func (s *ProjectService) GetProjectGitStashes(ctx context.Context, projectID string) ([]GitStashRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return []GitStashRecord{}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 暂存堆栈列表无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return listGitStashesInContainer(ctx, s.containerMgr, projectID)
}

func (s *ProjectService) ApplyProjectGitStash(ctx context.Context, projectID, stashRef string) (*GitStashApplyResultRecord, error) {
	normalizedRef, err := normalizeGitStashRef(stashRef)
	if err != nil {
		return nil, err
	}
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git stash apply")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git stash 应用无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}

	var result *GitStashApplyResultRecord
	var snapshot *gitCommitSnapshot
	result, snapshot, err = applyGitStashInContainer(ctx, s.containerMgr, projectID, normalizedRef)
	if err != nil {
		return nil, err
	}
	if result.CommitCreated {
		if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, snapshot); err != nil {
			return nil, err
		}
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return result, nil
}

func (s *ProjectService) CreateProjectGitStash(ctx context.Context, projectID, message string) (*GitStashCreateResultRecord, error) {
	normalizedMessage, err := normalizeGitStashMessage(message)
	if err != nil {
		return nil, err
	}
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git stash create")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git stash 创建无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}

	result, err := createGitStashInContainer(ctx, s.containerMgr, projectID, normalizedMessage)
	if err != nil {
		return nil, err
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return result, nil
}

func (s *ProjectService) GetProjectGitWorktreeStatus(ctx context.Context, projectID string) (*GitWorktreeStatusRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return &GitWorktreeStatusRecord{
			Status:     "clean",
			DirtyFiles: 0,
			Files:      []GitWorktreeFileRecord{},
			Diff:       []GitCommitDiff{},
			Message:    "当前项目类型不需要运行时 Git 工作区",
			Recovery:   "无需处理 worktree dirty 状态。",
		}, nil
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git worktree 状态无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return readGitWorktreeStatusInContainer(ctx, s.containerMgr, projectID)
}

func (s *ProjectService) DiscardProjectGitWorktreeFile(ctx context.Context, projectID, filePath string) (*GitWorktreeFileDiscardResultRecord, error) {
	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git worktree file discard")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git worktree 文件丢弃无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}

	result, err := discardGitWorktreeFileInContainer(ctx, s.containerMgr, projectID, normalizedPath)
	if err != nil {
		return nil, err
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return result, nil
}

func (s *ProjectService) CommitProjectGitWorktree(ctx context.Context, projectID, message string) (*GitWorktreeCommitResultRecord, error) {
	message = strings.TrimSpace(message)
	if message == "" {
		return nil, fmt.Errorf("commit message is required")
	}
	if len([]rune(message)) > 200 {
		return nil, fmt.Errorf("commit message must be 200 characters or fewer")
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git worktree commit")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git worktree 提交无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}

	result, snapshot, err := commitGitWorktreeInContainer(ctx, s.containerMgr, projectID, message)
	if err != nil {
		return nil, err
	}
	if result.CommitCreated && snapshot != nil {
		if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, snapshot); err != nil {
			result.Status = "committed_record_failed"
			result.Message = "Git worktree 提交已创建，但提交记录同步失败"
			result.Recovery = "Git 面板可继续从项目仓库读取真实提交历史；后台 commits 记录可能暂时缺失，请稍后刷新提交列表或检查数据库写入。"
		}
	} else if result.CommitCreated {
		result.Status = "committed_record_missing"
		result.Message = "Git worktree 提交已创建，但提交元数据不可用"
		result.Recovery = "请刷新 Git 面板从容器 Git 真源读取最新提交；后台 commits 记录可能暂时缺失。"
	}
	return result, nil
}

func (s *ProjectService) GetProjectGitBranchCompare(ctx context.Context, projectID, baseBranch, headBranch string) (*GitBranchCompareRecord, error) {
	baseBranch, err := normalizeGitBranchName(baseBranch)
	if err != nil {
		return nil, err
	}
	headBranch, err = normalizeGitBranchName(headBranch)
	if err != nil {
		return nil, err
	}
	if baseBranch == headBranch {
		return &GitBranchCompareRecord{
			BaseBranch: baseBranch,
			HeadBranch: headBranch,
			Files:      []GitBranchCompareFileRecord{},
			Commits:    []GitBranchCompareCommitRecord{},
		}, nil
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch compare")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支对比无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return readGitBranchCompareInContainer(ctx, s.containerMgr, projectID, baseBranch, headBranch)
}

func (s *ProjectService) ApplyProjectGitBranchCompareFile(ctx context.Context, projectID, baseBranch, headBranch, filePath string) (*GitBranchCompareFileApplyResultRecord, error) {
	baseBranch, err := normalizeGitBranchName(baseBranch)
	if err != nil {
		return nil, err
	}
	headBranch, err = normalizeGitBranchName(headBranch)
	if err != nil {
		return nil, err
	}
	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch compare file apply")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支对比文件引入无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}

	var result *GitBranchCompareFileApplyResultRecord
	var snapshot *gitCommitSnapshot
	result, snapshot, err = applyGitBranchCompareFileInContainer(ctx, s.containerMgr, projectID, baseBranch, headBranch, normalizedPath)
	if err != nil {
		return nil, err
	}
	if result.CommitCreated {
		if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, snapshot); err != nil {
			return nil, err
		}
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return result, nil
}

func (s *ProjectService) GetProjectGitBranchSwitchReadiness(ctx context.Context, projectID, targetBranch string) (*GitBranchSwitchReadinessRecord, error) {
	targetBranch, err := normalizeGitBranchName(targetBranch)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch switch readiness")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支切换预检无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return readGitBranchSwitchReadinessInContainer(ctx, s.containerMgr, projectID, targetBranch)
}

func (s *ProjectService) SwitchProjectGitBranch(ctx context.Context, projectID, targetBranch string) (*GitBranchSwitchResultRecord, error) {
	targetBranch, err := normalizeGitBranchName(targetBranch)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch switch")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支切换无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return switchGitBranchInContainer(ctx, s.containerMgr, projectID, targetBranch)
}

func (s *ProjectService) CreateProjectGitBranch(ctx context.Context, projectID, branchName string) (*GitBranchCreateResultRecord, error) {
	branchName, err := normalizeGitBranchName(branchName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch create")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支创建无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return createGitBranchInContainer(ctx, s.containerMgr, projectID, branchName)
}

func (s *ProjectService) CreateProjectGitBranchFromRemote(ctx context.Context, projectID, remoteBranch, branchName string) (*GitBranchCreateFromRemoteResultRecord, error) {
	remoteBranch, err := normalizeGitRemoteBranchName(remoteBranch)
	if err != nil {
		return nil, err
	}
	branchName, err = normalizeGitBranchName(branchName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch create from remote")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 远端引用创建本地分支无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return createGitBranchFromRemoteInContainer(ctx, s.containerMgr, projectID, remoteBranch, branchName)
}

func (s *ProjectService) DeleteProjectGitBranch(ctx context.Context, projectID, branchName string) (*GitBranchDeleteResultRecord, error) {
	branchName, err := normalizeGitBranchName(branchName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch delete")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支删除无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return deleteGitBranchInContainer(ctx, s.containerMgr, projectID, branchName)
}

func (s *ProjectService) RenameProjectGitBranch(ctx context.Context, projectID, previousName, nextName string) (*GitBranchRenameResultRecord, error) {
	previousName, err := normalizeGitBranchName(previousName)
	if err != nil {
		return nil, err
	}
	nextName, err = normalizeGitBranchName(nextName)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git branch rename")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 分支重命名无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}
	return renameGitBranchInContainer(ctx, s.containerMgr, projectID, previousName, nextName)
}

func (s *ProjectService) GetProjectGitCommit(ctx context.Context, projectID, commitHash string) (*GitCommitRecord, error) {
	normalizedHash, err := normalizeGitCommitHash(commitHash)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git commit detail")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 提交详情无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	if _, _, err := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); err != nil {
		return nil, err
	}
	return readGitCommitRecordInContainer(ctx, s.containerMgr, projectID, normalizedHash, true)
}

func (s *ProjectService) RestoreProjectGitCommit(ctx context.Context, projectID, commitHash string) error {
	normalizedHash, err := normalizeGitCommitHash(commitHash)
	if err != nil {
		return err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return err
	}
	if !projectNeedsRuntime(project.AppType) {
		return fmt.Errorf("runtime is required for git restore")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 恢复无法连接容器管理器", containerErr)
		return containerErr
	}
	if _, _, err := ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile); err != nil {
		return err
	}
	if _, err := runGitInContainer(ctx, s.containerMgr, projectID, "rev-parse", "--verify", normalizedHash); err != nil {
		return err
	}
	if _, err := runGitInContainer(ctx, s.containerMgr, projectID, "reset", "--hard", normalizedHash); err != nil {
		return err
	}
	if _, err := runGitInContainer(ctx, s.containerMgr, projectID, "clean", "-fd"); err != nil {
		return err
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return nil
}

func (s *ProjectService) RestoreProjectGitCommitFile(ctx context.Context, projectID, commitHash, filePath string) (*GitCommitFileRestoreResultRecord, error) {
	normalizedHash, err := normalizeGitCommitHash(commitHash)
	if err != nil {
		return nil, err
	}
	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return nil, err
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, fmt.Errorf("runtime is required for git file restore")
	}
	if s.containerMgr == nil {
		containerErr := fmt.Errorf("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "Git 单文件恢复无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	_, _, err = ensureProjectRuntimeBaseContainer(ctx, project, s.projectRepo, s.containerMgr, s.containerCfg, s.getImageForRuntimeProfile)
	if err != nil {
		return nil, err
	}

	var result *GitCommitFileRestoreResultRecord
	var snapshot *gitCommitSnapshot
	result, snapshot, err = restoreGitFileFromCommitInContainer(ctx, s.containerMgr, projectID, normalizedHash, normalizedPath)
	if err != nil {
		return nil, err
	}
	if result.CommitCreated {
		if err := persistProjectGitCommitSnapshot(ctx, s.commitRepo, project, snapshot); err != nil {
			return nil, err
		}
	}
	refreshProjectFileTree(ctx, projectID, s.containerMgr, s.projectRepo)
	return result, nil
}

func createProjectGitCommitInContainer(ctx context.Context, containerMgr *container.Manager, projectID, message string) (bool, *gitCommitSnapshot, error) {
	if containerMgr == nil {
		return false, nil, fmt.Errorf("container manager not available")
	}
	if strings.TrimSpace(projectID) == "" {
		return false, nil, nil
	}
	if strings.TrimSpace(message) == "" {
		message = "Update project files"
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "config", "user.name", "YiStack"); err != nil {
		return false, nil, err
	}
	if _, err := runGitInContainer(ctx, containerMgr, projectID, "config", "user.email", "system@yistack.local"); err != nil {
		return false, nil, err
	}
	gitignoreExists, err := projectPathExistsInContainer(ctx, containerMgr, projectID, ".gitignore")
	if err != nil {
		return false, nil, err
	}
	if !gitignoreExists {
		if err := writeFileInContainer(ctx, containerMgr, projectID, ".gitignore", "node_modules/\n.next/\ndist/\nbuild/\n.env\n.env.local\n"); err != nil {
			return false, nil, err
		}
	}
	if _, err := runGitInContainer(ctx, containerMgr, projectID, "add", "-A"); err != nil {
		return false, nil, err
	}
	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain")
	if err != nil {
		return false, nil, err
	}
	if strings.TrimSpace(statusOutput) == "" {
		return false, nil, nil
	}
	if _, err := runGitInContainer(ctx, containerMgr, projectID, "commit", "-m", message); err != nil {
		return false, nil, fmt.Errorf("git commit failed: %w", err)
	}
	snapshot, _ := readGitCommitSnapshotInContainer(ctx, containerMgr, projectID, "HEAD")
	return true, snapshot, nil
}
func persistProjectGitCommitSnapshot(ctx context.Context, commitRepo CommitRepo, project *model.Project, snapshot *gitCommitSnapshot) error {
	if commitRepo == nil || project == nil || snapshot == nil || strings.TrimSpace(snapshot.Hash) == "" {
		return nil
	}
	return commitRepo.Create(ctx, &model.Commit{
		ProjectID:  strings.TrimSpace(project.ProjectID),
		UserID:     strings.TrimSpace(project.UserID),
		Message:    strings.TrimSpace(snapshot.Message),
		Hash:       strings.TrimSpace(snapshot.Hash),
		ParentHash: strings.TrimSpace(snapshot.ParentHash),
		CreatedAt:  snapshot.CreatedAt,
	})
}

func readGitCommitSnapshotInContainer(ctx context.Context, containerMgr *container.Manager, projectID, commitRef string) (*gitCommitSnapshot, error) {
	if strings.TrimSpace(commitRef) == "" {
		commitRef = "HEAD"
	}
	output, err := runGitInContainer(ctx, containerMgr, projectID, "log", "-1", "--date=iso-strict", "--pretty=format:%H%x1f%s%x1f%P%x1f%cI", commitRef)
	if err != nil {
		return nil, err
	}
	parts := strings.Split(strings.TrimSpace(output), "\x1f")
	if len(parts) < 4 {
		return nil, fmt.Errorf("invalid git commit metadata")
	}
	createdAt, err := time.Parse(time.RFC3339, strings.TrimSpace(parts[3]))
	if err != nil {
		return nil, fmt.Errorf("parse git commit time: %w", err)
	}
	parentHash := ""
	parentParts := strings.Fields(parts[2])
	if len(parentParts) > 0 {
		parentHash = parentParts[0]
	}
	return &gitCommitSnapshot{
		Hash:       strings.TrimSpace(parts[0]),
		Message:    strings.TrimSpace(parts[1]),
		ParentHash: parentHash,
		CreatedAt:  createdAt,
	}, nil
}

func listGitCommitsInContainer(ctx context.Context, containerMgr *container.Manager, projectID string, limit int) ([]GitCommitRecord, error) {
	if limit <= 0 {
		limit = 20
	}

	logOutput, err := runGitInContainer(ctx, containerMgr, projectID, "log", fmt.Sprintf("-%d", limit), "--date=iso-strict", "--pretty=format:%H%x1f%s%x1f%an%x1f%ae%x1f%ad")
	if err != nil {
		if isEmptyGitHistoryError(err) {
			return []GitCommitRecord{}, nil
		}
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(logOutput), "\n")
	commits := make([]GitCommitRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Split(line, "\x1f")
		if len(parts) < 5 {
			continue
		}

		diff, err := readGitCommitDiffInContainer(ctx, containerMgr, projectID, parts[0], false)
		if err != nil {
			diff = nil
		}

		commits = append(commits, GitCommitRecord{
			Hash:     shortHash(parts[0]),
			Message:  parts[1],
			Author:   parts[2],
			Email:    parts[3],
			Time:     parts[4],
			Files:    len(diff),
			Branches: []string{"main"},
			Diff:     diff,
		})
	}

	return commits, nil
}

func parseGitBranchCompareCommitRecords(output string) []GitBranchCompareCommitRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	commits := make([]GitBranchCompareCommitRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Split(line, "\x1f")
		if len(parts) < 5 {
			continue
		}
		hash := shortHash(parts[0])
		if hash == "" {
			continue
		}
		commits = append(commits, GitBranchCompareCommitRecord{
			Hash:    hash,
			Message: strings.TrimSpace(parts[1]),
			Author:  strings.TrimSpace(parts[2]),
			Email:   strings.TrimSpace(parts[3]),
			Time:    strings.TrimSpace(parts[4]),
		})
	}
	return commits
}

func parseGitBranchCompareFileRecords(output string) []GitBranchCompareFileRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	files := make([]GitBranchCompareFileRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 3)
		if len(parts) < 3 {
			continue
		}
		path, err := normalizeProjectRelativePath(parts[2])
		if err != nil {
			continue
		}
		files = append(files, GitBranchCompareFileRecord{
			Path:      path,
			Additions: parseGitNumStat(parts[0]),
			Deletions: parseGitNumStat(parts[1]),
			IsBinary:  strings.TrimSpace(parts[0]) == "-" || strings.TrimSpace(parts[1]) == "-",
		})
	}
	return files
}

func readGitBranchCompareFilePatchesInContainer(ctx context.Context, containerMgr *container.Manager, projectID, baseBranch, headBranch string, files []GitBranchCompareFileRecord) []GitBranchCompareFileRecord {
	filesWithContent := make([]GitBranchCompareFileRecord, 0, len(files))
	for _, file := range files {
		if file.IsBinary || strings.TrimSpace(file.Path) == "" {
			filesWithContent = append(filesWithContent, file)
			continue
		}
		normalizedPath, err := normalizeProjectRelativePath(file.Path)
		if err != nil {
			continue
		}
		output, err := runGitInContainer(ctx, containerMgr, projectID, "diff", "--unified=3", baseBranch+"..."+headBranch, "--", normalizedPath)
		if err == nil {
			file.Content = strings.TrimSpace(output)
		}
		filesWithContent = append(filesWithContent, file)
	}
	return filesWithContent
}

func listGitBranchesInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) ([]GitBranchRecord, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--format=%(refname:short)%x1f%(HEAD)%x1f%(objectname:short)%x1f%(upstream:short)%x1f%(upstream:track,nobracket)")
	if err != nil {
		if isEmptyGitHistoryError(err) {
			return []GitBranchRecord{}, nil
		}
		return nil, err
	}
	return parseGitBranchRecords(output), nil
}

func parseGitBranchRecords(output string) []GitBranchRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	branches := make([]GitBranchRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Split(line, "\x1f")
		if len(parts) < 3 {
			continue
		}
		name := strings.TrimSpace(parts[0])
		if name == "" {
			continue
		}
		branches = append(branches, GitBranchRecord{
			Name:           name,
			IsCurrent:      strings.TrimSpace(parts[1]) == "*",
			LastCommit:     shortHash(parts[2]),
			Upstream:       strings.TrimSpace(getGitFormatPart(parts, 3)),
			HasUpstream:    strings.TrimSpace(getGitFormatPart(parts, 3)) != "",
			Ahead:          parseGitTrackingCount(getGitFormatPart(parts, 4), "ahead"),
			Behind:         parseGitTrackingCount(getGitFormatPart(parts, 4), "behind"),
			TrackingStatus: summarizeGitTrackingStatus(getGitFormatPart(parts, 3), getGitFormatPart(parts, 4)),
		})
	}
	return branches
}

func getGitFormatPart(parts []string, index int) string {
	if index < 0 || index >= len(parts) {
		return ""
	}
	return parts[index]
}

func parseGitTrackingCount(value, label string) int {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0
	}
	pattern := regexp.MustCompile(`(?:^|,\s*)` + regexp.QuoteMeta(label) + `\s+([0-9]+)`)
	matches := pattern.FindStringSubmatch(value)
	if len(matches) < 2 {
		return 0
	}
	count, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0
	}
	return count
}

func summarizeGitTrackingStatus(upstream, track string) string {
	upstream = strings.TrimSpace(upstream)
	track = strings.TrimSpace(track)
	if upstream == "" {
		return "none"
	}
	if strings.Contains(strings.ToLower(track), "gone") {
		return "gone"
	}
	ahead := parseGitTrackingCount(track, "ahead")
	behind := parseGitTrackingCount(track, "behind")
	if ahead > 0 && behind > 0 {
		return "diverged"
	}
	if ahead > 0 {
		return "ahead"
	}
	if behind > 0 {
		return "behind"
	}
	return "up_to_date"
}

func listGitRemoteBranchesInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) ([]GitRemoteBranchRecord, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "-r", "--format=%(refname:short)%x1f%(objectname:short)")
	if err != nil {
		if isEmptyGitHistoryError(err) {
			return []GitRemoteBranchRecord{}, nil
		}
		return nil, err
	}
	return parseGitRemoteBranchRecords(output), nil
}

func listGitRemotesInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) ([]GitRemoteRecord, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "remote")
	if err != nil {
		return nil, err
	}
	return parseGitRemoteRecords(output), nil
}

func parseGitRemoteRecords(output string) []GitRemoteRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	remotes := make([]GitRemoteRecord, 0, len(lines))
	seen := make(map[string]struct{}, len(lines))
	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		remotes = append(remotes, GitRemoteRecord{Name: name})
	}
	return remotes
}

func parseGitRemoteBranchRecords(output string) []GitRemoteBranchRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	branches := make([]GitRemoteBranchRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 2)
		if len(parts) < 2 {
			continue
		}
		name := strings.TrimSpace(parts[0])
		if name == "" || strings.Contains(name, " -> ") {
			continue
		}
		remote, branch, ok := strings.Cut(name, "/")
		remote = strings.TrimSpace(remote)
		branch = strings.TrimSpace(branch)
		if !ok || remote == "" || branch == "" {
			continue
		}
		branches = append(branches, GitRemoteBranchRecord{
			Name:       name,
			Remote:     remote,
			Branch:     branch,
			LastCommit: shortHash(parts[1]),
		})
	}
	return branches
}

func refreshGitRemoteBranchesInContainer(ctx context.Context, containerMgr *container.Manager, projectID, remoteName string) (*GitRemoteBranchRefreshResultRecord, error) {
	remoteListOutput, err := runGitInContainer(ctx, containerMgr, projectID, "remote")
	if err != nil {
		return nil, err
	}
	remoteExists := false
	for _, remote := range strings.Split(strings.TrimSpace(remoteListOutput), "\n") {
		if strings.TrimSpace(remote) == remoteName {
			remoteExists = true
			break
		}
	}
	if !remoteExists {
		return &GitRemoteBranchRefreshResultRecord{
			Remote:   remoteName,
			Status:   "blocked",
			Fetched:  false,
			Message:  "远端不存在",
			Recovery: "先在项目 Git 仓库中配置对应 remote，再显式刷新远端引用；当前操作不会创建 remote 或修改工作区文件。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "fetch", remoteName); err != nil {
		return &GitRemoteBranchRefreshResultRecord{
			Remote:   remoteName,
			Status:   "blocked",
			Fetched:  false,
			Message:  "远端引用刷新失败",
			Recovery: "检查 remote URL、网络凭据或远端服务可用性后重试；当前受控刷新不会执行 pull、push、prune、checkout 或修改工作区文件。",
		}, nil
	}

	return &GitRemoteBranchRefreshResultRecord{
		Remote:   remoteName,
		Status:   "fetched",
		Fetched:  true,
		Message:  "Git 远端引用已刷新",
		Recovery: "Workspace 会重新读取本地 remote refs；如需创建本地跟踪分支，请继续使用受控创建入口。",
	}, nil
}

func listGitTagsInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) ([]GitTagRecord, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "tag", "--list", "--format=%(refname:short)%x1f%(subject)")
	if err != nil {
		if isEmptyGitHistoryError(err) {
			return []GitTagRecord{}, nil
		}
		return nil, err
	}
	tags := parseGitTagRecords(output)
	for index := range tags {
		commitOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-list", "-n", "1", tags[index].Name)
		if err != nil {
			continue
		}
		tags[index].TargetCommit = shortHash(commitOutput)
	}
	return tags, nil
}

func parseGitTagRecords(output string) []GitTagRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	tags := make([]GitTagRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 2)
		name := strings.TrimSpace(parts[0])
		if name == "" {
			continue
		}
		message := ""
		if len(parts) > 1 {
			message = strings.TrimSpace(parts[1])
		}
		tags = append(tags, GitTagRecord{
			Name:    name,
			Message: message,
		})
	}
	return tags
}

func createGitTagInContainer(ctx context.Context, containerMgr *container.Manager, projectID, tagName string) (*GitTagCreateResultRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		currentBranch = "HEAD"
	}

	headOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return nil, err
	}
	headCommit := strings.TrimSpace(headOutput)

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/tags/"+tagName); err == nil {
		return &GitTagCreateResultRecord{
			Name:          tagName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Created:       false,
			TargetCommit:  shortHash(headCommit),
			Message:       "目标标签已存在",
			Recovery:      "刷新 Git 标签列表后选择已有标签，或输入一个尚未存在的新标签名。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "tag", tagName, "HEAD"); err != nil {
		return nil, err
	}

	return &GitTagCreateResultRecord{
		Name:          tagName,
		CurrentBranch: currentBranch,
		Status:        "created",
		Created:       true,
		TargetCommit:  shortHash(headCommit),
		Message:       "Git 标签已创建",
		Recovery:      "Workspace 会刷新标签列表；当前操作不会 checkout、push tag、创建提交或修改工作区文件。",
	}, nil
}

func deleteGitTagInContainer(ctx context.Context, containerMgr *container.Manager, projectID, tagName string) (*GitTagDeleteResultRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		currentBranch = "HEAD"
	}

	targetOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/tags/"+tagName)
	if err != nil {
		return &GitTagDeleteResultRecord{
			Name:          tagName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Deleted:       false,
			Message:       "目标标签不存在",
			Recovery:      "刷新 Git 标签列表后重新选择一个存在的本地标签。",
		}, nil
	}
	targetCommit := strings.TrimSpace(targetOutput)

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "tag", "-d", tagName); err != nil {
		return nil, err
	}

	return &GitTagDeleteResultRecord{
		Name:          tagName,
		CurrentBranch: currentBranch,
		Status:        "deleted",
		Deleted:       true,
		TargetCommit:  shortHash(targetCommit),
		Message:       "Git 本地标签已删除",
		Recovery:      "Workspace 会刷新标签列表；当前操作不会 checkout、push、删除远端标签、创建提交或修改工作区文件。",
	}, nil
}

func listGitStashesInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) ([]GitStashRecord, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "stash", "list", "--format=%gd%x1f%H%x1f%gs")
	if err != nil {
		if isEmptyGitHistoryError(err) {
			return []GitStashRecord{}, nil
		}
		return nil, err
	}
	return parseGitStashRecords(output), nil
}

func createGitStashInContainer(ctx context.Context, containerMgr *container.Manager, projectID, message string) (*GitStashCreateResultRecord, error) {
	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain")
	if err != nil {
		return nil, err
	}
	dirtyFiles := countGitStatusPorcelainFiles(statusOutput)
	if dirtyFiles == 0 {
		return &GitStashCreateResultRecord{
			Status:       "blocked",
			DirtyFiles:   0,
			StashCreated: false,
			Message:      "当前 worktree 没有可保存为 stash 的 dirty 变更",
			Recovery:     "请先保存文件或执行会修改 worktree 的操作，再刷新 Git 面板确认 dirty 状态后创建 stash。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "stash", "push", "--include-untracked", "-m", message); err != nil {
		return nil, err
	}
	stashes, err := listGitStashesInContainer(ctx, containerMgr, projectID)
	if err != nil {
		return nil, err
	}
	stashRef := ""
	if len(stashes) > 0 {
		stashRef = stashes[0].Ref
	}
	if strings.TrimSpace(stashRef) == "" {
		return &GitStashCreateResultRecord{
			Status:       "blocked",
			DirtyFiles:   dirtyFiles,
			StashCreated: false,
			Message:      "Git stash push 已返回成功，但未能读取新建 stash ref",
			Recovery:     "请刷新 Git 面板确认 stash 列表；如列表为空，请检查容器内 Git 状态后重试。",
		}, nil
	}

	return &GitStashCreateResultRecord{
		Ref:          stashRef,
		Status:       "created",
		DirtyFiles:   dirtyFiles,
		StashCreated: true,
		Message:      "Git worktree dirty 变更已保存为 stash",
		Recovery:     "Workspace 会刷新 Explorer、worktree 与 stash 列表；该操作不会提交、reset、pop、drop 或 clear stash。",
	}, nil
}

func applyGitStashInContainer(ctx context.Context, containerMgr *container.Manager, projectID, stashRef string) (*GitStashApplyResultRecord, *gitCommitSnapshot, error) {
	if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", stashRef); err != nil {
		return nil, nil, err
	}

	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain")
	if err != nil {
		return nil, nil, err
	}
	dirtyFiles := countGitStatusPorcelainFiles(statusOutput)
	if dirtyFiles > 0 {
		return &GitStashApplyResultRecord{
			Ref:        stashRef,
			Status:     "blocked",
			DirtyFiles: dirtyFiles,
			Message:    "当前工作区存在未提交变更",
			Recovery:   "先保存当前文件并生成 Git 快照，或清理 worktree dirty 状态后再应用 stash。",
		}, nil, nil
	}

	if err := checkGitStashPatchAppliesInContainer(ctx, containerMgr, projectID, stashRef); err != nil {
		return &GitStashApplyResultRecord{
			Ref:        stashRef,
			Status:     "blocked",
			DirtyFiles: 0,
			Message:    "stash patch 预检未通过",
			Recovery:   "目标 stash 与当前 HEAD 存在冲突或无法无损应用；请先切换到匹配的提交/分支，或手动处理该 stash。",
		}, nil, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "stash", "apply", "--index", stashRef); err != nil {
		return nil, nil, err
	}

	commitCreated, snapshot, err := createProjectGitCommitInContainer(ctx, containerMgr, projectID, fmt.Sprintf("Apply stash %s", stashRef))
	if err != nil {
		return nil, nil, err
	}
	commitHash := ""
	if snapshot != nil {
		commitHash = snapshot.Hash
	}
	return &GitStashApplyResultRecord{
		Ref:           stashRef,
		Status:        "applied",
		DirtyFiles:    0,
		CommitCreated: commitCreated,
		CommitHash:    commitHash,
		Message:       "Git stash 已受控应用",
		Recovery:      "Workspace 已应用 stash、创建 Git 快照并刷新 Explorer、worktree、stash 与提交列表；该操作不会 pop、drop 或 clear stash。",
	}, snapshot, nil
}

func checkGitStashPatchAppliesInContainer(ctx context.Context, containerMgr *container.Manager, projectID, stashRef string) error {
	if containerMgr == nil {
		return fmt.Errorf("container manager not available")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	patch, err := runGitInContainer(ctx, containerMgr, projectID, "stash", "show", "--patch", "--include-untracked", "--binary", "--full-index", stashRef)
	if err != nil {
		return err
	}
	patchPath := ".yistack/tmp/stash-apply-precheck.patch"
	if err := writeFileInContainer(ctx, containerMgr, projectID, patchPath, patch); err != nil {
		return fmt.Errorf("git stash apply precheck patch write failed: %w", err)
	}
	defer func() {
		_ = deletePathInContainer(context.Background(), containerMgr, projectID, patchPath)
	}()

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "apply", "--check", "--index", "--whitespace=nowarn", patchPath); err != nil {
		return fmt.Errorf("git stash apply precheck failed: %w", err)
	}
	return nil
}
func parseGitStashRecords(output string) []GitStashRecord {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	stashes := make([]GitStashRecord, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 3)
		if len(parts) < 2 {
			continue
		}
		ref := strings.TrimSpace(parts[0])
		if ref == "" {
			continue
		}
		message := ""
		if len(parts) > 2 {
			message = strings.TrimSpace(parts[2])
		}
		stashes = append(stashes, GitStashRecord{
			Ref:          ref,
			TargetCommit: shortHash(parts[1]),
			Branch:       parseGitStashBranchFromMessage(message),
			Message:      message,
		})
	}
	return stashes
}

func parseGitStashBranchFromMessage(message string) string {
	for _, prefix := range []string{"WIP on ", "On "} {
		if remainder, ok := strings.CutPrefix(message, prefix); ok {
			if branch, _, ok := strings.Cut(remainder, ":"); ok {
				return strings.TrimSpace(branch)
			}
		}
	}
	return ""
}

func readGitBranchCompareInContainer(ctx context.Context, containerMgr *container.Manager, projectID, baseBranch, headBranch string) (*GitBranchCompareRecord, error) {
	for _, branch := range []string{baseBranch, headBranch} {
		if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+branch); err != nil {
			return nil, err
		}
	}

	aheadOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-list", "--count", baseBranch+".."+headBranch)
	if err != nil {
		return nil, err
	}
	diffOutput, err := runGitInContainer(ctx, containerMgr, projectID, "diff", "--numstat", baseBranch+"..."+headBranch)
	if err != nil {
		return nil, err
	}
	commitOutput, err := runGitInContainer(ctx, containerMgr, projectID, "log", "--max-count=8", "--date=iso-strict", "--pretty=format:%H%x1f%s%x1f%an%x1f%ae%x1f%ad", baseBranch+".."+headBranch)
	if err != nil {
		return nil, err
	}

	filesChanged, additions, deletions := parseGitNumStatTotals(diffOutput)
	files := parseGitBranchCompareFileRecords(diffOutput)
	return &GitBranchCompareRecord{
		BaseBranch:   baseBranch,
		HeadBranch:   headBranch,
		CommitsAhead: parseGitNumStat(strings.TrimSpace(aheadOutput)),
		FilesChanged: filesChanged,
		Additions:    additions,
		Deletions:    deletions,
		Files:        readGitBranchCompareFilePatchesInContainer(ctx, containerMgr, projectID, baseBranch, headBranch, files),
		Commits:      parseGitBranchCompareCommitRecords(commitOutput),
	}, nil
}

func readGitBranchSwitchReadinessInContainer(ctx context.Context, containerMgr *container.Manager, projectID, targetBranch string) (*GitBranchSwitchReadinessRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		return &GitBranchSwitchReadinessRecord{
			CurrentBranch: "",
			TargetBranch:  targetBranch,
			Status:        "current_missing",
			CanSwitch:     false,
			Message:       "当前 Git 分支不可确认",
			Recovery:      "先刷新分支列表或确认项目 Git 工作区处于普通分支状态，再尝试切换分支。",
		}, nil
	}

	_, err = runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+targetBranch)
	if err != nil {
		return &GitBranchSwitchReadinessRecord{
			CurrentBranch: currentBranch,
			TargetBranch:  targetBranch,
			Status:        "target_missing",
			CanSwitch:     false,
			Message:       "目标分支不存在",
			Recovery:      "刷新分支列表后重新选择一个存在的本地分支。",
		}, nil
	}

	if currentBranch == targetBranch {
		return &GitBranchSwitchReadinessRecord{
			CurrentBranch: currentBranch,
			TargetBranch:  targetBranch,
			Status:        "already_current",
			CanSwitch:     false,
			Message:       "目标分支已经是当前分支",
			Recovery:      "无需执行分支切换；如需比较其他分支，请选择非当前分支。",
		}, nil
	}

	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain")
	if err != nil {
		return nil, err
	}
	dirtyFiles := countGitStatusPorcelainFiles(statusOutput)
	if dirtyFiles > 0 {
		return &GitBranchSwitchReadinessRecord{
			CurrentBranch: currentBranch,
			TargetBranch:  targetBranch,
			Status:        "dirty_worktree",
			CanSwitch:     false,
			DirtyFiles:    dirtyFiles,
			Message:       "当前工作区存在未提交变更",
			Recovery:      "先保存并生成 Git 快照，或确认本地变更处理完毕后再切换分支。",
		}, nil
	}

	return &GitBranchSwitchReadinessRecord{
		CurrentBranch: currentBranch,
		TargetBranch:  targetBranch,
		Status:        "ready",
		CanSwitch:     true,
		DirtyFiles:    0,
		Message:       "目标分支可安全切换",
		Recovery:      "后续可在显式确认后执行分支切换；当前接口只做只读预检。",
	}, nil
}

func switchGitBranchInContainer(ctx context.Context, containerMgr *container.Manager, projectID, targetBranch string) (*GitBranchSwitchResultRecord, error) {
	readiness, err := readGitBranchSwitchReadinessInContainer(ctx, containerMgr, projectID, targetBranch)
	if err != nil {
		return nil, err
	}
	if !readiness.CanSwitch {
		return &GitBranchSwitchResultRecord{
			PreviousBranch: readiness.CurrentBranch,
			CurrentBranch:  readiness.CurrentBranch,
			TargetBranch:   targetBranch,
			Status:         "blocked",
			Readiness:      readiness,
			Message:        readiness.Message,
			Recovery:       readiness.Recovery,
		}, nil
	}

	_, err = runGitInContainer(ctx, containerMgr, projectID, "switch", targetBranch)
	if err != nil {
		return nil, err
	}
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		currentBranch = targetBranch
	}
	return &GitBranchSwitchResultRecord{
		PreviousBranch: readiness.CurrentBranch,
		CurrentBranch:  currentBranch,
		TargetBranch:   targetBranch,
		Status:         "switched",
		Readiness:      readiness,
		Message:        "Git 分支切换完成",
		Recovery:       "Workspace 已切换到目标分支，请等待前端资源刷新完成后继续编辑。",
	}, nil
}

func createGitBranchInContainer(ctx context.Context, containerMgr *container.Manager, projectID, branchName string) (*GitBranchCreateResultRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		currentBranch = "HEAD"
	}

	headOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "HEAD")
	if err != nil {
		return nil, err
	}
	headCommit := strings.TrimSpace(headOutput)

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+branchName); err == nil {
		return &GitBranchCreateResultRecord{
			Name:       branchName,
			FromBranch: currentBranch,
			Status:     "blocked",
			Created:    false,
			LastCommit: shortHash(headCommit),
			Message:    "目标分支已存在",
			Recovery:   "刷新 Git 分支列表后选择已有分支，或输入一个尚未存在的新分支名。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "branch", branchName); err != nil {
		return nil, err
	}

	return &GitBranchCreateResultRecord{
		Name:       branchName,
		FromBranch: currentBranch,
		Status:     "created",
		Created:    true,
		LastCommit: shortHash(headCommit),
		Message:    "Git 分支已创建",
		Recovery:   "Workspace 会刷新分支列表；如需进入该分支，请在 readiness guard 通过后显式执行分支切换。",
	}, nil
}

func createGitBranchFromRemoteInContainer(ctx context.Context, containerMgr *container.Manager, projectID, remoteBranch, branchName string) (*GitBranchCreateFromRemoteResultRecord, error) {
	remote, branch, _ := strings.Cut(remoteBranch, "/")
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		currentBranch = "HEAD"
	}

	remoteRef := "refs/remotes/" + remoteBranch
	remoteCommitOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", remoteRef)
	if err != nil {
		return &GitBranchCreateFromRemoteResultRecord{
			Name:          branchName,
			RemoteBranch:  remoteBranch,
			Remote:        remote,
			Branch:        branch,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Created:       false,
			Tracking:      false,
			Message:       "远端引用不存在",
			Recovery:      "刷新 Git 远端分支列表，确认本地已有 remote refs 后再从远端引用创建本地分支；当前操作不会执行 fetch。",
		}, nil
	}
	remoteCommit := strings.TrimSpace(remoteCommitOutput)

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+branchName); err == nil {
		return &GitBranchCreateFromRemoteResultRecord{
			Name:          branchName,
			RemoteBranch:  remoteBranch,
			Remote:        remote,
			Branch:        branch,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Created:       false,
			Tracking:      false,
			LastCommit:    shortHash(remoteCommit),
			Message:       "目标本地分支已存在",
			Recovery:      "刷新 Git 分支列表后选择已有分支，或输入一个尚未存在的新本地分支名。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--track", branchName, remoteRef); err != nil {
		return nil, err
	}

	return &GitBranchCreateFromRemoteResultRecord{
		Name:          branchName,
		RemoteBranch:  remoteBranch,
		Remote:        remote,
		Branch:        branch,
		CurrentBranch: currentBranch,
		Status:        "created",
		Created:       true,
		Tracking:      true,
		LastCommit:    shortHash(remoteCommit),
		Message:       "已从远端引用创建本地跟踪分支",
		Recovery:      "Workspace 会刷新本地分支列表；如需进入该分支，请等待 readiness guard 通过后显式执行分支切换。",
	}, nil
}

func deleteGitBranchInContainer(ctx context.Context, containerMgr *container.Manager, projectID, branchName string) (*GitBranchDeleteResultRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		return &GitBranchDeleteResultRecord{
			Name:          branchName,
			CurrentBranch: "",
			Status:        "blocked",
			Deleted:       false,
			Message:       "当前 Git 分支不可确认",
			Recovery:      "先刷新分支列表或确认项目 Git 工作区处于普通分支状态，再删除非当前本地分支。",
		}, nil
	}

	targetCommitOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+branchName)
	if err != nil {
		return &GitBranchDeleteResultRecord{
			Name:          branchName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Deleted:       false,
			Message:       "目标分支不存在",
			Recovery:      "刷新 Git 分支列表后重新选择一个存在的非当前本地分支。",
		}, nil
	}
	targetCommit := strings.TrimSpace(targetCommitOutput)

	if currentBranch == branchName {
		return &GitBranchDeleteResultRecord{
			Name:          branchName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Deleted:       false,
			LastCommit:    shortHash(targetCommit),
			Message:       "不能删除当前分支",
			Recovery:      "先通过 readiness guard 显式切换到其他分支，再删除该本地分支。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "-d", branchName); err != nil {
		return &GitBranchDeleteResultRecord{
			Name:          branchName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Deleted:       false,
			LastCommit:    shortHash(targetCommit),
			Message:       "目标分支未合并或删除失败",
			Recovery:      "如需删除未合并分支，请先完成合并或保留分支；当前受控删除不会执行强制删除。",
		}, nil
	}

	return &GitBranchDeleteResultRecord{
		Name:          branchName,
		CurrentBranch: currentBranch,
		Status:        "deleted",
		Deleted:       true,
		LastCommit:    shortHash(targetCommit),
		Message:       "Git 本地分支已删除",
		Recovery:      "Workspace 会刷新分支列表和对比目标；当前工作区未执行 checkout、switch、merge、reset 或远端删除。",
	}, nil
}

func renameGitBranchInContainer(ctx context.Context, containerMgr *container.Manager, projectID, previousName, nextName string) (*GitBranchRenameResultRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}
	currentBranch := strings.TrimSpace(currentOutput)
	if currentBranch == "" {
		return &GitBranchRenameResultRecord{
			PreviousName:  previousName,
			Name:          nextName,
			CurrentBranch: "",
			Status:        "blocked",
			Renamed:       false,
			Message:       "当前 Git 分支不可确认",
			Recovery:      "先刷新分支列表或确认项目 Git 工作区处于普通分支状态，再重命名非当前本地分支。",
		}, nil
	}

	sourceCommitOutput, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+previousName)
	if err != nil {
		return &GitBranchRenameResultRecord{
			PreviousName:  previousName,
			Name:          nextName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Renamed:       false,
			Message:       "源分支不存在",
			Recovery:      "刷新 Git 分支列表后重新选择一个存在的非当前本地分支。",
		}, nil
	}
	sourceCommit := strings.TrimSpace(sourceCommitOutput)

	if currentBranch == previousName {
		return &GitBranchRenameResultRecord{
			PreviousName:  previousName,
			Name:          nextName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Renamed:       false,
			LastCommit:    shortHash(sourceCommit),
			Message:       "不能重命名当前分支",
			Recovery:      "先通过 readiness guard 显式切换到其他分支，再重命名该本地分支。",
		}, nil
	}
	if previousName == nextName {
		return &GitBranchRenameResultRecord{
			PreviousName:  previousName,
			Name:          nextName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Renamed:       false,
			LastCommit:    shortHash(sourceCommit),
			Message:       "新分支名与源分支名相同",
			Recovery:      "请输入一个尚未存在且不同于源分支的新本地分支名。",
		}, nil
	}
	if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+nextName); err == nil {
		return &GitBranchRenameResultRecord{
			PreviousName:  previousName,
			Name:          nextName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Renamed:       false,
			LastCommit:    shortHash(sourceCommit),
			Message:       "目标分支名已存在",
			Recovery:      "刷新 Git 分支列表后选择已有分支，或输入一个尚未存在的新分支名。",
		}, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "-m", previousName, nextName); err != nil {
		return &GitBranchRenameResultRecord{
			PreviousName:  previousName,
			Name:          nextName,
			CurrentBranch: currentBranch,
			Status:        "blocked",
			Renamed:       false,
			LastCommit:    shortHash(sourceCommit),
			Message:       "目标分支重命名失败",
			Recovery:      "请刷新 Git 分支列表确认源分支仍存在且目标名合法；当前受控重命名不会切换工作区或覆盖已有分支。",
		}, nil
	}

	return &GitBranchRenameResultRecord{
		PreviousName:  previousName,
		Name:          nextName,
		CurrentBranch: currentBranch,
		Status:        "renamed",
		Renamed:       true,
		LastCommit:    shortHash(sourceCommit),
		Message:       "Git 本地分支已重命名",
		Recovery:      "Workspace 会刷新分支列表和对比目标；当前工作区未执行 checkout、switch、merge、reset、删除或远端操作。",
	}, nil
}

func restoreGitFileFromCommitInContainer(ctx context.Context, containerMgr *container.Manager, projectID, commitHash, filePath string) (*GitCommitFileRestoreResultRecord, *gitCommitSnapshot, error) {
	_, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", commitHash)
	if err != nil {
		return nil, nil, err
	}
	_, err = runGitInContainer(ctx, containerMgr, projectID, "cat-file", "-e", commitHash+":"+filePath)
	if err != nil {
		return nil, nil, err
	}

	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain", "--", filePath)
	if err != nil {
		return nil, nil, err
	}
	dirtyFiles := countGitStatusPorcelainFiles(statusOutput)
	if dirtyFiles > 0 {
		return &GitCommitFileRestoreResultRecord{
			Hash:       commitHash,
			Path:       filePath,
			Status:     "blocked",
			DirtyFiles: dirtyFiles,
			Message:    "目标文件存在未提交变更",
			Recovery:   "先保存当前文件并生成 Git 快照，或处理该文件的本地变更后再执行单文件版本恢复。",
		}, nil, nil
	}

	_, err = runGitInContainer(ctx, containerMgr, projectID, "checkout", commitHash, "--", filePath)
	if err != nil {
		return nil, nil, err
	}
	commitCreated, snapshot, err := createProjectGitCommitInContainer(ctx, containerMgr, projectID, fmt.Sprintf("Restore %s from %s", filePath, shortHash(commitHash)))
	if err != nil {
		return nil, nil, err
	}
	commitHashAfterRestore := ""
	if snapshot != nil {
		commitHashAfterRestore = snapshot.Hash
	}
	return &GitCommitFileRestoreResultRecord{
		Hash:          commitHash,
		Path:          filePath,
		Status:        "restored",
		DirtyFiles:    0,
		CommitCreated: commitCreated,
		CommitHash:    commitHashAfterRestore,
		Message:       "Git 单文件版本恢复完成",
		Recovery:      "Workspace 已恢复该文件并刷新 Explorer 与 Git 提交列表；请重新打开文件确认内容。",
	}, snapshot, nil
}

func discardGitWorktreeFileInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath string) (*GitWorktreeFileDiscardResultRecord, error) {
	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain", "--", filePath)
	if err != nil {
		return nil, err
	}
	files := parseGitWorktreeFileRecords(statusOutput)
	if len(files) == 0 {
		return &GitWorktreeFileDiscardResultRecord{
			Path:       filePath,
			Status:     "blocked",
			DirtyFiles: 0,
			Message:    "目标文件没有可丢弃的 worktree 变更",
			Recovery:   "请刷新 Git 面板确认当前 worktree dirty 文件列表后再选择需要丢弃的文件。",
		}, nil
	}
	if len(files) > 1 {
		return &GitWorktreeFileDiscardResultRecord{
			Path:       filePath,
			Status:     "blocked",
			DirtyFiles: len(files),
			Message:    "目标路径匹配到多个 dirty 记录",
			Recovery:   "请先处理重命名、目录或多路径变更，再对单个文件执行丢弃操作。",
		}, nil
	}

	file := files[0]
	if file.Status == "renamed" || file.Status == "copied" || file.Status == "unmerged" || file.Status == "ignored" {
		return &GitWorktreeFileDiscardResultRecord{
			Path:       filePath,
			Status:     "blocked",
			DirtyFiles: 1,
			Message:    "目标文件处于复杂 Git 状态，已阻断单文件丢弃",
			Recovery:   "请在终端手工处理重命名、复制、冲突或 ignored 状态，避免单路径操作误删或覆盖关联文件。",
		}, nil
	}

	if file.Status == "untracked" || file.IndexStatus == "A" {
		if _, err := runGitInContainer(ctx, containerMgr, projectID, "reset", "--", filePath); err != nil {
			return nil, err
		}
		if _, err := runGitInContainer(ctx, containerMgr, projectID, "clean", "-f", "--", filePath); err != nil {
			return nil, err
		}
	} else {
		if _, err := runGitInContainer(ctx, containerMgr, projectID, "checkout", "HEAD", "--", filePath); err != nil {
			return nil, err
		}
	}

	return &GitWorktreeFileDiscardResultRecord{
		Path:       filePath,
		Status:     "discarded",
		DirtyFiles: 1,
		Message:    "Git worktree 单文件变更已丢弃",
		Recovery:   "Workspace 会清理该文件编辑器缓存并刷新 Explorer、worktree 与 Git 提交列表；请重新打开文件确认后端真源内容。",
	}, nil
}

func commitGitWorktreeInContainer(ctx context.Context, containerMgr *container.Manager, projectID, message string) (*GitWorktreeCommitResultRecord, *gitCommitSnapshot, error) {
	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain")
	if err != nil {
		return nil, nil, err
	}
	files := parseGitWorktreeFileRecords(statusOutput)
	if len(files) == 0 {
		return &GitWorktreeCommitResultRecord{
			Status:        "blocked",
			DirtyFiles:    0,
			CommitCreated: false,
			CommitHash:    "",
			Message:       "当前 worktree 没有可提交的 dirty 变更",
			Recovery:      "请先保存文件或执行会修改 worktree 的操作，再刷新 Git 面板确认 dirty 状态后提交。",
		}, nil, nil
	}

	commitCreated, snapshot, err := createProjectGitCommitInContainer(ctx, containerMgr, projectID, message)
	if err != nil {
		return nil, nil, err
	}
	if !commitCreated {
		return &GitWorktreeCommitResultRecord{
			Status:        "blocked",
			DirtyFiles:    len(files),
			CommitCreated: false,
			CommitHash:    "",
			Message:       "Git 未创建新提交",
			Recovery:      "提交前 dirty 预检存在变更，但提交阶段未检测到可提交内容；请刷新 Git 面板确认 worktree 状态。",
		}, nil, nil
	}

	commitHash := ""
	if snapshot != nil {
		commitHash = snapshot.Hash
	}
	return &GitWorktreeCommitResultRecord{
		Status:        "committed",
		DirtyFiles:    len(files),
		CommitCreated: true,
		CommitHash:    commitHash,
		Message:       "Git worktree dirty 变更已提交",
		Recovery:      "Workspace 会重新同步 Explorer、worktree 与 Git 提交列表；请在 Git 面板确认最新提交。",
	}, snapshot, nil
}

func applyGitBranchCompareFileInContainer(ctx context.Context, containerMgr *container.Manager, projectID, baseBranch, headBranch, filePath string) (*GitBranchCompareFileApplyResultRecord, *gitCommitSnapshot, error) {
	for _, branch := range []string{baseBranch, headBranch} {
		if _, err := runGitInContainer(ctx, containerMgr, projectID, "rev-parse", "--verify", "refs/heads/"+branch); err != nil {
			return nil, nil, err
		}
	}
	currentBranchOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, nil, err
	}
	currentBranch := strings.TrimSpace(currentBranchOutput)
	if currentBranch != baseBranch {
		return &GitBranchCompareFileApplyResultRecord{
			BaseBranch: baseBranch,
			HeadBranch: headBranch,
			Path:       filePath,
			Status:     "blocked",
			Message:    "当前分支与分支对比基准不一致",
			Recovery:   "刷新 Git 面板重新确认当前分支、对比基准和目标分支后，再执行单文件引入。",
		}, nil, nil
	}
	if baseBranch == headBranch {
		return &GitBranchCompareFileApplyResultRecord{
			BaseBranch: baseBranch,
			HeadBranch: headBranch,
			Path:       filePath,
			Status:     "blocked",
			Message:    "基准分支与目标分支相同",
			Recovery:   "请选择不同的本地目标分支后再引入文件。",
		}, nil, nil
	}
	if _, err := runGitInContainer(ctx, containerMgr, projectID, "cat-file", "-e", "refs/heads/"+headBranch+":"+filePath); err != nil {
		return nil, nil, err
	}

	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain", "--", filePath)
	if err != nil {
		return nil, nil, err
	}
	dirtyFiles := countGitStatusPorcelainFiles(statusOutput)
	if dirtyFiles > 0 {
		return &GitBranchCompareFileApplyResultRecord{
			BaseBranch: baseBranch,
			HeadBranch: headBranch,
			Path:       filePath,
			Status:     "blocked",
			DirtyFiles: dirtyFiles,
			Message:    "目标文件存在未提交变更",
			Recovery:   "先保存当前文件并生成 Git 快照，或处理该文件的本地变更后再从分支对比引入。",
		}, nil, nil
	}

	if _, err := runGitInContainer(ctx, containerMgr, projectID, "checkout", "refs/heads/"+headBranch, "--", filePath); err != nil {
		return nil, nil, err
	}
	commitCreated, snapshot, err := createProjectGitCommitInContainer(ctx, containerMgr, projectID, fmt.Sprintf("Apply %s from %s", filePath, headBranch))
	if err != nil {
		return nil, nil, err
	}
	commitHashAfterApply := ""
	if snapshot != nil {
		commitHashAfterApply = snapshot.Hash
	}
	return &GitBranchCompareFileApplyResultRecord{
		BaseBranch:    baseBranch,
		HeadBranch:    headBranch,
		Path:          filePath,
		Status:        "applied",
		DirtyFiles:    0,
		CommitCreated: commitCreated,
		CommitHash:    commitHashAfterApply,
		Message:       "Git 分支对比单文件引入完成",
		Recovery:      "Workspace 已从目标分支引入该文件并刷新 Explorer、Git 提交列表和分支对比；请重新打开文件确认内容。",
	}, snapshot, nil
}

func readGitCommitRecordInContainer(ctx context.Context, containerMgr *container.Manager, projectID, commitHash string, includePatch bool) (*GitCommitRecord, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "log", "-1", "--date=iso-strict", "--pretty=format:%H%x1f%s%x1f%an%x1f%ae%x1f%ad", commitHash)
	if err != nil {
		return nil, err
	}
	parts := strings.Split(strings.TrimSpace(output), "\x1f")
	if len(parts) < 5 {
		return nil, fmt.Errorf("invalid git commit metadata")
	}
	diff, err := readGitCommitDiffInContainer(ctx, containerMgr, projectID, parts[0], includePatch)
	if err != nil {
		return nil, err
	}
	return &GitCommitRecord{
		Hash:     shortHash(parts[0]),
		Message:  parts[1],
		Author:   parts[2],
		Email:    parts[3],
		Time:     parts[4],
		Files:    len(diff),
		Branches: []string{"main"},
		Diff:     diff,
	}, nil
}

func readGitCommitDiffInContainer(ctx context.Context, containerMgr *container.Manager, projectID, commitHash string, includePatch bool) ([]GitCommitDiff, error) {
	output, err := runGitInContainer(ctx, containerMgr, projectID, "show", "--format=", "--numstat", commitHash)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(output), "\n")
	diffs := make([]GitCommitDiff, 0, len(lines))
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 3 {
			continue
		}
		content := ""
		if includePatch {
			content = readGitDiffPatchInContainer(ctx, containerMgr, projectID, commitHash, parts[2])
		}
		diffs = append(diffs, GitCommitDiff{
			Path:      parts[2],
			Additions: parseGitNumStat(parts[0]),
			Deletions: parseGitNumStat(parts[1]),
			Content:   content,
		})
	}

	return diffs, nil
}

func readGitDiffPatchInContainer(ctx context.Context, containerMgr *container.Manager, projectID, commitHash, filePath string) string {
	if strings.TrimSpace(filePath) == "" {
		return ""
	}
	output, err := runGitInContainer(ctx, containerMgr, projectID, "show", "--format=", "--unified=3", commitHash, "--", filePath)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(output)
}

func parseGitNumStat(value string) int {
	if value == "-" {
		return 0
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return n
}

func parseGitNumStatTotals(output string) (filesChanged int, additions int, deletions int) {
	lines := strings.Split(strings.TrimSpace(output), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 3 {
			continue
		}
		filesChanged++
		additions += parseGitNumStat(parts[0])
		deletions += parseGitNumStat(parts[1])
	}
	return filesChanged, additions, deletions
}

func countGitStatusPorcelainFiles(output string) int {
	return len(parseGitWorktreeFileRecords(output))
}

func parseGitWorktreeFileRecords(output string) []GitWorktreeFileRecord {
	files := make([]GitWorktreeFileRecord, 0)
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimRight(line, "\r")
		if strings.TrimSpace(line) == "" || len(line) < 3 {
			continue
		}
		indexStatus := string(line[0])
		worktreeStatus := string(line[1])
		path := strings.TrimSpace(line[3:])
		if path == "" {
			continue
		}
		originalPath := ""
		if (indexStatus == "R" || indexStatus == "C") && strings.Contains(path, " -> ") {
			parts := strings.SplitN(path, " -> ", 2)
			originalPath = strings.TrimSpace(parts[0])
			path = strings.TrimSpace(parts[1])
		}
		if path == "" {
			continue
		}
		files = append(files, GitWorktreeFileRecord{
			Path:           path,
			OriginalPath:   originalPath,
			Status:         summarizeGitWorktreeFileStatus(indexStatus, worktreeStatus),
			IndexStatus:    indexStatus,
			WorktreeStatus: worktreeStatus,
		})
	}
	return files
}

func summarizeGitWorktreeFileStatus(indexStatus, worktreeStatus string) string {
	if indexStatus == "?" && worktreeStatus == "?" {
		return "untracked"
	}
	if indexStatus == "!" && worktreeStatus == "!" {
		return "ignored"
	}
	if indexStatus == "R" || worktreeStatus == "R" {
		return "renamed"
	}
	if indexStatus == "C" || worktreeStatus == "C" {
		return "copied"
	}
	if indexStatus == "A" || worktreeStatus == "A" {
		return "added"
	}
	if indexStatus == "D" || worktreeStatus == "D" {
		return "deleted"
	}
	if indexStatus == "M" || worktreeStatus == "M" {
		return "modified"
	}
	if indexStatus == "U" || worktreeStatus == "U" {
		return "unmerged"
	}
	return "updated"
}

func buildGitWorktreeStatusRecord(currentBranch, statusOutput string, diff []GitCommitDiff) *GitWorktreeStatusRecord {
	currentBranch = strings.TrimSpace(currentBranch)
	if currentBranch == "" {
		currentBranch = "HEAD"
	}
	files := parseGitWorktreeFileRecords(statusOutput)
	dirtyFiles := len(files)
	diffFiles, additions, deletions := summarizeGitDiffStats(diff)
	if dirtyFiles > 0 {
		return &GitWorktreeStatusRecord{
			CurrentBranch: currentBranch,
			Status:        "dirty",
			DirtyFiles:    dirtyFiles,
			Files:         files,
			DiffFiles:     diffFiles,
			Additions:     additions,
			Deletions:     deletions,
			Diff:          diff,
			Message:       "当前 Git worktree 存在未提交变更",
			Recovery:      "先保存并生成 Git 快照，或处理本地变更后再执行分支切换、版本恢复等受控写操作。",
		}
	}

	return &GitWorktreeStatusRecord{
		CurrentBranch: currentBranch,
		Status:        "clean",
		DirtyFiles:    0,
		Files:         []GitWorktreeFileRecord{},
		DiffFiles:     0,
		Additions:     0,
		Deletions:     0,
		Diff:          []GitCommitDiff{},
		Message:       "当前 Git worktree 没有未提交变更",
		Recovery:      "可继续查看提交、分支和远端引用；后续写操作仍需通过各自 guard。",
	}
}

type gitWorktreeDiffStat struct {
	additions int
	deletions int
}

func readGitWorktreeDiffInContainer(ctx context.Context, containerMgr *container.Manager, projectID string, files []GitWorktreeFileRecord) ([]GitCommitDiff, error) {
	unstagedOutput, err := runGitInContainer(ctx, containerMgr, projectID, "diff", "--numstat")
	if err != nil {
		return nil, err
	}
	cachedOutput, err := runGitInContainer(ctx, containerMgr, projectID, "diff", "--cached", "--numstat")
	if err != nil {
		return nil, err
	}

	statsByPath := mergeGitNumStatRows(unstagedOutput, cachedOutput)
	diffs := make([]GitCommitDiff, 0, len(files))
	for _, file := range files {
		if file.Status == "untracked" || file.Status == "ignored" || strings.TrimSpace(file.Path) == "" {
			continue
		}
		normalizedPath, err := normalizeProjectRelativePath(file.Path)
		if err != nil {
			continue
		}
		stat := statsByPath[normalizedPath]
		content := readGitWorktreeDiffPatchInContainer(ctx, containerMgr, projectID, normalizedPath)
		if stat.additions == 0 && stat.deletions == 0 && content == "" {
			continue
		}
		diffs = append(diffs, GitCommitDiff{
			Path:      normalizedPath,
			Additions: stat.additions,
			Deletions: stat.deletions,
			Content:   content,
		})
	}
	return diffs, nil
}

func readGitWorktreeDiffPatchInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath string) string {
	cachedOutput, cachedErr := runGitInContainer(ctx, containerMgr, projectID, "diff", "--cached", "--unified=3", "--", filePath)
	unstagedOutput, unstagedErr := runGitInContainer(ctx, containerMgr, projectID, "diff", "--unified=3", "--", filePath)
	sections := make([]string, 0, 2)
	if cachedErr == nil && strings.TrimSpace(cachedOutput) != "" {
		sections = append(sections, strings.TrimSpace(cachedOutput))
	}
	if unstagedErr == nil && strings.TrimSpace(unstagedOutput) != "" {
		sections = append(sections, strings.TrimSpace(unstagedOutput))
	}
	return strings.Join(sections, "\n")
}

func mergeGitNumStatRows(outputs ...string) map[string]gitWorktreeDiffStat {
	stats := make(map[string]gitWorktreeDiffStat)
	for _, output := range outputs {
		for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
			if strings.TrimSpace(line) == "" {
				continue
			}
			parts := strings.Split(line, "\t")
			if len(parts) < 3 {
				continue
			}
			path, err := normalizeProjectRelativePath(parts[2])
			if err != nil {
				continue
			}
			stat := stats[path]
			stat.additions += parseGitNumStat(parts[0])
			stat.deletions += parseGitNumStat(parts[1])
			stats[path] = stat
		}
	}
	return stats
}

func summarizeGitDiffStats(diff []GitCommitDiff) (filesChanged int, additions int, deletions int) {
	for _, file := range diff {
		filesChanged++
		additions += file.Additions
		deletions += file.Deletions
	}
	return filesChanged, additions, deletions
}

func readGitWorktreeStatusInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) (*GitWorktreeStatusRecord, error) {
	currentOutput, err := runGitInContainer(ctx, containerMgr, projectID, "branch", "--show-current")
	if err != nil {
		return nil, err
	}

	statusOutput, err := runGitInContainer(ctx, containerMgr, projectID, "status", "--porcelain")
	if err != nil {
		return nil, err
	}
	files := parseGitWorktreeFileRecords(statusOutput)
	diff, err := readGitWorktreeDiffInContainer(ctx, containerMgr, projectID, files)
	if err != nil {
		return nil, err
	}
	return buildGitWorktreeStatusRecord(currentOutput, statusOutput, diff), nil
}

func shortHash(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	for _, r := range normalized {
		if (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') {
			builder.WriteRune(r)
		}
		if builder.Len() >= 7 {
			break
		}
	}
	if builder.Len() > 0 {
		return builder.String()
	}
	if len(normalized) <= 7 {
		return normalized
	}
	return normalized[:7]
}

func normalizeGitBranchName(value string) (string, error) {
	branch := strings.TrimSpace(value)
	if branch == "" {
		return "", fmt.Errorf("git branch name is required")
	}
	if len(branch) > 200 {
		return "", fmt.Errorf("git branch name is too long")
	}
	if strings.Contains(branch, "\x00") || strings.Contains(branch, "\n") || strings.Contains(branch, "\r") {
		return "", fmt.Errorf("git branch name contains invalid characters")
	}
	if strings.Contains(branch, "..") ||
		strings.Contains(branch, "//") ||
		strings.Contains(branch, "@{") ||
		strings.ContainsAny(branch, " ~^:?*[\\") ||
		strings.HasPrefix(branch, "-") ||
		strings.HasPrefix(branch, "/") ||
		strings.HasSuffix(branch, "/") ||
		strings.HasSuffix(branch, ".") ||
		strings.HasSuffix(branch, ".lock") {
		return "", fmt.Errorf("git branch name is invalid")
	}
	for _, part := range strings.Split(branch, "/") {
		if strings.HasPrefix(part, ".") {
			return "", fmt.Errorf("git branch name is invalid")
		}
	}
	return branch, nil
}

var gitStashRefPattern = regexp.MustCompile(`^stash@\{[0-9]+\}$`)

func normalizeGitStashRef(value string) (string, error) {
	stashRef := strings.TrimSpace(value)
	if stashRef == "" {
		return "", fmt.Errorf("git stash ref is required")
	}
	if !gitStashRefPattern.MatchString(stashRef) {
		return "", fmt.Errorf("git stash ref is invalid")
	}
	return stashRef, nil
}

func normalizeGitStashMessage(value string) (string, error) {
	message := strings.TrimSpace(value)
	if message == "" {
		return "", fmt.Errorf("git stash message is required")
	}
	if len(message) > 200 {
		return "", fmt.Errorf("git stash message is too long")
	}
	if strings.Contains(message, "\x00") || strings.Contains(message, "\n") || strings.Contains(message, "\r") {
		return "", fmt.Errorf("git stash message contains invalid characters")
	}
	return message, nil
}

func normalizeGitTagName(value string) (string, error) {
	tagName, err := normalizeGitBranchName(value)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(tagName, "refs/") {
		return "", fmt.Errorf("git tag name is invalid")
	}
	return tagName, nil
}

func normalizeGitRemoteName(value string) (string, error) {
	remote := strings.TrimSpace(value)
	if remote == "" {
		return "", fmt.Errorf("git remote name is required")
	}
	if len(remote) > 100 {
		return "", fmt.Errorf("git remote name is too long")
	}
	if strings.Contains(remote, "\x00") || strings.Contains(remote, "\n") || strings.Contains(remote, "\r") {
		return "", fmt.Errorf("git remote name contains invalid characters")
	}
	if strings.Contains(remote, "..") ||
		strings.Contains(remote, "//") ||
		strings.ContainsAny(remote, " /\\~^:?*[\t") ||
		strings.HasPrefix(remote, "-") ||
		strings.HasPrefix(remote, ".") ||
		strings.HasSuffix(remote, ".") ||
		strings.HasSuffix(remote, ".lock") {
		return "", fmt.Errorf("git remote name is invalid")
	}
	return remote, nil
}

func normalizeGitRemoteBranchName(value string) (string, error) {
	branch, err := normalizeGitBranchName(value)
	if err != nil {
		return "", err
	}
	remote, name, ok := strings.Cut(branch, "/")
	if !ok || strings.TrimSpace(remote) == "" || strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("git remote branch name must include remote and branch")
	}
	if strings.EqualFold(name, "HEAD") || strings.Contains(branch, " -> ") {
		return "", fmt.Errorf("git remote branch name is invalid")
	}
	return branch, nil
}

func runGitCommandInContainer(ctx context.Context, containerMgr *container.Manager, projectID string, args ...string) (*container.ExecResult, error) {
	commandArgs := make([]string, 0, len(args)+1)
	commandArgs = append(commandArgs, "git")
	commandArgs = append(commandArgs, args...)
	return containerMgr.RunCommandArgs(ctx, projectID, commandArgs, "/workspace", 300)
}

func ensureGitRepositoryInContainer(ctx context.Context, containerMgr *container.Manager, projectID string) error {
	result, err := runGitCommandInContainer(ctx, containerMgr, projectID, "--version")
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return fmt.Errorf("git is not available in container")
	}

	exists, err := projectPathExistsInContainer(ctx, containerMgr, projectID, ".git")
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	result, err = runGitCommandInContainer(ctx, containerMgr, projectID, "init")
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return fmt.Errorf("git init failed: %s", strings.TrimSpace(result.Stderr))
	}
	result, err = runGitCommandInContainer(ctx, containerMgr, projectID, "symbolic-ref", "HEAD", "refs/heads/main")
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return fmt.Errorf("git symbolic-ref failed: %s", strings.TrimSpace(result.Stderr))
	}

	return nil
}

func runGitInContainer(ctx context.Context, containerMgr *container.Manager, projectID string, args ...string) (string, error) {
	if containerMgr == nil {
		return "", fmt.Errorf("container manager not available")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if len(args) == 0 {
		return "", fmt.Errorf("git command args are required")
	}
	if err := ensureGitRepositoryInContainer(ctx, containerMgr, projectID); err != nil {
		return "", err
	}

	result, err := runGitCommandInContainer(ctx, containerMgr, projectID, args...)
	if err != nil {
		return "", err
	}
	if result.ExitCode != 0 {
		errMsg := strings.TrimSpace(result.Stderr)
		if errMsg == "" {
			errMsg = strings.TrimSpace(result.Stdout)
		}
		return "", fmt.Errorf("git %s failed: %s", strings.Join(args, " "), errMsg)
	}
	return result.Stdout, nil
}

var gitCommitHashPattern = regexp.MustCompile(`^[0-9a-fA-F]{7,64}$`)

func normalizeGitCommitHash(value string) (string, error) {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return "", fmt.Errorf("commit hash is required")
	}
	if !gitCommitHashPattern.MatchString(normalized) {
		return "", fmt.Errorf("invalid commit hash")
	}
	return normalized, nil
}

func isEmptyGitHistoryError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "does not have any commits yet") ||
		strings.Contains(message, "your current branch") ||
		strings.Contains(message, "not a git repository") ||
		strings.Contains(message, "git repository not initialized")
}

func buildGitCommitMessage(prompt, message string) string {
	if strings.TrimSpace(message) != "" {
		return strings.TrimSpace(message)
	}
	if strings.TrimSpace(prompt) != "" {
		prompt = strings.TrimSpace(prompt)
		runes := []rune(prompt)
		if len(runes) > 48 {
			prompt = string(runes[:48])
		}
		return "Implement: " + prompt
	}
	return "Implement project changes"
}
