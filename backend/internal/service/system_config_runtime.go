package service

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"yistack/config"
	"yistack/internal/model"
)

const (
	PermissionSystemConfigRead      = "system.config.read"
	PermissionSystemConfigUpdate    = "system.config.update"
	PermissionContainerConfigRead   = "system.container_config.read"
	PermissionContainerConfigUpdate = "system.container_config.update"
)

var containerConfigKeys = map[string]struct{}{
	"container.enabled":               {},
	"container.runtime":               {},
	"container.socket_path":           {},
	"container.project_dir":           {},
	"container.template_dir":          {},
	"container.data_dir":              {},
	"container.apt_mirror":            {},
	"container.apt_mirror_candidates": {},
	"container.port_range_start":      {},
	"container.port_range_end":        {},
	"container.default_cpu":           {},
	"container.default_memory":        {},
	"container.default_disk":          {},
	"container.idle_timeout_min":      {},
	"container.images":                {},
}

var projectRuntimeConfigKeys = map[string]struct{}{
	"project.max_size":                             {},
	"project.max_file_size":                        {},
	"project.allowed_extensions":                   {},
	"project.auto_backup":                          {},
	"project.backup_dir":                           {},
	"project.auto_backup_interval_seconds":         {},
	"project.backup_remote_enabled":                {},
	"project.backup_remote_provider":               {},
	"project.backup_remote_bucket":                 {},
	"project.backup_remote_prefix":                 {},
	"project.backup_remote_endpoint":               {},
	"project.backup_remote_region":                 {},
	"project.generation_repair_max_attempts":       {},
	"project.generation_repair_timeout_seconds":    {},
	"project.generation_repair_max_output_units":   {},
	"project.browser_acceptance_timeout_seconds":   {},
	"project.resource_alert_enabled":               {},
	"project.resource_alert_cpu_percent":           {},
	"project.resource_alert_memory_percent":        {},
	"project.resource_alert_disk_bytes":            {},
	"project.resource_alert_notification_enabled":  {},
	"project.resource_alert_notification_provider": {},
	"project.resource_alert_enforcement_enabled":   {},
	"project.resource_alert_enforcement_mode":      {},
}

var capabilityRuntimeConfigKeys = map[string]struct{}{
	"capability.enable_skill_provider":    {},
	"capability.enable_mcp_provider":      {},
	"capability.enable_skill_execution":   {},
	"capability.enable_mcp_execution":     {},
	"capability.skill_runner_mode":        {},
	"capability.mcp_runner_mode":          {},
	"capability.skill_runner_manifest":    {},
	"capability.mcp_runner_manifest":      {},
	"capability.skill_runner_endpoint":    {},
	"capability.mcp_runner_endpoint":      {},
	"capability.runner_timeout_seconds":   {},
	"capability.runner_network_enabled":   {},
	"capability.runner_network_allowlist": {},
	"capability.execution_policy_note":    {},
}

var sensitiveSystemConfigKeys = map[string]struct{}{
	"project.backup_remote_access_key_id":             {},
	"project.backup_remote_secret_access_key":         {},
	"project.resource_alert_notification_webhook_url": {},
}

var sensitiveSystemConfigKeyFragments = []string{
	"access_key",
	"api_key",
	"client_secret",
	"password",
	"private_key",
	"secret",
	"token",
	"webhook_url",
}

func IsContainerConfigKey(key string) bool {
	_, ok := containerConfigKeys[key]
	return ok
}

func IsSensitiveSystemConfigKey(key string) bool {
	normalizedKey := strings.ToLower(strings.TrimSpace(key))
	if normalizedKey == "" {
		return false
	}
	if _, ok := sensitiveSystemConfigKeys[normalizedKey]; ok {
		return true
	}
	for _, fragment := range sensitiveSystemConfigKeyFragments {
		if strings.Contains(normalizedKey, fragment) {
			return true
		}
	}
	return false
}

func FilterVisibleConfigs(configs []model.SystemConfig, canReadAll bool, canReadContainer bool) []model.SystemConfig {
	filtered := make([]model.SystemConfig, 0, len(configs))
	for _, cfg := range configs {
		if IsSensitiveSystemConfigKey(cfg.Key) {
			continue
		}
		if canReadAll {
			filtered = append(filtered, cfg)
			continue
		}
		if canReadContainer && IsContainerConfigKey(cfg.Key) {
			filtered = append(filtered, cfg)
		}
	}
	return filtered
}

