package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/container"

	"gorm.io/gorm"
)

type recordedGitHubGitCall struct {
	Args  []string
	Token string
}

type recordingGitHubGitRunner struct {
	calls []recordedGitHubGitCall
}

func testGitHubTokenEncryptionKey() string {
	return strings.Repeat("0", 32)
}

func (r *recordingGitHubGitRunner) Run(
	_ context.Context,
	_ string,
	args []string,
	token string,
	_ int,
) (*container.ExecResult, error) {
	r.calls = append(r.calls, recordedGitHubGitCall{
		Args: append([]string{}, args...), Token: token,
	})
	command := strings.Join(args, " ")
	switch {
	case command == "status --porcelain":
		return &container.ExecResult{ExitCode: 0}, nil
	case command == "rev-parse --verify HEAD":
		return &container.ExecResult{ExitCode: 0, Stdout: "local-sha\n"}, nil
	case command == "branch --show-current":
		return &container.ExecResult{ExitCode: 0, Stdout: "main\n"}, nil
	case strings.HasPrefix(command, "remote get-url"):
		return &container.ExecResult{ExitCode: 2}, nil
	case strings.HasPrefix(command, "rev-parse refs/remotes/"):
		return &container.ExecResult{ExitCode: 0, Stdout: "remote-sha\n"}, nil
	case strings.HasPrefix(command, "rev-list --left-right --count"):
		return &container.ExecResult{ExitCode: 0, Stdout: "1 1\n"}, nil
	case command == "rev-parse HEAD":
		return &container.ExecResult{ExitCode: 0, Stdout: "local-sha\n"}, nil
	default:
		return &container.ExecResult{ExitCode: 0}, nil
	}
}

type memoryGitHubIntegrationRepo struct {
	connection *model.GitHubConnection
	states     map[string]*model.GitHubOAuthState
	bindings   map[string]*model.GitHubProjectBinding
	operations map[string]*model.GitHubSyncOperation
	deliveries map[string]*model.GitHubWebhookDelivery
}

func newMemoryGitHubIntegrationRepo() *memoryGitHubIntegrationRepo {
	return &memoryGitHubIntegrationRepo{
		states: map[string]*model.GitHubOAuthState{}, bindings: map[string]*model.GitHubProjectBinding{},
		operations: map[string]*model.GitHubSyncOperation{}, deliveries: map[string]*model.GitHubWebhookDelivery{},
	}
}

