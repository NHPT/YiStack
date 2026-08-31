package service

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"yistack/internal/model"
)

const projectAccessGuardEnterpriseSwitchReadinessProjectPageSize = 100
const projectAccessGuardEnterpriseAuthorizationDryRunProjectPageSize = 100
const projectAccessGuardEnterpriseAuthorizationDryRunDriftPreviewLimit = 50
const projectAccessGuardEnterpriseActivationBlockerPreviewLimit = 50
const projectAccessGuardModeSystemConfigKey = "enterprise.project_access_guard.mode"

type ProjectAccessGuardMode string
type ProjectAccessDecisionStatus string
type ProjectAccessEnterpriseOwnershipShadowStatus string
type ProjectAccessGuardEnterpriseSwitchReadinessStatus string
type ProjectAccessEnterpriseAuthorizationDryRunStatus string
type ProjectAccessEnterpriseAuthorizationDriftStatus string
type ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus string
type ProjectAccessGuardEnterpriseActivationReadinessStatus string
type ProjectAccessGuardEnterpriseActivationBlockerSource string
type ProjectAccessGuardEnterpriseActivationReviewItemSource string
type ProjectAccessGuardEnterpriseActivationReviewItemStatus string
type ProjectAccessGuardEnterpriseActivationAuditPlanItemSource string
type ProjectAccessGuardEnterpriseActivationAuditPlanItemStatus string

const (
	ProjectAccessGuardModeLegacyUserOwned ProjectAccessGuardMode = "legacy_user_owned"
	ProjectAccessGuardModeEnterpriseOwned ProjectAccessGuardMode = "enterprise_owned"

	ProjectAccessDecisionGranted            ProjectAccessDecisionStatus = "granted"
	ProjectAccessDecisionUnauthenticated    ProjectAccessDecisionStatus = "unauthenticated"
	ProjectAccessDecisionProjectNotFound    ProjectAccessDecisionStatus = "project_not_found"
	ProjectAccessDecisionForbidden          ProjectAccessDecisionStatus = "forbidden"
	ProjectAccessDecisionServiceUnavailable ProjectAccessDecisionStatus = "service_unavailable"

	ProjectAccessEnterpriseOwnershipShadowUnavailable  ProjectAccessEnterpriseOwnershipShadowStatus = "unavailable"
	ProjectAccessEnterpriseOwnershipShadowNoMapping    ProjectAccessEnterpriseOwnershipShadowStatus = "no_mapping"
	ProjectAccessEnterpriseOwnershipShadowMappingReady ProjectAccessEnterpriseOwnershipShadowStatus = "mapping_ready"
	ProjectAccessEnterpriseOwnershipShadowLookupFailed ProjectAccessEnterpriseOwnershipShadowStatus = "lookup_failed"

	ProjectAccessGuardEnterpriseSwitchOwnershipRepoUnavailable ProjectAccessGuardEnterpriseSwitchReadinessStatus = "ownership_repo_unavailable"
	ProjectAccessGuardEnterpriseSwitchNoProjects               ProjectAccessGuardEnterpriseSwitchReadinessStatus = "no_projects"
	ProjectAccessGuardEnterpriseSwitchNoMappings               ProjectAccessGuardEnterpriseSwitchReadinessStatus = "no_mappings"
	ProjectAccessGuardEnterpriseSwitchUnmappedProjects         ProjectAccessGuardEnterpriseSwitchReadinessStatus = "unmapped_projects"
	ProjectAccessGuardEnterpriseSwitchEvidenceDrift            ProjectAccessGuardEnterpriseSwitchReadinessStatus = "mapping_evidence_drift"
	ProjectAccessGuardEnterpriseSwitchReady                    ProjectAccessGuardEnterpriseSwitchReadinessStatus = "enterprise_switch_ready"

	ProjectAccessEnterpriseAuthorizationDryRunUnavailable      ProjectAccessEnterpriseAuthorizationDryRunStatus = "unavailable"
	ProjectAccessEnterpriseAuthorizationDryRunNoMapping        ProjectAccessEnterpriseAuthorizationDryRunStatus = "no_mapping"
	ProjectAccessEnterpriseAuthorizationDryRunMembershipFailed ProjectAccessEnterpriseAuthorizationDryRunStatus = "membership_lookup_failed"
	ProjectAccessEnterpriseAuthorizationDryRunNoMembership     ProjectAccessEnterpriseAuthorizationDryRunStatus = "no_active_membership"
	ProjectAccessEnterpriseAuthorizationDryRunMembershipReady  ProjectAccessEnterpriseAuthorizationDryRunStatus = "membership_ready"

	ProjectAccessEnterpriseAuthorizationDriftNotCompared                    ProjectAccessEnterpriseAuthorizationDriftStatus = "not_compared"
	ProjectAccessEnterpriseAuthorizationDriftAligned                        ProjectAccessEnterpriseAuthorizationDriftStatus = "aligned"
	ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable          ProjectAccessEnterpriseAuthorizationDriftStatus = "enterprise_unavailable"
	ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked ProjectAccessEnterpriseAuthorizationDriftStatus = "legacy_granted_enterprise_blocked"
	ProjectAccessEnterpriseAuthorizationDriftLegacyBlockedEnterpriseGranted ProjectAccessEnterpriseAuthorizationDriftStatus = "legacy_blocked_enterprise_granted"

	ProjectAccessGuardEnterpriseAuthorizationDryRunOwnershipRepoUnavailable ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus = "ownership_repo_unavailable"
	ProjectAccessGuardEnterpriseAuthorizationDryRunNoProjects               ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus = "no_projects"
	ProjectAccessGuardEnterpriseAuthorizationDryRunEnterpriseUnavailable    ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus = "enterprise_unavailable"
	ProjectAccessGuardEnterpriseAuthorizationDryRunDriftDetected            ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus = "drift_detected"
	ProjectAccessGuardEnterpriseAuthorizationDryRunAligned                  ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus = "dry_run_aligned"

	ProjectAccessGuardEnterpriseActivationReadinessOwnershipRepoUnavailable ProjectAccessGuardEnterpriseActivationReadinessStatus = "ownership_repo_unavailable"
	ProjectAccessGuardEnterpriseActivationReadinessNoProjects               ProjectAccessGuardEnterpriseActivationReadinessStatus = "no_projects"
	ProjectAccessGuardEnterpriseActivationReadinessSwitchNotReady           ProjectAccessGuardEnterpriseActivationReadinessStatus = "switch_not_ready"
	ProjectAccessGuardEnterpriseActivationReadinessDryRunUnavailable        ProjectAccessGuardEnterpriseActivationReadinessStatus = "dry_run_unavailable"
	ProjectAccessGuardEnterpriseActivationReadinessDriftDetected            ProjectAccessGuardEnterpriseActivationReadinessStatus = "drift_detected"
	ProjectAccessGuardEnterpriseActivationReadinessAlreadyActive            ProjectAccessGuardEnterpriseActivationReadinessStatus = "already_active"
	ProjectAccessGuardEnterpriseActivationReadinessReady                    ProjectAccessGuardEnterpriseActivationReadinessStatus = "ready_to_activate"

	ProjectAccessGuardEnterpriseActivationBlockerSwitchUnmappedProject       ProjectAccessGuardEnterpriseActivationBlockerSource = "switch_unmapped_project"
	ProjectAccessGuardEnterpriseActivationBlockerSwitchExtraOwnership        ProjectAccessGuardEnterpriseActivationBlockerSource = "switch_extra_ownership"
	ProjectAccessGuardEnterpriseActivationBlockerDryRunEnterpriseUnavailable ProjectAccessGuardEnterpriseActivationBlockerSource = "dry_run_enterprise_unavailable"
	ProjectAccessGuardEnterpriseActivationBlockerDryRunAuthorizationDrift    ProjectAccessGuardEnterpriseActivationBlockerSource = "dry_run_authorization_drift"

	ProjectAccessGuardEnterpriseActivationReviewSwitchReadiness          ProjectAccessGuardEnterpriseActivationReviewItemSource = "switch_readiness"
	ProjectAccessGuardEnterpriseActivationReviewAuthorizationDryRun      ProjectAccessGuardEnterpriseActivationReviewItemSource = "authorization_dry_run"
	ProjectAccessGuardEnterpriseActivationReviewBlockerCandidates        ProjectAccessGuardEnterpriseActivationReviewItemSource = "blocker_candidates"
	ProjectAccessGuardEnterpriseActivationReviewAuthorizationMode        ProjectAccessGuardEnterpriseActivationReviewItemSource = "authorization_mode"
	ProjectAccessGuardEnterpriseActivationReviewTenantIsolationBoundary  ProjectAccessGuardEnterpriseActivationReviewItemSource = "tenant_isolation_boundary"
	ProjectAccessGuardEnterpriseActivationReviewOrganizationRBACBoundary ProjectAccessGuardEnterpriseActivationReviewItemSource = "organization_rbac_boundary"
	ProjectAccessGuardEnterpriseActivationReviewManualActivationTask     ProjectAccessGuardEnterpriseActivationReviewItemSource = "manual_activation_task"

	ProjectAccessGuardEnterpriseActivationReviewPassed         ProjectAccessGuardEnterpriseActivationReviewItemStatus = "passed"
	ProjectAccessGuardEnterpriseActivationReviewBlocked        ProjectAccessGuardEnterpriseActivationReviewItemStatus = "blocked"
	ProjectAccessGuardEnterpriseActivationReviewManualRequired ProjectAccessGuardEnterpriseActivationReviewItemStatus = "manual_required"

	ProjectAccessGuardEnterpriseActivationAuditReadinessSnapshot      ProjectAccessGuardEnterpriseActivationAuditPlanItemSource = "readiness_snapshot"
	ProjectAccessGuardEnterpriseActivationAuditBlockerSnapshot        ProjectAccessGuardEnterpriseActivationAuditPlanItemSource = "blocker_snapshot"
	ProjectAccessGuardEnterpriseActivationAuditManualApproval         ProjectAccessGuardEnterpriseActivationAuditPlanItemSource = "manual_approval"
	ProjectAccessGuardEnterpriseActivationAuditActivationExecution    ProjectAccessGuardEnterpriseActivationAuditPlanItemSource = "activation_execution"
	ProjectAccessGuardEnterpriseActivationAuditPostActivationValidate ProjectAccessGuardEnterpriseActivationAuditPlanItemSource = "post_activation_access_validation"
	ProjectAccessGuardEnterpriseActivationAuditRollbackEvidence       ProjectAccessGuardEnterpriseActivationAuditPlanItemSource = "rollback_evidence"

	ProjectAccessGuardEnterpriseActivationAuditEvidenceReady  ProjectAccessGuardEnterpriseActivationAuditPlanItemStatus = "evidence_ready"
	ProjectAccessGuardEnterpriseActivationAuditBlocked        ProjectAccessGuardEnterpriseActivationAuditPlanItemStatus = "blocked"
	ProjectAccessGuardEnterpriseActivationAuditManualRequired ProjectAccessGuardEnterpriseActivationAuditPlanItemStatus = "manual_required"
)

