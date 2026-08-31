package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"yistack/config"
	"yistack/internal/model"
	"yistack/pkg/utils"
)

var deploymentEnvironmentKeyPattern = regexp.MustCompile(`^[A-Z_][A-Z0-9_]{0,127}$`)
var deploymentDomainPattern = regexp.MustCompile(`(?i)^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`)
var deploymentSensitiveLogPattern = regexp.MustCompile(`(?i)(authorization:\s*bearer|token|secret|password|api[_-]?key)(\s*[=:]\s*)[^\s]+`)

type DeploymentError struct {
	Code    string
	Message string
	Err     error
}

func (e *DeploymentError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}
func (e *DeploymentError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}
func deploymentError(code, message string, err error) *DeploymentError {
	return &DeploymentError{Code: code, Message: message, Err: err}
}
func deploymentErrorCode(err error) string {
	var target *DeploymentError
	if errors.As(err, &target) && target.Code != "" {
		return target.Code
	}
	return "deployment_operation_failed"
}

type deploymentProvider interface {
	configured() bool
	ensureProject(context.Context, string) (*vercelProject, error)
	upsertEnvironment(context.Context, string, string, map[string]string) error
	uploadFile(context.Context, string, []byte) error
	createDeployment(context.Context, string, string, string, string, string, []vercelFileReference) (*vercelDeployment, error)
	getDeployment(context.Context, string) (*vercelDeployment, error)
	getDeploymentEvents(context.Context, string) ([]vercelEvent, error)
	currentProductionDeployment(context.Context, string) (string, error)
	promote(context.Context, string, string) error
	addDomain(context.Context, string, string) (*vercelDomain, error)
	verifyDomain(context.Context, string, string) (*vercelDomain, error)
	removeDomain(context.Context, string, string) error
}

type ProjectDeploymentService struct {
	repo             ProjectDeploymentRepo
	projectService   *ProjectService
	config           config.DeploymentConfig
	provider         deploymentProvider
	secretCipher     *deploymentSecretCipher
	validator        generatedProjectValidator
	artifactPreparer func(context.Context, *model.Project) (*deploymentArtifact, error)
	now              func() time.Time
}

func NewProjectDeploymentService(repo ProjectDeploymentRepo, projects *ProjectService, cfg config.DeploymentConfig) *ProjectDeploymentService {
	cipher, _ := newDeploymentSecretCipher(cfg.SecretEncryptionKey)
	var validator generatedProjectValidator
	if projects != nil && projects.containerMgr != nil {
		validator = NewContainerProjectValidationRunner(projects.containerMgr)
	}
	return &ProjectDeploymentService{repo: repo, projectService: projects, config: cfg, provider: newVercelDeploymentAdapter(cfg), secretCipher: cipher, validator: validator, now: time.Now}
}

type DeploymentProviderStatus struct {
	Provider       string `json:"provider"`
	Configured     bool   `json:"configured"`
	TeamConfigured bool   `json:"team_configured"`
}
type DeploymentEnvironmentVariable struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}
type DeployProjectRequest struct {
	Target         string                          `json:"target"`
	ConfirmDeploy  bool                            `json:"confirm_deploy"`
	Environment    []DeploymentEnvironmentVariable `json:"environment"`
	IdempotencyKey string                          `json:"idempotency_key"`
}
type RollbackDeploymentRequest struct {
	TargetReleaseID             string `json:"target_release_id"`
	ExpectedCurrentDeploymentID string `json:"expected_current_deployment_id"`
	ConfirmRollback             bool   `json:"confirm_rollback"`
	IdempotencyKey              string `json:"idempotency_key"`
}
type DeploymentDomainRequest struct {
	Domain         string `json:"domain"`
	Confirm        bool   `json:"confirm"`
	IdempotencyKey string `json:"idempotency_key"`
}
type DeploymentMutationResult struct {
	Release       *model.ProjectDeploymentRelease `json:"release,omitempty"`
	Domain        *model.ProjectDeploymentDomain  `json:"domain,omitempty"`
	RemovedDomain string                          `json:"removed_domain,omitempty"`
	Replayed      bool                            `json:"replayed"`
}
type DeploymentLogEntry struct {
	Type      string `json:"type"`
	CreatedAt int64  `json:"created_at"`
	Step      string `json:"step,omitempty"`
	Status    string `json:"status,omitempty"`
	Message   string `json:"message"`
}

