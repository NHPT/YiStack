package service

import (
	"context"
	"errors"
	"testing"

	"yistack/internal/model"
)

func TestAuthorizeProjectAccessUsesLegacyUserOwnedGuard(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), " user-1 ", " project-1 ")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected granted decision, got %s", decision.Status)
	}
	if decision.Mode != ProjectAccessGuardModeLegacyUserOwned {
		t.Fatalf("expected legacy mode, got %s", decision.Mode)
	}
	if !decision.HasProjectAccess() {
		t.Fatalf("expected granted decision to expose project access")
	}
	if decision.Project == nil || decision.Project.ID != "record-1" {
		t.Fatalf("expected project record-1, got %#v", decision.Project)
	}
}

func TestAuthorizeProjectAccessAttachesEnterpriseOwnershipShadow(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	ownershipRepo := &stubProjectAccessOwnershipRepo{
		ownership: &model.EnterpriseProjectOwnership{
			ProjectID:      "project-1",
			OrganizationID: "organization-1",
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: repo, OwnershipRepo: ownershipRepo})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseOwnershipShadowStatus != ProjectAccessEnterpriseOwnershipShadowMappingReady {
		t.Fatalf("expected mapping_ready shadow, got %s", decision.EnterpriseOwnershipShadowStatus)
	}
	if decision.EnterpriseOwnership == nil || decision.EnterpriseOwnership.OrganizationID != "organization-1" {
		t.Fatalf("expected enterprise ownership shadow, got %#v", decision.EnterpriseOwnership)
	}
	if ownershipRepo.requestedProjectID != "project-1" {
		t.Fatalf("expected lookup by project business id, got %q", ownershipRepo.requestedProjectID)
	}
}

