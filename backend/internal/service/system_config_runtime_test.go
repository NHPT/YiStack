package service

import (
	"context"
	"testing"

	"yistack/internal/model"
)

func TestSystemConfigRejectsSensitiveConfigWrites(t *testing.T) {
	repo := &stubSystemConfigRepo{values: map[string]string{}}
	configSvc := NewSystemConfigService(repo)

	err := configSvc.SetConfig(context.Background(), "project.resource_alert_notification_webhook_url", "https://example.test/hook")

	if err == nil {
		t.Fatalf("expected sensitive config write to be rejected")
	}
	if _, ok := repo.values["project.resource_alert_notification_webhook_url"]; ok {
		t.Fatalf("sensitive config should not be written to system_config")
	}
}

func TestFilterVisibleConfigsHidesSensitiveConfigKeys(t *testing.T) {
	configs := []model.SystemConfig{
		{Key: "container.enabled", Value: "true"},
		{Key: "project.backup_remote_secret_access_key", Value: "secret"},
		{Key: "system.registration_mode", Value: "open"},
	}

	visibleConfigs := FilterVisibleConfigs(configs, true, true)

	for _, cfg := range visibleConfigs {
		if cfg.Key == "project.backup_remote_secret_access_key" {
			t.Fatalf("sensitive config should not be visible: %#v", visibleConfigs)
		}
	}
	if len(visibleConfigs) != 2 {
		t.Fatalf("expected two non-sensitive configs, got %#v", visibleConfigs)
	}
}
