package orchestration

import "yistack/internal/service"

func buildEngineeringStateStep(id, kind, title, detail, status string, state EngineeringState, meta map[string]interface{}) map[string]interface{} {
	payload := map[string]interface{}{
		"id":               id,
		"kind":             kind,
		"title":            title,
		"detail":           detail,
		"status":           status,
		"engineeringState": engineeringStatePayload(state),
	}
	if len(meta) > 0 {
		payload["meta"] = meta
	}
	return payload
}

func emitEngineeringStateStep(handler service.StreamEventHandler, payload map[string]interface{}) error {
	if handler == nil {
		return nil
	}
	return handler(service.StreamEventStep, payload)
}
