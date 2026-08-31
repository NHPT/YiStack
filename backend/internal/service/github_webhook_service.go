package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"yistack/internal/model"
)

type GitHubWebhookResult struct {
	Status          string `json:"status"`
	DeliveryID      string `json:"delivery_id"`
	Event           string `json:"event"`
	RepositoryName  string `json:"repository_name,omitempty"`
	UpdatedBindings int    `json:"updated_bindings"`
	Replayed        bool   `json:"replayed"`
}

type githubPushWebhookPayload struct {
	Ref        string `json:"ref"`
	After      string `json:"after"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

func (s *GitHubIntegrationService) ProcessWebhook(
	ctx context.Context,
	deliveryID,
	event,
	signature string,
	body []byte,
) (*GitHubWebhookResult, error) {
	if s == nil || s.repo == nil || strings.TrimSpace(s.config.WebhookSecret) == "" {
		return nil, githubError("github_webhook_not_configured", "GitHub webhook is not configured", nil)
	}
	deliveryID = strings.TrimSpace(deliveryID)
	event = strings.TrimSpace(event)
	if deliveryID == "" || event == "" {
		return nil, githubError("github_webhook_headers_invalid", "GitHub delivery and event headers are required", nil)
	}
	if !validGitHubWebhookSignature(s.config.WebhookSecret, signature, body) {
		return nil, githubError("github_webhook_signature_invalid", "GitHub webhook signature is invalid", nil)
	}

	result := &GitHubWebhookResult{
		Status: "ignored", DeliveryID: deliveryID, Event: event,
	}
	delivery := &model.GitHubWebhookDelivery{
		DeliveryID: deliveryID, Event: event, Status: "ignored",
		CreatedAt: s.now().UTC(),
	}
	var payload githubPushWebhookPayload
	if event == "push" {
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, githubError("github_webhook_payload_invalid", "GitHub webhook payload is invalid", err)
		}
		delivery.RepositoryName = strings.TrimSpace(payload.Repository.FullName)
		delivery.Ref = strings.TrimSpace(payload.Ref)
		delivery.AfterSHA = strings.TrimSpace(payload.After)
		delivery.Status = "recorded"
		result.Status = "recorded"
		result.RepositoryName = delivery.RepositoryName
	}
	created, err := s.repo.CreateWebhookDelivery(ctx, delivery)
	if err != nil {
		return nil, err
	}
	if !created {
		result.Status = "duplicate"
		result.Replayed = true
		return result, nil
	}
	if event != "push" || !githubRepositoryNamePattern.MatchString(delivery.RepositoryName) {
		return result, nil
	}
	bindings, err := s.repo.ListBindingsByRepository(ctx, delivery.RepositoryName)
	if err != nil {
		return nil, err
	}
	for index := range bindings {
		binding := bindings[index]
		expectedRef := "refs/heads/" + binding.DefaultBranch
		if delivery.Ref != expectedRef {
			continue
		}
		binding.RemoteHeadSHA = delivery.AfterSHA
		binding.UpdatedAt = s.now().UTC()
		if err := s.repo.UpsertBinding(ctx, &binding); err != nil {
			return nil, err
		}
		result.UpdatedBindings++
	}
	return result, nil
}

func validGitHubWebhookSignature(secret, signature string, body []byte) bool {
	secret = strings.TrimSpace(secret)
	signature = strings.TrimSpace(signature)
	if secret == "" || !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	provided, err := hex.DecodeString(strings.TrimPrefix(signature, "sha256="))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	return hmac.Equal(provided, mac.Sum(nil))
}
