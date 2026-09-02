package model

import "time"

const VisualContextSchemaVersion = "visual_context.v1"

// VisualAttachmentInput carries one image into the visual analysis boundary.
type VisualAttachmentInput struct {
	Name        string `json:"name"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	DataURL     string `json:"data_url"`
}

// VisualAttachmentSummary is the safe attachment evidence persisted with a visual context.
type VisualAttachmentSummary struct {
	Name        string `json:"name"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	SHA256      string `json:"sha256"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
}

// VisualContext is the validated visual_context.v1 contract produced by a vision model.
type VisualContext struct {
	SchemaVersion      string                    `json:"schema_version"`
	ID                 string                    `json:"id"`
	ServerProof        string                    `json:"server_proof"`
	Summary            string                    `json:"summary"`
	Layout             []string                  `json:"layout"`
	Components         []string                  `json:"components"`
	ColorPalette       []string                  `json:"color_palette"`
	Typography         []string                  `json:"typography"`
	Spacing            []string                  `json:"spacing"`
	ResponsiveBehavior []string                  `json:"responsive_behavior"`
	InteractionNotes   []string                  `json:"interaction_notes"`
	Attachments        []VisualAttachmentSummary `json:"attachments"`
	Provider           string                    `json:"provider"`
	Model              string                    `json:"model"`
	AnalyzedAt         time.Time                 `json:"analyzed_at"`
}