type ProjectAccessEnterpriseOwnershipRepo interface {
	FindEnterpriseProjectOwnershipByProjectID(ctx context.Context, projectID string) (*model.EnterpriseProjectOwnership, error)
	ListEnterpriseProjectOwnerships(ctx context.Context) ([]model.EnterpriseProjectOwnership, error)
	FindEnterpriseMembersByUserAndOrganizationID(ctx context.Context, userID, organizationID string) ([]model.EnterpriseMember, error)
}

type ProjectAccessDecision struct {
	Status                                ProjectAccessDecisionStatus
	Mode                                  ProjectAccessGuardMode
	UserID                                string
	ProjectID                             string
	Project                               *model.Project
	EnterpriseOwnershipShadowStatus       ProjectAccessEnterpriseOwnershipShadowStatus
	EnterpriseOwnership                   *model.EnterpriseProjectOwnership
	EnterpriseAuthorizationDryRunStatus   ProjectAccessEnterpriseAuthorizationDryRunStatus
	EnterpriseAuthorizationDryRunDecision ProjectAccessDecisionStatus
	EnterpriseAuthorizationDriftStatus    ProjectAccessEnterpriseAuthorizationDriftStatus
	AccessRole                            string
}

type ProjectAccessGuardEnterpriseSwitchReadiness struct {
	Status                        ProjectAccessGuardEnterpriseSwitchReadinessStatus
	CurrentMode                   ProjectAccessGuardMode
	TargetMode                    ProjectAccessGuardMode
	CanSwitchToEnterpriseOwned    bool
	ProjectCount                  int64
	OwnershipCount                int64
	MappedProjectCount            int64
	UnmappedProjectCount          int64
	ExtraOwnershipCount           int64
	OwnershipLookupAvailable      bool
	EnterpriseAuthorizationActive bool
}

type ProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate struct {
	ProjectRecordID string
	ProjectID       string
	ProjectName     string
	OwnerUserID     string
	DryRunStatus    ProjectAccessEnterpriseAuthorizationDryRunStatus
	DryRunDecision  ProjectAccessDecisionStatus
	DriftStatus     ProjectAccessEnterpriseAuthorizationDriftStatus
}

