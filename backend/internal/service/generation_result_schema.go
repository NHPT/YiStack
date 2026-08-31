package service

import (
	"yistack/internal/prompt"
	"yistack/pkg/llm"
)

func generationResultResponseFormat() *llm.ChatResponseFormat {
	stringSchema := func() map[string]any {
		return map[string]any{"type": "string"}
	}
	operationSchema := func(operation string, required []string, properties map[string]any) map[string]any {
		properties["operation"] = map[string]any{"type": "string", "const": operation}
		properties["path"] = stringSchema()
		properties["description"] = stringSchema()
		return map[string]any{
			"type":                 "object",
			"additionalProperties": false,
			"required":             required,
			"properties":           properties,
		}
	}
	editSchema := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"old_text", "new_text"},
		"properties": map[string]any{
			"old_text": stringSchema(),
			"new_text": stringSchema(),
		},
	}
	return &llm.ChatResponseFormat{
		Type: "json_schema",
		JSONSchema: &llm.ChatResponseJSONSchema{
			Name:   "yistack_generation_result_v2",
			Strict: true,
			Schema: map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"schema_version", "operations", "message", "commands"},
				"properties": map[string]any{
					"schema_version": map[string]any{
						"type":  "string",
						"const": prompt.GenerationResultSchemaVersion,
					},
					"operations": map[string]any{
						"type":     "array",
						"minItems": 1,
						"items": map[string]any{
							"anyOf": []any{
								operationSchema(GenerationFileOperationCreate, []string{"operation", "path", "content", "description"}, map[string]any{
									"content": stringSchema(),
								}),
								operationSchema(GenerationFileOperationReplace, []string{"operation", "path", "base_hash", "content", "description"}, map[string]any{
									"base_hash": stringSchema(),
									"content":   stringSchema(),
								}),
								operationSchema(GenerationFileOperationPatch, []string{"operation", "path", "base_hash", "edits", "description"}, map[string]any{
									"base_hash": stringSchema(),
									"edits": map[string]any{
										"type": "array", "minItems": 1, "items": editSchema,
									},
								}),
								operationSchema(GenerationFileOperationDelete, []string{"operation", "path", "base_hash", "description"}, map[string]any{
									"base_hash": stringSchema(),
								}),
							},
						},
					},
					"message": stringSchema(),
					"commands": map[string]any{
						"type":  "array",
						"items": stringSchema(),
					},
				},
			},
		},
	}
}
