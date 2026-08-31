package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"yistack/config"
	"yistack/internal/model"
)

type stubProjectResourceAlertEventRepo struct {
	created       []model.ProjectResourceAlertEvent
	projectID     string
	status        string
	offset        int
	limit         int
	listCallCount int
}

func (r *stubProjectResourceAlertEventRepo) Create(_ context.Context, event *model.ProjectResourceAlertEvent) error {
	if event == nil {
		return nil
	}
	if event.ID == 0 {
		event.ID = int64(len(r.created) + 1)
	}
	r.created = append(r.created, *event)
	return nil
}

func (r *stubProjectResourceAlertEventRepo) ListByProjectID(_ context.Context, projectID, status string, offset, limit int) ([]model.ProjectResourceAlertEvent, int64, error) {
	r.projectID = projectID
	r.status = status
	r.offset = offset
	r.limit = limit
	r.listCallCount++
	records := make([]model.ProjectResourceAlertEvent, 0, len(r.created))
	for _, record := range r.created {
		if status == "" || record.Status == status {
			records = append(records, record)
		}
	}
	return records, int64(len(records)), nil
}

func (r *stubProjectResourceAlertEventRepo) DeleteByProjectID(context.Context, string) error {
	r.created = nil
	return nil
}

type stubResourceAlertNotificationHTTPClient struct {
	statusCode int
	requests   int
	body       string
	headers    http.Header
}

func (c *stubResourceAlertNotificationHTTPClient) Do(req *http.Request) (*http.Response, error) {
	c.requests++
	c.headers = req.Header.Clone()
	body, _ := io.ReadAll(req.Body)
	c.body = string(body)
	statusCode := c.statusCode
	if statusCode == 0 {
		statusCode = http.StatusNoContent
	}
	return &http.Response{
		StatusCode: statusCode,
		Body:       io.NopCloser(strings.NewReader("")),
	}, nil
}

func TestGetProjectResourceSnapshotUnavailableWithoutContainerManager(t *testing.T) {
	projectID := "proj_resource_unavailable"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID:       projectID,
			AppType:         "web",
			ContainerStatus: "running",
		}}},
	})

	result, err := projectSvc.GetProjectResourceSnapshot(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceSnapshot returned error: %v", err)
	}
	if result.Status != "unavailable" {
		t.Fatalf("expected unavailable status, got %#v", result)
	}
	if result.MetricsAvailable {
		t.Fatalf("metrics should not be marked available without container manager: %#v", result)
	}
	if result.ContainerStatus != "unavailable" {
		t.Fatalf("expected unavailable container status, got %q", result.ContainerStatus)
	}
}

func TestGetProjectResourceAlertReadinessDisabledDoesNotRequireContainerManager(t *testing.T) {
	projectID := "proj_resource_alert_disabled"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled: false,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertReadiness returned error: %v", err)
	}
	if result.Status != "disabled" || result.ResourceAlertEnabled {
		t.Fatalf("expected disabled readiness, got %#v", result)
	}
	if result.SnapshotStatus != "not_checked" || result.ResourceSnapshot != nil {
		t.Fatalf("disabled readiness should not read resource snapshot: %#v", result)
	}
}

func TestGetProjectResourceAlertReadinessBlocksWithoutThresholds(t *testing.T) {
	projectID := "proj_resource_alert_no_threshold"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled: true,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertReadiness returned error: %v", err)
	}
	if result.Status != "blocked" {
		t.Fatalf("expected blocked readiness without thresholds, got %#v", result)
	}
	if result.SnapshotStatus != "not_checked" || result.ResourceSnapshot != nil {
		t.Fatalf("threshold configuration guard should not read resource snapshot: %#v", result)
	}
}