func ApplySystemRuntimeConfig(ctx context.Context, cfg *config.Config, repo SystemConfigRepo) error {
	if cfg == nil || repo == nil {
		return nil
	}

	configs, err := repo.List(ctx)
	if err != nil {
		return err
	}

	for _, item := range configs {
		switch item.Key {
		case "container.enabled":
			cfg.Container.Enabled = parseBool(item.Value, cfg.Container.Enabled)
		case "container.runtime":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.Runtime = value
			}
		case "container.socket_path":
			if value := strings.TrimSpace(item.Value); value != "" {
				if _, err := os.Stat(value); err == nil {
					cfg.Container.SocketPath = value
				}
			}
		case "container.project_dir":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.ProjectDir = resolveRuntimeConfigPath(value)
			}
		case "container.template_dir":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.TemplateDir = resolveRuntimeConfigPath(value)
			}
		case "container.data_dir":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.DataDir = resolveRuntimeConfigPath(value)
			}
		case "container.apt_mirror":
			cfg.Container.APTMirror = strings.TrimSpace(item.Value)
		case "container.apt_mirror_candidates":
			cfg.Container.APTMirrors = parseContainerAPTMirrorCandidates(item.Value)
		case "container.port_range_start":
			cfg.Container.PortRangeStart = parseInt(item.Value, cfg.Container.PortRangeStart)
		case "container.port_range_end":
			cfg.Container.PortRangeEnd = parseInt(item.Value, cfg.Container.PortRangeEnd)
		case "container.default_cpu":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.DefaultCPU = value
			}
		case "container.default_memory":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.DefaultMemory = value
			}
		case "container.default_disk":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.Container.DefaultDisk = value
			}
		case "container.idle_timeout_min", "container_idle_timeout_min":
			cfg.Container.IdleTimeoutMin = parseInt(item.Value, cfg.Container.IdleTimeoutMin)
		case "container.images":
			if strings.TrimSpace(item.Value) == "" {
				continue
			}
			var images []config.ContainerImage
			if err := json.Unmarshal([]byte(item.Value), &images); err == nil && len(images) > 0 {
				cfg.Container.Images = images
			}
		case "system.maintenance_mode":
			cfg.System.MaintenanceMode = parseBool(item.Value, cfg.System.MaintenanceMode)
		case "system.registration_mode":
			if value := strings.TrimSpace(item.Value); value != "" {
				cfg.System.RegistrationMode = value
			}
		case "system.max_upload_size":
			cfg.System.MaxUploadSize = parseInt64(item.Value, cfg.System.MaxUploadSize)
		}
	}
	ApplyProjectRuntimeConfigItems(&cfg.Project, configs)
	ApplyCapabilityRuntimeConfigItems(&cfg.Capability, configs)

	return nil
}

func ApplyProjectRuntimeConfigItems(projectCfg *config.ProjectConfig, configs []model.SystemConfig) {
	if projectCfg == nil {
		return
	}
	for _, item := range configs {
		switch item.Key {
		case "project.max_size":
			projectCfg.MaxProjectSize = parseInt64(item.Value, projectCfg.MaxProjectSize)
		case "project.max_file_size":
			projectCfg.MaxFileSize = parseInt64(item.Value, projectCfg.MaxFileSize)
		case "project.allowed_extensions":
			if values := parseCSVValue(item.Value); len(values) > 0 {
				projectCfg.AllowedExtensions = values
			}
		case "project.auto_backup":
			projectCfg.AutoBackup = parseBool(item.Value, projectCfg.AutoBackup)
		case "project.backup_dir":
			if value := strings.TrimSpace(item.Value); value != "" {
				projectCfg.BackupDir = resolveRuntimeConfigPath(value)
			}
		case "project.auto_backup_interval_seconds":
			projectCfg.AutoBackupIntervalSeconds = parseInt(item.Value, projectCfg.AutoBackupIntervalSeconds)
		case "project.backup_remote_enabled":
			projectCfg.RemoteBackupEnabled = parseBool(item.Value, projectCfg.RemoteBackupEnabled)
		case "project.backup_remote_provider":
			projectCfg.RemoteBackupProvider = strings.TrimSpace(item.Value)
		case "project.backup_remote_bucket":
			projectCfg.RemoteBackupBucket = strings.TrimSpace(item.Value)
		case "project.backup_remote_prefix":
			if value := strings.TrimSpace(item.Value); value != "" {
				projectCfg.RemoteBackupPrefix = value
			}
		case "project.backup_remote_endpoint":
			projectCfg.RemoteBackupEndpoint = strings.TrimSpace(item.Value)
		case "project.backup_remote_region":
			projectCfg.RemoteBackupRegion = strings.TrimSpace(item.Value)
		case "project.resource_alert_enabled":
			projectCfg.ResourceAlertEnabled = parseBool(item.Value, projectCfg.ResourceAlertEnabled)
		case "project.resource_alert_cpu_percent":
			projectCfg.ResourceAlertCPUPercent = parseFloat64(item.Value, projectCfg.ResourceAlertCPUPercent)
		case "project.resource_alert_memory_percent":
			projectCfg.ResourceAlertMemoryPercent = parseFloat64(item.Value, projectCfg.ResourceAlertMemoryPercent)
		case "project.resource_alert_disk_bytes":
			projectCfg.ResourceAlertDiskBytes = parseInt64(item.Value, projectCfg.ResourceAlertDiskBytes)
		case "project.resource_alert_notification_enabled":
			projectCfg.ResourceAlertNotificationEnabled = parseBool(item.Value, projectCfg.ResourceAlertNotificationEnabled)
		case "project.resource_alert_notification_provider":
			projectCfg.ResourceAlertNotificationProvider = strings.TrimSpace(item.Value)
		case "project.resource_alert_enforcement_enabled":
			projectCfg.ResourceAlertEnforcementEnabled = parseBool(item.Value, projectCfg.ResourceAlertEnforcementEnabled)
		case "project.resource_alert_enforcement_mode":
			projectCfg.ResourceAlertEnforcementMode = strings.TrimSpace(item.Value)
		}
	}
}

