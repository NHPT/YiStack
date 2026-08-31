package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"strconv"
	"strings"

	"yistack/internal/model"
	"yistack/pkg/container"
	"yistack/pkg/utils"

	"gorm.io/gorm"
)

type githubGitRunner interface {
	Run(ctx context.Context, projectID string, args []string, token string, timeout int) (*container.ExecResult, error)
}

type containerGitHubGitRunner struct {
	manager *container.Manager
}

func newContainerGitHubGitRunner(projectService *ProjectService) githubGitRunner {
	if projectService == nil || projectService.containerMgr == nil {
		return nil
	}
	return &containerGitHubGitRunner{manager: projectService.containerMgr}
}

func (r *containerGitHubGitRunner) Run(
	ctx context.Context,
	projectID string,
	args []string,
	token string,
	timeout int,
) (*container.ExecResult, error) {
	command := append([]string{"git"}, args...)
	env := []string{"GIT_TERMINAL_PROMPT=0"}
	if strings.TrimSpace(token) != "" {
		env = append(env,
			"GIT_CONFIG_COUNT=1",
			"GIT_CONFIG_KEY_0=http.extraHeader",
			"GIT_CONFIG_VALUE_0=Authorization: Bearer "+token,
		)
	}
	return r.manager.RunCommand(ctx, projectID, container.RunOptions{
		ProjectID: projectID, Args: command, Env: env, WorkDir: "/workspace", Timeout: timeout,
	})
}

type GitHubImportRequest struct {
	RepositoryName          string `json:"repository_name"`
	Branch                  string `json:"branch"`
	ConfirmReplaceWorkspace bool   `json:"confirm_replace_workspace"`
	IdempotencyKey          string `json:"idempotency_key"`
}

type GitHubPullRequest struct {
	ConfirmPull    bool   `json:"confirm_pull"`
	IdempotencyKey string `json:"idempotency_key"`
}

type GitHubPushRequest struct {
	ConfirmPush       bool   `json:"confirm_push"`
	Force             bool   `json:"force"`
	ConfirmForcePush  bool   `json:"confirm_force_push"`
	ExpectedRemoteSHA string `json:"expected_remote_sha"`
	IdempotencyKey    string `json:"idempotency_key"`
}

type GitHubSyncResult struct {
	Status         string `json:"status"`
	Kind           string `json:"kind"`
	RepositoryName string `json:"repository_name"`
	Branch         string `json:"branch"`
	LocalSHA       string `json:"local_sha,omitempty"`
	RemoteSHA      string `json:"remote_sha,omitempty"`
	BackupRef      string `json:"backup_ref,omitempty"`
	Forced         bool   `json:"forced"`
	Replayed       bool   `json:"replayed"`
	Message        string `json:"message"`
}

func (s *GitHubIntegrationService) GetProjectBinding(
	ctx context.Context,
	userID,
	projectID string,
) (*model.GitHubProjectBinding, error) {
	if s == nil || s.repo == nil {
		return nil, githubError("github_service_unavailable", "GitHub integration service is not available", nil)
	}
	binding, err := s.repo.FindBindingByProjectID(ctx, projectID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, githubError("github_project_not_bound", "Project is not bound to a GitHub repository", err)
	}
	if err != nil {
		return nil, err
	}
	if binding.UserID != userID {
		return nil, githubError("github_project_forbidden", "GitHub project binding belongs to another user", nil)
	}
	return binding, nil
}