func TestGetProjectResourceAlertReadinessUnavailableWhenSnapshotUnavailable(t *testing.T) {
	projectID := "proj_resource_alert_snapshot_unavailable"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled:    true,
			ResourceAlertCPUPercent: 80,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertReadiness returned error: %v", err)
	}
	if result.Status != "unavailable" || result.SnapshotStatus != "unavailable" {
		t.Fatalf("expected unavailable readiness when snapshot is unavailable, got %#v", result)
	}
	if result.ResourceSnapshot == nil || result.ResourceSnapshot.Status != "unavailable" {
		t.Fatalf("expected embedded unavailable resource snapshot, got %#v", result)
	}
}

func TestGetProjectResourceAlertEvaluationPreviewDisabledDoesNotCreateAlert(t *testing.T) {
	projectID := "proj_resource_alert_preview_disabled"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled: false,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertEvaluationPreview(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertEvaluationPreview returned error: %v", err)
	}
	if result.Status != "disabled" || result.ReadinessStatus != "disabled" {
		t.Fatalf("expected disabled preview, got %#v", result)
	}
	if result.WouldCreateAlert || result.TriggeredCount != 0 || len(result.TriggeredThresholds) != 0 {
		t.Fatalf("disabled preview should not create alert: %#v", result)
	}
	if result.Readiness == nil || result.Readiness.ResourceSnapshot != nil {
		t.Fatalf("disabled preview should embed readiness without reading snapshot: %#v", result)
	}
}

func TestGetProjectResourceAlertEvaluationPreviewUnavailableDoesNotCreateAlert(t *testing.T) {
	projectID := "proj_resource_alert_preview_unavailable"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled:    true,
			ResourceAlertCPUPercent: 80,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertEvaluationPreview(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertEvaluationPreview returned error: %v", err)
	}
	if result.Status != "unavailable" || result.ReadinessStatus != "unavailable" {
		t.Fatalf("expected unavailable preview, got %#v", result)
	}
	if result.WouldCreateAlert || result.TriggeredCount != 0 {
		t.Fatalf("unavailable preview should not create alert: %#v", result)
	}
	if len(result.Thresholds) != 3 || !result.Thresholds[0].Configured {
		t.Fatalf("preview should expose threshold facts even when snapshot is unavailable: %#v", result)
	}
	if result.Readiness == nil || result.Readiness.ResourceSnapshot == nil {
		t.Fatalf("unavailable preview should embed readiness and unavailable snapshot: %#v", result)
	}
}

func TestCreateProjectResourceAlertEventRequiresExplicitConfirmation(t *testing.T) {
	projectID := "proj_resource_alert_event_confirm"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled:    true,
			ResourceAlertCPUPercent: 80,
		},
	})

	result, err := projectSvc.CreateProjectResourceAlertEvent(context.Background(), projectID, "user-alert", false)
	if err != nil {
		t.Fatalf("CreateProjectResourceAlertEvent returned error: %v", err)
	}
	if result.Status != "blocked" || result.EventCreated {
		t.Fatalf("expected confirmation-blocked alert event, got %#v", result)
	}
	if result.EvaluationPreview != nil || result.EvaluationID != "" {
		t.Fatalf("unconfirmed alert event creation should not evaluate runtime facts: %#v", result)
	}
}

func TestCreateProjectResourceAlertEventUnavailableWithoutRepository(t *testing.T) {
	projectID := "proj_resource_alert_event_repo_unavailable"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled:    true,
			ResourceAlertCPUPercent: 80,
		},
	})

	result, err := projectSvc.CreateProjectResourceAlertEvent(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("CreateProjectResourceAlertEvent returned error: %v", err)
	}
	if result.Status != "unavailable" || result.EventCreated {
		t.Fatalf("expected unavailable alert event without repository, got %#v", result)
	}
	if result.EvaluationPreview != nil {
		t.Fatalf("repository guard should run before resource evaluation: %#v", result)
	}
}

