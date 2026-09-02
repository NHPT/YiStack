package llm

import (
	"encoding/json"
	"testing"
)

func TestMessageMarshalJSONUsesStringContentForTextMessage(t *testing.T) {
	encoded, err := json.Marshal(Message{Role: "user", Content: "hello"})
	if err != nil {
		t.Fatalf("marshal text message: %v", err)
	}
	if string(encoded) != `{"role":"user","content":"hello"}` {
		t.Fatalf("unexpected text message JSON: %s", encoded)
	}
}

func TestMessageMarshalJSONUsesContentPartsForMultimodalMessage(t *testing.T) {
	message := Message{
		Role: "user",
		Parts: []MessageContentPart{
			{Type: "text", Text: "inspect"},
			{Type: "image_url", ImageURL: &MessageImageURL{URL: "data:image/png;base64,AA==", Detail: "high"}},
		},
	}
	encoded, err := json.Marshal(message)
	if err != nil {
		t.Fatalf("marshal multimodal message: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(encoded, &payload); err != nil {
		t.Fatalf("decode multimodal message JSON: %v", err)
	}
	content, ok := payload["content"].([]any)
	if !ok || len(content) != 2 {
		t.Fatalf("expected two content parts, got %#v", payload["content"])
	}
	imagePart, ok := content[1].(map[string]any)
	if !ok || imagePart["type"] != "image_url" {
		t.Fatalf("expected image_url content part, got %#v", content[1])
	}
	imageURL, ok := imagePart["image_url"].(map[string]any)
	if !ok || imageURL["url"] != "data:image/png;base64,AA==" || imageURL["detail"] != "high" {
		t.Fatalf("unexpected image_url payload: %#v", imagePart["image_url"])
	}
}

func TestMessageUnmarshalJSONRestoresMultimodalPartsAndText(t *testing.T) {
	var message Message
	err := json.Unmarshal([]byte(`{"role":"assistant","content":[{"type":"text","text":"one"},{"type":"image_url","image_url":{"url":"data:image/png;base64,AA=="}},{"type":"text","text":"two"}]}`), &message)
	if err != nil {
		t.Fatalf("unmarshal multimodal message: %v", err)
	}
	if message.Role != "assistant" || message.Content != "onetwo" || len(message.Parts) != 3 {
		t.Fatalf("unexpected decoded message: %#v", message)
	}
}