func (s *GitHubIntegrationService) ImportRepository(
	ctx context.Context,
	userID string,
	project *model.Project,
	request GitHubImportRequest,
) (*GitHubSyncResult, error) {
	if project == nil || project.UserID != userID {
		return nil, githubError("github_project_forbidden", "Project access denied", nil)
	}
	repository, token, err := s.getRepository(ctx, userID, request.RepositoryName)
	if err != nil {
		return nil, err
	}
	branch := strings.TrimSpace(request.Branch)
	if branch == "" {
		branch = repository.DefaultBranch
	}
	branch, err = normalizeGitBranchName(branch)
	if err != nil {
		return nil, githubError("github_branch_invalid", "GitHub branch is invalid", err)
	}
	if !request.ConfirmReplaceWorkspace {
		return nil, githubError("github_import_confirmation_required", "Repository import requires explicit workspace replacement confirmation", nil)
	}
	payload := map[string]interface{}{
		"repository_name": repository.FullName, "branch": branch,
		"confirm_replace_workspace": request.ConfirmReplaceWorkspace,
	}
	return s.executeIdempotentSync(ctx, userID, project.ProjectID, "import", request.IdempotencyKey, payload, func() (*GitHubSyncResult, error) {
		return s.importRepository(ctx, userID, project, repository, branch, token)
	})
}

func (s *GitHubIntegrationService) PullRepository(
	ctx context.Context,
	userID string,
	project *model.Project,
	request GitHubPullRequest,
) (*GitHubSyncResult, error) {
	if project == nil || project.UserID != userID {
		return nil, githubError("github_project_forbidden", "Project access denied", nil)
	}
	if !request.ConfirmPull {
		return nil, githubError("github_pull_confirmation_required", "GitHub pull requires explicit confirmation", nil)
	}
	return s.executeIdempotentSync(ctx, userID, project.ProjectID, "pull", request.IdempotencyKey, request, func() (*GitHubSyncResult, error) {
		return s.pullRepository(ctx, userID, project)
	})
}

func (s *GitHubIntegrationService) PushRepository(
	ctx context.Context,
	userID string,
	project *model.Project,
	request GitHubPushRequest,
) (*GitHubSyncResult, error) {
	if project == nil || project.UserID != userID {
		return nil, githubError("github_project_forbidden", "Project access denied", nil)
	}
	if !request.ConfirmPush {
		return nil, githubError("github_push_confirmation_required", "GitHub push requires explicit confirmation", nil)
	}
	if request.Force && (!request.ConfirmForcePush || strings.TrimSpace(request.ExpectedRemoteSHA) == "") {
		return nil, githubError("github_force_push_confirmation_required", "Force push requires confirmation and the expected remote SHA", nil)
	}
	return s.executeIdempotentSync(ctx, userID, project.ProjectID, "push", request.IdempotencyKey, request, func() (*GitHubSyncResult, error) {
		return s.pushRepository(ctx, userID, project, request)
	})
}

