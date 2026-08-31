package handler

import (
	"errors"

	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/orchestration"
)

func classifyGenerateOrchestrationError(err error) (int, map[string]interface{}, bool) {
	switch {
	case errors.Is(err, orchestration.ErrPromptRequired):
		return consts.StatusBadRequest, map[string]interface{}{
			"error": "Prompt is required",
		}, true
	case errors.Is(err, orchestration.ErrProjectServiceUnavailable):
		return consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "Project service not available",
		}, true
	case errors.Is(err, orchestration.ErrUnauthorized):
		return consts.StatusUnauthorized, map[string]interface{}{
			"error": "Unauthorized",
		}, true
	case errors.Is(err, orchestration.ErrProjectNotFound):
		return consts.StatusNotFound, map[string]interface{}{
			"error": "Project not found",
		}, true
	case errors.Is(err, orchestration.ErrProjectForbidden):
		return consts.StatusForbidden, map[string]interface{}{
			"error": "You don't have permission to access this project",
		}, true
	case errors.Is(err, orchestration.ErrGenerateOrchestrationUnavailable):
		return consts.StatusServiceUnavailable, map[string]interface{}{
			"error": "代码生成服务未初始化",
		}, true
	default:
		return 0, nil, false
	}
}

func classifyPlanOrchestrationError(err error) (int, map[string]interface{}, bool) {
	switch {
	case errors.Is(err, orchestration.ErrDescriptionRequired):
		return consts.StatusBadRequest, map[string]interface{}{
			"error": "Description is required",
		}, true
	case errors.Is(err, orchestration.ErrPlanOrchestrationUnavailable):
		return consts.StatusServiceUnavailable, map[string]interface{}{
			"success": false,
			"error":   "AI 方案生成服务未初始化，请确保 LLM 服务已配置",
		}, true
	default:
		return 0, nil, false
	}
}