type ProjectAccessGuardEnterpriseAuthorizationDryRunEvidence struct {
	Status                              ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus
	CurrentMode                         ProjectAccessGuardMode
	TargetMode                          ProjectAccessGuardMode
	ProjectCount                        int64
	ComparedProjectCount                int64
	AlignedProjectCount                 int64
	EnterpriseUnavailableProjectCount   int64
	LegacyGrantedEnterpriseBlockedCount int64
	LegacyBlockedEnterpriseGrantedCount int64
	DriftPreviewLimit                   int
	DriftCandidates                     []ProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate
	EnterpriseAuthorizationActive       bool
}

type ProjectAccessGuardEnterpriseActivationReadiness struct {
	Status                        ProjectAccessGuardEnterpriseActivationReadinessStatus
	CurrentMode                   ProjectAccessGuardMode
	TargetMode                    ProjectAccessGuardMode
	CanActivateEnterpriseOwned    bool
	SwitchStatus                  ProjectAccessGuardEnterpriseSwitchReadinessStatus
	AuthorizationDryRunStatus     ProjectAccessGuardEnterpriseAuthorizationDryRunEvidenceStatus
	ProjectCount                  int64
	MappedProjectCount            int64
	UnmappedProjectCount          int64
	ExtraOwnershipCount           int64
	ComparedProjectCount          int64
	AlignedProjectCount           int64
	EnterpriseUnavailableCount    int64
	AuthorizationDriftCount       int64
	BlockerPreviewLimit           int
	BlockerCandidates             []ProjectAccessGuardEnterpriseActivationBlockerCandidate
	ReviewItems                   []ProjectAccessGuardEnterpriseActivationReviewItem
	AuditPlanItems                []ProjectAccessGuardEnterpriseActivationAuditPlanItem
	EnterpriseAuthorizationActive bool
}

type ProjectAccessGuardEnterpriseActivationBlockerCandidate struct {
	Source          ProjectAccessGuardEnterpriseActivationBlockerSource
	ProjectRecordID string
	ProjectID       string
	ProjectName     string
	OwnerUserID     string
	DryRunStatus    ProjectAccessEnterpriseAuthorizationDryRunStatus
	DryRunDecision  ProjectAccessDecisionStatus
	DriftStatus     ProjectAccessEnterpriseAuthorizationDriftStatus
}

type ProjectAccessGuardEnterpriseActivationReviewItem struct {
	Source   ProjectAccessGuardEnterpriseActivationReviewItemSource
	Status   ProjectAccessGuardEnterpriseActivationReviewItemStatus
	Message  string
	Recovery string
}

type ProjectAccessGuardEnterpriseActivationAuditPlanItem struct {
	Source   ProjectAccessGuardEnterpriseActivationAuditPlanItemSource
	Status   ProjectAccessGuardEnterpriseActivationAuditPlanItemStatus
	Message  string
	Recovery string
}

func (d ProjectAccessDecision) HasProjectAccess() bool {
	return d.Status == ProjectAccessDecisionGranted && d.Project != nil
}

func (d ProjectAccessDecision) CanRead() bool { return d.HasProjectAccess() }
func (d ProjectAccessDecision) CanWrite() bool {
	return d.HasProjectAccess() && (d.AccessRole == ProjectMemberRoleOwner || d.AccessRole == ProjectMemberRoleEditor)
}
func (d ProjectAccessDecision) CanManage() bool {
	return d.HasProjectAccess() && d.AccessRole == ProjectMemberRoleOwner
}

func (d ProjectAccessDecision) HasEnterpriseAuthorizationDryRun() bool {
	return d.EnterpriseAuthorizationDryRunStatus != ProjectAccessEnterpriseAuthorizationDryRunUnavailable &&
		d.EnterpriseAuthorizationDriftStatus != ProjectAccessEnterpriseAuthorizationDriftNotCompared
}

func (r ProjectAccessGuardEnterpriseSwitchReadiness) HasEnterpriseSwitchReadiness() bool {
	return r.Status == ProjectAccessGuardEnterpriseSwitchReady &&
		r.CanSwitchToEnterpriseOwned &&
		r.CurrentMode == ProjectAccessGuardModeLegacyUserOwned &&
		r.TargetMode == ProjectAccessGuardModeEnterpriseOwned &&
		!r.EnterpriseAuthorizationActive
}

func (r ProjectAccessGuardEnterpriseActivationReadiness) HasEnterpriseActivationReadiness() bool {
	return r.Status == ProjectAccessGuardEnterpriseActivationReadinessReady &&
		r.CanActivateEnterpriseOwned &&
		r.CurrentMode == ProjectAccessGuardModeLegacyUserOwned &&
		r.TargetMode == ProjectAccessGuardModeEnterpriseOwned &&
		len(r.BlockerCandidates) == 0 &&
		!r.EnterpriseAuthorizationActive
}

// AuthorizeProjectAccess centralizes the current project access guard.
// It defaults to legacy user-owned mode and only switches to enterprise-owned when system_config explicitly says so.
func (s *ProjectService) AuthorizeProjectAccess(ctx context.Context, userID, projectID string) ProjectAccessDecision {
	userID = strings.TrimSpace(userID)
	projectID = strings.TrimSpace(projectID)
	decision := ProjectAccessDecision{
		Mode:                                  ProjectAccessGuardModeLegacyUserOwned,
		UserID:                                userID,
		ProjectID:                             projectID,
		EnterpriseOwnershipShadowStatus:       ProjectAccessEnterpriseOwnershipShadowUnavailable,
		EnterpriseAuthorizationDryRunStatus:   ProjectAccessEnterpriseAuthorizationDryRunUnavailable,
		EnterpriseAuthorizationDriftStatus:    ProjectAccessEnterpriseAuthorizationDriftNotCompared,
		EnterpriseAuthorizationDryRunDecision: ProjectAccessDecisionServiceUnavailable,
	}
	if s == nil || s.projectRepo == nil {
		decision.Status = ProjectAccessDecisionServiceUnavailable
		return decision
	}
	if userID == "" {
		decision.Status = ProjectAccessDecisionUnauthenticated
		return decision
	}
	if projectID == "" {
		decision.Status = ProjectAccessDecisionProjectNotFound
		return decision
	}

	project, err := s.GetProject(ctx, projectID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || strings.EqualFold(strings.TrimSpace(err.Error()), "project not found") {
			decision.Status = ProjectAccessDecisionProjectNotFound
		} else {
			decision.Status = ProjectAccessDecisionServiceUnavailable
		}
		return decision
	}
	if project == nil {
		decision.Status = ProjectAccessDecisionProjectNotFound
		return decision
	}
	decision.Project = project
	if strings.TrimSpace(project.UserID) == userID {
		decision.AccessRole = ProjectMemberRoleOwner
	}
	s.attachEnterpriseOwnershipShadow(ctx, &decision, project.ProjectID)
	decision.Mode = s.resolveProjectAccessGuardMode(ctx)
	if decision.Mode == ProjectAccessGuardModeEnterpriseOwned {
		s.authorizeEnterpriseOwnedProjectAccess(ctx, &decision)
		return decision
	}
	if strings.TrimSpace(project.UserID) != userID {
		if s.collaborationRepo != nil {
			member, memberErr := s.collaborationRepo.FindMember(ctx, project.ProjectID, userID)
			if memberErr == nil && member != nil && validProjectMemberRole(member.Role) {
				decision.Status = ProjectAccessDecisionGranted
				decision.AccessRole = member.Role
				s.attachEnterpriseAuthorizationDryRun(ctx, &decision)
				return decision
			}
		}
		decision.Status = ProjectAccessDecisionForbidden
		s.attachEnterpriseAuthorizationDryRun(ctx, &decision)
		return decision
	}
	decision.Status = ProjectAccessDecisionGranted
	decision.AccessRole = ProjectMemberRoleOwner
	s.attachEnterpriseAuthorizationDryRun(ctx, &decision)
	return decision
}