func TestCreateProjectResourceAlertEventDoesNotPersistWhenPreviewDoesNotAlert(t *testing.T) {
	projectID := "proj_resource_alert_event_disabled"
	alertRepo := &stubProjectResourceAlertEventRepo{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ResourceAlertEventRepo: alertRepo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnabled: false,
		},
	})

	result, err := projectSvc.CreateProjectResourceAlertEvent(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("CreateProjectResourceAlertEvent returned error: %v", err)
	}
	if result.Status != "disabled" || result.EventCreated {
		t.Fatalf("expected disabled non-created alert event result, got %#v", result)
	}
	if result.EvaluationPreview == nil || result.EvaluationPreview.WouldCreateAlert {
		t.Fatalf("expected embedded non-alerting evaluation preview, got %#v", result)
	}
	if len(alertRepo.created) != 0 {
		t.Fatalf("disabled preview must not persist alert events: %#v", alertRepo.created)
	}
}

func TestListProjectResourceAlertEventsUnavailableWithoutRepository(t *testing.T) {
	projectSvc := NewProjectService(ProjectServiceOptions{})

	result, err := projectSvc.ListProjectResourceAlertEvents(context.Background(), "proj_alert_events", "created", 0, 20)
	if err != nil {
		t.Fatalf("ListProjectResourceAlertEvents returned error: %v", err)
	}
	if result.Status != "unavailable" || len(result.Records) != 0 {
		t.Fatalf("expected unavailable empty list without repository, got %#v", result)
	}
	if result.Recovery == "" {
		t.Fatalf("unavailable list result should include recovery guidance: %#v", result)
	}
}

func TestListProjectResourceAlertEventsParsesEvidenceAndNormalizesPagination(t *testing.T) {
	createdAt := time.Now().UTC()
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{{
		ID:                  7,
		ProjectID:           "proj_alert_events",
		UserID:              "user-alert",
		Status:              "created",
		EvaluationID:        "eval-1",
		ReadinessStatus:     "alerting",
		TriggeredCount:      1,
		TriggeredThresholds: `[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}]`,
		Thresholds:          `[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}]`,
		EvaluationPreview:   `{"status":"would_alert","project_id":"proj_alert_events","evaluation_id":"eval-1","readiness_status":"alerting","would_create_alert":true,"triggered_count":1,"triggered_thresholds":[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}],"thresholds":[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}],"readiness":{"status":"alerting","project_id":"proj_alert_events","resource_alert_enabled":true,"cpu_threshold_configured":true,"memory_threshold_configured":false,"disk_threshold_configured":false,"cpu_threshold_percent":80,"memory_threshold_percent":0,"disk_threshold_bytes":0,"snapshot_status":"ready","metrics_available":true,"cpu_percent":91,"memory_usage_bytes":0,"memory_limit_bytes":0,"memory_usage_percent":0,"disk_usage_bytes":0,"cpu_threshold_exceeded":true,"memory_threshold_exceeded":false,"disk_threshold_exceeded":false,"any_threshold_exceeded":true,"resource_snapshot":null,"message":"ready","recovery":"none"},"message":"preview","recovery":"none"}`,
		Message:             "created",
		Recovery:            "read-only",
		CreatedAt:           createdAt,
	}}}
	projectSvc := NewProjectService(ProjectServiceOptions{ResourceAlertEventRepo: repo})

	result, err := projectSvc.ListProjectResourceAlertEvents(context.Background(), " proj_alert_events ", " created ", -5, 500)
	if err != nil {
		t.Fatalf("ListProjectResourceAlertEvents returned error: %v", err)
	}
	if repo.projectID != "proj_alert_events" || repo.status != "created" || repo.offset != 0 || repo.limit != 100 {
		t.Fatalf("expected normalized query options, got project=%q status=%q offset=%d limit=%d", repo.projectID, repo.status, repo.offset, repo.limit)
	}
	if result.Status != "ready" || result.Total != 1 || len(result.Records) != 1 {
		t.Fatalf("expected ready list with one record, got %#v", result)
	}
	record := result.Records[0]
	if record.ID != 7 || record.EvaluationPreview == nil || record.EvaluationPreview.EvaluationID != "eval-1" {
		t.Fatalf("expected parsed event evidence, got %#v", record)
	}
	if len(record.TriggeredThresholds) != 1 || record.TriggeredThresholds[0].Name != "cpu" {
		t.Fatalf("expected parsed triggered thresholds, got %#v", record.TriggeredThresholds)
	}
	if record.RawEvaluationPreview == "" || !record.CreatedAt.Equal(createdAt) {
		t.Fatalf("expected raw evidence and created_at to be preserved, got %#v", record)
	}
}

