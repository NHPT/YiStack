package service

import (
	"testing"

	"yistack/internal/model"
)

func TestEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityDetectsMissingPayload(t *testing.T) {
	events := []model.EnterpriseProjectAccessGuardActivationAudit{
		{
			ID:                1,
			EventType:         string(EnterpriseProjectAccessGuardActivationAuditEventReadinessSnapshot),
			Status:            string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:       string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:        string(ProjectAccessGuardModeEnterpriseOwned),
			ReadinessSnapshot: "{}",
			Source:            "activation_audit_schema_readiness",
		},
	}

	issues, issueCount := buildEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityIssues(events)
	status := resolveEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityStatus(int64(len(events)), 5, issueCount)

	if status != EnterpriseProjectAccessGuardActivationAuditPayloadFailed {
		t.Fatalf("expected payload integrity failed, got %s", status)
	}
	if issueCount != 1 {
		t.Fatalf("expected one issue, got %d", issueCount)
	}
	if len(issues) != 1 {
		t.Fatalf("expected one returned issue, got %d", len(issues))
	}
	if issues[0].Source != EnterpriseProjectAccessGuardActivationAuditPayloadIssueReadinessSnapshot {
		t.Fatalf("expected readiness snapshot issue, got %s", issues[0].Source)
	}
}

func TestEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityReady(t *testing.T) {
	events := []model.EnterpriseProjectAccessGuardActivationAudit{
		{
			ID:                1,
			EventType:         string(EnterpriseProjectAccessGuardActivationAuditEventReadinessSnapshot),
			Status:            string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:       string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:        string(ProjectAccessGuardModeEnterpriseOwned),
			ReadinessSnapshot: `{"status":"ready_to_activate"}`,
			Source:            "activation_audit_schema_readiness",
		},
		{
			ID:              2,
			EventType:       string(EnterpriseProjectAccessGuardActivationAuditEventBlockerSnapshot),
			Status:          string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:     string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:      string(ProjectAccessGuardModeEnterpriseOwned),
			BlockerSnapshot: `{"blockers":[]}`,
			Source:          "activation_audit_schema_readiness",
		},
		{
			ID:             3,
			EventType:      string(EnterpriseProjectAccessGuardActivationAuditEventManualApproval),
			Status:         string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:    string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:     string(ProjectAccessGuardModeEnterpriseOwned),
			ReviewSnapshot: `{"approved":true}`,
			Source:         "activation_audit_schema_readiness",
		},
		{
			ID:              4,
			EventType:       string(EnterpriseProjectAccessGuardActivationAuditEventActivationExecution),
			Status:          string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:     string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:      string(ProjectAccessGuardModeEnterpriseOwned),
			ExecutionResult: `{"executed":true}`,
			Source:          "activation_audit_schema_readiness",
		},
		{
			ID:              5,
			EventType:       string(EnterpriseProjectAccessGuardActivationAuditEventPostActivationValidation),
			Status:          string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:     string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:      string(ProjectAccessGuardModeEnterpriseOwned),
			ExecutionResult: `{"validated":true}`,
			Source:          "activation_audit_schema_readiness",
		},
		{
			ID:                6,
			EventType:         string(EnterpriseProjectAccessGuardActivationAuditEventRollbackEvidence),
			Status:            string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:       string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:        string(ProjectAccessGuardModeEnterpriseOwned),
			ExecutionResult:   `{"rollback_ready":true}`,
			RollbackReference: "rollback-runbook-1",
			Source:            "activation_audit_schema_readiness",
		},
	}

	requiredItems, missingCount := buildEnterpriseProjectAccessGuardActivationAuditRequiredEventItems(events)
	issues, issueCount := buildEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityIssues(events)
	status := resolveEnterpriseProjectAccessGuardActivationAuditPayloadIntegrityStatus(int64(len(events)), missingCount, issueCount)

	if len(requiredItems) != enterpriseProjectAccessGuardActivationAuditRequiredEventTypeCount {
		t.Fatalf("expected %d required items, got %d", enterpriseProjectAccessGuardActivationAuditRequiredEventTypeCount, len(requiredItems))
	}
	if missingCount != 0 {
		t.Fatalf("expected no missing required event types, got %d", missingCount)
	}
	if issueCount != 0 {
		t.Fatalf("expected no payload issues, got %d: %#v", issueCount, issues)
	}
	if status != EnterpriseProjectAccessGuardActivationAuditPayloadReady {
		t.Fatalf("expected payload integrity ready, got %s", status)
	}
}

func TestEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityDetectsInvalidFields(t *testing.T) {
	events := []model.EnterpriseProjectAccessGuardActivationAudit{
		{
			ID:          7,
			EventType:   "unknown_event",
			Status:      "unknown_status",
			CurrentMode: "invalid_mode",
			TargetMode:  "",
			Source:      "",
		},
	}

	issues, issueCount := buildEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityIssues(events)
	status := resolveEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityStatus(int64(len(events)), issueCount)

	if status != EnterpriseProjectAccessGuardActivationAuditMetadataFailed {
		t.Fatalf("expected metadata integrity failed, got %s", status)
	}
	if issueCount != 5 {
		t.Fatalf("expected five metadata issues, got %d: %#v", issueCount, issues)
	}
	if len(issues) != 5 {
		t.Fatalf("expected five returned metadata issues, got %d", len(issues))
	}
	if issues[0].Source != EnterpriseProjectAccessGuardActivationAuditMetadataIssueEventType {
		t.Fatalf("expected event type issue first, got %s", issues[0].Source)
	}
}

func TestEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityReady(t *testing.T) {
	events := []model.EnterpriseProjectAccessGuardActivationAudit{
		{
			ID:          8,
			EventType:   string(EnterpriseProjectAccessGuardActivationAuditEventManualApproval),
			Status:      string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode: string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:  string(ProjectAccessGuardModeEnterpriseOwned),
			Source:      "activation_audit_schema_readiness",
		},
	}

	issues, issueCount := buildEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityIssues(events)
	status := resolveEnterpriseProjectAccessGuardActivationAuditMetadataIntegrityStatus(int64(len(events)), issueCount)

	if issueCount != 0 {
		t.Fatalf("expected no metadata issues, got %d: %#v", issueCount, issues)
	}
	if status != EnterpriseProjectAccessGuardActivationAuditMetadataReady {
		t.Fatalf("expected metadata integrity ready, got %s", status)
	}
}

func TestEnterpriseProjectAccessGuardActivationManualApprovalEvidenceMakesAuditPlanReady(t *testing.T) {
	events := []model.EnterpriseProjectAccessGuardActivationAudit{
		{
			ID:                9,
			EventType:         string(EnterpriseProjectAccessGuardActivationAuditEventManualApproval),
			Status:            string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			ReadinessStatus:   string(ProjectAccessGuardEnterpriseActivationReadinessReady),
			CurrentMode:       string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:        string(ProjectAccessGuardModeEnterpriseOwned),
			ReadinessSnapshot: `{"status":"ready_to_activate"}`,
			BlockerSnapshot:   `{"blockers":[]}`,
			ReviewSnapshot:    `{"approved":true}`,
			AuditPlanSnapshot: `{"manual_approval":"recorded"}`,
			Source:            "admin_enterprise_project_access_guard_activation_manual_approval",
		},
	}
	if !hasEnterpriseProjectAccessGuardActivationManualApprovalEvidence(events) {
		t.Fatalf("expected manual approval evidence to be detected")
	}
	evidence := readEnterpriseProjectAccessGuardActivationAuditPlanEvidence(events)
	if !evidence.ManualApproval {
		t.Fatalf("expected manual approval audit plan evidence")
	}

	item := materializeEnterpriseProjectAccessGuardActivationAuditPlanItem(ProjectAccessGuardEnterpriseActivationAuditPlanItem{
		Source:   ProjectAccessGuardEnterpriseActivationAuditManualApproval,
		Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
		Message:  "manual approval required",
		Recovery: "record manual approval",
	}, evidence)
	if item.Status != ProjectAccessGuardEnterpriseActivationAuditEvidenceReady {
		t.Fatalf("expected manual approval audit plan evidence ready, got %s", item.Status)
	}
}