func (r *memoryGitHubIntegrationRepo) UpsertConnection(_ context.Context, v *model.GitHubConnection) error {
	copy := *v
	r.connection = &copy
	return nil
}
func (r *memoryGitHubIntegrationRepo) FindConnectionByUserID(_ context.Context, id string) (*model.GitHubConnection, error) {
	if r.connection == nil || r.connection.UserID != id {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *r.connection
	return &copy, nil
}
func (r *memoryGitHubIntegrationRepo) DeleteConnectionByUserID(_ context.Context, id string) error {
	if r.connection != nil && r.connection.UserID == id {
		r.connection = nil
	}
	return nil
}
func (r *memoryGitHubIntegrationRepo) CreateOAuthState(_ context.Context, v *model.GitHubOAuthState) error {
	copy := *v
	r.states[v.StateHash] = &copy
	return nil
}
func (r *memoryGitHubIntegrationRepo) ConsumeOAuthState(_ context.Context, hash string, now time.Time) (*model.GitHubOAuthState, error) {
	v := r.states[hash]
	if v == nil || v.ConsumedAt != nil || !v.ExpiresAt.After(now) {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *v
	v.ConsumedAt = &now
	copy.ConsumedAt = &now
	return &copy, nil
}
func (r *memoryGitHubIntegrationRepo) UpsertBinding(_ context.Context, v *model.GitHubProjectBinding) error {
	copy := *v
	r.bindings[v.ProjectID] = &copy
	return nil
}
func (r *memoryGitHubIntegrationRepo) FindBindingByProjectID(_ context.Context, id string) (*model.GitHubProjectBinding, error) {
	v := r.bindings[id]
	if v == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *v
	return &copy, nil
}
func (r *memoryGitHubIntegrationRepo) ListBindingsByRepository(_ context.Context, name string) ([]model.GitHubProjectBinding, error) {
	result := []model.GitHubProjectBinding{}
	for _, v := range r.bindings {
		if v.RepositoryName == name {
			result = append(result, *v)
		}
	}
	return result, nil
}
func (r *memoryGitHubIntegrationRepo) CreateSyncOperation(_ context.Context, v *model.GitHubSyncOperation) (bool, error) {
	key := v.UserID + ":" + v.IdempotencyKey
	if r.operations[key] != nil {
		return false, nil
	}
	copy := *v
	r.operations[key] = &copy
	return true, nil
}
func (r *memoryGitHubIntegrationRepo) FindSyncOperation(_ context.Context, id, key string) (*model.GitHubSyncOperation, error) {
	v := r.operations[id+":"+key]
	if v == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *v
	return &copy, nil
}
func (r *memoryGitHubIntegrationRepo) UpdateSyncOperation(_ context.Context, v *model.GitHubSyncOperation) error {
	copy := *v
	r.operations[v.UserID+":"+v.IdempotencyKey] = &copy
	return nil
}
func (r *memoryGitHubIntegrationRepo) CreateWebhookDelivery(_ context.Context, v *model.GitHubWebhookDelivery) (bool, error) {
	if r.deliveries[v.DeliveryID] != nil {
		return false, nil
	}
	copy := *v
	r.deliveries[v.DeliveryID] = &copy
	return true, nil
}

func TestGitHubTokenCipherRoundTripDoesNotStorePlaintext(t *testing.T) {
	cipher, err := newGitHubTokenCipher("0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatalf("create cipher: %v", err)
	}
	ciphertext, nonce, err := cipher.Encrypt("github-access-token")
	if err != nil {
		t.Fatalf("encrypt token: %v", err)
	}
	if strings.Contains(ciphertext, "github-access-token") || nonce == "" {
		t.Fatal("ciphertext must not contain plaintext")
	}
	plaintext, err := cipher.Decrypt(ciphertext, nonce, githubTokenKeyVersion)
	if err != nil || plaintext != "github-access-token" {
		t.Fatalf("decrypt: %q %v", plaintext, err)
	}
}

func TestGitHubOAuthUsesPKCEHashedStateAndEncryptedToken(t *testing.T) {
	var expectedVerifier string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch req.URL.Path {
		case "/login/oauth/access_token":
			var body map[string]string
			_ = json.NewDecoder(req.Body).Decode(&body)
			if body["code_verifier"] != expectedVerifier || body["client_secret"] != "client-secret" {
				t.Errorf("unexpected exchange body")
			}
			_, _ = w.Write([]byte(`{"access_token":"plain-token","token_type":"bearer","scope":"repo,read:user"}`))
		case "/user":
			if req.Header.Get("Authorization") != "Bearer plain-token" {
				t.Errorf("missing bearer token")
			}
			_, _ = w.Write([]byte(`{"id":42,"login":"octocat","name":"Octo Cat","avatar_url":"https://example.test/avatar"}`))
		default:
			http.NotFound(w, req)
		}
	}))
	defer server.Close()
	repo := newMemoryGitHubIntegrationRepo()
	service := NewGitHubIntegrationService(repo, nil, config.GitHubIntegrationConfig{
		OAuthClientID: "client-id", OAuthClientSecret: "client-secret",
		OAuthCallbackURL:   "https://app.example.test/api/github/oauth/callback",
		TokenEncryptionKey: testGitHubTokenEncryptionKey(),
		APIBaseURL:         server.URL, WebBaseURL: server.URL,
	})
	service.httpClient = server.Client()
	service.now = func() time.Time { return time.Date(2026, 8, 28, 0, 0, 0, 0, time.UTC) }
	start, err := service.StartOAuth(context.Background(), "user-1", "/projects/proj-1/github")
	if err != nil {
		t.Fatalf("start OAuth: %v", err)
	}
	authorizationURL, _ := url.Parse(start.AuthorizationURL)
	rawState := authorizationURL.Query().Get("state")
	if rawState == "" || repo.states[rawState] != nil {
		t.Fatal("raw state must not be stored")
	}
	stored := repo.states[githubSHA256(rawState)]
	if stored == nil || stored.CodeVerifier == "" {
		t.Fatal("hashed state and verifier required")
	}
	expectedVerifier = stored.CodeVerifier
	if authorizationURL.Query().Get("code_challenge") != githubPKCEChallenge(expectedVerifier) {
		t.Fatal("PKCE challenge mismatch")
	}
	callback, err := service.CompleteOAuth(context.Background(), "code-1", rawState)
	if err != nil {
		t.Fatalf("complete OAuth: %v", err)
	}
	if !callback.Connected || callback.AccountLogin != "octocat" {
		t.Fatalf("unexpected callback: %#v", callback)
	}
	if repo.connection == nil || strings.Contains(repo.connection.TokenCiphertext, "plain-token") {
		t.Fatal("token must be encrypted")
	}
	if _, err := service.CompleteOAuth(context.Background(), "code-1", rawState); githubIntegrationErrorCode(err) != "github_oauth_state_invalid" {
		t.Fatalf("state replay must fail: %v", err)
	}
}