func TestListProjectResourceAlertEventsPreservesBadJSONEvidence(t *testing.T) {
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{{
		ID:                  8,
		ProjectID:           "proj_alert_events",
		Status:              "created",
		TriggeredThresholds: `not-json`,
		Thresholds:          `[`,
		EvaluationPreview:   `{`,
	}}}
	projectSvc := NewProjectService(ProjectServiceOptions{ResourceAlertEventRepo: repo})

	result, err := projectSvc.ListProjectResourceAlertEvents(context.Background(), "proj_alert_events", "", 0, 20)
	if err != nil {
		t.Fatalf("ListProjectResourceAlertEvents returned error: %v", err)
	}
	if result.Status != "ready" || len(result.Records) != 1 {
		t.Fatalf("expected bad JSON record to remain listable, got %#v", result)
	}
	record := result.Records[0]
	if record.TriggeredThresholdsParseError == "" || record.ThresholdsParseError == "" || record.EvaluationPreviewParseError == "" {
		t.Fatalf("expected parse errors to be preserved, got %#v", record)
	}
	if record.RawTriggeredThresholds != "not-json" || record.RawThresholds != "[" || record.RawEvaluationPreview != "{" {
		t.Fatalf("expected raw JSON evidence to be preserved, got %#v", record)
	}
}

func TestGetProjectResourceAlertNotificationReadinessDisabledDoesNotReadEvents(t *testing.T) {
	projectID := "proj_resource_alert_notification_disabled"
	repo := &stubProjectResourceAlertEventRepo{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{
			ProjectID: projectID,
			AppType:   "web",
		}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled: false,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertNotificationReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertNotificationReadiness returned error: %v", err)
	}
	if result.Status != "disabled" || result.NotificationEnabled {
		t.Fatalf("expected disabled notification readiness, got %#v", result)
	}
	if repo.listCallCount != 0 {
		t.Fatalf("disabled notification readiness should not read alert events, list calls=%d", repo.listCallCount)
	}
}

func TestGetProjectResourceAlertNotificationReadinessBlocksWithoutProviderOrWebhook(t *testing.T) {
	projectID := "proj_resource_alert_notification_blocked"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled: true,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertNotificationReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertNotificationReadiness returned error: %v", err)
	}
	if result.Status != "blocked" || result.ProviderSupported || result.WebhookConfigured {
		t.Fatalf("expected blocked readiness without provider, got %#v", result)
	}

	projectSvc = NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: "webhook",
		},
	})
	result, err = projectSvc.GetProjectResourceAlertNotificationReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertNotificationReadiness returned error: %v", err)
	}
	if result.Status != "blocked" || !result.ProviderSupported || result.WebhookConfigured {
		t.Fatalf("expected blocked readiness without webhook URL, got %#v", result)
	}
}

func TestGetProjectResourceAlertNotificationReadinessUnavailableWithoutRepository(t *testing.T) {
	projectID := "proj_resource_alert_notification_repo_unavailable"
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: "webhook",
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			ResourceAlertNotificationWebhookURL: "https://hooks.example.test/resource-alert",
		},
	})

	result, err := projectSvc.GetProjectResourceAlertNotificationReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertNotificationReadiness returned error: %v", err)
	}
	if result.Status != "unavailable" || !result.WebhookConfigured {
		t.Fatalf("expected unavailable readiness without event repository, got %#v", result)
	}
}

