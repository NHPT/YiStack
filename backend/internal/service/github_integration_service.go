package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/utils"

	"gorm.io/gorm"
)

const (
	githubOAuthStateTTL = 10 * time.Minute
	githubOAuthScope    = "repo read:user"
)

var githubRepositoryNamePattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

type githubHTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type GitHubIntegrationError struct {
	Code    string
	Message string
	Err     error
}

func (e *GitHubIntegrationError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *GitHubIntegrationError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func githubError(code, message string, err error) *GitHubIntegrationError {
	return &GitHubIntegrationError{Code: code, Message: message, Err: err}
}

type GitHubIntegrationService struct {
	repo            GitHubIntegrationRepo
	projectService  *ProjectService
	config          config.GitHubIntegrationConfig
	tokenCipher     *githubTokenCipher
	httpClient      githubHTTPClient
	now             func() time.Time
	gitRunner       githubGitRunner
	runtimePreparer func(context.Context, *model.Project) error
}

type GitHubOAuthStartResult struct {
	AuthorizationURL string `json:"authorization_url"`
	ExpiresAt        string `json:"expires_at"`
}

type GitHubOAuthCallbackResult struct {
	Connected    bool   `json:"connected"`
	AccountLogin string `json:"account_login"`
	ReturnPath   string `json:"return_path"`
}

type GitHubConnectionStatus struct {
	Configured   bool   `json:"configured"`
	Connected    bool   `json:"connected"`
	AccountID    int64  `json:"account_id,omitempty"`
	AccountLogin string `json:"account_login,omitempty"`
	AccountName  string `json:"account_name,omitempty"`
	AvatarURL    string `json:"avatar_url,omitempty"`
	Scopes       string `json:"scopes,omitempty"`
	UpdatedAt    string `json:"updated_at,omitempty"`
}

type GitHubRepositoryRecord struct {
	ID              int64  `json:"id"`
	FullName        string `json:"full_name"`
	HTMLURL         string `json:"html_url"`
	DefaultBranch   string `json:"default_branch"`
	Private         bool   `json:"private"`
	Archived        bool   `json:"archived"`
	PermissionPush  bool   `json:"permission_push"`
	PermissionAdmin bool   `json:"permission_admin"`
}

type githubOAuthTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	Error       string `json:"error"`
}

type githubUserResponse struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