func TestEnterpriseProjectAccessGuardActivationExecutionEvidenceMakesAuditPlanReady(t *testing.T) {
	events := []model.EnterpriseProjectAccessGuardActivationAudit{
		{
			ID:              10,
			EventType:       string(EnterpriseProjectAccessGuardActivationAuditEventActivationExecution),
			Status:          string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:     string(ProjectAccessGuardModeLegacyUserOwned),
			TargetMode:      string(ProjectAccessGuardModeEnterpriseOwned),
			ExecutionResult: `{"executed":true}`,
			Source:          "admin_enterprise_project_access_guard_activation_execution",
		},
		{
			ID:              11,
			EventType:       string(EnterpriseProjectAccessGuardActivationAuditEventPostActivationValidation),
			Status:          string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:     string(ProjectAccessGuardModeEnterpriseOwned),
			TargetMode:      string(ProjectAccessGuardModeEnterpriseOwned),
			ExecutionResult: `{"validated":true}`,
			Source:          "admin_enterprise_project_access_guard_post_activation_validation",
		},
		{
			ID:                12,
			EventType:         string(EnterpriseProjectAccessGuardActivationAuditEventRollbackEvidence),
			Status:            string(EnterpriseProjectAccessGuardActivationAuditEventRecorded),
			CurrentMode:       string(ProjectAccessGuardModeEnterpriseOwned),
			TargetMode:        string(ProjectAccessGuardModeLegacyUserOwned),
			ExecutionResult:   `{"rollback_ready":true}`,
			RollbackReference: "rollback-runbook-1",
			Source:            "admin_enterprise_project_access_guard_rollback_evidence",
		},
	}
	evidence := readEnterpriseProjectAccessGuardActivationAuditPlanEvidence(events)
	if !evidence.ActivationExecution || !evidence.PostActivationValidation || !evidence.RollbackEvidence {
		t.Fatalf("expected execution, post-validation and rollback evidence, got %#v", evidence)
	}

	executionItem := materializeEnterpriseProjectAccessGuardActivationAuditPlanItem(ProjectAccessGuardEnterpriseActivationAuditPlanItem{
		Source:   ProjectAccessGuardEnterpriseActivationAuditActivationExecution,
		Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
		Message:  "execution required",
		Recovery: "record execution",
	}, evidence)
	if executionItem.Status != ProjectAccessGuardEnterpriseActivationAuditEvidenceReady {
		t.Fatalf("expected execution audit plan evidence ready, got %s", executionItem.Status)
	}

	postValidationItem := materializeEnterpriseProjectAccessGuardActivationAuditPlanItem(ProjectAccessGuardEnterpriseActivationAuditPlanItem{
		Source:   ProjectAccessGuardEnterpriseActivationAuditPostActivationValidate,
		Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
		Message:  "post validation required",
		Recovery: "record post validation",
	}, evidence)
	if postValidationItem.Status != ProjectAccessGuardEnterpriseActivationAuditEvidenceReady {
		t.Fatalf("expected post-validation audit plan evidence ready, got %s", postValidationItem.Status)
	}

	rollbackItem := materializeEnterpriseProjectAccessGuardActivationAuditPlanItem(ProjectAccessGuardEnterpriseActivationAuditPlanItem{
		Source:   ProjectAccessGuardEnterpriseActivationAuditRollbackEvidence,
		Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
		Message:  "rollback required",
		Recovery: "record rollback",
	}, evidence)
	if rollbackItem.Status != ProjectAccessGuardEnterpriseActivationAuditEvidenceReady {
		t.Fatalf("expected rollback audit plan evidence ready, got %s", rollbackItem.Status)
	}
}
