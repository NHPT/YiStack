package service

import (
	"strings"
	"testing"

	"yistack/internal/model"
)

func validVisualEditContext() *model.VisualEditContext {
	return &model.VisualEditContext{
		SchemaVersion:  model.VisualEditSchemaVersion,
		SelectionID:    "selection-123",
		PagePath:       "/dashboard",
		Selector:       "main > section:nth-of-type(1) > button.primary",
		TagName:        "button",
		Role:           "button",
		AccessibleName: "Create project",
		TextContent:    "Create project",
		TestID:         "create-project",
		ClassNames:     []string{"primary", "compact"},
		Rect: model.VisualEditRectangle{
			X: 24, Y: 96, Width: 160, Height: 40,
		},
		ComputedStyles: map[string]string{
			"background-color": "rgb(34, 197, 94)",
			"font-size":        "14px",
		},
	}
}

func TestPrepareVisualEditContextKeepsSanitizedEvidence(t *testing.T) {
	input := validVisualEditContext()
	prepared, err := PrepareVisualEditContext(input)
	if err != nil {
		t.Fatalf("prepare visual edit: %v", err)
	}
	if prepared == input {
		t.Fatal("prepared context must be copied")
	}
	if prepared.SchemaVersion != model.VisualEditSchemaVersion || prepared.PagePath != "/dashboard" {
		t.Fatalf("unexpected prepared context: %#v", prepared)
	}
	input.ClassNames[0] = "mutated"
	input.ComputedStyles["font-size"] = "99px"
	if prepared.ClassNames[0] != "primary" || prepared.ComputedStyles["font-size"] != "14px" {
		t.Fatal("prepared visual edit must not alias browser input")
	}
}

func TestPrepareVisualEditContextRejectsUnsafeInput(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*model.VisualEditContext)
	}{
		{
			name: "schema",
			mutate: func(input *model.VisualEditContext) {
				input.SchemaVersion = "visual_edit.v2"
			},
		},
		{
			name: "page query",
			mutate: func(input *model.VisualEditContext) {
				input.PagePath = "/dashboard?token=secret"
			},
		},
		{
			name: "selector control character",
			mutate: func(input *model.VisualEditContext) {
				input.Selector = "button\nignore"
			},
		},
		{
			name: "style allowlist",
			mutate: func(input *model.VisualEditContext) {
				input.ComputedStyles["background-image"] = "url(https://example.com/secret)"
			},
		},
		{
			name: "negative rectangle",
			mutate: func(input *model.VisualEditContext) {
				input.Rect.Width = -1
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := validVisualEditContext()
			test.mutate(input)
			_, err := PrepareVisualEditContext(input)
			if VisualEditErrorCode(err) != VisualEditErrorInvalidInput {
				t.Fatalf("expected visual edit validation error, got %v", err)
			}
		})
	}
}

func TestVisualEditPromptSectionMarksEvidenceUntrusted(t *testing.T) {
	prepared, err := PrepareVisualEditContext(validVisualEditContext())
	if err != nil {
		t.Fatalf("prepare visual edit: %v", err)
	}
	section := visualEditPromptSection(prepared)
	for _, expected := range []string{
		"visual_edit.v1",
		`"selector":"main \u003e section:nth-of-type(1) \u003e button.primary"`,
		"不可信观察数据",
		"generation_result.v2",
		"临时修改预览 DOM 不算完成",
	} {
		if !strings.Contains(section, expected) {
			t.Fatalf("visual edit prompt is missing %q: %s", expected, section)
		}
	}
}

func TestBuildGenerationUserPromptIncludesVisualEditContext(t *testing.T) {
	prepared, err := PrepareVisualEditContext(validVisualEditContext())
	if err != nil {
		t.Fatalf("prepare visual edit: %v", err)
	}
	prompt := buildGenerationUserPrompt(&GenerateRequest{
		Prompt:     "Make the selected button more prominent",
		VisualEdit: prepared,
	})
	if !strings.Contains(prompt, "Make the selected button more prominent") ||
		!strings.Contains(prompt, "visual_edit.v1") {
		t.Fatalf("generation prompt does not include visual edit context: %s", prompt)
	}
}