func (s *ProjectService) resolveProjectAccessGuardMode(ctx context.Context) ProjectAccessGuardMode {
	if s == nil || s.systemConfigSvc == nil {
		return ProjectAccessGuardModeLegacyUserOwned
	}
	value, err := s.systemConfigSvc.GetConfig(ctx, projectAccessGuardModeSystemConfigKey)
	if err != nil {
		return ProjectAccessGuardModeLegacyUserOwned
	}
	if ProjectAccessGuardMode(strings.TrimSpace(value)) == ProjectAccessGuardModeEnterpriseOwned {
		return ProjectAccessGuardModeEnterpriseOwned
	}
	return ProjectAccessGuardModeLegacyUserOwned
}

func (s *ProjectService) authorizeEnterpriseOwnedProjectAccess(ctx context.Context, decision *ProjectAccessDecision) {
	if s == nil || decision == nil || decision.Project == nil || s.ownershipRepo == nil {
		if decision != nil {
			decision.Status = ProjectAccessDecisionServiceUnavailable
			decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunUnavailable
			decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionServiceUnavailable
			decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable
		}
		return
	}
	switch decision.EnterpriseOwnershipShadowStatus {
	case ProjectAccessEnterpriseOwnershipShadowLookupFailed, ProjectAccessEnterpriseOwnershipShadowUnavailable:
		decision.Status = ProjectAccessDecisionServiceUnavailable
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunUnavailable
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionServiceUnavailable
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable
		return
	case ProjectAccessEnterpriseOwnershipShadowNoMapping:
		decision.Status = ProjectAccessDecisionForbidden
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunNoMapping
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionForbidden
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftNotCompared
		return
	case ProjectAccessEnterpriseOwnershipShadowMappingReady:
	default:
		decision.Status = ProjectAccessDecisionServiceUnavailable
		return
	}
	if decision.EnterpriseOwnership == nil {
		decision.Status = ProjectAccessDecisionForbidden
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunNoMapping
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionForbidden
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftNotCompared
		return
	}
	members, err := s.ownershipRepo.FindEnterpriseMembersByUserAndOrganizationID(ctx, decision.UserID, decision.EnterpriseOwnership.OrganizationID)
	if err != nil {
		decision.Status = ProjectAccessDecisionServiceUnavailable
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunMembershipFailed
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionServiceUnavailable
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable
		return
	}
	if hasActiveEnterpriseProjectMembership(members, decision.EnterpriseOwnership.TeamID) {
		decision.Status = ProjectAccessDecisionGranted
		if decision.AccessRole == "" {
			decision.AccessRole = ProjectMemberRoleEditor
		}
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunMembershipReady
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionGranted
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftNotCompared
		return
	}
	decision.Status = ProjectAccessDecisionForbidden
	decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunNoMembership
	decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionForbidden
	decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftNotCompared
}

func (s *ProjectService) attachEnterpriseOwnershipShadow(ctx context.Context, decision *ProjectAccessDecision, projectRecordID string) {
	if s == nil || decision == nil || s.ownershipRepo == nil || strings.TrimSpace(projectRecordID) == "" {
		return
	}
	ownership, err := s.ownershipRepo.FindEnterpriseProjectOwnershipByProjectID(ctx, strings.TrimSpace(projectRecordID))
	if err != nil {
		decision.EnterpriseOwnershipShadowStatus = ProjectAccessEnterpriseOwnershipShadowLookupFailed
		return
	}
	if ownership == nil {
		decision.EnterpriseOwnershipShadowStatus = ProjectAccessEnterpriseOwnershipShadowNoMapping
		return
	}
	decision.EnterpriseOwnership = ownership
	decision.EnterpriseOwnershipShadowStatus = ProjectAccessEnterpriseOwnershipShadowMappingReady
}

func (s *ProjectService) attachEnterpriseAuthorizationDryRun(ctx context.Context, decision *ProjectAccessDecision) {
	if s == nil || decision == nil || s.ownershipRepo == nil || decision.Project == nil {
		return
	}
	switch decision.EnterpriseOwnershipShadowStatus {
	case ProjectAccessEnterpriseOwnershipShadowLookupFailed, ProjectAccessEnterpriseOwnershipShadowUnavailable:
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunUnavailable
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionServiceUnavailable
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable
		return
	case ProjectAccessEnterpriseOwnershipShadowNoMapping:
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunNoMapping
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionForbidden
		decision.EnterpriseAuthorizationDriftStatus = compareProjectAccessDecisionDrift(decision.Status, decision.EnterpriseAuthorizationDryRunDecision)
		return
	case ProjectAccessEnterpriseOwnershipShadowMappingReady:
	default:
		return
	}
	if decision.EnterpriseOwnership == nil {
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunNoMapping
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionForbidden
		decision.EnterpriseAuthorizationDriftStatus = compareProjectAccessDecisionDrift(decision.Status, decision.EnterpriseAuthorizationDryRunDecision)
		return
	}

	members, err := s.ownershipRepo.FindEnterpriseMembersByUserAndOrganizationID(ctx, decision.UserID, decision.EnterpriseOwnership.OrganizationID)
	if err != nil {
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunMembershipFailed
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionServiceUnavailable
		decision.EnterpriseAuthorizationDriftStatus = ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable
		return
	}
	if hasActiveEnterpriseProjectMembership(members, decision.EnterpriseOwnership.TeamID) {
		decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunMembershipReady
		decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionGranted
		decision.EnterpriseAuthorizationDriftStatus = compareProjectAccessDecisionDrift(decision.Status, decision.EnterpriseAuthorizationDryRunDecision)
		return
	}
	decision.EnterpriseAuthorizationDryRunStatus = ProjectAccessEnterpriseAuthorizationDryRunNoMembership
	decision.EnterpriseAuthorizationDryRunDecision = ProjectAccessDecisionForbidden
	decision.EnterpriseAuthorizationDriftStatus = compareProjectAccessDecisionDrift(decision.Status, decision.EnterpriseAuthorizationDryRunDecision)
}

