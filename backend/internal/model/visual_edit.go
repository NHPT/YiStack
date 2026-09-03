package model

const VisualEditSchemaVersion = "visual_edit.v1"

// VisualEditRectangle is the selected element's viewport-relative geometry.
type VisualEditRectangle struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// VisualEditContext contains sanitized browser evidence for one visual edit.
// It intentionally excludes HTML, form values, cookies, storage, and query data.
type VisualEditContext struct {
	SchemaVersion  string              `json:"schema_version"`
	SelectionID    string              `json:"selection_id"`
	PagePath       string              `json:"page_path"`
	Selector       string              `json:"selector"`
	TagName        string              `json:"tag_name"`
	Role           string              `json:"role,omitempty"`
	AccessibleName string              `json:"accessible_name,omitempty"`
	TextContent    string              `json:"text_content,omitempty"`
	TestID         string              `json:"test_id,omitempty"`
	ClassNames     []string            `json:"class_names,omitempty"`
	Rect           VisualEditRectangle `json:"rect"`
	ComputedStyles map[string]string   `json:"computed_styles,omitempty"`
}
