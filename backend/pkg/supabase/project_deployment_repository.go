package supabase

import (
	"context"
	"errors"
	"strings"

	"yistack/internal/model"

	"gorm.io/gorm"
)

type ProjectDeploymentRepository struct{ supabase *Client }

func (r *SupabaseRepository) ProjectDeploymentRepository() *ProjectDeploymentRepository {
	return &ProjectDeploymentRepository{supabase: r.client}
}

func (r *ProjectDeploymentRepository) UpsertBinding(ctx context.Context, binding *model.ProjectDeploymentBinding) error {
	data := deploymentBindingData(binding)
	existing, err := r.FindBindingByProjectID(ctx, binding.ProjectID)
	if err == nil {
		binding.ID = existing.ID
		_, err = r.supabase.AdminTable("project_deployment_bindings").Eq("project_id", binding.ProjectID).Update(data)
		return err
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	result, err := r.supabase.AdminTable("project_deployment_bindings").Insert(data)
	if item, ok := firstDataMap(result.Data); ok {
		binding.ID = stringValue(item["id"])
	}
	return err
}

func (r *ProjectDeploymentRepository) FindBindingByProjectID(_ context.Context, projectID string) (*model.ProjectDeploymentBinding, error) {
	result, err := r.supabase.AdminTable("project_deployment_bindings").Eq("project_id", projectID).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapDeploymentBinding(item), nil
}

func (r *ProjectDeploymentRepository) CreateRelease(_ context.Context, release *model.ProjectDeploymentRelease) error {
	result, err := r.supabase.AdminTable("project_deployment_releases").Insert(deploymentReleaseData(release))
	if item, ok := firstDataMap(result.Data); ok {
		release.ID = stringValue(item["id"])
	}
	return err
}

func (r *ProjectDeploymentRepository) UpdateRelease(_ context.Context, release *model.ProjectDeploymentRelease) error {
	_, err := r.supabase.AdminTable("project_deployment_releases").Eq("id", release.ID).Update(map[string]interface{}{
		"status": release.Status, "url": release.URL, "error_code": release.ErrorCode,
		"error_message": release.ErrorMessage, "ready_at": release.ReadyAt, "updated_at": release.UpdatedAt,
	})
	return err
}

func (r *ProjectDeploymentRepository) FindReleaseByID(_ context.Context, releaseID string) (*model.ProjectDeploymentRelease, error) {
	result, err := r.supabase.AdminTable("project_deployment_releases").Eq("id", releaseID).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapDeploymentRelease(item), nil
}

func (r *ProjectDeploymentRepository) ListReleases(_ context.Context, projectID string, limit int) ([]model.ProjectDeploymentRelease, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	result, err := r.supabase.AdminTable("project_deployment_releases").Eq("project_id", projectID).Order("created_at", false).Limit(limit).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.ProjectDeploymentRelease, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapDeploymentRelease(item))
		}
	}
	return items, nil
}