func TestAuthorizeProjectAccessDoesNotAuthorizeFromEnterpriseOwnershipShadow(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	ownershipRepo := &stubProjectAccessOwnershipRepo{
		ownership: &model.EnterpriseProjectOwnership{
			ProjectID:      "project-1",
			OrganizationID: "organization-1",
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: repo, OwnershipRepo: ownershipRepo})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-2", "project-1")

	if decision.Status != ProjectAccessDecisionForbidden {
		t.Fatalf("expected forbidden decision, got %s", decision.Status)
	}
	if decision.EnterpriseOwnershipShadowStatus != ProjectAccessEnterpriseOwnershipShadowMappingReady {
		t.Fatalf("expected mapping_ready shadow for evidence only, got %s", decision.EnterpriseOwnershipShadowStatus)
	}
	if decision.HasProjectAccess() {
		t.Fatalf("enterprise ownership shadow must not grant project access")
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunAlignsLegacyOwnerWithMembership(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	ownershipRepo := &stubProjectAccessOwnershipRepo{
		ownership: &model.EnterpriseProjectOwnership{
			ProjectID:      "project-1",
			OrganizationID: "organization-1",
		},
		members: []model.EnterpriseMember{
			{OrganizationID: "organization-1", UserID: "user-1", Status: "active"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: repo, OwnershipRepo: ownershipRepo})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected legacy granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunMembershipReady {
		t.Fatalf("expected membership_ready dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionGranted {
		t.Fatalf("expected enterprise dry-run granted, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftAligned {
		t.Fatalf("expected aligned drift status, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
	if !decision.HasEnterpriseAuthorizationDryRun() {
		t.Fatalf("expected dry-run evidence")
	}
	if ownershipRepo.requestedMemberUserID != "user-1" || ownershipRepo.requestedMemberOrganizationID != "organization-1" {
		t.Fatalf("unexpected member lookup: user=%q organization=%q", ownershipRepo.requestedMemberUserID, ownershipRepo.requestedMemberOrganizationID)
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunDetectsLegacyGrantedEnterpriseBlocked(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
			},
		},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected legacy granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunNoMembership {
		t.Fatalf("expected no_active_membership dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionForbidden {
		t.Fatalf("expected enterprise dry-run forbidden, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked {
		t.Fatalf("expected legacy granted drift, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
	if !decision.HasProjectAccess() {
		t.Fatalf("enterprise dry-run drift must not change legacy access")
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunDetectsLegacyBlockedEnterpriseGranted(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-2", Status: "active"},
			},
		},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-2", "project-1")

	if decision.Status != ProjectAccessDecisionForbidden {
		t.Fatalf("expected legacy forbidden decision, got %s", decision.Status)
	}
	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunMembershipReady {
		t.Fatalf("expected membership_ready dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionGranted {
		t.Fatalf("expected enterprise dry-run granted, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftLegacyBlockedEnterpriseGranted {
		t.Fatalf("expected legacy blocked drift, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
	if decision.HasProjectAccess() {
		t.Fatalf("enterprise dry-run must not grant legacy access")
	}
}

func TestAuthorizeProjectAccessEnterpriseOwnedGrantsActiveEnterpriseMember(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "legacy-owner"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "enterprise-member", Status: "active"},
			},
		},
		SystemConfigSvc: NewSystemConfigService(&stubSystemConfigRepo{values: map[string]string{
			projectAccessGuardModeSystemConfigKey: string(ProjectAccessGuardModeEnterpriseOwned),
		}}),
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "enterprise-member", "project-1")

	if decision.Mode != ProjectAccessGuardModeEnterpriseOwned {
		t.Fatalf("expected enterprise mode, got %s", decision.Mode)
	}
	if decision.Status != ProjectAccessDecisionGranted || !decision.HasProjectAccess() {
		t.Fatalf("expected enterprise member to be granted, got %#v", decision)
	}
}

func TestAuthorizeProjectAccessEnterpriseOwnedRejectsLegacyOwnerWithoutMembership(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "legacy-owner"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
			},
		},
		SystemConfigSvc: NewSystemConfigService(&stubSystemConfigRepo{values: map[string]string{
			projectAccessGuardModeSystemConfigKey: string(ProjectAccessGuardModeEnterpriseOwned),
		}}),
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "legacy-owner", "project-1")

	if decision.Mode != ProjectAccessGuardModeEnterpriseOwned {
		t.Fatalf("expected enterprise mode, got %s", decision.Mode)
	}
	if decision.Status != ProjectAccessDecisionForbidden || decision.HasProjectAccess() {
		t.Fatalf("expected legacy owner without enterprise membership to be forbidden, got %#v", decision)
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunHandlesMembershipLookupFailure(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
			},
			memberErr: errors.New("member lookup failed"),
		},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected legacy granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunMembershipFailed {
		t.Fatalf("expected membership_lookup_failed dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionServiceUnavailable {
		t.Fatalf("expected enterprise dry-run service unavailable, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable {
		t.Fatalf("expected enterprise_unavailable drift, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
	if !decision.HasProjectAccess() {
		t.Fatalf("membership lookup failure must not change legacy access")
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunHandlesMissingMapping(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:   repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected legacy granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunNoMapping {
		t.Fatalf("expected no_mapping dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionForbidden {
		t.Fatalf("expected enterprise dry-run forbidden, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked {
		t.Fatalf("expected legacy granted drift, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
	if !decision.HasProjectAccess() {
		t.Fatalf("missing enterprise mapping must not change legacy access")
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunRejectsInactiveMembership(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", Status: "inactive"},
			},
		},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected legacy granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunNoMembership {
		t.Fatalf("expected no_active_membership dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionForbidden {
		t.Fatalf("expected enterprise dry-run forbidden, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked {
		t.Fatalf("expected legacy granted drift, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
}

func TestAuthorizeProjectAccessEnterpriseDryRunHonorsTeamScopedMembership(t *testing.T) {
	requiredTeamID := "team-1"
	otherTeamID := "team-2"
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
				TeamID:         &requiredTeamID,
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", TeamID: &otherTeamID, Status: "active"},
			},
		},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunNoMembership {
		t.Fatalf("expected team mismatch to block dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionForbidden {
		t.Fatalf("expected enterprise dry-run forbidden, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}

	projectSvc = NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownership: &model.EnterpriseProjectOwnership{
				ProjectID:      "record-1",
				OrganizationID: "organization-1",
				TeamID:         &requiredTeamID,
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", Status: "active"},
			},
		},
	})

	decision = projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunMembershipReady {
		t.Fatalf("expected organization-level membership to satisfy team-owned project dry-run, got %s", decision.EnterpriseAuthorizationDryRunStatus)
	}
	if decision.EnterpriseAuthorizationDryRunDecision != ProjectAccessDecisionGranted {
		t.Fatalf("expected enterprise dry-run granted, got %s", decision.EnterpriseAuthorizationDryRunDecision)
	}
	if decision.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftAligned {
		t.Fatalf("expected aligned drift, got %s", decision.EnterpriseAuthorizationDriftStatus)
	}
}

func TestProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceAligned(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
			{ID: "record-2", ProjectID: "project-2", Name: "Project 2", UserID: "user-2"},
		},
		total: 2,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
				{ProjectID: "project-2", OrganizationID: "organization-1"},
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", Status: "active"},
				{OrganizationID: "organization-1", UserID: "user-2", Status: "active"},
			},
		},
	})

	evidence, err := projectSvc.GetProjectAccessGuardEnterpriseAuthorizationDryRunEvidence(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if evidence.Status != ProjectAccessGuardEnterpriseAuthorizationDryRunAligned {
		t.Fatalf("expected dry_run_aligned, got %s", evidence.Status)
	}
	if evidence.ProjectCount != 2 || evidence.ComparedProjectCount != 2 || evidence.AlignedProjectCount != 2 {
		t.Fatalf("unexpected aligned evidence counts: %#v", evidence)
	}
	if evidence.EnterpriseAuthorizationActive {
		t.Fatalf("dry-run evidence must not activate enterprise authorization")
	}
	if len(evidence.DriftCandidates) != 0 {
		t.Fatalf("expected no drift candidates, got %#v", evidence.DriftCandidates)
	}
}

func TestProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceDetectsDrift(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
		},
		total: 1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
			},
		},
	})

	evidence, err := projectSvc.GetProjectAccessGuardEnterpriseAuthorizationDryRunEvidence(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if evidence.Status != ProjectAccessGuardEnterpriseAuthorizationDryRunDriftDetected {
		t.Fatalf("expected drift_detected, got %s", evidence.Status)
	}
	if evidence.LegacyGrantedEnterpriseBlockedCount != 1 {
		t.Fatalf("expected one legacy granted enterprise blocked project, got %#v", evidence)
	}
	if len(evidence.DriftCandidates) != 1 {
		t.Fatalf("expected one drift candidate, got %#v", evidence.DriftCandidates)
	}
	candidate := evidence.DriftCandidates[0]
	if candidate.ProjectRecordID != "record-1" || candidate.ProjectID != "project-1" || candidate.OwnerUserID != "user-1" {
		t.Fatalf("unexpected drift candidate identity: %#v", candidate)
	}
	if candidate.DriftStatus != ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked {
		t.Fatalf("expected legacy granted drift, got %s", candidate.DriftStatus)
	}
	if candidate.DryRunDecision != ProjectAccessDecisionForbidden {
		t.Fatalf("expected enterprise dry-run forbidden, got %s", candidate.DryRunDecision)
	}
}

func TestProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceHandlesEnterpriseUnavailable(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
		},
		total: 1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
			},
			memberErr: errors.New("member lookup failed"),
		},
	})

	evidence, err := projectSvc.GetProjectAccessGuardEnterpriseAuthorizationDryRunEvidence(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if evidence.Status != ProjectAccessGuardEnterpriseAuthorizationDryRunEnterpriseUnavailable {
		t.Fatalf("expected enterprise_unavailable, got %s", evidence.Status)
	}
	if evidence.EnterpriseUnavailableProjectCount != 1 {
		t.Fatalf("expected one enterprise unavailable project, got %#v", evidence)
	}
	if len(evidence.DriftCandidates) != 1 {
		t.Fatalf("expected one unavailable candidate, got %#v", evidence.DriftCandidates)
	}
	if evidence.DriftCandidates[0].DryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunMembershipFailed {
		t.Fatalf("expected membership lookup failed, got %s", evidence.DriftCandidates[0].DryRunStatus)
	}
}

func TestProjectAccessGuardEnterpriseActivationReadinessReady(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
			{ID: "record-2", ProjectID: "project-2", Name: "Project 2", UserID: "user-2"},
		},
		total: 2,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
				{ProjectID: "project-2", OrganizationID: "organization-1"},
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", Status: "active"},
				{OrganizationID: "organization-1", UserID: "user-2", Status: "active"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseActivationReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseActivationReadinessReady {
		t.Fatalf("expected ready_to_activate, got %s", readiness.Status)
	}
	if !readiness.HasEnterpriseActivationReadiness() {
		t.Fatalf("expected explicit enterprise activation readiness")
	}
	if readiness.SwitchStatus != ProjectAccessGuardEnterpriseSwitchReady {
		t.Fatalf("expected enterprise switch ready, got %s", readiness.SwitchStatus)
	}
	if readiness.AuthorizationDryRunStatus != ProjectAccessGuardEnterpriseAuthorizationDryRunAligned {
		t.Fatalf("expected dry-run aligned, got %s", readiness.AuthorizationDryRunStatus)
	}
	if readiness.ProjectCount != 2 || readiness.MappedProjectCount != 2 || readiness.ComparedProjectCount != 2 || readiness.AlignedProjectCount != 2 {
		t.Fatalf("unexpected activation readiness counts: %#v", readiness)
	}
	if len(readiness.BlockerCandidates) != 0 {
		t.Fatalf("ready activation readiness should not expose blockers: %#v", readiness.BlockerCandidates)
	}
	if len(readiness.ReviewItems) != 7 {
		t.Fatalf("expected seven activation review items, got %#v", readiness.ReviewItems)
	}
	if countActivationReviewItems(readiness.ReviewItems, ProjectAccessGuardEnterpriseActivationReviewBlocked) != 0 {
		t.Fatalf("ready activation readiness should not expose blocked review items: %#v", readiness.ReviewItems)
	}
	if countActivationReviewItems(readiness.ReviewItems, ProjectAccessGuardEnterpriseActivationReviewManualRequired) != 3 {
		t.Fatalf("expected three manual review boundaries, got %#v", readiness.ReviewItems)
	}
	if len(readiness.AuditPlanItems) != 6 {
		t.Fatalf("expected six activation audit plan items, got %#v", readiness.AuditPlanItems)
	}
	if countActivationAuditPlanItems(readiness.AuditPlanItems, ProjectAccessGuardEnterpriseActivationAuditEvidenceReady) != 2 {
		t.Fatalf("expected two evidence-ready audit plan items, got %#v", readiness.AuditPlanItems)
	}
	if countActivationAuditPlanItems(readiness.AuditPlanItems, ProjectAccessGuardEnterpriseActivationAuditManualRequired) != 4 {
		t.Fatalf("expected four manual-required audit plan items, got %#v", readiness.AuditPlanItems)
	}
	if readiness.EnterpriseAuthorizationActive {
		t.Fatalf("activation readiness must not activate enterprise authorization")
	}
}

func TestProjectAccessGuardEnterpriseActivationReadinessBlocksSwitchNotReady(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
			{ID: "record-2", ProjectID: "project-2", Name: "Project 2", UserID: "user-2"},
		},
		total: 2,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", Status: "active"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseActivationReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseActivationReadinessSwitchNotReady {
		t.Fatalf("expected switch_not_ready, got %s", readiness.Status)
	}
	if readiness.HasEnterpriseActivationReadiness() {
		t.Fatalf("unmapped projects must block activation readiness")
	}
	if readiness.UnmappedProjectCount != 1 {
		t.Fatalf("expected one unmapped project, got %#v", readiness)
	}
	if len(readiness.BlockerCandidates) != 1 {
		t.Fatalf("expected one activation blocker candidate, got %#v", readiness.BlockerCandidates)
	}
	if readiness.BlockerCandidates[0].Source != ProjectAccessGuardEnterpriseActivationBlockerSwitchUnmappedProject {
		t.Fatalf("expected unmapped project blocker, got %#v", readiness.BlockerCandidates[0])
	}
	if readiness.BlockerCandidates[0].ProjectRecordID != "record-2" {
		t.Fatalf("expected record-2 blocker, got %#v", readiness.BlockerCandidates[0])
	}
	if countActivationReviewItems(readiness.ReviewItems, ProjectAccessGuardEnterpriseActivationReviewBlocked) == 0 {
		t.Fatalf("switch_not_ready activation readiness should expose blocked review items: %#v", readiness.ReviewItems)
	}
	if countActivationAuditPlanItems(readiness.AuditPlanItems, ProjectAccessGuardEnterpriseActivationAuditBlocked) == 0 {
		t.Fatalf("switch_not_ready activation readiness should expose blocked audit plan items: %#v", readiness.AuditPlanItems)
	}
}

func TestProjectAccessGuardEnterpriseActivationReadinessBlocksDryRunDrift(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
		},
		total: 1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseActivationReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseActivationReadinessDriftDetected {
		t.Fatalf("expected drift_detected, got %s", readiness.Status)
	}
	if readiness.HasEnterpriseActivationReadiness() {
		t.Fatalf("dry-run drift must block activation readiness")
	}
	if readiness.AuthorizationDriftCount != 1 {
		t.Fatalf("expected one authorization drift, got %#v", readiness)
	}
	if readiness.AuthorizationDryRunStatus != ProjectAccessGuardEnterpriseAuthorizationDryRunDriftDetected {
		t.Fatalf("expected dry-run drift status, got %s", readiness.AuthorizationDryRunStatus)
	}
	if len(readiness.BlockerCandidates) != 1 {
		t.Fatalf("expected one dry-run blocker, got %#v", readiness.BlockerCandidates)
	}
	if readiness.BlockerCandidates[0].Source != ProjectAccessGuardEnterpriseActivationBlockerDryRunAuthorizationDrift {
		t.Fatalf("expected dry-run authorization drift blocker, got %#v", readiness.BlockerCandidates[0])
	}
	if readiness.BlockerCandidates[0].DriftStatus != ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked {
		t.Fatalf("expected legacy granted enterprise blocked drift, got %#v", readiness.BlockerCandidates[0])
	}
	if countActivationReviewItems(readiness.ReviewItems, ProjectAccessGuardEnterpriseActivationReviewBlocked) == 0 {
		t.Fatalf("dry-run drift activation readiness should expose blocked review items: %#v", readiness.ReviewItems)
	}
}

func TestProjectAccessGuardEnterpriseActivationReadinessExposesExtraOwnershipBlocker(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", Name: "Project 1", UserID: "user-1"},
		},
		total: 1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
				{ProjectID: "missing-project", OrganizationID: "organization-1"},
			},
			members: []model.EnterpriseMember{
				{OrganizationID: "organization-1", UserID: "user-1", Status: "active"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseActivationReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseActivationReadinessSwitchNotReady {
		t.Fatalf("expected switch_not_ready, got %s", readiness.Status)
	}
	if len(readiness.BlockerCandidates) != 1 {
		t.Fatalf("expected one extra ownership blocker, got %#v", readiness.BlockerCandidates)
	}
	if readiness.BlockerCandidates[0].Source != ProjectAccessGuardEnterpriseActivationBlockerSwitchExtraOwnership {
		t.Fatalf("expected extra ownership blocker, got %#v", readiness.BlockerCandidates[0])
	}
	if readiness.BlockerCandidates[0].ProjectID != "missing-project" {
		t.Fatalf("expected missing-project blocker, got %#v", readiness.BlockerCandidates[0])
	}
}

func countActivationReviewItems(items []ProjectAccessGuardEnterpriseActivationReviewItem, status ProjectAccessGuardEnterpriseActivationReviewItemStatus) int {
	count := 0
	for _, item := range items {
		if item.Status == status {
			count++
		}
	}
	return count
}

func countActivationAuditPlanItems(items []ProjectAccessGuardEnterpriseActivationAuditPlanItem, status ProjectAccessGuardEnterpriseActivationAuditPlanItemStatus) int {
	count := 0
	for _, item := range items {
		if item.Status == status {
			count++
		}
	}
	return count
}

func TestAuthorizeProjectAccessHandlesMissingEnterpriseOwnershipShadow(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:   repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseOwnershipShadowStatus != ProjectAccessEnterpriseOwnershipShadowNoMapping {
		t.Fatalf("expected no_mapping shadow, got %s", decision.EnterpriseOwnershipShadowStatus)
	}
}

func TestAuthorizeProjectAccessHandlesEnterpriseOwnershipShadowLookupFailure(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo:   repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{err: errors.New("ownership lookup failed")},
	})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionGranted {
		t.Fatalf("expected granted decision, got %s", decision.Status)
	}
	if decision.EnterpriseOwnershipShadowStatus != ProjectAccessEnterpriseOwnershipShadowLookupFailed {
		t.Fatalf("expected lookup_failed shadow, got %s", decision.EnterpriseOwnershipShadowStatus)
	}
}

func TestAuthorizeProjectAccessRejectsNonOwner(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
	}
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: repo})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-2", "project-1")

	if decision.Status != ProjectAccessDecisionForbidden {
		t.Fatalf("expected forbidden decision, got %s", decision.Status)
	}
	if decision.HasProjectAccess() {
		t.Fatalf("forbidden decision must not expose project access")
	}
}