func TestGetProjectResourceAlertNotificationReadinessReadyWithCandidateEvent(t *testing.T) {
	projectID := "proj_resource_alert_notification_ready"
	createdAt := time.Now().UTC()
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{{
		ID:              11,
		ProjectID:       projectID,
		Status:          "created",
		EvaluationID:    "eval-notify-1",
		ReadinessStatus: "alerting",
		TriggeredCount:  2,
		CreatedAt:       createdAt,
	}}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: " WEBHOOK ",
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			ResourceAlertNotificationWebhookURL: "https://hooks.example.test/resource-alert",
		},
	})

	result, err := projectSvc.GetProjectResourceAlertNotificationReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertNotificationReadiness returned error: %v", err)
	}
	if repo.projectID != projectID || repo.status != "created" || repo.offset != 0 || repo.limit != 1 {
		t.Fatalf("expected readiness to read latest created event candidate, got project=%q status=%q offset=%d limit=%d", repo.projectID, repo.status, repo.offset, repo.limit)
	}
	if result.Status != "ready" || !result.CandidateEventAvailable || result.CandidateEventID != 11 {
		t.Fatalf("expected ready notification readiness with candidate event, got %#v", result)
	}
	if result.Provider != "webhook" || !result.ProviderSupported || !result.WebhookConfigured {
		t.Fatalf("expected normalized webhook readiness without exposing URL, got %#v", result)
	}
	if result.CandidateEvaluationID != "eval-notify-1" || result.CandidateTriggeredCount != 2 || !result.CandidateCreatedAt.Equal(createdAt) {
		t.Fatalf("expected candidate event facts to be preserved, got %#v", result)
	}
}

func TestSendProjectResourceAlertNotificationRequiresExplicitConfirmation(t *testing.T) {
	projectID := "proj_resource_alert_notification_confirm"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 21)}}
	httpClient := &stubResourceAlertNotificationHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ResourceAlertEventRepo: repo,
		NotificationHTTPClient: httpClient,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: "webhook",
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			ResourceAlertNotificationWebhookURL: "https://hooks.example.test/resource-alert",
		},
	})

	result, err := projectSvc.SendProjectResourceAlertNotification(context.Background(), projectID, "user-alert", false)
	if err != nil {
		t.Fatalf("SendProjectResourceAlertNotification returned error: %v", err)
	}
	if result.Status != "blocked" || result.NotificationSent {
		t.Fatalf("expected blocked send without confirmation, got %#v", result)
	}
	if repo.listCallCount != 0 || httpClient.requests != 0 {
		t.Fatalf("send without confirmation should not read events or call webhook, list=%d requests=%d", repo.listCallCount, httpClient.requests)
	}
}

func TestSendProjectResourceAlertNotificationDoesNotSendWhenReadinessDisabled(t *testing.T) {
	projectID := "proj_resource_alert_notification_disabled_send"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 22)}}
	httpClient := &stubResourceAlertNotificationHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ResourceAlertEventRepo: repo,
		NotificationHTTPClient: httpClient,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled: false,
		},
	})

	result, err := projectSvc.SendProjectResourceAlertNotification(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("SendProjectResourceAlertNotification returned error: %v", err)
	}
	if result.Status != "disabled" || result.NotificationSent {
		t.Fatalf("expected disabled readiness to block notification send, got %#v", result)
	}
	if repo.listCallCount != 0 || httpClient.requests != 0 {
		t.Fatalf("disabled readiness should not read events or call webhook, list=%d requests=%d", repo.listCallCount, httpClient.requests)
	}
}