func TestGitHubDisconnectRevokesTokenBeforeDeletingConnection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodDelete || request.URL.Path != "/applications/client-id/token" {
			http.NotFound(writer, request)
			return
		}
		clientID, clientSecret, ok := request.BasicAuth()
		if !ok || clientID != "client-id" || clientSecret != "client-secret" {
			t.Error("token revocation must use OAuth app basic authentication")
		}
		var body map[string]string
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil || body["access_token"] != "plain-token" {
			t.Error("token revocation request has an invalid body")
		}
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	repo := newMemoryGitHubIntegrationRepo()
	service := NewGitHubIntegrationService(repo, nil, config.GitHubIntegrationConfig{
		OAuthClientID: "client-id", OAuthClientSecret: "client-secret",
		TokenEncryptionKey: testGitHubTokenEncryptionKey(),
		APIBaseURL:         server.URL,
	})
	service.httpClient = server.Client()
	ciphertext, nonce, err := service.tokenCipher.Encrypt("plain-token")
	if err != nil {
		t.Fatalf("encrypt token: %v", err)
	}
	repo.connection = &model.GitHubConnection{
		UserID: "user-1", TokenCiphertext: ciphertext, TokenNonce: nonce,
		TokenKeyVersion: githubTokenKeyVersion,
	}
	if err := service.Disconnect(context.Background(), "user-1"); err != nil {
		t.Fatalf("disconnect: %v", err)
	}
	if repo.connection != nil {
		t.Fatal("local connection must be deleted after remote revocation")
	}
}

func TestGitHubDisconnectKeepsConnectionWhenRevocationFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	repo := newMemoryGitHubIntegrationRepo()
	service := NewGitHubIntegrationService(repo, nil, config.GitHubIntegrationConfig{
		OAuthClientID: "client-id", OAuthClientSecret: "client-secret",
		TokenEncryptionKey: testGitHubTokenEncryptionKey(),
		APIBaseURL:         server.URL,
	})
	service.httpClient = server.Client()
	ciphertext, nonce, err := service.tokenCipher.Encrypt("plain-token")
	if err != nil {
		t.Fatalf("encrypt token: %v", err)
	}
	repo.connection = &model.GitHubConnection{
		UserID: "user-1", TokenCiphertext: ciphertext, TokenNonce: nonce,
		TokenKeyVersion: githubTokenKeyVersion,
	}
	err = service.Disconnect(context.Background(), "user-1")
	if githubIntegrationErrorCode(err) != "github_token_revoke_failed" {
		t.Fatalf("unexpected disconnect error: %v", err)
	}
	if repo.connection == nil {
		t.Fatal("local connection must remain when remote revocation fails")
	}
}

func TestGitHubWebhookVerifiesSignatureAndRejectsReplay(t *testing.T) {
	repo := newMemoryGitHubIntegrationRepo()
	repo.bindings["project-1"] = &model.GitHubProjectBinding{ProjectID: "project-1", RepositoryName: "owner/repo", DefaultBranch: "main"}
	service := NewGitHubIntegrationService(repo, nil, config.GitHubIntegrationConfig{TokenEncryptionKey: testGitHubTokenEncryptionKey(), WebhookSecret: "webhook-secret"})
	service.now = time.Now
	body := []byte(`{"ref":"refs/heads/main","after":"0123456789012345678901234567890123456789","repository":{"full_name":"owner/repo"}}`)
	mac := hmac.New(sha256.New, []byte("webhook-secret"))
	_, _ = mac.Write(body)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	result, err := service.ProcessWebhook(context.Background(), "delivery-1", "push", signature, body)
	if err != nil || result.Status != "recorded" || result.UpdatedBindings != 1 {
		t.Fatalf("webhook failed: %#v %v", result, err)
	}
	replay, err := service.ProcessWebhook(context.Background(), "delivery-1", "push", signature, body)
	if err != nil || !replay.Replayed || replay.Status != "duplicate" {
		t.Fatalf("replay not blocked: %#v %v", replay, err)
	}
	if _, err := service.ProcessWebhook(context.Background(), "delivery-2", "push", "sha256=bad", body); githubIntegrationErrorCode(err) != "github_webhook_signature_invalid" {
		t.Fatalf("invalid signature accepted: %v", err)
	}
}