func TestAuthorizeProjectAccessHandlesMissingProject(t *testing.T) {
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: &stubProjectListRepo{}})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "missing-project")

	if decision.Status != ProjectAccessDecisionProjectNotFound {
		t.Fatalf("expected project_not_found decision, got %s", decision.Status)
	}
	if decision.HasProjectAccess() {
		t.Fatalf("missing project decision must not expose project access")
	}
}

func TestAuthorizeProjectAccessTreatsRepositoryFailureAsUnavailable(t *testing.T) {
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: &stubProjectListRepo{
		findByProjectIDErr: errors.New("failed to read response: context deadline exceeded"),
	}})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionServiceUnavailable {
		t.Fatalf("expected service_unavailable decision, got %s", decision.Status)
	}
	if decision.HasProjectAccess() {
		t.Fatal("repository failure must not expose project access")
	}
}

func TestAuthorizeProjectAccessHandlesUnavailableService(t *testing.T) {
	var projectSvc *ProjectService

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), "user-1", "project-1")

	if decision.Status != ProjectAccessDecisionServiceUnavailable {
		t.Fatalf("expected service_unavailable decision, got %s", decision.Status)
	}
}

func TestAuthorizeProjectAccessRequiresUserID(t *testing.T) {
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: &stubProjectListRepo{}})

	decision := projectSvc.AuthorizeProjectAccess(context.Background(), " ", "project-1")

	if decision.Status != ProjectAccessDecisionUnauthenticated {
		t.Fatalf("expected unauthenticated decision, got %s", decision.Status)
	}
}