func TestSendProjectResourceAlertNotificationSendsWebhookAndAppendsEvent(t *testing.T) {
	projectID := "proj_resource_alert_notification_send"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 31)}}
	httpClient := &stubResourceAlertNotificationHTTPClient{statusCode: http.StatusAccepted}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ResourceAlertEventRepo: repo,
		NotificationHTTPClient: httpClient,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: "webhook",
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			ResourceAlertNotificationWebhookURL: "https://hooks.example.test/resource-alert",
		},
	})

	result, err := projectSvc.SendProjectResourceAlertNotification(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("SendProjectResourceAlertNotification returned error: %v", err)
	}
	if result.Status != "sent" || !result.NotificationSent || !result.NotificationEventCreated {
		t.Fatalf("expected sent notification result, got %#v", result)
	}
	if httpClient.requests != 1 {
		t.Fatalf("expected one webhook request, got %d", httpClient.requests)
	}
	if !strings.Contains(httpClient.body, `"source_event_id":31`) || strings.Contains(httpClient.body, "hooks.example") {
		t.Fatalf("webhook payload should include source event facts without leaking webhook URL, body=%s", httpClient.body)
	}
	if httpClient.headers.Get("X-YiStack-Resource-Alert-Event-ID") != "31" {
		t.Fatalf("expected source event header, got %q", httpClient.headers.Get("X-YiStack-Resource-Alert-Event-ID"))
	}
	last := repo.created[len(repo.created)-1]
	if last.Status != "notification_sent" || last.EvaluationID != "eval-notify-31" || !strings.Contains(last.Message, "source_event_id=31") {
		t.Fatalf("expected append-only notification_sent event, got %#v", last)
	}
}

func TestSendProjectResourceAlertNotificationBlocksDuplicateSentEvent(t *testing.T) {
	projectID := "proj_resource_alert_notification_duplicate"
	source := buildNotificationSourceEvent(projectID, 41)
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{
		source,
		{
			ID:                  42,
			ProjectID:           projectID,
			Status:              "notification_sent",
			EvaluationID:        source.EvaluationID,
			ReadinessStatus:     source.ReadinessStatus,
			TriggeredCount:      source.TriggeredCount,
			TriggeredThresholds: source.TriggeredThresholds,
			Thresholds:          source.Thresholds,
			EvaluationPreview:   source.EvaluationPreview,
			Message:             "项目资源告警 webhook 通知已受控发送；source_event_id=41",
			CreatedAt:           time.Now().UTC(),
		},
	}}
	httpClient := &stubResourceAlertNotificationHTTPClient{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ResourceAlertEventRepo: repo,
		NotificationHTTPClient: httpClient,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: "webhook",
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			ResourceAlertNotificationWebhookURL: "https://hooks.example.test/resource-alert",
		},
	})

	result, err := projectSvc.SendProjectResourceAlertNotification(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("SendProjectResourceAlertNotification returned error: %v", err)
	}
	if result.Status != "blocked" || result.NotificationSent {
		t.Fatalf("expected duplicate sent event to block notification, got %#v", result)
	}
	if httpClient.requests != 0 || len(repo.created) != 2 {
		t.Fatalf("duplicate notification should not call webhook or append event, requests=%d events=%d", httpClient.requests, len(repo.created))
	}
}

func TestSendProjectResourceAlertNotificationRecordsFailedWithoutLeakingWebhookURL(t *testing.T) {
	projectID := "proj_resource_alert_notification_failed"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 51)}}
	httpClient := &stubResourceAlertNotificationHTTPClient{statusCode: http.StatusInternalServerError}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID}}},
		ResourceAlertEventRepo: repo,
		NotificationHTTPClient: httpClient,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertNotificationEnabled:  true,
			ResourceAlertNotificationProvider: "webhook",
		},
		ProjectSecretCfg: &config.ProjectSecretConfig{
			ResourceAlertNotificationWebhookURL: "https://hooks.example.test/resource-alert",
		},
	})

	result, err := projectSvc.SendProjectResourceAlertNotification(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("SendProjectResourceAlertNotification returned error: %v", err)
	}
	if result.Status != "failed" || result.NotificationSent || !result.NotificationEventCreated || result.HTTPStatusCode != http.StatusInternalServerError {
		t.Fatalf("expected failed notification result with append-only event, got %#v", result)
	}
	last := repo.created[len(repo.created)-1]
	if last.Status != "notification_failed" || strings.Contains(result.Message, "hooks.example") || strings.Contains(last.Message, "hooks.example") {
		t.Fatalf("failed notification should not leak webhook URL, result=%#v event=%#v", result, last)
	}
}