func (s *GitHubIntegrationService) importRepository(
	ctx context.Context,
	userID string,
	project *model.Project,
	repository GitHubRepositoryRecord,
	branch,
	token string,
) (*GitHubSyncResult, error) {
	if !repository.PermissionAdmin {
		return nil, githubError("github_webhook_permission_required", "Repository admin permission is required to install the protected webhook", nil)
	}
	if err := s.prepareGitHubRuntime(ctx, project); err != nil {
		return nil, err
	}
	if err := s.requireCleanWorktree(ctx, project.ProjectID); err != nil {
		return nil, err
	}
	webhookID, webhookErr := s.ensureRepositoryWebhook(ctx, repository.FullName, token)
	if webhookErr != nil {
		return nil, webhookErr
	}
	remoteURL, urlErr := s.repositoryCloneURL(repository.FullName)
	if urlErr != nil {
		return nil, urlErr
	}
	backupRef := ""
	if result, _ := s.runGit(ctx, project.ProjectID, "", "rev-parse", "--verify", "HEAD"); result != nil && result.ExitCode == 0 {
		backupRef = "refs/yistack/import-backup/" + strconv.FormatInt(s.now().UTC().Unix(), 10)
		if _, err := s.runGitChecked(ctx, project.ProjectID, "", "update-ref", backupRef, "HEAD"); err != nil {
			return nil, err
		}
	}
	if remoteResult, _ := s.runGit(ctx, project.ProjectID, "", "remote", "get-url", "origin"); remoteResult != nil && remoteResult.ExitCode == 0 {
		if _, err := s.runGitChecked(ctx, project.ProjectID, "", "remote", "set-url", "origin", remoteURL); err != nil {
			return nil, err
		}
	} else if _, err := s.runGitChecked(ctx, project.ProjectID, "", "remote", "add", "origin", remoteURL); err != nil {
		return nil, err
	}
	if _, err := s.runGitChecked(ctx, project.ProjectID, token, "fetch", "--prune", "origin",
		"+refs/heads/"+branch+":refs/remotes/origin/"+branch); err != nil {
		return nil, err
	}
	remoteSHA, err := s.gitOutput(ctx, project.ProjectID, "", "rev-parse", "refs/remotes/origin/"+branch)
	if err != nil {
		return nil, githubError("github_branch_not_found", "GitHub branch was not found", err)
	}
	if _, err := s.runGitChecked(ctx, project.ProjectID, "", "checkout", "-B", branch, "refs/remotes/origin/"+branch); err != nil {
		return nil, err
	}
	if _, err := s.runGitChecked(ctx, project.ProjectID, "", "branch", "--set-upstream-to=origin/"+branch, branch); err != nil {
		return nil, err
	}
	now := s.now().UTC()
	binding := &model.GitHubProjectBinding{
		ID: utils.GenerateUUID(), ProjectID: project.ProjectID, UserID: userID,
		RepositoryID: repository.ID, RepositoryName: repository.FullName,
		RepositoryURL: repository.HTMLURL, DefaultBranch: branch, RemoteName: "origin",
		PermissionPush: repository.PermissionPush, WebhookID: webhookID, RemoteHeadSHA: remoteSHA,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.repo.UpsertBinding(ctx, binding); err != nil {
		return nil, err
	}
	if s.projectService.projectRepo != nil {
		_ = s.projectService.projectRepo.UpdateFields(ctx, project.ProjectID, map[string]interface{}{
			"git_repo_url": repository.HTMLURL, "git_branch": branch,
		})
	}
	s.refreshGitHubProjectFileTree(ctx, project.ProjectID)
	return &GitHubSyncResult{
		Status: "succeeded", Kind: "import", RepositoryName: repository.FullName,
		Branch: branch, LocalSHA: remoteSHA, RemoteSHA: remoteSHA, BackupRef: backupRef,
		Message: "GitHub repository imported with a protected local backup ref",
	}, nil
}

func (s *GitHubIntegrationService) pullRepository(
	ctx context.Context,
	userID string,
	project *model.Project,
) (*GitHubSyncResult, error) {
	binding, err := s.GetProjectBinding(ctx, userID, project.ProjectID)
	if err != nil {
		return nil, err
	}
	_, token, err := s.getRepository(ctx, userID, binding.RepositoryName)
	if err != nil {
		return nil, err
	}
	if err := s.prepareGitHubRuntime(ctx, project); err != nil {
		return nil, err
	}
	if err := s.requireCleanWorktree(ctx, project.ProjectID); err != nil {
		return nil, err
	}
	if err := s.requireBoundBranch(ctx, project.ProjectID, binding.DefaultBranch); err != nil {
		return nil, err
	}
	if _, err := s.runGitChecked(ctx, project.ProjectID, token, "fetch", "--prune", binding.RemoteName,
		"+refs/heads/"+binding.DefaultBranch+":refs/remotes/"+binding.RemoteName+"/"+binding.DefaultBranch); err != nil {
		return nil, err
	}
	localAhead, remoteAhead, err := s.gitAheadBehind(ctx, project.ProjectID, binding)
	if err != nil {
		return nil, err
	}
	if localAhead > 0 && remoteAhead > 0 {
		return nil, githubError("github_sync_diverged", "Local and GitHub branches have diverged; automatic pull is blocked", nil)
	}
	if localAhead > 0 {
		return nil, githubError("github_pull_local_ahead", "Local branch is ahead; push or reconcile before pulling", nil)
	}
	if remoteAhead > 0 {
		if _, err := s.runGitChecked(ctx, project.ProjectID, "", "merge", "--ff-only",
			"refs/remotes/"+binding.RemoteName+"/"+binding.DefaultBranch); err != nil {
			return nil, err
		}
	}
	localSHA, err := s.gitOutput(ctx, project.ProjectID, "", "rev-parse", "HEAD")
	if err != nil {
		return nil, err
	}
	binding.RemoteHeadSHA = localSHA
	binding.UpdatedAt = s.now().UTC()
	if err := s.repo.UpsertBinding(ctx, binding); err != nil {
		return nil, err
	}
	s.refreshGitHubProjectFileTree(ctx, project.ProjectID)
	return &GitHubSyncResult{
		Status: "succeeded", Kind: "pull", RepositoryName: binding.RepositoryName,
		Branch: binding.DefaultBranch, LocalSHA: localSHA, RemoteSHA: localSHA,
		Message: "GitHub branch synchronized with fast-forward only",
	}, nil
}

func (s *GitHubIntegrationService) pushRepository(
	ctx context.Context,
	userID string,
	project *model.Project,
	request GitHubPushRequest,
) (*GitHubSyncResult, error) {
	binding, err := s.GetProjectBinding(ctx, userID, project.ProjectID)
	if err != nil {
		return nil, err
	}
	repository, token, err := s.getRepository(ctx, userID, binding.RepositoryName)
	if err != nil {
		return nil, err
	}
	if !repository.PermissionPush || !binding.PermissionPush {
		return nil, githubError("github_push_forbidden", "GitHub repository does not grant push permission", nil)
	}
	if request.Force && !repository.PermissionAdmin {
		return nil, githubError("github_force_push_forbidden", "Force-with-lease requires GitHub repository admin permission", nil)
	}
	if err := s.prepareGitHubRuntime(ctx, project); err != nil {
		return nil, err
	}
	if err := s.requireCleanWorktree(ctx, project.ProjectID); err != nil {
		return nil, err
	}
	if err := s.requireBoundBranch(ctx, project.ProjectID, binding.DefaultBranch); err != nil {
		return nil, err
	}
	if _, err := s.runGitChecked(ctx, project.ProjectID, token, "fetch", "--prune", binding.RemoteName,
		"+refs/heads/"+binding.DefaultBranch+":refs/remotes/"+binding.RemoteName+"/"+binding.DefaultBranch); err != nil {
		return nil, err
	}
	remoteSHA, err := s.gitOutput(ctx, project.ProjectID, "", "rev-parse",
		"refs/remotes/"+binding.RemoteName+"/"+binding.DefaultBranch)
	if err != nil {
		return nil, err
	}
	localAhead, remoteAhead, err := s.gitAheadBehind(ctx, project.ProjectID, binding)
	if err != nil {
		return nil, err
	}
	pushArgs := []string{"push", binding.RemoteName, "HEAD:refs/heads/" + binding.DefaultBranch}
	if request.Force {
		if strings.TrimSpace(request.ExpectedRemoteSHA) != remoteSHA {
			return nil, githubError("github_force_push_stale_remote", "Remote SHA changed; force-with-lease is blocked", nil)
		}
		pushArgs = []string{"push",
			"--force-with-lease=refs/heads/" + binding.DefaultBranch + ":" + remoteSHA,
			binding.RemoteName, "HEAD:refs/heads/" + binding.DefaultBranch,
		}
	} else if remoteAhead > 0 {
		return nil, githubError("github_push_remote_ahead", "GitHub branch contains commits not present locally", nil)
	}
	if localAhead > 0 || request.Force {
		if _, err := s.runGitChecked(ctx, project.ProjectID, token, pushArgs...); err != nil {
			return nil, err
		}
	}
	localSHA, err := s.gitOutput(ctx, project.ProjectID, "", "rev-parse", "HEAD")
	if err != nil {
		return nil, err
	}
	binding.RemoteHeadSHA = localSHA
	binding.PermissionPush = repository.PermissionPush
	binding.UpdatedAt = s.now().UTC()
	if err := s.repo.UpsertBinding(ctx, binding); err != nil {
		return nil, err
	}
	return &GitHubSyncResult{
		Status: "succeeded", Kind: "push", RepositoryName: binding.RepositoryName,
		Branch: binding.DefaultBranch, LocalSHA: localSHA, RemoteSHA: localSHA,
		Forced: request.Force, Message: "GitHub push completed",
	}, nil
}

func (s *GitHubIntegrationService) executeIdempotentSync(
	ctx context.Context,
	userID,
	projectID,
	kind,
	idempotencyKey string,
	payload interface{},
	execute func() (*GitHubSyncResult, error),
) (*GitHubSyncResult, error) {
	idempotencyKey = strings.TrimSpace(idempotencyKey)
	if idempotencyKey == "" || len(idempotencyKey) > 255 {
		return nil, githubError("github_idempotency_key_required", "A valid idempotency key is required", nil)
	}
	encoded, _ := json.Marshal(payload)
	requestHash := githubSHA256(kind + "\n" + string(encoded))
	now := s.now().UTC()
	operation := &model.GitHubSyncOperation{
		ID: utils.GenerateUUID(), UserID: userID, ProjectID: projectID,
		IdempotencyKey: idempotencyKey, Kind: kind, RequestHash: requestHash,
		Status: "running", CreatedAt: now, UpdatedAt: now,
	}
	created, err := s.repo.CreateSyncOperation(ctx, operation)
	if err != nil {
		return nil, err
	}
	if !created {
		existing, err := s.repo.FindSyncOperation(ctx, userID, idempotencyKey)
		if err != nil {
			return nil, err
		}
		if existing.Kind != kind || existing.RequestHash != requestHash {
			return nil, githubError("github_idempotency_conflict", "Idempotency key was already used for another GitHub operation", nil)
		}
		if existing.Status == "succeeded" {
			var result GitHubSyncResult
			if json.Unmarshal([]byte(existing.Result), &result) != nil {
				return nil, githubError("github_idempotency_result_invalid", "Stored GitHub operation result is invalid", nil)
			}
			result.Replayed = true
			return &result, nil
		}
		if existing.Status == "failed" {
			return nil, githubError(existing.ErrorCode, "Previous GitHub operation with this idempotency key failed", nil)
		}
		return nil, githubError("github_operation_in_progress", "GitHub operation is already in progress", nil)
	}
	result, executeErr := execute()
	operation.UpdatedAt = s.now().UTC()
	if executeErr != nil {
		operation.Status = "failed"
		operation.ErrorCode = githubIntegrationErrorCode(executeErr)
		_ = s.repo.UpdateSyncOperation(ctx, operation)
		return nil, executeErr
	}
	resultJSON, _ := json.Marshal(result)
	operation.Status = "succeeded"
	operation.Result = string(resultJSON)
	if err := s.repo.UpdateSyncOperation(ctx, operation); err != nil {
		return nil, err
	}
	return result, nil
}

func (s *GitHubIntegrationService) prepareGitHubRuntime(ctx context.Context, project *model.Project) error {
	if s != nil && s.runtimePreparer != nil {
		return s.runtimePreparer(ctx, project)
	}
	if s.projectService == nil || s.projectService.containerMgr == nil {
		return githubError("github_runtime_unavailable", "Project runtime is not available", nil)
	}
	_, _, err := ensureProjectRuntimeBaseContainer(
		ctx, project, s.projectService.projectRepo, s.projectService.containerMgr,
		s.projectService.containerCfg, s.projectService.getImageForRuntimeProfile,
	)
	return err
}

func (s *GitHubIntegrationService) refreshGitHubProjectFileTree(ctx context.Context, projectID string) {
	if s == nil || s.projectService == nil || s.projectService.containerMgr == nil || s.projectService.projectRepo == nil {
		return
	}
	refreshProjectFileTree(ctx, projectID, s.projectService.containerMgr, s.projectService.projectRepo)
}

func (s *GitHubIntegrationService) requireCleanWorktree(ctx context.Context, projectID string) error {
	status, err := s.gitOutput(ctx, projectID, "", "status", "--porcelain")
	if err != nil {
		return err
	}
	if strings.TrimSpace(status) != "" {
		return githubError("github_dirty_worktree", "GitHub synchronization is blocked by a dirty worktree", nil)
	}
	return nil
}

func (s *GitHubIntegrationService) requireBoundBranch(ctx context.Context, projectID, expected string) error {
	current, err := s.gitOutput(ctx, projectID, "", "branch", "--show-current")
	if err != nil {
		return err
	}
	if current != expected {
		return githubError("github_branch_mismatch", "Current branch does not match the bound GitHub branch", nil)
	}
	return nil
}

func (s *GitHubIntegrationService) gitAheadBehind(
	ctx context.Context,
	projectID string,
	binding *model.GitHubProjectBinding,
) (int, int, error) {
	output, err := s.gitOutput(ctx, projectID, "", "rev-list", "--left-right", "--count",
		"HEAD...refs/remotes/"+binding.RemoteName+"/"+binding.DefaultBranch)
	if err != nil {
		return 0, 0, err
	}
	fields := strings.Fields(output)
	if len(fields) != 2 {
		return 0, 0, githubError("github_git_output_invalid", "Git branch comparison output is invalid", nil)
	}
	localAhead, firstErr := strconv.Atoi(fields[0])
	remoteAhead, secondErr := strconv.Atoi(fields[1])
	if firstErr != nil || secondErr != nil {
		return 0, 0, githubError("github_git_output_invalid", "Git branch comparison output is invalid", nil)
	}
	return localAhead, remoteAhead, nil
}

func (s *GitHubIntegrationService) repositoryCloneURL(repositoryName string) (string, error) {
	base, err := url.Parse(strings.TrimRight(s.config.WebBaseURL, "/"))
	if err != nil || base.Scheme != "https" || base.Host == "" {
		return "", githubError("github_web_base_url_invalid", "GitHub web base URL must use HTTPS", err)
	}
	if !githubRepositoryNamePattern.MatchString(repositoryName) {
		return "", githubError("github_repository_invalid", "GitHub repository must use owner/name", nil)
	}
	base.Path = strings.TrimRight(base.Path, "/") + "/" + repositoryName + ".git"
	base.RawQuery = ""
	base.Fragment = ""
	return base.String(), nil
}

func (s *GitHubIntegrationService) runGit(
	ctx context.Context,
	projectID,
	token string,
	args ...string,
) (*container.ExecResult, error) {
	if s.gitRunner == nil {
		return nil, githubError("github_runtime_unavailable", "GitHub Git runner is not available", nil)
	}
	return s.gitRunner.Run(ctx, projectID, args, token, 600)
}

func (s *GitHubIntegrationService) runGitChecked(
	ctx context.Context,
	projectID,
	token string,
	args ...string,
) (*container.ExecResult, error) {
	result, err := s.runGit(ctx, projectID, token, args...)
	if err != nil {
		return nil, githubError("github_git_failed", "GitHub Git operation failed", err)
	}
	if result == nil || result.ExitCode != 0 {
		return nil, githubError("github_git_failed", "GitHub Git operation failed", nil)
	}
	return result, nil
}

func (s *GitHubIntegrationService) gitOutput(
	ctx context.Context,
	projectID,
	token string,
	args ...string,
) (string, error) {
	result, err := s.runGitChecked(ctx, projectID, token, args...)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(result.Stdout), nil
}

func githubIntegrationErrorCode(err error) string {
	var integrationErr *GitHubIntegrationError
	if errors.As(err, &integrationErr) && integrationErr.Code != "" {
		return integrationErr.Code
	}
	return "github_operation_failed"
}
