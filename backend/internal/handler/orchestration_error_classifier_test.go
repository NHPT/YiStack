package handler

import (
	"testing"

	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/internal/service"
)

func TestClassifyGenerateOrchestrationVisualContextErrors(t *testing.T) {
	tests := []struct {
		code   string
		status int
	}{
		{code: service.VisualContextErrorInvalidInput, status: consts.StatusBadRequest},
		{code: service.VisualContextErrorUnsupportedModel, status: consts.StatusUnprocessableEntity},
		{code: service.VisualContextErrorProviderUnavailable, status: consts.StatusServiceUnavailable},
		{code: service.VisualContextErrorContractInvalid, status: consts.StatusUnprocessableEntity},
		{code: service.VisualContextErrorAnalysisFailed, status: consts.StatusBadGateway},
	}
	for _, test := range tests {
		t.Run(test.code, func(t *testing.T) {
			status, payload, handled := classifyGenerateOrchestrationError(&service.VisualContextError{
				Code:    test.code,
				Message: "visual context failure",
			})
			if !handled || status != test.status {
				t.Fatalf("status=%d handled=%v", status, handled)
			}
			if payload["code"] != test.code || payload["blocking"] != true {
				t.Fatalf("unexpected payload: %#v", payload)
			}
		})
	}
}