func hasActiveEnterpriseProjectMembership(members []model.EnterpriseMember, requiredTeamID *string) bool {
	for _, member := range members {
		if strings.TrimSpace(member.Status) != "active" {
			continue
		}
		if requiredTeamID == nil || strings.TrimSpace(*requiredTeamID) == "" {
			return true
		}
		if member.TeamID != nil && strings.TrimSpace(*member.TeamID) == strings.TrimSpace(*requiredTeamID) {
			return true
		}
		if member.TeamID == nil {
			return true
		}
	}
	return false
}

func compareProjectAccessDecisionDrift(legacyStatus, enterpriseStatus ProjectAccessDecisionStatus) ProjectAccessEnterpriseAuthorizationDriftStatus {
	if enterpriseStatus == ProjectAccessDecisionServiceUnavailable {
		return ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable
	}
	if legacyStatus == enterpriseStatus {
		return ProjectAccessEnterpriseAuthorizationDriftAligned
	}
	if legacyStatus == ProjectAccessDecisionGranted && enterpriseStatus != ProjectAccessDecisionGranted {
		return ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked
	}
	if legacyStatus != ProjectAccessDecisionGranted && enterpriseStatus == ProjectAccessDecisionGranted {
		return ProjectAccessEnterpriseAuthorizationDriftLegacyBlockedEnterpriseGranted
	}
	return ProjectAccessEnterpriseAuthorizationDriftAligned
}

func (s *ProjectService) GetProjectAccessGuardEnterpriseAuthorizationDryRunEvidence(ctx context.Context) (ProjectAccessGuardEnterpriseAuthorizationDryRunEvidence, error) {
	currentMode := s.resolveProjectAccessGuardMode(ctx)
	evidence := ProjectAccessGuardEnterpriseAuthorizationDryRunEvidence{
		CurrentMode:                   currentMode,
		TargetMode:                    ProjectAccessGuardModeEnterpriseOwned,
		DriftPreviewLimit:             projectAccessGuardEnterpriseAuthorizationDryRunDriftPreviewLimit,
		DriftCandidates:               []ProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate{},
		EnterpriseAuthorizationActive: currentMode == ProjectAccessGuardModeEnterpriseOwned,
	}
	if s == nil || s.projectRepo == nil || s.ownershipRepo == nil {
		evidence.Status = ProjectAccessGuardEnterpriseAuthorizationDryRunOwnershipRepoUnavailable
		return evidence, nil
	}

	page := 1
	for {
		projects, total, err := s.projectRepo.ListAll(ctx, page, projectAccessGuardEnterpriseAuthorizationDryRunProjectPageSize)
		if err != nil {
			return evidence, err
		}
		if page == 1 {
			evidence.ProjectCount = total
		}
		if len(projects) == 0 {
			break
		}
		for _, project := range projects {
			decision := s.AuthorizeProjectAccess(ctx, project.UserID, project.ProjectID)
			evidence.ComparedProjectCount++
			switch decision.EnterpriseAuthorizationDriftStatus {
			case ProjectAccessEnterpriseAuthorizationDriftAligned:
				evidence.AlignedProjectCount++
			case ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable:
				evidence.EnterpriseUnavailableProjectCount++
				appendProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate(&evidence, project, decision)
			case ProjectAccessEnterpriseAuthorizationDriftLegacyGrantedEnterpriseBlocked:
				evidence.LegacyGrantedEnterpriseBlockedCount++
				appendProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate(&evidence, project, decision)
			case ProjectAccessEnterpriseAuthorizationDriftLegacyBlockedEnterpriseGranted:
				evidence.LegacyBlockedEnterpriseGrantedCount++
				appendProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate(&evidence, project, decision)
			case ProjectAccessEnterpriseAuthorizationDriftNotCompared:
				if evidence.EnterpriseAuthorizationActive {
					evidence.AlignedProjectCount++
					continue
				}
				evidence.EnterpriseUnavailableProjectCount++
				appendProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate(&evidence, project, decision)
			default:
				evidence.EnterpriseUnavailableProjectCount++
				appendProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate(&evidence, project, decision)
			}
		}
		if int64(page*projectAccessGuardEnterpriseAuthorizationDryRunProjectPageSize) >= evidence.ProjectCount {
			break
		}
		page++
	}

	switch {
	case evidence.ProjectCount == 0:
		evidence.Status = ProjectAccessGuardEnterpriseAuthorizationDryRunNoProjects
	case evidence.EnterpriseUnavailableProjectCount > 0:
		evidence.Status = ProjectAccessGuardEnterpriseAuthorizationDryRunEnterpriseUnavailable
	case evidence.LegacyGrantedEnterpriseBlockedCount > 0 || evidence.LegacyBlockedEnterpriseGrantedCount > 0:
		evidence.Status = ProjectAccessGuardEnterpriseAuthorizationDryRunDriftDetected
	default:
		evidence.Status = ProjectAccessGuardEnterpriseAuthorizationDryRunAligned
	}
	return evidence, nil
}