func (s *ProjectDeploymentService) ProviderStatus() DeploymentProviderStatus {
	configured := s != nil && s.provider != nil && s.provider.configured() && s.secretCipher != nil
	return DeploymentProviderStatus{Provider: "vercel", Configured: configured, TeamConfigured: s != nil && strings.TrimSpace(s.config.VercelTeamID) != ""}
}

func (s *ProjectDeploymentService) ListReleases(ctx context.Context, userID, projectID string) ([]model.ProjectDeploymentRelease, error) {
	if err := s.requireAvailable(); err != nil {
		return nil, err
	}
	return s.repo.ListReleases(ctx, projectID, 50)
}

func (s *ProjectDeploymentService) Deploy(ctx context.Context, userID string, project *model.Project, request DeployProjectRequest) (*DeploymentMutationResult, error) {
	if project == nil || project.UserID != userID {
		return nil, deploymentError("deployment_project_forbidden", "Project access denied", nil)
	}
	if err := s.requireConfigured(); err != nil {
		return nil, err
	}
	if !request.ConfirmDeploy {
		return nil, deploymentError("deployment_confirmation_required", "Deployment requires explicit confirmation", nil)
	}
	target := strings.ToLower(strings.TrimSpace(request.Target))
	if target != "preview" && target != "production" {
		return nil, deploymentError("deployment_target_invalid", "Deployment target must be preview or production", nil)
	}
	environment, environmentKeys, err := normalizeDeploymentEnvironment(request.Environment)
	if err != nil {
		return nil, err
	}
	payload := map[string]interface{}{"target": target, "environment": environment, "confirm_deploy": true}
	raw, replayed, err := s.executeOperation(ctx, userID, project.ProjectID, "deploy", request.IdempotencyKey, payload, func() (interface{}, error) {
		return s.deploy(ctx, userID, project, target, environment, environmentKeys)
	})
	if err != nil {
		return nil, err
	}
	var release model.ProjectDeploymentRelease
	if err := json.Unmarshal(raw, &release); err != nil {
		return nil, deploymentError("deployment_idempotency_result_invalid", "Stored deployment result is invalid", err)
	}
	return &DeploymentMutationResult{Release: &release, Replayed: replayed}, nil
}