func TestGitHubIdempotencyRejectsMismatchAndReplaysSuccess(t *testing.T) {
	repo := newMemoryGitHubIntegrationRepo()
	service := NewGitHubIntegrationService(repo, nil, config.GitHubIntegrationConfig{TokenEncryptionKey: testGitHubTokenEncryptionKey()})
	service.now = time.Now
	calls := 0
	execute := func() (*GitHubSyncResult, error) {
		calls++
		return &GitHubSyncResult{Status: "succeeded", Kind: "pull"}, nil
	}
	first, err := service.executeIdempotentSync(context.Background(), "user", "project", "pull", "key-1", map[string]bool{"confirm": true}, execute)
	if err != nil || first.Replayed {
		t.Fatalf("first call failed: %#v %v", first, err)
	}
	replay, err := service.executeIdempotentSync(context.Background(), "user", "project", "pull", "key-1", map[string]bool{"confirm": true}, execute)
	if err != nil || !replay.Replayed || calls != 1 {
		t.Fatalf("result not replayed: %#v calls=%d err=%v", replay, calls, err)
	}
	_, err = service.executeIdempotentSync(context.Background(), "user", "project", "push", "key-1", map[string]bool{"confirm": true}, execute)
	if githubIntegrationErrorCode(err) != "github_idempotency_conflict" {
		t.Fatalf("expected conflict: %v", err)
	}
}

func TestGitHubSyncConfirmationAndRedirectGuards(t *testing.T) {
	service := NewGitHubIntegrationService(newMemoryGitHubIntegrationRepo(), nil, config.GitHubIntegrationConfig{TokenEncryptionKey: testGitHubTokenEncryptionKey()})
	project := &model.Project{ProjectID: "project", UserID: "user"}
	if _, err := service.PullRepository(context.Background(), "user", project, GitHubPullRequest{IdempotencyKey: "key"}); githubIntegrationErrorCode(err) != "github_pull_confirmation_required" {
		t.Fatalf("pull confirmation missing: %v", err)
	}
	if _, err := service.PushRepository(context.Background(), "user", project, GitHubPushRequest{ConfirmPush: true, Force: true, IdempotencyKey: "key"}); githubIntegrationErrorCode(err) != "github_force_push_confirmation_required" {
		t.Fatalf("force confirmation missing: %v", err)
	}
	if _, err := normalizeGitHubReturnPath("//evil.example"); err == nil {
		t.Fatal("external redirect accepted")
	}
	if !errors.Is((&GitHubIntegrationError{Err: gorm.ErrRecordNotFound}), gorm.ErrRecordNotFound) {
		t.Fatal("wrapped error lost")
	}
}