func ApplyCapabilityRuntimeConfigItems(capabilityCfg *config.CapabilityConfig, configs []model.SystemConfig) {
	if capabilityCfg == nil {
		return
	}
	for _, item := range configs {
		switch item.Key {
		case "capability.enable_skill_provider":
			capabilityCfg.EnableSkillProvider = parseBool(item.Value, capabilityCfg.EnableSkillProvider)
		case "capability.enable_mcp_provider":
			capabilityCfg.EnableMCPProvider = parseBool(item.Value, capabilityCfg.EnableMCPProvider)
		case "capability.enable_skill_execution":
			capabilityCfg.EnableSkillExecution = parseBool(item.Value, capabilityCfg.EnableSkillExecution)
		case "capability.enable_mcp_execution":
			capabilityCfg.EnableMCPExecution = parseBool(item.Value, capabilityCfg.EnableMCPExecution)
		case "capability.skill_runner_mode":
			capabilityCfg.SkillRunnerMode = strings.TrimSpace(item.Value)
		case "capability.mcp_runner_mode":
			capabilityCfg.MCPRunnerMode = strings.TrimSpace(item.Value)
		case "capability.skill_runner_manifest":
			capabilityCfg.SkillRunnerManifest = strings.TrimSpace(item.Value)
		case "capability.mcp_runner_manifest":
			capabilityCfg.MCPRunnerManifest = strings.TrimSpace(item.Value)
		case "capability.skill_runner_endpoint":
			capabilityCfg.SkillRunnerEndpoint = strings.TrimSpace(item.Value)
		case "capability.mcp_runner_endpoint":
			capabilityCfg.MCPRunnerEndpoint = strings.TrimSpace(item.Value)
		case "capability.runner_timeout_seconds":
			capabilityCfg.RunnerTimeoutSeconds = parseInt(item.Value, capabilityCfg.RunnerTimeoutSeconds)
		case "capability.runner_network_enabled":
			capabilityCfg.NetworkEnabled = parseBool(item.Value, capabilityCfg.NetworkEnabled)
		case "capability.runner_network_allowlist":
			capabilityCfg.NetworkAllowlist = parseCSVValue(item.Value)
		case "capability.execution_policy_note":
			if value := strings.TrimSpace(item.Value); value != "" {
				capabilityCfg.ExecutionPolicyNote = value
			}
		}
	}
}

func resolveRuntimeConfigPath(value string) string {
	if value == "" || filepath.IsAbs(value) {
		return value
	}

	cwd, err := os.Getwd()
	if err != nil {
		return filepath.Clean(value)
	}

	base := cwd
	if filepath.Base(base) == "backend" {
		base = filepath.Dir(base)
	}

	return filepath.Clean(filepath.Join(base, value))
}

func parseBool(value string, fallback bool) bool {
	parsed, err := strconv.ParseBool(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return parsed
}

func parseInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return fallback
	}
	return parsed
}

func parseInt64(value string, fallback int64) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseFloat64(value string, fallback float64) float64 {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseCSVValue(value string) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return uniqueNonEmptyStrings(strings.Split(value, ","))
}

type aptMirrorCandidate struct {
	URL      string `json:"url"`
	Enabled  *bool  `json:"enabled,omitempty"`
	Priority int    `json:"priority,omitempty"`
}

func parseContainerAPTMirrorCandidates(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" {
		return nil
	}

	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err == nil {
		return uniqueNonEmptyStrings(values)
	}

	var items []aptMirrorCandidate
	if err := json.Unmarshal([]byte(raw), &items); err == nil {
		sort.SliceStable(items, func(i, j int) bool {
			return items[i].Priority < items[j].Priority
		})
		values = make([]string, 0, len(items))
		for _, item := range items {
			if item.Enabled != nil && !*item.Enabled {
				continue
			}
			if value := strings.TrimSpace(item.URL); value != "" {
				values = append(values, value)
			}
		}
		return uniqueNonEmptyStrings(values)
	}

	return nil
}

func uniqueNonEmptyStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	if len(result) == 0 {
		return nil
	}
	return result
}