func TestGetProjectResourceAlertEnforcementReadinessDisabledDoesNotReadEvents(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_disabled"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 61)}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: false,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertEnforcementReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertEnforcementReadiness returned error: %v", err)
	}
	if result.Status != "disabled" || result.EnforcementEnabled {
		t.Fatalf("expected disabled enforcement readiness, got %#v", result)
	}
	if repo.listCallCount != 0 {
		t.Fatalf("disabled enforcement readiness should not read alert events, calls=%d", repo.listCallCount)
	}
}

func TestGetProjectResourceAlertEnforcementReadinessBlocksWithoutMode(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_no_mode"
	repo := &stubProjectResourceAlertEventRepo{}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: true,
		},
	})

	result, err := projectSvc.GetProjectResourceAlertEnforcementReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertEnforcementReadiness returned error: %v", err)
	}
	if result.Status != "blocked" || result.EnforcementModeSupported {
		t.Fatalf("expected missing mode to block enforcement readiness, got %#v", result)
	}
	if repo.listCallCount != 0 {
		t.Fatalf("mode-blocked enforcement readiness should not read alert events, calls=%d", repo.listCallCount)
	}
}

func TestGetProjectResourceAlertEnforcementReadinessBlocksWithoutNotificationSent(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_without_notification"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 71)}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: true,
			ResourceAlertEnforcementMode:    "stop_container",
		},
	})

	result, err := projectSvc.GetProjectResourceAlertEnforcementReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertEnforcementReadiness returned error: %v", err)
	}
	if result.Status != "blocked" || !result.CandidateEventAvailable || result.NotificationSentAvailable {
		t.Fatalf("expected missing notification_sent to block enforcement readiness, got %#v", result)
	}
	if repo.status != "notification_sent" {
		t.Fatalf("expected enforcement readiness to check notification_sent evidence, last status=%q", repo.status)
	}
}

func TestGetProjectResourceAlertEnforcementReadinessReadyWithNotificationSent(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_ready"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{
		buildNotificationSourceEvent(projectID, 81),
		{
			ID:                  82,
			ProjectID:           projectID,
			UserID:              "user-alert",
			Status:              "notification_sent",
			EvaluationID:        "eval-notify-81",
			ReadinessStatus:     "alerting",
			TriggeredCount:      1,
			TriggeredThresholds: "[]",
			Thresholds:          "[]",
			EvaluationPreview:   "{}",
			Message:             "项目资源告警 webhook 通知已受控发送；source_event_id=81",
			Recovery:            "sent",
			CreatedAt:           time.Now().UTC(),
		},
	}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: true,
			ResourceAlertEnforcementMode:    " stop_container ",
		},
	})

	result, err := projectSvc.GetProjectResourceAlertEnforcementReadiness(context.Background(), projectID)
	if err != nil {
		t.Fatalf("GetProjectResourceAlertEnforcementReadiness returned error: %v", err)
	}
	if result.Status != "ready" || !result.WouldEnforce || !result.NotificationSentAvailable || result.CandidateEventID != 81 {
		t.Fatalf("expected ready enforcement readiness with notification_sent evidence, got %#v", result)
	}
}

func TestExecuteProjectResourceAlertEnforcementRequiresExplicitConfirmation(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_execute_confirm"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 91)}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: true,
			ResourceAlertEnforcementMode:    "stop_container",
		},
	})

	result, err := projectSvc.ExecuteProjectResourceAlertEnforcement(context.Background(), projectID, "user-alert", false)
	if err != nil {
		t.Fatalf("ExecuteProjectResourceAlertEnforcement returned error: %v", err)
	}
	if result.Status != "blocked" || result.EnforcementExecuted {
		t.Fatalf("expected confirmation guard to block enforcement execution, got %#v", result)
	}
	if repo.listCallCount != 0 {
		t.Fatalf("unconfirmed enforcement execution should not read alert events, calls=%d", repo.listCallCount)
	}
}

