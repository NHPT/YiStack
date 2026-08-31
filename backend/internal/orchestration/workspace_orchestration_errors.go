package orchestration

import "errors"

var (
	ErrDescriptionRequired              = errors.New("description is required")
	ErrPromptRequired                   = errors.New("prompt is required")
	ErrPlanOrchestrationUnavailable     = errors.New("plan orchestration not available")
	ErrGenerateOrchestrationUnavailable = errors.New("generate orchestration not available")
	ErrValidationGateUnavailable        = errors.New("validation gate runner not available")
	ErrCapabilityExecutionBlocked       = errors.New("capability execution blocked")
	ErrProjectServiceUnavailable        = errors.New("project service not available")
	ErrUnauthorized                     = errors.New("unauthorized")
	ErrProjectNotFound                  = errors.New("project not found")
	ErrProjectForbidden                 = errors.New("you don't have permission to access this project")
)