func (s *ProjectService) GetProjectAccessGuardEnterpriseActivationReadiness(ctx context.Context) (ProjectAccessGuardEnterpriseActivationReadiness, error) {
	readiness := ProjectAccessGuardEnterpriseActivationReadiness{
		CurrentMode:         ProjectAccessGuardModeLegacyUserOwned,
		TargetMode:          ProjectAccessGuardModeEnterpriseOwned,
		BlockerPreviewLimit: projectAccessGuardEnterpriseActivationBlockerPreviewLimit,
		BlockerCandidates:   []ProjectAccessGuardEnterpriseActivationBlockerCandidate{},
	}
	switchReadiness, err := s.GetProjectAccessGuardEnterpriseSwitchReadiness(ctx)
	if err != nil {
		return readiness, err
	}
	dryRunEvidence, err := s.GetProjectAccessGuardEnterpriseAuthorizationDryRunEvidence(ctx)
	if err != nil {
		return readiness, err
	}

	readiness.CurrentMode = switchReadiness.CurrentMode
	readiness.TargetMode = switchReadiness.TargetMode
	readiness.SwitchStatus = switchReadiness.Status
	readiness.AuthorizationDryRunStatus = dryRunEvidence.Status
	readiness.ProjectCount = switchReadiness.ProjectCount
	readiness.MappedProjectCount = switchReadiness.MappedProjectCount
	readiness.UnmappedProjectCount = switchReadiness.UnmappedProjectCount
	readiness.ExtraOwnershipCount = switchReadiness.ExtraOwnershipCount
	readiness.ComparedProjectCount = dryRunEvidence.ComparedProjectCount
	readiness.AlignedProjectCount = dryRunEvidence.AlignedProjectCount
	readiness.EnterpriseUnavailableCount = dryRunEvidence.EnterpriseUnavailableProjectCount
	readiness.AuthorizationDriftCount = dryRunEvidence.LegacyGrantedEnterpriseBlockedCount + dryRunEvidence.LegacyBlockedEnterpriseGrantedCount
	readiness.EnterpriseAuthorizationActive = switchReadiness.EnterpriseAuthorizationActive || dryRunEvidence.EnterpriseAuthorizationActive

	switch {
	case switchReadiness.Status == ProjectAccessGuardEnterpriseSwitchOwnershipRepoUnavailable ||
		dryRunEvidence.Status == ProjectAccessGuardEnterpriseAuthorizationDryRunOwnershipRepoUnavailable:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessOwnershipRepoUnavailable
	case switchReadiness.ProjectCount == 0 && dryRunEvidence.ProjectCount == 0:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessNoProjects
	case readiness.EnterpriseAuthorizationActive:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessAlreadyActive
	case !switchReadiness.HasEnterpriseSwitchReadiness():
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessSwitchNotReady
		readiness.BlockerCandidates = s.collectProjectAccessGuardEnterpriseActivationSwitchBlockers(ctx)
	case dryRunEvidence.Status == ProjectAccessGuardEnterpriseAuthorizationDryRunEnterpriseUnavailable:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessDryRunUnavailable
		appendProjectAccessGuardEnterpriseActivationDryRunBlockers(&readiness, dryRunEvidence)
	case dryRunEvidence.Status == ProjectAccessGuardEnterpriseAuthorizationDryRunDriftDetected:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessDriftDetected
		appendProjectAccessGuardEnterpriseActivationDryRunBlockers(&readiness, dryRunEvidence)
	case dryRunEvidence.Status == ProjectAccessGuardEnterpriseAuthorizationDryRunAligned:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessReady
		readiness.CanActivateEnterpriseOwned = true
	default:
		readiness.Status = ProjectAccessGuardEnterpriseActivationReadinessDryRunUnavailable
		appendProjectAccessGuardEnterpriseActivationDryRunBlockers(&readiness, dryRunEvidence)
	}
	readiness.ReviewItems = buildProjectAccessGuardEnterpriseActivationReviewItems(readiness)
	readiness.AuditPlanItems = buildProjectAccessGuardEnterpriseActivationAuditPlanItems(readiness)
	return readiness, nil
}

func buildProjectAccessGuardEnterpriseActivationAuditPlanItems(readiness ProjectAccessGuardEnterpriseActivationReadiness) []ProjectAccessGuardEnterpriseActivationAuditPlanItem {
	readinessStatus := ProjectAccessGuardEnterpriseActivationAuditBlocked
	readinessMessage := "activation readiness 尚未形成可审计的 ready_to_activate snapshot。"
	readinessRecovery := "先让 readiness 达到 ready_to_activate，并保留 switch/dry-run/review item 快照。"
	if readiness.HasEnterpriseActivationReadiness() {
		readinessStatus = ProjectAccessGuardEnterpriseActivationAuditEvidenceReady
		readinessMessage = "activation readiness snapshot 已具备切换前审计价值。"
		readinessRecovery = "切换任务必须记录该 readiness snapshot 的 status、counts、review items 和时间点。"
	}

	blockerStatus := ProjectAccessGuardEnterpriseActivationAuditBlocked
	blockerMessage := "activation blocker snapshot 仍包含阻断候选。"
	blockerRecovery := "切换前必须清零 blocker candidates，并保留清零前后的对比证据。"
	if len(readiness.BlockerCandidates) == 0 {
		blockerStatus = ProjectAccessGuardEnterpriseActivationAuditEvidenceReady
		blockerMessage = "activation blocker snapshot 当前为空。"
		blockerRecovery = "切换任务必须记录 blocker_candidates=0，作为授权模式切换前置证据。"
	}

	return []ProjectAccessGuardEnterpriseActivationAuditPlanItem{
		{
			Source:   ProjectAccessGuardEnterpriseActivationAuditReadinessSnapshot,
			Status:   readinessStatus,
			Message:  readinessMessage,
			Recovery: readinessRecovery,
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationAuditBlockerSnapshot,
			Status:   blockerStatus,
			Message:  blockerMessage,
			Recovery: blockerRecovery,
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationAuditManualApproval,
			Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
			Message:  "enterprise_owned 授权真实切换必须记录人工审批证据。",
			Recovery: "后续 activation execution 任务必须写入审批人、审批时间、readiness snapshot 和回滚方案引用。",
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationAuditActivationExecution,
			Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
			Message:  "enterprise_owned 授权真实切换执行事件尚未存在。",
			Recovery: "真实切换任务必须显式记录 activation execution audit，并包含旧模式、新模式和执行结果。",
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationAuditPostActivationValidate,
			Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
			Message:  "切换后的访问验证审计尚未存在。",
			Recovery: "真实切换后必须记录 owner、active enterprise member、inactive member、非成员等访问验证结果。",
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationAuditRollbackEvidence,
			Status:   ProjectAccessGuardEnterpriseActivationAuditManualRequired,
			Message:  "enterprise authorization rollback evidence 尚未存在。",
			Recovery: "真实切换任务必须同时设计回滚审计证据，不得只记录正向 activation。",
		},
	}
}