type githubRepositoryAPIResponse struct {
	ID            int64  `json:"id"`
	FullName      string `json:"full_name"`
	HTMLURL       string `json:"html_url"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
	Archived      bool   `json:"archived"`
	Permissions   struct {
		Push  bool `json:"push"`
		Admin bool `json:"admin"`
	} `json:"permissions"`
}

func NewGitHubIntegrationService(
	repo GitHubIntegrationRepo,
	projectService *ProjectService,
	cfg config.GitHubIntegrationConfig,
) *GitHubIntegrationService {
	cipher, _ := newGitHubTokenCipher(cfg.TokenEncryptionKey)
	return &GitHubIntegrationService{
		repo: repo, projectService: projectService, config: cfg,
		tokenCipher: cipher, httpClient: &http.Client{Timeout: 30 * time.Second},
		now:       time.Now,
		gitRunner: newContainerGitHubGitRunner(projectService),
	}
}

func (s *GitHubIntegrationService) GetConnectionStatus(ctx context.Context, userID string) (*GitHubConnectionStatus, error) {
	status := &GitHubConnectionStatus{Configured: s.oauthConfigured()}
	if s == nil || s.repo == nil || strings.TrimSpace(userID) == "" {
		return status, nil
	}
	connection, err := s.repo.FindConnectionByUserID(ctx, userID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return status, nil
	}
	if err != nil {
		return nil, err
	}
	status.Connected = true
	status.AccountID = connection.AccountID
	status.AccountLogin = connection.AccountLogin
	status.AccountName = connection.AccountName
	status.AvatarURL = connection.AvatarURL
	status.Scopes = connection.Scopes
	status.UpdatedAt = connection.UpdatedAt.UTC().Format(time.RFC3339)
	return status, nil
}

func (s *GitHubIntegrationService) StartOAuth(
	ctx context.Context,
	userID,
	returnPath string,
) (*GitHubOAuthStartResult, error) {
	if !s.oauthConfigured() || s.repo == nil || s.tokenCipher == nil {
		return nil, githubError("github_oauth_not_configured", "GitHub OAuth is not configured", nil)
	}
	returnPath, err := normalizeGitHubReturnPath(returnPath)
	if err != nil {
		return nil, err
	}
	state, err := randomGitHubSecret(32)
	if err != nil {
		return nil, err
	}
	verifier, err := randomGitHubSecret(48)
	if err != nil {
		return nil, err
	}
	now := s.now().UTC()
	expiresAt := now.Add(githubOAuthStateTTL)
	if err := s.repo.CreateOAuthState(ctx, &model.GitHubOAuthState{
		StateHash: githubSHA256(state), UserID: userID, CodeVerifier: verifier,
		ReturnPath: returnPath, ExpiresAt: expiresAt, CreatedAt: now,
	}); err != nil {
		return nil, err
	}
	authorizeURL, err := url.Parse(strings.TrimRight(s.config.WebBaseURL, "/") + "/login/oauth/authorize")
	if err != nil {
		return nil, err
	}
	query := authorizeURL.Query()
	query.Set("client_id", strings.TrimSpace(s.config.OAuthClientID))
	query.Set("redirect_uri", strings.TrimSpace(s.config.OAuthCallbackURL))
	query.Set("scope", githubOAuthScope)
	query.Set("state", state)
	query.Set("code_challenge", githubPKCEChallenge(verifier))
	query.Set("code_challenge_method", "S256")
	authorizeURL.RawQuery = query.Encode()
	return &GitHubOAuthStartResult{
		AuthorizationURL: authorizeURL.String(),
		ExpiresAt:        expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *GitHubIntegrationService) CompleteOAuth(
	ctx context.Context,
	code,
	state string,
) (*GitHubOAuthCallbackResult, error) {
	if !s.oauthConfigured() || s.repo == nil || s.tokenCipher == nil {
		return nil, githubError("github_oauth_not_configured", "GitHub OAuth is not configured", nil)
	}
	if strings.TrimSpace(code) == "" || strings.TrimSpace(state) == "" {
		return nil, githubError("github_oauth_callback_invalid", "GitHub OAuth code and state are required", nil)
	}
	now := s.now().UTC()
	oauthState, err := s.repo.ConsumeOAuthState(ctx, githubSHA256(state), now)
	if err != nil {
		return nil, githubError("github_oauth_state_invalid", "GitHub OAuth state is invalid, expired, or already consumed", err)
	}
	token, scopes, err := s.exchangeOAuthCode(ctx, code, oauthState.CodeVerifier)
	if err != nil {
		return nil, err
	}
	user, err := s.fetchGitHubUser(ctx, token)
	if err != nil {
		return nil, err
	}
	ciphertext, nonce, err := s.tokenCipher.Encrypt(token)
	if err != nil {
		return nil, githubError("github_token_encrypt_failed", "GitHub token encryption failed", err)
	}
	if err := s.repo.UpsertConnection(ctx, &model.GitHubConnection{
		ID: utils.GenerateUUID(), UserID: oauthState.UserID,
		AccountID: user.ID, AccountLogin: user.Login, AccountName: user.Name,
		AvatarURL: user.AvatarURL, Scopes: scopes,
		TokenCiphertext: ciphertext, TokenNonce: nonce, TokenKeyVersion: githubTokenKeyVersion,
		CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		return nil, err
	}
	return &GitHubOAuthCallbackResult{
		Connected: true, AccountLogin: user.Login, ReturnPath: oauthState.ReturnPath,
	}, nil
}

func (s *GitHubIntegrationService) Disconnect(ctx context.Context, userID string) error {
	if s == nil || s.repo == nil {
		return githubError("github_service_unavailable", "GitHub integration service is not available", nil)
	}
	token, err := s.accessToken(ctx, userID)
	if err != nil {
		return err
	}
	if err := s.revokeOAuthToken(ctx, token); err != nil {
		return err
	}
	return s.repo.DeleteConnectionByUserID(ctx, userID)
}

func (s *GitHubIntegrationService) revokeOAuthToken(ctx context.Context, token string) error {
	clientID := strings.TrimSpace(s.config.OAuthClientID)
	clientSecret := strings.TrimSpace(s.config.OAuthClientSecret)
	if clientID == "" || clientSecret == "" {
		return githubError("github_oauth_not_configured", "GitHub OAuth is not configured", nil)
	}
	body, err := json.Marshal(map[string]string{"access_token": token})
	if err != nil {
		return githubError("github_token_revoke_failed", "GitHub token revocation failed", err)
	}
	endpoint := strings.TrimRight(s.config.APIBaseURL, "/") +
		"/applications/" + url.PathEscape(clientID) + "/token"
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, bytes.NewReader(body))
	if err != nil {
		return githubError("github_token_revoke_failed", "GitHub token revocation failed", err)
	}
	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return githubError("github_token_revoke_failed", "GitHub token revocation failed", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1024*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return githubError(
			"github_token_revoke_failed",
			fmt.Sprintf("GitHub token revocation returned status %d", resp.StatusCode),
			nil,
		)
	}
	return nil
}

func (s *GitHubIntegrationService) ListRepositories(ctx context.Context, userID string) ([]GitHubRepositoryRecord, error) {
	token, err := s.accessToken(ctx, userID)
	if err != nil {
		return nil, err
	}
	endpoint := strings.TrimRight(s.config.APIBaseURL, "/") + "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member"
	var response []githubRepositoryAPIResponse
	if err := s.githubAPIJSON(ctx, http.MethodGet, endpoint, token, nil, &response); err != nil {
		return nil, err
	}
	result := make([]GitHubRepositoryRecord, 0, len(response))
	for _, repository := range response {
		if repository.Archived || !githubRepositoryNamePattern.MatchString(repository.FullName) {
			continue
		}
		result = append(result, githubRepositoryRecord(repository))
	}
	return result, nil
}

func (s *GitHubIntegrationService) getRepository(
	ctx context.Context,
	userID,
	repositoryName string,
) (GitHubRepositoryRecord, string, error) {
	repositoryName = strings.TrimSpace(repositoryName)
	if !githubRepositoryNamePattern.MatchString(repositoryName) {
		return GitHubRepositoryRecord{}, "", githubError("github_repository_invalid", "GitHub repository must use owner/name", nil)
	}
	token, err := s.accessToken(ctx, userID)
	if err != nil {
		return GitHubRepositoryRecord{}, "", err
	}
	endpoint := strings.TrimRight(s.config.APIBaseURL, "/") + "/repos/" + repositoryName
	var response githubRepositoryAPIResponse
	if err := s.githubAPIJSON(ctx, http.MethodGet, endpoint, token, nil, &response); err != nil {
		return GitHubRepositoryRecord{}, "", err
	}
	if response.Archived {
		return GitHubRepositoryRecord{}, "", githubError("github_repository_archived", "Archived GitHub repositories cannot be synchronized", nil)
	}
	return githubRepositoryRecord(response), token, nil
}

func githubRepositoryRecord(response githubRepositoryAPIResponse) GitHubRepositoryRecord {
	return GitHubRepositoryRecord{
		ID: response.ID, FullName: response.FullName, HTMLURL: response.HTMLURL,
		DefaultBranch: response.DefaultBranch, Private: response.Private,
		Archived: response.Archived, PermissionPush: response.Permissions.Push,
		PermissionAdmin: response.Permissions.Admin,
	}
}

type githubRepositoryHook struct {
	ID     int64 `json:"id"`
	Active bool  `json:"active"`
	Config struct {
		URL string `json:"url"`
	} `json:"config"`
}

func (s *GitHubIntegrationService) ensureRepositoryWebhook(ctx context.Context, repositoryName, token string) (int64, error) {
	webhookURL := strings.TrimSpace(s.config.WebhookURL)
	if webhookURL == "" || strings.TrimSpace(s.config.WebhookSecret) == "" {
		return 0, githubError("github_webhook_not_configured", "GitHub webhook URL and secret are not configured", nil)
	}
	parsed, err := url.Parse(webhookURL)
	loopback := parsed != nil && (parsed.Hostname() == "localhost" || parsed.Hostname() == "127.0.0.1")
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && !(loopback && parsed.Scheme == "http")) {
		return 0, githubError("github_webhook_url_invalid", "GitHub webhook URL must use HTTPS", err)
	}
	endpoint := strings.TrimRight(s.config.APIBaseURL, "/") + "/repos/" + repositoryName + "/hooks"
	var hooks []githubRepositoryHook
	if err := s.githubAPIJSON(ctx, http.MethodGet, endpoint+"?per_page=100", token, nil, &hooks); err != nil {
		return 0, err
	}
	for _, hook := range hooks {
		if hook.Active && strings.TrimSpace(hook.Config.URL) == webhookURL {
			return hook.ID, nil
		}
	}
	body, _ := json.Marshal(map[string]interface{}{
		"name": "web", "active": true, "events": []string{"push"},
		"config": map[string]string{
			"url": webhookURL, "content_type": "json",
			"secret": s.config.WebhookSecret, "insecure_ssl": "0",
		},
	})
	var created githubRepositoryHook
	if err := s.githubAPIJSON(ctx, http.MethodPost, endpoint, token, body, &created); err != nil {
		return 0, err
	}
	if created.ID == 0 {
		return 0, githubError("github_webhook_create_failed", "GitHub webhook creation returned no hook ID", nil)
	}
	return created.ID, nil
}

func (s *GitHubIntegrationService) accessToken(ctx context.Context, userID string) (string, error) {
	if s == nil || s.repo == nil || s.tokenCipher == nil {
		return "", githubError("github_oauth_not_configured", "GitHub OAuth is not configured", nil)
	}
	connection, err := s.repo.FindConnectionByUserID(ctx, userID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", githubError("github_not_connected", "GitHub account is not connected", err)
	}
	if err != nil {
		return "", err
	}
	token, err := s.tokenCipher.Decrypt(connection.TokenCiphertext, connection.TokenNonce, connection.TokenKeyVersion)
	if err != nil {
		return "", githubError("github_token_decrypt_failed", "GitHub connection must be reauthorized", err)
	}
	return token, nil
}

func (s *GitHubIntegrationService) exchangeOAuthCode(ctx context.Context, code, verifier string) (string, string, error) {
	body, _ := json.Marshal(map[string]string{
		"client_id": s.config.OAuthClientID, "client_secret": s.config.OAuthClientSecret,
		"code": code, "redirect_uri": s.config.OAuthCallbackURL, "code_verifier": verifier,
	})
	endpoint := strings.TrimRight(s.config.WebBaseURL, "/") + "/login/oauth/access_token"
	var response githubOAuthTokenResponse
	if err := s.githubAPIJSON(ctx, http.MethodPost, endpoint, "", body, &response); err != nil {
		return "", "", err
	}
	if strings.TrimSpace(response.AccessToken) == "" || response.Error != "" {
		return "", "", githubError("github_oauth_exchange_failed", "GitHub OAuth token exchange failed", nil)
	}
	return response.AccessToken, response.Scope, nil
}

func (s *GitHubIntegrationService) fetchGitHubUser(ctx context.Context, token string) (githubUserResponse, error) {
	var user githubUserResponse
	endpoint := strings.TrimRight(s.config.APIBaseURL, "/") + "/user"
	if err := s.githubAPIJSON(ctx, http.MethodGet, endpoint, token, nil, &user); err != nil {
		return githubUserResponse{}, err
	}
	if user.ID == 0 || strings.TrimSpace(user.Login) == "" {
		return githubUserResponse{}, githubError("github_identity_invalid", "GitHub user identity is invalid", nil)
	}
	return user, nil
}

func (s *GitHubIntegrationService) githubAPIJSON(
	ctx context.Context,
	method,
	endpoint,
	token string,
	body []byte,
	target interface{},
) error {
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return githubError("github_request_failed", "GitHub request failed", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return githubError("github_response_invalid", "GitHub response could not be read", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return githubError("github_request_rejected", fmt.Sprintf("GitHub request returned status %d", resp.StatusCode), nil)
	}
	if target != nil && len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, target); err != nil {
			return githubError("github_response_invalid", "GitHub response was invalid", err)
		}
	}
	return nil
}

func (s *GitHubIntegrationService) oauthConfigured() bool {
	return s != nil &&
		strings.TrimSpace(s.config.OAuthClientID) != "" &&
		strings.TrimSpace(s.config.OAuthClientSecret) != "" &&
		strings.TrimSpace(s.config.OAuthCallbackURL) != "" &&
		s.tokenCipher != nil
}

func normalizeGitHubReturnPath(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "/projects", nil
	}
	if len(value) > 1000 || !strings.HasPrefix(value, "/") ||
		strings.HasPrefix(value, "//") || strings.ContainsAny(value, "\\\r\n") {
		return "", githubError("github_return_path_invalid", "GitHub OAuth return path must be a local path", nil)
	}
	return value, nil
}