func TestProjectAccessGuardEnterpriseSwitchReadinessReady(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
			{ID: "record-2", ProjectID: "project-2", UserID: "user-2"},
		},
		total: 2,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
				{ProjectID: "project-2", OrganizationID: "organization-1"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseSwitchReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseSwitchReady {
		t.Fatalf("expected enterprise_switch_ready, got %s", readiness.Status)
	}
	if !readiness.HasEnterpriseSwitchReadiness() {
		t.Fatalf("expected explicit enterprise switch readiness")
	}
	if readiness.CurrentMode != ProjectAccessGuardModeLegacyUserOwned {
		t.Fatalf("expected current legacy mode, got %s", readiness.CurrentMode)
	}
	if readiness.TargetMode != ProjectAccessGuardModeEnterpriseOwned {
		t.Fatalf("expected enterprise target mode, got %s", readiness.TargetMode)
	}
	if readiness.EnterpriseAuthorizationActive {
		t.Fatalf("readiness must not activate enterprise authorization")
	}
	if readiness.ProjectCount != 2 || readiness.MappedProjectCount != 2 || readiness.UnmappedProjectCount != 0 || readiness.ExtraOwnershipCount != 0 {
		t.Fatalf("unexpected readiness counts: %#v", readiness)
	}
}

func TestProjectAccessGuardEnterpriseSwitchReadinessAlreadyActiveDoesNotExposeSwitchGate(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
		total: 1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
			},
		},
		SystemConfigSvc: NewSystemConfigService(&stubSystemConfigRepo{values: map[string]string{
			projectAccessGuardModeSystemConfigKey: string(ProjectAccessGuardModeEnterpriseOwned),
		}}),
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseSwitchReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseSwitchReady {
		t.Fatalf("expected enterprise_switch_ready evidence, got %s", readiness.Status)
	}
	if readiness.CurrentMode != ProjectAccessGuardModeEnterpriseOwned {
		t.Fatalf("expected current enterprise mode, got %s", readiness.CurrentMode)
	}
	if !readiness.EnterpriseAuthorizationActive {
		t.Fatalf("expected enterprise authorization to be active")
	}
	if readiness.CanSwitchToEnterpriseOwned {
		t.Fatalf("already active mode must not expose switch gate")
	}
	if readiness.HasEnterpriseSwitchReadiness() {
		t.Fatalf("already active mode must not satisfy switch readiness")
	}
}