func buildProjectAccessGuardEnterpriseActivationReviewItems(readiness ProjectAccessGuardEnterpriseActivationReadiness) []ProjectAccessGuardEnterpriseActivationReviewItem {
	switchReviewStatus := ProjectAccessGuardEnterpriseActivationReviewBlocked
	switchReviewMessage := "Project Access Guard switch readiness 尚未满足。"
	switchReviewRecovery := "先让 switch readiness 达到 enterprise_switch_ready，再评审企业映射授权切换。"
	if readiness.SwitchStatus == ProjectAccessGuardEnterpriseSwitchReady {
		switchReviewStatus = ProjectAccessGuardEnterpriseActivationReviewPassed
		switchReviewMessage = "Project Access Guard switch readiness 已满足。"
		switchReviewRecovery = "继续保持 enterprise_project_ownerships 对现有项目的覆盖，并在切换前复核映射漂移。"
	}

	dryRunReviewStatus := ProjectAccessGuardEnterpriseActivationReviewBlocked
	dryRunReviewMessage := "Project Access Guard authorization dry-run 尚未对齐。"
	dryRunReviewRecovery := "先修复 enterprise unavailable 或 authorization drift，再评审真实切换。"
	if readiness.AuthorizationDryRunStatus == ProjectAccessGuardEnterpriseAuthorizationDryRunAligned {
		dryRunReviewStatus = ProjectAccessGuardEnterpriseActivationReviewPassed
		dryRunReviewMessage = "Project Access Guard authorization dry-run 已对齐。"
		dryRunReviewRecovery = "继续保持 legacy 与 enterprise hypothetical decision 对齐，并在切换前复跑 dry-run evidence。"
	}

	blockerReviewStatus := ProjectAccessGuardEnterpriseActivationReviewBlocked
	blockerReviewMessage := "Activation readiness 仍存在 blocker candidates。"
	blockerReviewRecovery := "先清零 blocker candidates，再进入真实切换评审。"
	if len(readiness.BlockerCandidates) == 0 {
		blockerReviewStatus = ProjectAccessGuardEnterpriseActivationReviewPassed
		blockerReviewMessage = "Activation readiness 当前没有 blocker candidates。"
		blockerReviewRecovery = "继续保留 blocker candidates 预览作为切换前审计证据。"
	}

	modeReviewStatus := ProjectAccessGuardEnterpriseActivationReviewBlocked
	modeReviewMessage := "Project Access Guard 当前授权模式不满足 activation 前置条件。"
	modeReviewRecovery := "只有 current_mode=legacy_user_owned 且 enterprise authorization 未 active 时，activation readiness 才能进入真实切换评审。"
	if readiness.CurrentMode == ProjectAccessGuardModeLegacyUserOwned && !readiness.EnterpriseAuthorizationActive {
		modeReviewStatus = ProjectAccessGuardEnterpriseActivationReviewPassed
		modeReviewMessage = "Project Access Guard 仍处于 legacy_user_owned 模式，尚未激活 enterprise authorization。"
		modeReviewRecovery = "真实切换必须由后续显式任务实现，当前 readiness 不改变授权模式。"
	}

	return []ProjectAccessGuardEnterpriseActivationReviewItem{
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewSwitchReadiness,
			Status:   switchReviewStatus,
			Message:  switchReviewMessage,
			Recovery: switchReviewRecovery,
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewAuthorizationDryRun,
			Status:   dryRunReviewStatus,
			Message:  dryRunReviewMessage,
			Recovery: dryRunReviewRecovery,
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewBlockerCandidates,
			Status:   blockerReviewStatus,
			Message:  blockerReviewMessage,
			Recovery: blockerReviewRecovery,
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewAuthorizationMode,
			Status:   modeReviewStatus,
			Message:  modeReviewMessage,
			Recovery: modeReviewRecovery,
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewTenantIsolationBoundary,
			Status:   ProjectAccessGuardEnterpriseActivationReviewManualRequired,
			Message:  "租户隔离仍未启用，activation readiness 不代表 tenant isolation ready。",
			Recovery: "企业映射授权真实切换后必须通过独立任务补齐租户隔离验证，不得由 readiness 自动启用。",
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewOrganizationRBACBoundary,
			Status:   ProjectAccessGuardEnterpriseActivationReviewManualRequired,
			Message:  "组织级 RBAC 仍未启用，activation readiness 不代表 organization RBAC ready。",
			Recovery: "真实切换后必须通过独立任务设计和验证组织级 RBAC，不得由 readiness 自动启用。",
		},
		{
			Source:   ProjectAccessGuardEnterpriseActivationReviewManualActivationTask,
			Status:   ProjectAccessGuardEnterpriseActivationReviewManualRequired,
			Message:  "enterprise_owned 授权真实切换尚未实现为可执行任务。",
			Recovery: "只有在显式评审、审计和回滚方案完成后，才能新增独立 activation execution 任务。",
		},
	}
}

func (s *ProjectService) collectProjectAccessGuardEnterpriseActivationSwitchBlockers(ctx context.Context) []ProjectAccessGuardEnterpriseActivationBlockerCandidate {
	candidates := []ProjectAccessGuardEnterpriseActivationBlockerCandidate{}
	if s == nil || s.projectRepo == nil || s.ownershipRepo == nil {
		return candidates
	}
	ownerships, err := s.ownershipRepo.ListEnterpriseProjectOwnerships(ctx)
	if err != nil {
		return candidates
	}
	ownershipByProjectID := make(map[string]model.EnterpriseProjectOwnership, len(ownerships))
	for _, ownership := range ownerships {
		ownershipProjectID := strings.TrimSpace(ownership.ProjectID)
		if ownershipProjectID == "" {
			continue
		}
		ownershipByProjectID[ownershipProjectID] = ownership
	}

	projectIDs := make(map[string]struct{})
	page := 1
	var projectCount int64
	for {
		projects, total, err := s.projectRepo.ListAll(ctx, page, projectAccessGuardEnterpriseSwitchReadinessProjectPageSize)
		if err != nil {
			return candidates
		}
		if page == 1 {
			projectCount = total
		}
		if len(projects) == 0 {
			break
		}
		for _, project := range projects {
			projectID := strings.TrimSpace(project.ProjectID)
			if projectID == "" {
				continue
			}
			projectIDs[projectID] = struct{}{}
			if _, exists := ownershipByProjectID[projectID]; exists {
				continue
			}
			if len(candidates) < projectAccessGuardEnterpriseActivationBlockerPreviewLimit {
				candidates = append(candidates, ProjectAccessGuardEnterpriseActivationBlockerCandidate{
					Source:          ProjectAccessGuardEnterpriseActivationBlockerSwitchUnmappedProject,
					ProjectRecordID: strings.TrimSpace(project.ID),
					ProjectID:       projectID,
					ProjectName:     project.Name,
					OwnerUserID:     strings.TrimSpace(project.UserID),
					DryRunStatus:    ProjectAccessEnterpriseAuthorizationDryRunUnavailable,
					DryRunDecision:  ProjectAccessDecisionServiceUnavailable,
					DriftStatus:     ProjectAccessEnterpriseAuthorizationDriftNotCompared,
				})
			}
		}
		if int64(page*projectAccessGuardEnterpriseSwitchReadinessProjectPageSize) >= projectCount {
			break
		}
		page++
	}
	for _, ownership := range ownerships {
		if len(candidates) >= projectAccessGuardEnterpriseActivationBlockerPreviewLimit {
			break
		}
		ownershipProjectID := strings.TrimSpace(ownership.ProjectID)
		if ownershipProjectID == "" {
			continue
		}
		if _, exists := projectIDs[ownershipProjectID]; exists {
			continue
		}
		candidates = append(candidates, ProjectAccessGuardEnterpriseActivationBlockerCandidate{
			Source:         ProjectAccessGuardEnterpriseActivationBlockerSwitchExtraOwnership,
			ProjectID:      ownershipProjectID,
			DryRunStatus:   ProjectAccessEnterpriseAuthorizationDryRunUnavailable,
			DryRunDecision: ProjectAccessDecisionServiceUnavailable,
			DriftStatus:    ProjectAccessEnterpriseAuthorizationDriftNotCompared,
		})
	}
	return candidates
}