func TestGitHubImportUsesEphemeralTokenAndInstallsWebhook(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodGet && strings.HasSuffix(request.URL.Path, "/hooks"):
			_, _ = writer.Write([]byte(`[]`))
		case request.Method == http.MethodPost && strings.HasSuffix(request.URL.Path, "/hooks"):
			if request.Header.Get("Authorization") != "Bearer runtime-token" {
				t.Error("webhook request must use the runtime OAuth token")
			}
			_, _ = writer.Write([]byte(`{"id":99,"active":true,"config":{"url":"https://app.example.test/api/github/webhook"}}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	repo := newMemoryGitHubIntegrationRepo()
	runner := &recordingGitHubGitRunner{}
	service := NewGitHubIntegrationService(repo, &ProjectService{}, config.GitHubIntegrationConfig{
		TokenEncryptionKey: testGitHubTokenEncryptionKey(),
		APIBaseURL:         server.URL, WebBaseURL: "https://github.com",
		WebhookURL: "https://app.example.test/api/github/webhook", WebhookSecret: "webhook-secret",
	})
	service.httpClient = server.Client()
	service.gitRunner = runner
	service.runtimePreparer = func(context.Context, *model.Project) error { return nil }
	service.now = time.Now

	result, err := service.importRepository(
		context.Background(), "user-1",
		&model.Project{ProjectID: "project-1", UserID: "user-1"},
		GitHubRepositoryRecord{
			ID: 7, FullName: "owner/repo", HTMLURL: "https://github.com/owner/repo",
			DefaultBranch: "main", PermissionPush: true, PermissionAdmin: true,
		},
		"main", "runtime-token",
	)
	if err != nil {
		t.Fatalf("import repository: %v", err)
	}
	if result.RemoteSHA != "remote-sha" || repo.bindings["project-1"].WebhookID != 99 {
		t.Fatalf("unexpected import result or binding: %#v %#v", result, repo.bindings["project-1"])
	}
	authenticatedGitCalls := 0
	for _, call := range runner.calls {
		if strings.Contains(strings.Join(call.Args, " "), "runtime-token") {
			t.Fatal("OAuth token must not appear in git argv")
		}
		if call.Token != "" {
			authenticatedGitCalls++
			if len(call.Args) == 0 || call.Args[0] != "fetch" {
				t.Fatalf("token should only be injected for network git commands: %#v", call)
			}
		}
	}
	if authenticatedGitCalls != 1 {
		t.Fatalf("expected one authenticated git fetch, got %d", authenticatedGitCalls)
	}
}

func TestGitHubForcePushUsesExpectedRemoteSHAWithLease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet || request.URL.Path != "/repos/owner/repo" {
			http.NotFound(writer, request)
			return
		}
		if request.Header.Get("Authorization") != "Bearer runtime-token" {
			t.Error("repository lookup must use the runtime OAuth token")
		}
		_, _ = writer.Write([]byte(`{"id":7,"full_name":"owner/repo","html_url":"https://github.com/owner/repo","default_branch":"main","permissions":{"push":true,"admin":true}}`))
	}))
	defer server.Close()

	repo := newMemoryGitHubIntegrationRepo()
	runner := &recordingGitHubGitRunner{}
	service := NewGitHubIntegrationService(repo, &ProjectService{}, config.GitHubIntegrationConfig{
		TokenEncryptionKey: testGitHubTokenEncryptionKey(),
		APIBaseURL:         server.URL,
	})
	service.httpClient = server.Client()
	service.gitRunner = runner
	service.runtimePreparer = func(context.Context, *model.Project) error { return nil }
	service.now = time.Now
	ciphertext, nonce, err := service.tokenCipher.Encrypt("runtime-token")
	if err != nil {
		t.Fatalf("encrypt token: %v", err)
	}
	repo.connection = &model.GitHubConnection{
		UserID: "user-1", TokenCiphertext: ciphertext, TokenNonce: nonce,
		TokenKeyVersion: githubTokenKeyVersion,
	}
	repo.bindings["project-1"] = &model.GitHubProjectBinding{
		ProjectID: "project-1", UserID: "user-1", RepositoryName: "owner/repo",
		DefaultBranch: "main", RemoteName: "origin", PermissionPush: true,
	}

	result, err := service.PushRepository(
		context.Background(), "user-1",
		&model.Project{ProjectID: "project-1", UserID: "user-1"},
		GitHubPushRequest{
			ConfirmPush: true, Force: true, ConfirmForcePush: true,
			ExpectedRemoteSHA: "remote-sha", IdempotencyKey: "force-push-1",
		},
	)
	if err != nil {
		t.Fatalf("force push: %v", err)
	}
	if !result.Forced || result.RemoteSHA != "local-sha" {
		t.Fatalf("unexpected force push result: %#v", result)
	}
	expectedLease := "--force-with-lease=refs/heads/main:remote-sha"
	foundPush := false
	for _, call := range runner.calls {
		joined := strings.Join(call.Args, " ")
		if strings.Contains(joined, "runtime-token") {
			t.Fatal("OAuth token must not appear in git argv")
		}
		if len(call.Args) > 0 && call.Args[0] == "push" {
			foundPush = true
			if call.Token != "runtime-token" || !strings.Contains(joined, expectedLease) {
				t.Fatalf("force push must use runtime auth and exact lease: %#v", call)
			}
		}
	}
	if !foundPush {
		t.Fatal("expected authenticated force push call")
	}
}
