package orchestration

import (
	"context"

	"yistack/internal/service"
)

func ensureOwnedProjectAccess(ctx context.Context, projectService *service.ProjectService, userID, projectID string) error {
	if projectID == "" {
		return nil
	}
	if projectService == nil {
		return ErrProjectServiceUnavailable
	}
	if userID == "" {
		return ErrUnauthorized
	}

	decision := projectService.AuthorizeProjectAccess(ctx, userID, projectID)
	switch decision.Status {
	case service.ProjectAccessDecisionGranted:
		if decision.CanWrite() {
			return nil
		}
		return ErrProjectForbidden
	case service.ProjectAccessDecisionProjectNotFound:
		return ErrProjectNotFound
	case service.ProjectAccessDecisionForbidden:
		return ErrProjectForbidden
	case service.ProjectAccessDecisionUnauthenticated:
		return ErrUnauthorized
	case service.ProjectAccessDecisionServiceUnavailable:
		return ErrProjectServiceUnavailable
	default:
		return ErrProjectForbidden
	}
}
