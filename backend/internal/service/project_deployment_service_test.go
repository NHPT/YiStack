package service

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"yistack/config"
	"yistack/internal/model"

	"gorm.io/gorm"
)

type memoryDeploymentRepo struct {
	binding    *model.ProjectDeploymentBinding
	releases   map[string]*model.ProjectDeploymentRelease
	domains    map[string]*model.ProjectDeploymentDomain
	operations map[string]*model.ProjectDeploymentOperation
}

func newMemoryDeploymentRepo() *memoryDeploymentRepo {
	return &memoryDeploymentRepo{releases: map[string]*model.ProjectDeploymentRelease{}, domains: map[string]*model.ProjectDeploymentDomain{}, operations: map[string]*model.ProjectDeploymentOperation{}}
}
func (r *memoryDeploymentRepo) UpsertBinding(_ context.Context, v *model.ProjectDeploymentBinding) error {
	copy := *v
	r.binding = &copy
	return nil
}
func (r *memoryDeploymentRepo) FindBindingByProjectID(_ context.Context, id string) (*model.ProjectDeploymentBinding, error) {
	if r.binding == nil || r.binding.ProjectID != id {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *r.binding
	return &copy, nil
}
func (r *memoryDeploymentRepo) CreateRelease(_ context.Context, v *model.ProjectDeploymentRelease) error {
	copy := *v
	r.releases[v.ID] = &copy
	return nil
}
func (r *memoryDeploymentRepo) UpdateRelease(_ context.Context, v *model.ProjectDeploymentRelease) error {
	copy := *v
	r.releases[v.ID] = &copy
	return nil
}
func (r *memoryDeploymentRepo) FindReleaseByID(_ context.Context, id string) (*model.ProjectDeploymentRelease, error) {
	v := r.releases[id]
	if v == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *v
	return &copy, nil
}
func (r *memoryDeploymentRepo) ListReleases(_ context.Context, projectID string, _ int) ([]model.ProjectDeploymentRelease, error) {
	result := []model.ProjectDeploymentRelease{}
	for _, v := range r.releases {
		if v.ProjectID == projectID {
			result = append(result, *v)
		}
	}
	return result, nil
}
func (r *memoryDeploymentRepo) FindLatestReadyProductionRelease(_ context.Context, projectID string) (*model.ProjectDeploymentRelease, error) {
	var latest *model.ProjectDeploymentRelease
	for _, v := range r.releases {
		if v.ProjectID == projectID && v.Target == "production" && v.Status == "ready" && (latest == nil || v.CreatedAt.After(latest.CreatedAt)) {
			copy := *v
			latest = &copy
		}
	}
	if latest == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return latest, nil
}
func (r *memoryDeploymentRepo) UpsertDomain(_ context.Context, v *model.ProjectDeploymentDomain) error {
	copy := *v
	r.domains[v.ProjectID+":"+v.Domain] = &copy
	return nil
}
func (r *memoryDeploymentRepo) FindDomain(_ context.Context, projectID, domain string) (*model.ProjectDeploymentDomain, error) {
	v := r.domains[projectID+":"+domain]
	if v == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *v
	return &copy, nil
}
func (r *memoryDeploymentRepo) ListDomains(_ context.Context, projectID string) ([]model.ProjectDeploymentDomain, error) {
	result := []model.ProjectDeploymentDomain{}
	for _, v := range r.domains {
		if v.ProjectID == projectID {
			result = append(result, *v)
		}
	}
	return result, nil
}
func (r *memoryDeploymentRepo) DeleteDomain(_ context.Context, projectID, domain string) error {
	delete(r.domains, projectID+":"+domain)
	return nil
}
func (r *memoryDeploymentRepo) CreateOperation(_ context.Context, v *model.ProjectDeploymentOperation) (bool, error) {
	key := v.UserID + ":" + v.IdempotencyKey
	if r.operations[key] != nil {
		return false, nil
	}
	copy := *v
	r.operations[key] = &copy
	return true, nil
}
func (r *memoryDeploymentRepo) FindOperation(_ context.Context, userID, key string) (*model.ProjectDeploymentOperation, error) {
	v := r.operations[userID+":"+key]
	if v == nil {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *v
	return &copy, nil
}
func (r *memoryDeploymentRepo) UpdateOperation(_ context.Context, v *model.ProjectDeploymentOperation) error {
	copy := *v
	r.operations[v.UserID+":"+v.IdempotencyKey] = &copy
	return nil
}

type fakeDeploymentProvider struct {
	createCalls   int
	environment   map[string]string
	uploaded      []vercelFileReference
	promoted      string
	domainRemoved string
	remote        vercelDeployment
	events        []vercelEvent
}

func (p *fakeDeploymentProvider) configured() bool { return true }
func (p *fakeDeploymentProvider) ensureProject(context.Context, string) (*vercelProject, error) {
	return &vercelProject{ID: "prj_1", Name: "project"}, nil
}
func (p *fakeDeploymentProvider) upsertEnvironment(_ context.Context, _ string, _ string, v map[string]string) error {
	p.environment = v
	return nil
}
func (p *fakeDeploymentProvider) uploadFile(_ context.Context, sha string, content []byte) error {
	p.uploaded = append(p.uploaded, vercelFileReference{SHA: sha, Size: int64(len(content))})
	return nil
}
func (p *fakeDeploymentProvider) createDeployment(_ context.Context, _ string, _ string, _ string, _ string, _ string, files []vercelFileReference) (*vercelDeployment, error) {
	p.createCalls++
	p.uploaded = append(p.uploaded, files...)
	value := p.remote
	return &value, nil
}
func (p *fakeDeploymentProvider) getDeployment(context.Context, string) (*vercelDeployment, error) {
	value := p.remote
	return &value, nil
}
func (p *fakeDeploymentProvider) currentProductionDeployment(context.Context, string) (string, error) {
	return p.remote.ID, nil
}
func (p *fakeDeploymentProvider) getDeploymentEvents(context.Context, string) ([]vercelEvent, error) {
	return p.events, nil
}
func (p *fakeDeploymentProvider) promote(_ context.Context, _ string, id string) error {
	p.promoted = id
	return nil
}
func (p *fakeDeploymentProvider) addDomain(_ context.Context, _ string, domain string) (*vercelDomain, error) {
	return &vercelDomain{Name: domain, Verified: false, Verification: []vercelVerification{{Type: "TXT", Domain: "_vercel." + domain, Value: "challenge"}}}, nil
}
func (p *fakeDeploymentProvider) verifyDomain(_ context.Context, _ string, domain string) (*vercelDomain, error) {
	return &vercelDomain{Name: domain, Verified: true}, nil
}
func (p *fakeDeploymentProvider) removeDomain(_ context.Context, _ string, domain string) error {
	p.domainRemoved = domain
	return nil
}

func newTestDeploymentService(repo *memoryDeploymentRepo, provider *fakeDeploymentProvider) *ProjectDeploymentService {
	cipher, _ := newDeploymentSecretCipher("0123456789abcdef0123456789abcdef")
	service := &ProjectDeploymentService{repo: repo, provider: provider, secretCipher: cipher, config: config.DeploymentConfig{VercelAccessToken: "provider-token"}, now: func() time.Time { return time.Date(2026, 8, 29, 0, 0, 0, 0, time.UTC) }}
	service.artifactPreparer = func(context.Context, *model.Project) (*deploymentArtifact, error) {
		return &deploymentArtifact{SourceCommitSHA: strings.Repeat("a", 40), SHA256: strings.Repeat("b", 64), Size: 5, Files: []deploymentArtifactFile{{Path: "index.html", Content: []byte("hello"), SHA1: strings.Repeat("c", 40), Size: 5}}}, nil
	}
	return service
}

func TestProjectDeploymentDeployEncryptsSecretsAndReplaysIdempotently(t *testing.T) {
	repo := newMemoryDeploymentRepo()
	provider := &fakeDeploymentProvider{remote: vercelDeployment{ID: "dpl_1", URL: "demo.vercel.app", ReadyState: "READY"}}
	service := newTestDeploymentService(repo, provider)
	project := &model.Project{ProjectID: "project-1", UserID: "user-1"}
	request := DeployProjectRequest{Target: "production", ConfirmDeploy: true, IdempotencyKey: "deploy-1", Environment: []DeploymentEnvironmentVariable{{Key: "API_SECRET", Value: "super-secret"}}}
	first, err := service.Deploy(context.Background(), "user-1", project, request)
	if err != nil {
		t.Fatalf("deploy: %v", err)
	}
	second, err := service.Deploy(context.Background(), "user-1", project, request)
	if err != nil || !second.Replayed || provider.createCalls != 1 {
		t.Fatalf("idempotent replay failed: %#v calls=%d err=%v", second, provider.createCalls, err)
	}
	if first.Release.Status != "ready" || provider.environment["API_SECRET"] != "super-secret" {
		t.Fatalf("unexpected release: %#v", first.Release)
	}
	stored := repo.releases[first.Release.ID]
	if stored == nil || stored.SecretCiphertext == "" {
		t.Fatal("encrypted deployment secrets were not persisted")
	}
	encoded, _ := json.Marshal(first.Release)
	if strings.Contains(string(encoded), "super-secret") || strings.Contains(string(encoded), stored.SecretCiphertext) {
		t.Fatal("release API must not expose encrypted or plaintext secrets")
	}
	plaintext, err := service.secretCipher.Decrypt(stored.SecretCiphertext, stored.SecretNonce, stored.SecretKeyVersion)
	if err != nil || !strings.Contains(string(plaintext), "super-secret") {
		t.Fatalf("encrypted secret evidence invalid: %s %v", plaintext, err)
	}
}

func TestProjectDeploymentLogsRollbackAndDomainLifecycle(t *testing.T) {
	repo := newMemoryDeploymentRepo()
	provider := &fakeDeploymentProvider{remote: vercelDeployment{ID: "dpl_current", URL: "current.vercel.app", ReadyState: "READY"}}
	service := newTestDeploymentService(repo, provider)
	project := &model.Project{ProjectID: "project-1", UserID: "user-1"}
	deployed, err := service.Deploy(context.Background(), "user-1", project, DeployProjectRequest{Target: "production", ConfirmDeploy: true, IdempotencyKey: "deploy", Environment: []DeploymentEnvironmentVariable{{Key: "TOKEN", Value: "log-secret"}}})
	if err != nil {
		t.Fatal(err)
	}
	event := vercelEvent{Type: "command", Created: json.Number("123")}
	event.Payload.Text = "build log-secret provider-token"
	event.Payload.Info.Step = "build"
	provider.events = []vercelEvent{event}
	logs, err := service.ReleaseLogs(context.Background(), "user-1", "project-1", deployed.Release.ID)
	if err != nil || strings.Contains(logs[0].Message, "log-secret") || strings.Contains(logs[0].Message, "provider-token") {
		t.Fatalf("logs were not redacted: %#v %v", logs, err)
	}
	provider.remote.ErrorMessage = "build failed with log-secret"
	refreshed, err := service.RefreshRelease(context.Background(), "user-1", "project-1", deployed.Release.ID)
	if err != nil || strings.Contains(refreshed.ErrorMessage, "log-secret") || !strings.Contains(refreshed.ErrorMessage, "[REDACTED]") {
		t.Fatalf("provider error was not redacted: %#v %v", refreshed, err)
	}
	provider.remote.ErrorMessage = ""

	target := *deployed.Release
	target.ID = "release-old"
	target.ProviderDeploymentID = "dpl_old"
	target.CreatedAt = target.CreatedAt.Add(-time.Hour)
	repo.releases[target.ID] = &target
	storedRelease := repo.releases[deployed.Release.ID]
	storedRelease.SecretCiphertext = "invalid"
	if _, err := service.ReleaseLogs(context.Background(), "user-1", "project-1", deployed.Release.ID); deploymentErrorCode(err) != "deployment_secret_decrypt_failed" {
		t.Fatalf("logs must fail closed when secret decryption fails: %v", err)
	}
	storedRelease.SecretCiphertext = repo.releases[target.ID].SecretCiphertext
	_, err = service.Rollback(context.Background(), "user-1", "project-1", RollbackDeploymentRequest{TargetReleaseID: target.ID, ExpectedCurrentDeploymentID: "stale", ConfirmRollback: true, IdempotencyKey: "rollback-stale"})
	if deploymentErrorCode(err) != "deployment_rollback_stale" {
		t.Fatalf("stale rollback accepted: %v", err)
	}
	result, err := service.Rollback(context.Background(), "user-1", "project-1", RollbackDeploymentRequest{TargetReleaseID: target.ID, ExpectedCurrentDeploymentID: "dpl_current", ConfirmRollback: true, IdempotencyKey: "rollback-ok"})
	if err != nil || provider.promoted != "dpl_old" || result.Release.Kind != "rollback" {
		t.Fatalf("rollback failed: %#v %v", result, err)
	}
	added, err := service.AddDomain(context.Background(), "user-1", "project-1", DeploymentDomainRequest{Domain: "app.example.com", Confirm: true, IdempotencyKey: "domain-add"})
	if err != nil || added.Domain.Verified {
		t.Fatalf("add domain: %#v %v", added, err)
	}
	verified, err := service.VerifyDomain(context.Background(), "user-1", "project-1", DeploymentDomainRequest{Domain: "app.example.com", Confirm: true, IdempotencyKey: "domain-verify"})
	if err != nil || !verified.Domain.Verified {
		t.Fatalf("verify domain: %#v %v", verified, err)
	}
	removed, err := service.RemoveDomain(context.Background(), "user-1", "project-1", DeploymentDomainRequest{Domain: "app.example.com", Confirm: true, IdempotencyKey: "domain-remove"})
	if err != nil || removed.RemovedDomain != "app.example.com" || provider.domainRemoved != "app.example.com" {
		t.Fatalf("remove domain: %#v %v", removed, err)
	}
	if _, err := repo.FindDomain(context.Background(), "project-1", "app.example.com"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatal("domain must be removed locally")
	}
}

func TestVercelAdapterUploadsImmutableArtifactWithoutTokenInURL(t *testing.T) {
	var projectLookups, projectCreates, environmentWrites, fileUploads, deployments, productionLookups int
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if strings.Contains(request.URL.String(), "provider-token") {
			t.Fatal("provider token leaked into URL")
		}
		if request.Header.Get("Authorization") != "Bearer provider-token" {
			t.Errorf("missing provider authorization for %s", request.URL.Path)
		}
		if request.URL.Query().Get("teamId") != "team-1" {
			t.Errorf("missing team scope for %s", request.URL.Path)
		}
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/v9/projects/yistack-project":
			projectLookups++
			writer.WriteHeader(http.StatusNotFound)
		case request.Method == http.MethodGet && request.URL.Path == "/v9/projects/prj_1":
			productionLookups++
			_, _ = writer.Write([]byte(`{"id":"prj_1","latestDeployments":[{"id":"dpl_current","target":"production","readyState":"READY"}]}`))
		case request.Method == http.MethodPost && request.URL.Path == "/v11/projects":
			projectCreates++
			_, _ = writer.Write([]byte(`{"id":"prj_1","name":"yistack-project"}`))
		case request.Method == http.MethodPost && request.URL.Path == "/v10/projects/prj_1/env":
			environmentWrites++
			body, _ := io.ReadAll(request.Body)
			if !strings.Contains(string(body), `"type":"sensitive"`) || !strings.Contains(string(body), "runtime-secret") {
				t.Error("sensitive environment payload missing")
			}
			_, _ = writer.Write([]byte(`[]`))
		case request.Method == http.MethodPost && request.URL.Path == "/v2/files":
			fileUploads++
			if request.Header.Get("x-Vercel-Digest") != "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" {
				t.Error("file digest mismatch")
			}
			writer.WriteHeader(http.StatusOK)
		case request.Method == http.MethodPost && request.URL.Path == "/v13/deployments":
			deployments++
			body, _ := io.ReadAll(request.Body)
			if strings.Contains(string(body), `"target":"preview"`) || strings.Contains(string(body), "runtime-secret") {
				t.Error("preview target or secret leaked into deployment artifact request")
			}
			_, _ = writer.Write([]byte(`{"id":"dpl_1","url":"demo.vercel.app","readyState":"QUEUED"}`))
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()
	adapter := newVercelDeploymentAdapter(config.DeploymentConfig{VercelAccessToken: "provider-token", VercelTeamID: "team-1", VercelAPIBaseURL: server.URL})
	adapter.client = server.Client()
	project, err := adapter.ensureProject(context.Background(), "yistack-project")
	if err != nil {
		t.Fatal(err)
	}
	if err := adapter.upsertEnvironment(context.Background(), project.ID, "preview", map[string]string{"API_TOKEN": "runtime-secret"}); err != nil {
		t.Fatal(err)
	}
	if err := adapter.uploadFile(context.Background(), "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d", []byte("hello")); err != nil {
		t.Fatal(err)
	}
	currentID, err := adapter.currentProductionDeployment(context.Background(), project.ID)
	if err != nil || currentID != "dpl_current" {
		t.Fatalf("current production lookup failed: %q %v", currentID, err)
	}
	if _, err := adapter.createDeployment(context.Background(), "yistack-project", project.ID, "preview", strings.Repeat("a", 40), strings.Repeat("b", 64), []vercelFileReference{{File: "index.html", SHA: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d", Size: 5}}); err != nil {
		t.Fatal(err)
	}
	if projectLookups != 1 || projectCreates != 1 || environmentWrites != 1 || fileUploads != 1 || deployments != 1 || productionLookups != 1 {
		t.Fatalf("unexpected adapter calls: %d %d %d %d %d %d", projectLookups, projectCreates, environmentWrites, fileUploads, deployments, productionLookups)
	}
}

func TestProjectDeploymentValidationFailureBlocksProviderMutation(t *testing.T) {
	repo := newMemoryDeploymentRepo()
	provider := &fakeDeploymentProvider{remote: vercelDeployment{ID: "dpl_1", ReadyState: "READY"}}
	service := newTestDeploymentService(repo, provider)
	service.artifactPreparer = func(context.Context, *model.Project) (*deploymentArtifact, error) {
		return nil, deploymentError("deployment_validation_failed", "Project Validation Gate must pass before deployment", errors.New("build failed"))
	}
	_, err := service.Deploy(context.Background(), "user-1", &model.Project{ProjectID: "project-1", UserID: "user-1"}, DeployProjectRequest{Target: "production", ConfirmDeploy: true, IdempotencyKey: "blocked"})
	if deploymentErrorCode(err) != "deployment_validation_failed" {
		t.Fatalf("unexpected validation error: %v", err)
	}
	if provider.createCalls != 0 || len(repo.releases) != 0 {
		t.Fatalf("validation failure must block provider and release persistence")
	}
}