func (r *ProjectDeploymentRepository) FindLatestReadyProductionRelease(ctx context.Context, projectID string) (*model.ProjectDeploymentRelease, error) {
	items, err := r.ListReleases(ctx, projectID, 100)
	if err != nil {
		return nil, err
	}
	for index := range items {
		if items[index].Target == "production" && items[index].Status == "ready" {
			return &items[index], nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *ProjectDeploymentRepository) UpsertDomain(ctx context.Context, domain *model.ProjectDeploymentDomain) error {
	data := deploymentDomainData(domain)
	existing, err := r.FindDomain(ctx, domain.ProjectID, domain.Domain)
	if err == nil {
		domain.ID = existing.ID
		_, err = r.supabase.AdminTable("project_deployment_domains").Eq("project_id", domain.ProjectID).Eq("domain", domain.Domain).Update(data)
		return err
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	result, err := r.supabase.AdminTable("project_deployment_domains").Insert(data)
	if item, ok := firstDataMap(result.Data); ok {
		domain.ID = stringValue(item["id"])
	}
	return err
}

func (r *ProjectDeploymentRepository) FindDomain(_ context.Context, projectID, domain string) (*model.ProjectDeploymentDomain, error) {
	result, err := r.supabase.AdminTable("project_deployment_domains").Eq("project_id", projectID).Eq("domain", domain).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapDeploymentDomain(item), nil
}

func (r *ProjectDeploymentRepository) ListDomains(_ context.Context, projectID string) ([]model.ProjectDeploymentDomain, error) {
	result, err := r.supabase.AdminTable("project_deployment_domains").Eq("project_id", projectID).Order("domain", true).SelectQuery()
	if err != nil {
		return nil, err
	}
	items := make([]model.ProjectDeploymentDomain, 0, len(result.Data))
	for _, raw := range result.Data {
		if item, ok := raw.(map[string]interface{}); ok {
			items = append(items, *mapDeploymentDomain(item))
		}
	}
	return items, nil
}

func (r *ProjectDeploymentRepository) DeleteDomain(_ context.Context, projectID, domain string) error {
	_, err := r.supabase.AdminTable("project_deployment_domains").Eq("project_id", projectID).Eq("domain", domain).Delete()
	return err
}

func (r *ProjectDeploymentRepository) CreateOperation(_ context.Context, operation *model.ProjectDeploymentOperation) (bool, error) {
	_, err := r.supabase.AdminTable("project_deployment_operations").Insert(map[string]interface{}{
		"id": operation.ID, "user_id": operation.UserID, "project_id": operation.ProjectID,
		"idempotency_key": operation.IdempotencyKey, "kind": operation.Kind, "request_hash": operation.RequestHash,
		"status": operation.Status, "result": operation.Result, "error_code": operation.ErrorCode,
		"created_at": operation.CreatedAt, "updated_at": operation.UpdatedAt,
	})
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		return false, nil
	}
	return err == nil, err
}

func (r *ProjectDeploymentRepository) FindOperation(_ context.Context, userID, key string) (*model.ProjectDeploymentOperation, error) {
	result, err := r.supabase.AdminTable("project_deployment_operations").Eq("user_id", userID).Eq("idempotency_key", key).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapDeploymentOperation(item), nil
}

func (r *ProjectDeploymentRepository) UpdateOperation(_ context.Context, operation *model.ProjectDeploymentOperation) error {
	_, err := r.supabase.AdminTable("project_deployment_operations").Eq("id", operation.ID).Update(map[string]interface{}{
		"status": operation.Status, "result": operation.Result, "error_code": operation.ErrorCode, "updated_at": operation.UpdatedAt,
	})
	return err
}

func deploymentBindingData(v *model.ProjectDeploymentBinding) map[string]interface{} {
	return map[string]interface{}{
		"project_id": v.ProjectID, "user_id": v.UserID, "provider": v.Provider, "provider_project_id": v.ProviderProjectID,
		"provider_project_name": v.ProviderProjectName, "team_id": v.TeamID, "updated_at": v.UpdatedAt,
	}
}
func deploymentReleaseData(v *model.ProjectDeploymentRelease) map[string]interface{} {
	return map[string]interface{}{
		"id": v.ID, "project_id": v.ProjectID, "user_id": v.UserID, "provider": v.Provider,
		"provider_deployment_id": v.ProviderDeploymentID, "provider_project_id": v.ProviderProjectID, "kind": v.Kind,
		"target": v.Target, "status": v.Status, "url": v.URL, "source_commit_sha": v.SourceCommitSHA,
		"artifact_sha256": v.ArtifactSHA256, "artifact_file_count": v.ArtifactFileCount, "artifact_size": v.ArtifactSize,
		"previous_provider_deployment_id": v.PreviousProviderDeploymentID, "environment_keys": v.EnvironmentKeys,
		"secret_ciphertext": v.SecretCiphertext, "secret_nonce": v.SecretNonce, "secret_key_version": v.SecretKeyVersion,
		"error_code": v.ErrorCode, "error_message": v.ErrorMessage, "ready_at": v.ReadyAt, "created_at": v.CreatedAt, "updated_at": v.UpdatedAt,
	}
}
func deploymentDomainData(v *model.ProjectDeploymentDomain) map[string]interface{} {
	return map[string]interface{}{
		"project_id": v.ProjectID, "user_id": v.UserID, "provider": v.Provider, "domain": v.Domain, "status": v.Status,
		"verified": v.Verified, "verification_type": v.VerificationType, "verification_domain": v.VerificationDomain,
		"verification_value": v.VerificationValue, "updated_at": v.UpdatedAt,
	}
}
func mapDeploymentBinding(m map[string]interface{}) *model.ProjectDeploymentBinding {
	return &model.ProjectDeploymentBinding{
		ID: stringValue(m["id"]), ProjectID: stringValue(m["project_id"]), UserID: stringValue(m["user_id"]), Provider: stringValue(m["provider"]),
		ProviderProjectID: stringValue(m["provider_project_id"]), ProviderProjectName: stringValue(m["provider_project_name"]), TeamID: stringValue(m["team_id"]),
		CreatedAt: timeValue(m["created_at"]), UpdatedAt: timeValue(m["updated_at"]),
	}
}
func mapDeploymentRelease(m map[string]interface{}) *model.ProjectDeploymentRelease {
	release := &model.ProjectDeploymentRelease{
		ID: stringValue(m["id"]), ProjectID: stringValue(m["project_id"]), UserID: stringValue(m["user_id"]), Provider: stringValue(m["provider"]),
		ProviderDeploymentID: stringValue(m["provider_deployment_id"]), ProviderProjectID: stringValue(m["provider_project_id"]), Kind: stringValue(m["kind"]),
		Target: stringValue(m["target"]), Status: stringValue(m["status"]), URL: stringValue(m["url"]), SourceCommitSHA: stringValue(m["source_commit_sha"]),
		ArtifactSHA256: stringValue(m["artifact_sha256"]), ArtifactFileCount: int(getSupabaseInt64(m["artifact_file_count"])), ArtifactSize: getSupabaseInt64(m["artifact_size"]),
		PreviousProviderDeploymentID: stringValue(m["previous_provider_deployment_id"]), EnvironmentKeys: jsonStringValue(m["environment_keys"]),
		SecretCiphertext: stringValue(m["secret_ciphertext"]), SecretNonce: stringValue(m["secret_nonce"]), SecretKeyVersion: stringValue(m["secret_key_version"]),
		ErrorCode: stringValue(m["error_code"]), ErrorMessage: stringValue(m["error_message"]), CreatedAt: timeValue(m["created_at"]), UpdatedAt: timeValue(m["updated_at"]),
	}
	if readyAt := timeValue(m["ready_at"]); !readyAt.IsZero() {
		release.ReadyAt = &readyAt
	}
	return release
}
func mapDeploymentDomain(m map[string]interface{}) *model.ProjectDeploymentDomain {
	return &model.ProjectDeploymentDomain{
		ID: stringValue(m["id"]), ProjectID: stringValue(m["project_id"]), UserID: stringValue(m["user_id"]), Provider: stringValue(m["provider"]),
		Domain: stringValue(m["domain"]), Status: stringValue(m["status"]), Verified: boolValue(m["verified"]), VerificationType: stringValue(m["verification_type"]),
		VerificationDomain: stringValue(m["verification_domain"]), VerificationValue: stringValue(m["verification_value"]), CreatedAt: timeValue(m["created_at"]), UpdatedAt: timeValue(m["updated_at"]),
	}
}
func mapDeploymentOperation(m map[string]interface{}) *model.ProjectDeploymentOperation {
	return &model.ProjectDeploymentOperation{
		ID: stringValue(m["id"]), UserID: stringValue(m["user_id"]), ProjectID: stringValue(m["project_id"]), IdempotencyKey: stringValue(m["idempotency_key"]),
		Kind: stringValue(m["kind"]), RequestHash: stringValue(m["request_hash"]), Status: stringValue(m["status"]), Result: jsonStringValue(m["result"]),
		ErrorCode: stringValue(m["error_code"]), CreatedAt: timeValue(m["created_at"]), UpdatedAt: timeValue(m["updated_at"]),
	}
}