func TestProjectAccessGuardEnterpriseSwitchReadinessBlocksUnmappedProjects(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
			{ID: "record-2", ProjectID: "project-2", UserID: "user-2"},
		},
		total: 2,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseSwitchReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseSwitchUnmappedProjects {
		t.Fatalf("expected unmapped_projects, got %s", readiness.Status)
	}
	if readiness.HasEnterpriseSwitchReadiness() {
		t.Fatalf("unmapped projects must block enterprise switch readiness")
	}
	if readiness.MappedProjectCount != 1 || readiness.UnmappedProjectCount != 1 {
		t.Fatalf("unexpected readiness counts: %#v", readiness)
	}
}

func TestProjectAccessGuardEnterpriseSwitchReadinessBlocksEvidenceDrift(t *testing.T) {
	repo := &stubProjectListRepo{
		projects: []model.Project{
			{ID: "record-1", ProjectID: "project-1", UserID: "user-1"},
		},
		total: 1,
	}
	projectSvc := NewProjectService(ProjectServiceOptions{
		ProjectRepo: repo,
		OwnershipRepo: &stubProjectAccessOwnershipRepo{
			ownerships: []model.EnterpriseProjectOwnership{
				{ProjectID: "project-1", OrganizationID: "organization-1"},
				{ProjectID: "missing-project", OrganizationID: "organization-1"},
			},
		},
	})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseSwitchReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseSwitchEvidenceDrift {
		t.Fatalf("expected mapping_evidence_drift, got %s", readiness.Status)
	}
	if readiness.HasEnterpriseSwitchReadiness() {
		t.Fatalf("evidence drift must block enterprise switch readiness")
	}
	if readiness.ExtraOwnershipCount != 1 {
		t.Fatalf("expected one extra ownership, got %d", readiness.ExtraOwnershipCount)
	}
}