func TestExecuteProjectResourceAlertEnforcementBlocksWhenReadinessBlocked(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_execute_readiness_blocked"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{buildNotificationSourceEvent(projectID, 101)}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: true,
			ResourceAlertEnforcementMode:    "stop_container",
		},
	})

	result, err := projectSvc.ExecuteProjectResourceAlertEnforcement(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("ExecuteProjectResourceAlertEnforcement returned error: %v", err)
	}
	if result.Status != "blocked" || result.EnforcementExecuted || result.StopResult != nil {
		t.Fatalf("expected readiness guard to block enforcement execution without stop result, got %#v", result)
	}
	if len(repo.created) != 1 {
		t.Fatalf("readiness-blocked enforcement execution should not append event, got %d records", len(repo.created))
	}
}

func TestExecuteProjectResourceAlertEnforcementStopFailureDoesNotAppendExecutedEvent(t *testing.T) {
	projectID := "proj_resource_alert_enforcement_execute_stop_failed"
	repo := &stubProjectResourceAlertEventRepo{created: []model.ProjectResourceAlertEvent{
		buildNotificationSourceEvent(projectID, 111),
		{
			ID:                  112,
			ProjectID:           projectID,
			UserID:              "user-alert",
			Status:              "notification_sent",
			EvaluationID:        "eval-notify-111",
			ReadinessStatus:     "alerting",
			TriggeredCount:      1,
			TriggeredThresholds: "[]",
			Thresholds:          "[]",
			EvaluationPreview:   "{}",
			Message:             "项目资源告警 webhook 通知已受控发送；source_event_id=111",
			Recovery:            "sent",
			CreatedAt:           time.Now().UTC(),
		},
	}}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:            &stubProjectListRepo{projects: []model.Project{{ProjectID: projectID, AppType: "web"}}},
		ResourceAlertEventRepo: repo,
		ProjectCfg: &config.ProjectConfig{
			ResourceAlertEnforcementEnabled: true,
			ResourceAlertEnforcementMode:    "stop_container",
		},
	})

	result, err := projectSvc.ExecuteProjectResourceAlertEnforcement(context.Background(), projectID, "user-alert", true)
	if err != nil {
		t.Fatalf("ExecuteProjectResourceAlertEnforcement returned error: %v", err)
	}
	if result.Status != "failed" || result.EnforcementExecuted || result.StopResult == nil {
		t.Fatalf("expected stop failure result without executed event, got %#v", result)
	}
	for _, record := range repo.created {
		if record.Status == "enforcement_executed" {
			t.Fatalf("stop failure should not append enforcement_executed event: %#v", record)
		}
	}
}

func buildNotificationSourceEvent(projectID string, id int64) model.ProjectResourceAlertEvent {
	return model.ProjectResourceAlertEvent{
		ID:                  id,
		ProjectID:           projectID,
		Status:              "created",
		EvaluationID:        fmt.Sprintf("eval-notify-%d", id),
		ReadinessStatus:     "alerting",
		TriggeredCount:      1,
		TriggeredThresholds: `[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}]`,
		Thresholds:          `[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}]`,
		EvaluationPreview:   `{"status":"would_alert","project_id":"` + projectID + `","evaluation_id":"eval-notify-test","readiness_status":"alerting","would_create_alert":true,"triggered_count":1,"triggered_thresholds":[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}],"thresholds":[{"name":"cpu","configured":true,"current_value":91,"threshold_value":80,"unit":"percent","exceeded":true}],"readiness":null,"message":"preview","recovery":"none"}`,
		CreatedAt:           time.Now().UTC(),
	}
}