func appendProjectAccessGuardEnterpriseActivationDryRunBlockers(readiness *ProjectAccessGuardEnterpriseActivationReadiness, evidence ProjectAccessGuardEnterpriseAuthorizationDryRunEvidence) {
	if readiness == nil {
		return
	}
	for _, candidate := range evidence.DriftCandidates {
		if len(readiness.BlockerCandidates) >= readiness.BlockerPreviewLimit {
			return
		}
		source := ProjectAccessGuardEnterpriseActivationBlockerDryRunAuthorizationDrift
		if candidate.DriftStatus == ProjectAccessEnterpriseAuthorizationDriftEnterpriseUnavailable {
			source = ProjectAccessGuardEnterpriseActivationBlockerDryRunEnterpriseUnavailable
		}
		readiness.BlockerCandidates = append(readiness.BlockerCandidates, ProjectAccessGuardEnterpriseActivationBlockerCandidate{
			Source:          source,
			ProjectRecordID: candidate.ProjectRecordID,
			ProjectID:       candidate.ProjectID,
			ProjectName:     candidate.ProjectName,
			OwnerUserID:     candidate.OwnerUserID,
			DryRunStatus:    candidate.DryRunStatus,
			DryRunDecision:  candidate.DryRunDecision,
			DriftStatus:     candidate.DriftStatus,
		})
	}
}

func appendProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate(evidence *ProjectAccessGuardEnterpriseAuthorizationDryRunEvidence, project model.Project, decision ProjectAccessDecision) {
	if evidence == nil || len(evidence.DriftCandidates) >= evidence.DriftPreviewLimit {
		return
	}
	evidence.DriftCandidates = append(evidence.DriftCandidates, ProjectAccessGuardEnterpriseAuthorizationDryRunDriftCandidate{
		ProjectRecordID: strings.TrimSpace(project.ID),
		ProjectID:       strings.TrimSpace(project.ProjectID),
		ProjectName:     project.Name,
		OwnerUserID:     strings.TrimSpace(project.UserID),
		DryRunStatus:    decision.EnterpriseAuthorizationDryRunStatus,
		DryRunDecision:  decision.EnterpriseAuthorizationDryRunDecision,
		DriftStatus:     decision.EnterpriseAuthorizationDriftStatus,
	})
}

func (s *ProjectService) GetProjectAccessGuardEnterpriseSwitchReadiness(ctx context.Context) (ProjectAccessGuardEnterpriseSwitchReadiness, error) {
	currentMode := s.resolveProjectAccessGuardMode(ctx)
	readiness := ProjectAccessGuardEnterpriseSwitchReadiness{
		CurrentMode:                   currentMode,
		TargetMode:                    ProjectAccessGuardModeEnterpriseOwned,
		EnterpriseAuthorizationActive: currentMode == ProjectAccessGuardModeEnterpriseOwned,
	}
	if s == nil || s.projectRepo == nil || s.ownershipRepo == nil {
		readiness.Status = ProjectAccessGuardEnterpriseSwitchOwnershipRepoUnavailable
		return readiness, nil
	}
	readiness.OwnershipLookupAvailable = true

	ownerships, err := s.ownershipRepo.ListEnterpriseProjectOwnerships(ctx)
	if err != nil {
		readiness.Status = ProjectAccessGuardEnterpriseSwitchOwnershipRepoUnavailable
		return readiness, err
	}
	readiness.OwnershipCount = int64(len(ownerships))
	ownershipByProjectID := make(map[string]model.EnterpriseProjectOwnership, len(ownerships))
	for _, ownership := range ownerships {
		ownershipProjectID := strings.TrimSpace(ownership.ProjectID)
		if ownershipProjectID == "" {
			continue
		}
		ownershipByProjectID[ownershipProjectID] = ownership
	}

	projects, projectCount, err := s.projectRepo.ListAll(ctx, 1, projectAccessGuardEnterpriseSwitchReadinessProjectPageSize)
	if err != nil {
		return readiness, err
	}
	readiness.ProjectCount = projectCount
	projectIDs := make(map[string]struct{}, int(projectCount))
	page := 1
	for {
		for _, project := range projects {
			projectID := strings.TrimSpace(project.ProjectID)
			if projectID == "" {
				continue
			}
			projectIDs[projectID] = struct{}{}
			if _, exists := ownershipByProjectID[projectID]; exists {
				readiness.MappedProjectCount++
				continue
			}
			readiness.UnmappedProjectCount++
		}
		if int64(page*projectAccessGuardEnterpriseSwitchReadinessProjectPageSize) >= projectCount {
			break
		}
		page++
		projects, _, err = s.projectRepo.ListAll(ctx, page, projectAccessGuardEnterpriseSwitchReadinessProjectPageSize)
		if err != nil {
			return readiness, err
		}
	}
	for _, ownership := range ownerships {
		if _, exists := projectIDs[strings.TrimSpace(ownership.ProjectID)]; !exists {
			readiness.ExtraOwnershipCount++
		}
	}

	switch {
	case readiness.ProjectCount == 0:
		readiness.Status = ProjectAccessGuardEnterpriseSwitchNoProjects
	case readiness.OwnershipCount == 0:
		readiness.Status = ProjectAccessGuardEnterpriseSwitchNoMappings
	case readiness.UnmappedProjectCount > 0:
		readiness.Status = ProjectAccessGuardEnterpriseSwitchUnmappedProjects
	case readiness.ExtraOwnershipCount > 0:
		readiness.Status = ProjectAccessGuardEnterpriseSwitchEvidenceDrift
	default:
		readiness.Status = ProjectAccessGuardEnterpriseSwitchReady
		readiness.CanSwitchToEnterpriseOwned = !readiness.EnterpriseAuthorizationActive
	}
	return readiness, nil
}
