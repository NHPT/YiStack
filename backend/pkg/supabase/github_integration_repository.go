package supabase

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"yistack/internal/model"

	"gorm.io/gorm"
)

type GitHubIntegrationRepository struct {
	supabase *Client
}

func (r *SupabaseRepository) GitHubIntegrationRepository() *GitHubIntegrationRepository {
	return &GitHubIntegrationRepository{supabase: r.client}
}

func (r *GitHubIntegrationRepository) UpsertConnection(_ context.Context, connection *model.GitHubConnection) error {
	data := githubConnectionData(connection)
	existing, err := r.FindConnectionByUserID(context.Background(), connection.UserID)
	if err == nil && existing != nil {
		connection.ID = existing.ID
		_, err = r.supabase.AdminTable("github_connections").Eq("user_id", connection.UserID).Update(data)
		return err
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	result, err := r.supabase.AdminTable("github_connections").Insert(data)
	if err != nil {
		return err
	}
	if item, ok := firstDataMap(result.Data); ok {
		connection.ID, _ = item["id"].(string)
	}
	return nil
}

func (r *GitHubIntegrationRepository) FindConnectionByUserID(_ context.Context, userID string) (*model.GitHubConnection, error) {
	result, err := r.supabase.AdminTable("github_connections").Eq("user_id", userID).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapGitHubConnection(item), nil
}

func (r *GitHubIntegrationRepository) DeleteConnectionByUserID(_ context.Context, userID string) error {
	_, err := r.supabase.AdminTable("github_connections").Eq("user_id", userID).Delete()
	return err
}

func (r *GitHubIntegrationRepository) CreateOAuthState(_ context.Context, state *model.GitHubOAuthState) error {
	_, err := r.supabase.AdminTable("github_oauth_states").Insert(map[string]interface{}{
		"state_hash": state.StateHash, "user_id": state.UserID,
		"code_verifier": state.CodeVerifier, "return_path": state.ReturnPath,
		"expires_at": state.ExpiresAt, "created_at": state.CreatedAt,
	})
	return err
}

func (r *GitHubIntegrationRepository) ConsumeOAuthState(_ context.Context, stateHash string, now time.Time) (*model.GitHubOAuthState, error) {
	result, err := r.supabase.AdminTable("github_oauth_states").
		Eq("state_hash", stateHash).IsNull("consumed_at").Gt("expires_at", now.Format(time.RFC3339Nano)).
		Update(map[string]interface{}{"consumed_at": now})
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	state := &model.GitHubOAuthState{
		StateHash: stringValue(item["state_hash"]), UserID: stringValue(item["user_id"]),
		CodeVerifier: stringValue(item["code_verifier"]), ReturnPath: stringValue(item["return_path"]),
		ExpiresAt: timeValue(item["expires_at"]), CreatedAt: timeValue(item["created_at"]),
	}
	consumedAt := timeValue(item["consumed_at"])
	state.ConsumedAt = &consumedAt
	return state, nil
}

func (r *GitHubIntegrationRepository) UpsertBinding(ctx context.Context, binding *model.GitHubProjectBinding) error {
	data := githubBindingData(binding)
	existing, err := r.FindBindingByProjectID(ctx, binding.ProjectID)
	if err == nil && existing != nil {
		binding.ID = existing.ID
		_, err = r.supabase.AdminTable("github_project_bindings").Eq("project_id", binding.ProjectID).Update(data)
		return err
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	result, err := r.supabase.AdminTable("github_project_bindings").Insert(data)
	if err != nil {
		return err
	}
	if item, ok := firstDataMap(result.Data); ok {
		binding.ID, _ = item["id"].(string)
	}
	return nil
}

func (r *GitHubIntegrationRepository) FindBindingByProjectID(_ context.Context, projectID string) (*model.GitHubProjectBinding, error) {
	result, err := r.supabase.AdminTable("github_project_bindings").Eq("project_id", projectID).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapGitHubBinding(item), nil
}

func (r *GitHubIntegrationRepository) ListBindingsByRepository(_ context.Context, repositoryName string) ([]model.GitHubProjectBinding, error) {
	result, err := r.supabase.AdminTable("github_project_bindings").Eq("repository_name", repositoryName).SelectQuery()
	if err != nil {
		return nil, err
	}
	bindings := make([]model.GitHubProjectBinding, 0, len(result.Data))
	for _, raw := range result.Data {
		item, ok := raw.(map[string]interface{})
		if ok {
			bindings = append(bindings, *mapGitHubBinding(item))
		}
	}
	return bindings, nil
}

func (r *GitHubIntegrationRepository) CreateSyncOperation(_ context.Context, operation *model.GitHubSyncOperation) (bool, error) {
	_, err := r.supabase.AdminTable("github_sync_operations").Insert(map[string]interface{}{
		"id": operation.ID, "user_id": operation.UserID, "project_id": operation.ProjectID,
		"idempotency_key": operation.IdempotencyKey, "kind": operation.Kind,
		"request_hash": operation.RequestHash, "status": operation.Status,
		"result": operation.Result, "error_code": operation.ErrorCode,
		"created_at": operation.CreatedAt, "updated_at": operation.UpdatedAt,
	})
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		return false, nil
	}
	return err == nil, err
}

func (r *GitHubIntegrationRepository) FindSyncOperation(_ context.Context, userID, idempotencyKey string) (*model.GitHubSyncOperation, error) {
	result, err := r.supabase.AdminTable("github_sync_operations").Eq("user_id", userID).Eq("idempotency_key", idempotencyKey).First()
	if err != nil {
		return nil, err
	}
	item, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapGitHubSyncOperation(item), nil
}

func (r *GitHubIntegrationRepository) UpdateSyncOperation(_ context.Context, operation *model.GitHubSyncOperation) error {
	_, err := r.supabase.AdminTable("github_sync_operations").Eq("id", operation.ID).Update(map[string]interface{}{
		"status": operation.Status, "result": operation.Result,
		"error_code": operation.ErrorCode, "updated_at": operation.UpdatedAt,
	})
	return err
}

func (r *GitHubIntegrationRepository) CreateWebhookDelivery(_ context.Context, delivery *model.GitHubWebhookDelivery) (bool, error) {
	_, err := r.supabase.AdminTable("github_webhook_deliveries").Insert(map[string]interface{}{
		"delivery_id": delivery.DeliveryID, "event": delivery.Event,
		"repository_name": delivery.RepositoryName, "project_id": delivery.ProjectID,
		"ref": delivery.Ref, "after_sha": delivery.AfterSHA,
		"status": delivery.Status, "created_at": delivery.CreatedAt,
	})
	if err != nil && strings.Contains(strings.ToLower(err.Error()), "duplicate") {
		return false, nil
	}
	return err == nil, err
}

func githubConnectionData(connection *model.GitHubConnection) map[string]interface{} {
	return map[string]interface{}{
		"user_id": connection.UserID, "account_id": connection.AccountID,
		"account_login": connection.AccountLogin, "account_name": connection.AccountName,
		"avatar_url": connection.AvatarURL, "scopes": connection.Scopes,
		"token_ciphertext": connection.TokenCiphertext, "token_nonce": connection.TokenNonce,
		"token_key_version": connection.TokenKeyVersion, "updated_at": connection.UpdatedAt,
	}
}

func githubBindingData(binding *model.GitHubProjectBinding) map[string]interface{} {
	return map[string]interface{}{
		"project_id": binding.ProjectID, "user_id": binding.UserID,
		"repository_id": binding.RepositoryID, "repository_name": binding.RepositoryName,
		"repository_url": binding.RepositoryURL, "default_branch": binding.DefaultBranch,
		"remote_name": binding.RemoteName, "permission_push": binding.PermissionPush,
		"webhook_id":      binding.WebhookID,
		"remote_head_sha": binding.RemoteHeadSHA, "updated_at": binding.UpdatedAt,
	}
}

func mapGitHubConnection(item map[string]interface{}) *model.GitHubConnection {
	return &model.GitHubConnection{
		ID: stringValue(item["id"]), UserID: stringValue(item["user_id"]),
		AccountID: int64Value(item["account_id"]), AccountLogin: stringValue(item["account_login"]),
		AccountName: stringValue(item["account_name"]), AvatarURL: stringValue(item["avatar_url"]),
		Scopes: stringValue(item["scopes"]), TokenCiphertext: stringValue(item["token_ciphertext"]),
		TokenNonce: stringValue(item["token_nonce"]), TokenKeyVersion: stringValue(item["token_key_version"]),
		CreatedAt: timeValue(item["created_at"]), UpdatedAt: timeValue(item["updated_at"]),
	}
}

func mapGitHubBinding(item map[string]interface{}) *model.GitHubProjectBinding {
	return &model.GitHubProjectBinding{
		ID: stringValue(item["id"]), ProjectID: stringValue(item["project_id"]), UserID: stringValue(item["user_id"]),
		RepositoryID: int64Value(item["repository_id"]), RepositoryName: stringValue(item["repository_name"]),
		RepositoryURL: stringValue(item["repository_url"]), DefaultBranch: stringValue(item["default_branch"]),
		RemoteName: stringValue(item["remote_name"]), PermissionPush: boolValue(item["permission_push"]),
		WebhookID:     int64Value(item["webhook_id"]),
		RemoteHeadSHA: stringValue(item["remote_head_sha"]),
		CreatedAt:     timeValue(item["created_at"]), UpdatedAt: timeValue(item["updated_at"]),
	}
}

func mapGitHubSyncOperation(item map[string]interface{}) *model.GitHubSyncOperation {
	return &model.GitHubSyncOperation{
		ID: stringValue(item["id"]), UserID: stringValue(item["user_id"]),
		ProjectID: stringValue(item["project_id"]), IdempotencyKey: stringValue(item["idempotency_key"]),
		Kind: stringValue(item["kind"]), RequestHash: stringValue(item["request_hash"]),
		Status: stringValue(item["status"]), Result: jsonStringValue(item["result"]),
		ErrorCode: stringValue(item["error_code"]), CreatedAt: timeValue(item["created_at"]),
		UpdatedAt: timeValue(item["updated_at"]),
	}
}

func stringValue(value interface{}) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func int64Value(value interface{}) int64 {
	return getSupabaseInt64(value)
}

func boolValue(value interface{}) bool {
	result, _ := value.(bool)
	return result
}

func timeValue(value interface{}) time.Time {
	text, _ := value.(string)
	parsed, _ := parseSupabaseTime(text)
	return parsed
}

func jsonStringValue(value interface{}) string {
	if text, ok := value.(string); ok {
		return text
	}
	encoded, _ := json.Marshal(value)
	return string(encoded)
}