func TestProjectAccessGuardEnterpriseSwitchReadinessHandlesUnavailableOwnershipRepo(t *testing.T) {
	projectSvc := NewProjectService(ProjectServiceOptions{ProjectRepo: &stubProjectListRepo{}})

	readiness, err := projectSvc.GetProjectAccessGuardEnterpriseSwitchReadiness(context.Background())

	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if readiness.Status != ProjectAccessGuardEnterpriseSwitchOwnershipRepoUnavailable {
		t.Fatalf("expected ownership_repo_unavailable, got %s", readiness.Status)
	}
	if readiness.OwnershipLookupAvailable {
		t.Fatalf("expected ownership lookup to be unavailable")
	}
	if readiness.HasEnterpriseSwitchReadiness() {
		t.Fatalf("unavailable ownership repo must block enterprise switch readiness")
	}
}

type stubProjectAccessOwnershipRepo struct {
	ownership                     *model.EnterpriseProjectOwnership
	ownerships                    []model.EnterpriseProjectOwnership
	members                       []model.EnterpriseMember
	err                           error
	memberErr                     error
	requestedProjectID            string
	requestedMemberUserID         string
	requestedMemberOrganizationID string
}

func (r *stubProjectAccessOwnershipRepo) FindEnterpriseProjectOwnershipByProjectID(_ context.Context, projectID string) (*model.EnterpriseProjectOwnership, error) {
	r.requestedProjectID = projectID
	if r.err != nil {
		return nil, r.err
	}
	for i := range r.ownerships {
		if r.ownerships[i].ProjectID == projectID {
			return &r.ownerships[i], nil
		}
	}
	return r.ownership, nil
}

func (r *stubProjectAccessOwnershipRepo) ListEnterpriseProjectOwnerships(context.Context) ([]model.EnterpriseProjectOwnership, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.ownerships, nil
}

func (r *stubProjectAccessOwnershipRepo) FindEnterpriseMembersByUserAndOrganizationID(_ context.Context, userID, organizationID string) ([]model.EnterpriseMember, error) {
	r.requestedMemberUserID = userID
	r.requestedMemberOrganizationID = organizationID
	if r.memberErr != nil {
		return nil, r.memberErr
	}
	result := make([]model.EnterpriseMember, 0, len(r.members))
	for _, member := range r.members {
		if member.UserID == userID && member.OrganizationID == organizationID {
			result = append(result, member)
		}
	}
	return result, nil
}