func (s *ProjectDeploymentService) deploy(ctx context.Context, userID string, project *model.Project, target string, environment map[string]string, environmentKeys []string) (*model.ProjectDeploymentRelease, error) {
	var artifact *deploymentArtifact
	var err error
	if s.artifactPreparer != nil {
		artifact, err = s.artifactPreparer(ctx, project)
	} else {
		artifact, err = s.prepareArtifact(ctx, project)
	}
	if err != nil {
		return nil, err
	}
	name := deploymentProviderProjectName(project.ProjectID)
	providerProject, err := s.provider.ensureProject(ctx, name)
	if err != nil {
		return nil, deploymentError("deployment_provider_project_failed", "Vercel project could not be prepared", err)
	}
	if err := s.provider.upsertEnvironment(ctx, providerProject.ID, target, environment); err != nil {
		return nil, deploymentError("deployment_secret_injection_failed", "Deployment environment could not be injected", err)
	}
	references := make([]vercelFileReference, 0, len(artifact.Files))
	for _, file := range artifact.Files {
		if err := s.provider.uploadFile(ctx, file.SHA1, file.Content); err != nil {
			return nil, deploymentError("deployment_artifact_upload_failed", "Deployment artifact upload failed", err)
		}
		references = append(references, vercelFileReference{File: file.Path, SHA: file.SHA1, Size: file.Size})
	}
	previousID := ""
	if target == "production" {
		currentID, currentErr := s.provider.currentProductionDeployment(ctx, providerProject.ID)
		if currentErr != nil {
			return nil, deploymentError("deployment_status_failed", "Current production deployment could not be resolved", currentErr)
		}
		previousID = currentID
	}
	remote, err := s.provider.createDeployment(ctx, name, providerProject.ID, target, artifact.SourceCommitSHA, artifact.SHA256, references)
	if err != nil {
		return nil, deploymentError("deployment_create_failed", "Vercel deployment could not be created", err)
	}
	now := s.now().UTC()
	encrypted, nonce, err := s.encryptEnvironment(environment)
	if err != nil {
		return nil, err
	}
	keysJSON, _ := json.Marshal(environmentKeys)
	release := &model.ProjectDeploymentRelease{
		ID: utils.GenerateUUID(), ProjectID: project.ProjectID, UserID: userID, Provider: "vercel",
		ProviderDeploymentID: remote.ID, ProviderProjectID: providerProject.ID, Kind: "deploy", Target: target,
		Status: normalizeVercelDeploymentStatus(remote), URL: normalizeVercelDeploymentURL(remote.URL), SourceCommitSHA: artifact.SourceCommitSHA,
		ArtifactSHA256: artifact.SHA256, ArtifactFileCount: len(artifact.Files), ArtifactSize: artifact.Size,
		PreviousProviderDeploymentID: previousID, EnvironmentKeys: string(keysJSON), SecretCiphertext: encrypted,
		SecretNonce: nonce, SecretKeyVersion: deploymentSecretKeyVersion, ErrorCode: strings.TrimSpace(remote.ErrorCode),
		ErrorMessage: redactDeploymentLog(remote.ErrorMessage, environment, s.config.VercelAccessToken), CreatedAt: now, UpdatedAt: now,
	}
	if release.Status == "ready" {
		release.ReadyAt = &now
	}
	if err := s.repo.CreateRelease(ctx, release); err != nil {
		return nil, err
	}
	if err := s.repo.UpsertBinding(ctx, &model.ProjectDeploymentBinding{
		ID: utils.GenerateUUID(), ProjectID: project.ProjectID, UserID: userID, Provider: "vercel",
		ProviderProjectID: providerProject.ID, ProviderProjectName: name, TeamID: strings.TrimSpace(s.config.VercelTeamID), CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		return nil, err
	}
	return release, nil
}

func (s *ProjectDeploymentService) RefreshRelease(ctx context.Context, userID, projectID, releaseID string) (*model.ProjectDeploymentRelease, error) {
	if err := s.requireConfigured(); err != nil {
		return nil, err
	}
	release, err := s.ownedRelease(ctx, userID, projectID, releaseID)
	if err != nil {
		return nil, err
	}
	remote, err := s.provider.getDeployment(ctx, release.ProviderDeploymentID)
	if err != nil {
		return nil, deploymentError("deployment_status_failed", "Deployment status could not be refreshed", err)
	}
	secrets, decryptErr := s.decryptEnvironment(release)
	if decryptErr != nil {
		return nil, decryptErr
	}
	now := s.now().UTC()
	release.Status = normalizeVercelDeploymentStatus(remote)
	release.URL = normalizeVercelDeploymentURL(remote.URL)
	release.ErrorCode = strings.TrimSpace(remote.ErrorCode)
	release.ErrorMessage = redactDeploymentLog(remote.ErrorMessage, secrets, s.config.VercelAccessToken)
	release.UpdatedAt = now
	if release.Status == "ready" && release.ReadyAt == nil {
		release.ReadyAt = &now
	}
	if err := s.repo.UpdateRelease(ctx, release); err != nil {
		return nil, err
	}
	return release, nil
}

func (s *ProjectDeploymentService) ReleaseLogs(ctx context.Context, userID, projectID, releaseID string) ([]DeploymentLogEntry, error) {
	if err := s.requireConfigured(); err != nil {
		return nil, err
	}
	release, err := s.ownedRelease(ctx, userID, projectID, releaseID)
	if err != nil {
		return nil, err
	}
	events, err := s.provider.getDeploymentEvents(ctx, release.ProviderDeploymentID)
	if err != nil {
		return nil, deploymentError("deployment_logs_failed", "Deployment logs could not be loaded", err)
	}
	secrets, decryptErr := s.decryptEnvironment(release)
	if decryptErr != nil {
		return nil, decryptErr
	}
	entries := make([]DeploymentLogEntry, 0, len(events))
	for _, event := range events {
		created, _ := strconv.ParseInt(event.Created.String(), 10, 64)
		message := redactDeploymentLog(event.Payload.Text, secrets, s.config.VercelAccessToken)
		if strings.TrimSpace(message) == "" {
			message = strings.TrimSpace(event.Payload.Info.Step)
		}
		entries = append(entries, DeploymentLogEntry{Type: event.Type, CreatedAt: created, Step: event.Payload.Info.Step, Status: event.Payload.Info.ReadyState, Message: message})
	}
	return entries, nil
}

func (s *ProjectDeploymentService) Rollback(ctx context.Context, userID, projectID string, request RollbackDeploymentRequest) (*DeploymentMutationResult, error) {
	if err := s.requireConfigured(); err != nil {
		return nil, err
	}
	if !request.ConfirmRollback {
		return nil, deploymentError("deployment_rollback_confirmation_required", "Rollback requires explicit confirmation", nil)
	}
	payload := request
	raw, replayed, err := s.executeOperation(ctx, userID, projectID, "rollback", request.IdempotencyKey, payload, func() (interface{}, error) {
		target, err := s.ownedRelease(ctx, userID, projectID, request.TargetReleaseID)
		if err != nil {
			return nil, err
		}
		if target.Status != "ready" {
			return nil, deploymentError("deployment_rollback_target_invalid", "Rollback target must be a ready deployment", nil)
		}
		binding, err := s.ownedBinding(ctx, userID, projectID)
		if err != nil {
			return nil, err
		}
		currentID, err := s.provider.currentProductionDeployment(ctx, binding.ProviderProjectID)
		if err != nil {
			return nil, deploymentError("deployment_status_failed", "Current production deployment could not be resolved", err)
		}
		if strings.TrimSpace(request.ExpectedCurrentDeploymentID) == "" || request.ExpectedCurrentDeploymentID != currentID {
			return nil, deploymentError("deployment_rollback_stale", "Current production deployment changed; rollback is blocked", nil)
		}
		if err := s.provider.promote(ctx, binding.ProviderProjectID, target.ProviderDeploymentID); err != nil {
			return nil, deploymentError("deployment_rollback_failed", "Vercel rollback promotion failed", err)
		}
		now := s.now().UTC()
		readyAt := now
		rollback := *target
		rollback.ID = utils.GenerateUUID()
		rollback.Kind = "rollback"
		rollback.Target = "production"
		rollback.PreviousProviderDeploymentID = currentID
		rollback.CreatedAt = now
		rollback.UpdatedAt = now
		rollback.ReadyAt = &readyAt
		if err := s.repo.CreateRelease(ctx, &rollback); err != nil {
			return nil, err
		}
		return &rollback, nil
	})
	if err != nil {
		return nil, err
	}
	var release model.ProjectDeploymentRelease
	if err := json.Unmarshal(raw, &release); err != nil {
		return nil, deploymentError("deployment_idempotency_result_invalid", "Stored rollback result is invalid", err)
	}
	return &DeploymentMutationResult{Release: &release, Replayed: replayed}, nil
}

func (s *ProjectDeploymentService) ListDomains(ctx context.Context, userID, projectID string) ([]model.ProjectDeploymentDomain, error) {
	if err := s.requireAvailable(); err != nil {
		return nil, err
	}
	return s.repo.ListDomains(ctx, projectID)
}
func (s *ProjectDeploymentService) AddDomain(ctx context.Context, userID, projectID string, request DeploymentDomainRequest) (*DeploymentMutationResult, error) {
	return s.mutateDomain(ctx, userID, projectID, "domain_add", request)
}
func (s *ProjectDeploymentService) VerifyDomain(ctx context.Context, userID, projectID string, request DeploymentDomainRequest) (*DeploymentMutationResult, error) {
	return s.mutateDomain(ctx, userID, projectID, "domain_verify", request)
}
func (s *ProjectDeploymentService) RemoveDomain(ctx context.Context, userID, projectID string, request DeploymentDomainRequest) (*DeploymentMutationResult, error) {
	return s.mutateDomain(ctx, userID, projectID, "domain_remove", request)
}

func (s *ProjectDeploymentService) mutateDomain(ctx context.Context, userID, projectID, kind string, request DeploymentDomainRequest) (*DeploymentMutationResult, error) {
	if err := s.requireConfigured(); err != nil {
		return nil, err
	}
	if !request.Confirm {
		return nil, deploymentError("deployment_domain_confirmation_required", "Domain mutation requires explicit confirmation", nil)
	}
	domain, err := normalizeDeploymentDomain(request.Domain)
	if err != nil {
		return nil, err
	}
	raw, replayed, err := s.executeOperation(ctx, userID, projectID, kind, request.IdempotencyKey, map[string]interface{}{"domain": domain, "confirm": true}, func() (interface{}, error) {
		binding, err := s.ownedBinding(ctx, userID, projectID)
		if err != nil {
			return nil, err
		}
		switch kind {
		case "domain_add":
			if _, err := s.repo.FindLatestReadyProductionRelease(ctx, projectID); err != nil {
				return nil, deploymentError("deployment_production_release_required", "A ready production deployment is required before adding a domain", err)
			}
			remote, err := s.provider.addDomain(ctx, binding.ProviderProjectID, domain)
			if err != nil {
				return nil, deploymentError("deployment_domain_add_failed", "Vercel domain could not be added", err)
			}
			record := deploymentDomainRecord(userID, projectID, remote, s.now().UTC())
			if err := s.repo.UpsertDomain(ctx, record); err != nil {
				return nil, err
			}
			return record, nil
		case "domain_verify":
			if _, err := s.repo.FindDomain(ctx, projectID, domain); err != nil {
				return nil, deploymentError("deployment_domain_not_found", "Deployment domain was not found", err)
			}
			remote, err := s.provider.verifyDomain(ctx, binding.ProviderProjectID, domain)
			if err != nil {
				return nil, deploymentError("deployment_domain_verify_failed", "Vercel domain verification failed", err)
			}
			record := deploymentDomainRecord(userID, projectID, remote, s.now().UTC())
			if err := s.repo.UpsertDomain(ctx, record); err != nil {
				return nil, err
			}
			return record, nil
		case "domain_remove":
			if err := s.provider.removeDomain(ctx, binding.ProviderProjectID, domain); err != nil {
				return nil, deploymentError("deployment_domain_remove_failed", "Vercel domain could not be removed", err)
			}
			if err := s.repo.DeleteDomain(ctx, projectID, domain); err != nil {
				return nil, err
			}
			return map[string]string{"removed_domain": domain}, nil
		}
		return nil, deploymentError("deployment_domain_operation_invalid", "Deployment domain operation is invalid", nil)
	})
	if err != nil {
		return nil, err
	}
	result := &DeploymentMutationResult{Replayed: replayed}
	if kind == "domain_remove" {
		var removed map[string]string
		if json.Unmarshal(raw, &removed) != nil {
			return nil, deploymentError("deployment_idempotency_result_invalid", "Stored domain result is invalid", nil)
		}
		result.RemovedDomain = removed["removed_domain"]
		return result, nil
	}
	var record model.ProjectDeploymentDomain
	if json.Unmarshal(raw, &record) != nil {
		return nil, deploymentError("deployment_idempotency_result_invalid", "Stored domain result is invalid", nil)
	}
	result.Domain = &record
	return result, nil
}

func (s *ProjectDeploymentService) executeOperation(ctx context.Context, userID, projectID, kind, key string, payload interface{}, execute func() (interface{}, error)) (json.RawMessage, bool, error) {
	key = strings.TrimSpace(key)
	if key == "" || len(key) > 255 {
		return nil, false, deploymentError("deployment_idempotency_key_required", "A valid idempotency key is required", nil)
	}
	encoded, _ := json.Marshal(payload)
	sum := sha256.Sum256(append([]byte(kind+"\n"), encoded...))
	requestHash := hex.EncodeToString(sum[:])
	now := s.now().UTC()
	operation := &model.ProjectDeploymentOperation{ID: utils.GenerateUUID(), UserID: userID, ProjectID: projectID, IdempotencyKey: key, Kind: kind, RequestHash: requestHash, Status: "running", CreatedAt: now, UpdatedAt: now}
	created, err := s.repo.CreateOperation(ctx, operation)
	if err != nil {
		return nil, false, err
	}
	if !created {
		existing, err := s.repo.FindOperation(ctx, userID, key)
		if err != nil {
			return nil, false, err
		}
		if existing.Kind != kind || existing.RequestHash != requestHash {
			return nil, false, deploymentError("deployment_idempotency_conflict", "Idempotency key was already used for another deployment operation", nil)
		}
		if existing.Status == "succeeded" {
			return json.RawMessage(existing.Result), true, nil
		}
		if existing.Status == "failed" {
			return nil, true, deploymentError(existing.ErrorCode, "Previous deployment operation with this idempotency key failed", nil)
		}
		return nil, true, deploymentError("deployment_operation_in_progress", "Deployment operation is already in progress", nil)
	}
	value, executeErr := execute()
	operation.UpdatedAt = s.now().UTC()
	if executeErr != nil {
		operation.Status = "failed"
		operation.ErrorCode = deploymentErrorCode(executeErr)
		_ = s.repo.UpdateOperation(ctx, operation)
		return nil, false, executeErr
	}
	result, marshalErr := json.Marshal(value)
	if marshalErr != nil {
		return nil, false, marshalErr
	}
	operation.Status = "succeeded"
	operation.Result = string(result)
	if err := s.repo.UpdateOperation(ctx, operation); err != nil {
		return nil, false, err
	}
	return result, false, nil
}

func (s *ProjectDeploymentService) requireAvailable() error {
	if s == nil || s.repo == nil {
		return deploymentError("deployment_service_unavailable", "Deployment service is not available", nil)
	}
	return nil
}
func (s *ProjectDeploymentService) requireConfigured() error {
	if err := s.requireAvailable(); err != nil {
		return err
	}
	if s.provider == nil || !s.provider.configured() || s.secretCipher == nil || (s.validator == nil && s.artifactPreparer == nil) {
		return deploymentError("deployment_provider_not_configured", "Vercel deployment is not configured", nil)
	}
	return nil
}
func (s *ProjectDeploymentService) ownedBinding(ctx context.Context, userID, projectID string) (*model.ProjectDeploymentBinding, error) {
	binding, err := s.repo.FindBindingByProjectID(ctx, projectID)
	if err != nil {
		return nil, deploymentError("deployment_binding_not_found", "Project is not bound to a deployment provider", err)
	}
	if binding.UserID != userID {
		return nil, deploymentError("deployment_project_forbidden", "Deployment binding belongs to another user", nil)
	}
	return binding, nil
}
func (s *ProjectDeploymentService) ownedRelease(ctx context.Context, userID, projectID, releaseID string) (*model.ProjectDeploymentRelease, error) {
	release, err := s.repo.FindReleaseByID(ctx, strings.TrimSpace(releaseID))
	if err != nil {
		return nil, deploymentError("deployment_release_not_found", "Deployment release was not found", err)
	}
	if release.UserID != userID || release.ProjectID != projectID {
		return nil, deploymentError("deployment_project_forbidden", "Deployment release belongs to another project", nil)
	}
	return release, nil
}

func normalizeDeploymentEnvironment(items []DeploymentEnvironmentVariable) (map[string]string, []string, error) {
	if len(items) > 50 {
		return nil, nil, deploymentError("deployment_environment_invalid", "Deployment environment has too many variables", nil)
	}
	values := map[string]string{}
	for _, item := range items {
		key := strings.TrimSpace(item.Key)
		if !deploymentEnvironmentKeyPattern.MatchString(key) || len(item.Value) > 32768 {
			return nil, nil, deploymentError("deployment_environment_invalid", "Deployment environment contains an invalid key or value", nil)
		}
		if _, exists := values[key]; exists {
			return nil, nil, deploymentError("deployment_environment_invalid", "Deployment environment contains duplicate keys", nil)
		}
		values[key] = item.Value
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return values, keys, nil
}
func (s *ProjectDeploymentService) encryptEnvironment(values map[string]string) (string, string, error) {
	encoded, _ := json.Marshal(values)
	ciphertext, nonce, err := s.secretCipher.Encrypt(encoded)
	if err != nil {
		return "", "", deploymentError("deployment_secret_encrypt_failed", "Deployment secrets could not be encrypted", err)
	}
	return ciphertext, nonce, nil
}
func (s *ProjectDeploymentService) decryptEnvironment(release *model.ProjectDeploymentRelease) (map[string]string, error) {
	result := map[string]string{}
	if release == nil || release.SecretCiphertext == "" {
		return result, nil
	}
	plaintext, err := s.secretCipher.Decrypt(release.SecretCiphertext, release.SecretNonce, release.SecretKeyVersion)
	if err != nil {
		return nil, deploymentError("deployment_secret_decrypt_failed", "Deployment logs are unavailable because release secrets could not be decrypted", err)
	}
	if err := json.Unmarshal(plaintext, &result); err != nil {
		return nil, deploymentError("deployment_secret_decrypt_failed", "Deployment logs are unavailable because release secrets could not be decoded", err)
	}
	return result, nil
}
func redactDeploymentLog(value string, secrets map[string]string, providerToken string) string {
	result := value
	for _, secret := range secrets {
		if secret != "" {
			result = strings.ReplaceAll(result, secret, "[REDACTED]")
		}
	}
	if providerToken != "" {
		result = strings.ReplaceAll(result, providerToken, "[REDACTED]")
	}
	result = deploymentSensitiveLogPattern.ReplaceAllString(result, "$1$2[REDACTED]")
	if len(result) > 8000 {
		result = result[:8000]
	}
	return result
}
func normalizeVercelDeploymentStatus(remote *vercelDeployment) string {
	if remote == nil {
		return "error"
	}
	value := strings.ToLower(strings.TrimSpace(remote.ReadyState))
	if value == "" {
		value = strings.ToLower(strings.TrimSpace(remote.Status))
	}
	switch value {
	case "queued":
		return "queued"
	case "initializing":
		return "initializing"
	case "building":
		return "building"
	case "ready":
		return "ready"
	case "canceled", "cancelled":
		return "canceled"
	default:
		return "error"
	}
}
func normalizeVercelDeploymentURL(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "https://") {
		return value
	}
	return "https://" + strings.TrimPrefix(value, "http://")
}
func normalizeDeploymentDomain(value string) (string, error) {
	domain := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(value), "."))
	if !deploymentDomainPattern.MatchString(domain) {
		return "", deploymentError("deployment_domain_invalid", "Custom domain is invalid", nil)
	}
	return domain, nil
}
func deploymentDomainRecord(userID, projectID string, remote *vercelDomain, now time.Time) *model.ProjectDeploymentDomain {
	record := &model.ProjectDeploymentDomain{ID: utils.GenerateUUID(), ProjectID: projectID, UserID: userID, Provider: "vercel", Domain: strings.ToLower(strings.TrimSpace(remote.Name)), Status: "pending", Verified: remote.Verified, CreatedAt: now, UpdatedAt: now}
	if remote.Verified {
		record.Status = "verified"
	}
	if len(remote.Verification) > 0 {
		record.VerificationType = remote.Verification[0].Type
		record.VerificationDomain = remote.Verification[0].Domain
		record.VerificationValue = remote.Verification[0].Value
	}
	return record
}
