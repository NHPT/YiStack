package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
	"time"

	"yistack/internal/model"
	"yistack/pkg/llm"
)

const visualContextTestSigningKey = "test-visual-context-signing-key"

type visualContextProviderStub struct {
	messages []llm.Message
	request  llm.ChatRequest
	content  string
	err      error
}

func (p *visualContextProviderStub) Chat(_ context.Context, messages []llm.Message, opts ...llm.Option) (*llm.ChatResponse, error) {
	request := llm.ChatRequest{}
	for _, option := range opts {
		option(&request)
	}
	p.messages = messages
	p.request = request
	if p.err != nil {
		return nil, p.err
	}
	return &llm.ChatResponse{Choices: []llm.Choice{{Message: llm.Message{Role: "assistant", Content: p.content}}}}, nil
}

func (p *visualContextProviderStub) StreamChat(context.Context, []llm.Message, llm.StreamChunkHandler, ...llm.Option) error {
	return nil
}

func visualContextTestAttachment(t *testing.T) model.VisualAttachmentInput {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, 3, 2))
	canvas.Set(1, 1, color.RGBA{R: 20, G: 120, B: 220, A: 255})
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, canvas); err != nil {
		t.Fatalf("encode test image: %v", err)
	}
	return model.VisualAttachmentInput{
		Name:        `C:\private\reference.png`,
		ContentType: "image/png",
		Size:        int64(encoded.Len()),
		DataURL:     "data:image/png;base64," + base64.StdEncoding.EncodeToString(encoded.Bytes()),
	}
}

func validVisualContextJSON() string {
	return `{"schema_version":"visual_context.v1","summary":"A compact dashboard","layout":["Two-column desktop layout"],"components":["Metric cards"],"color_palette":["#ffffff","#111111"],"typography":["Sans-serif headings"],"spacing":["8px spacing scale"],"responsive_behavior":["Collapse to one column"],"interaction_notes":["Cards are clickable"]}`
}

func TestPrepareVisualAttachmentsSanitizesNameAndBuildsEvidence(t *testing.T) {
	prepared, err := prepareVisualAttachments([]model.VisualAttachmentInput{visualContextTestAttachment(t)})
	if err != nil {
		t.Fatalf("prepare visual attachment: %v", err)
	}
	if len(prepared) != 1 {
		t.Fatalf("expected one attachment, got %d", len(prepared))
	}
	if prepared[0].Input.Name != "reference.png" {
		t.Fatalf("expected path-free name, got %q", prepared[0].Input.Name)
	}
	if prepared[0].Summary.Width != 3 || prepared[0].Summary.Height != 2 || len(prepared[0].Summary.SHA256) != 64 {
		t.Fatalf("unexpected attachment evidence: %#v", prepared[0].Summary)
	}
}

func TestPrepareVisualAttachmentsRejectsOriginalTotalAboveLimit(t *testing.T) {
	base := visualContextTestAttachment(t)
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(base.DataURL, "data:image/png;base64,"))
	if err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	attachments := make([]model.VisualAttachmentInput, 0, 3)
	for index := 0; index < 3; index++ {
		source := append([]byte(nil), raw...)
		source = append(source, make([]byte, 4*1024*1024+1-len(source))...)
		attachments = append(attachments, model.VisualAttachmentInput{
			Name:        fmt.Sprintf("reference-%d.png", index+1),
			ContentType: "image/png",
			Size:        int64(len(source)),
			DataURL:     "data:image/png;base64," + base64.StdEncoding.EncodeToString(source),
		})
	}
	_, err = PrepareVisualAttachments(attachments)
	if VisualContextErrorCode(err) != VisualContextErrorInvalidInput {
		t.Fatalf("expected original total size to be rejected, got %v", err)
	}
}

func TestPrepareVisualAttachmentsRejectsMIMEContentMismatch(t *testing.T) {
	attachment := visualContextTestAttachment(t)
	attachment.ContentType = "image/jpeg"
	attachment.DataURL = strings.Replace(attachment.DataURL, "data:image/png", "data:image/jpeg", 1)
	_, err := PrepareVisualAttachments([]model.VisualAttachmentInput{attachment})
	if VisualContextErrorCode(err) != VisualContextErrorInvalidInput {
		t.Fatalf("expected invalid input error, got %v", err)
	}
}

func TestAnalyzeVisualContextRequiresVisionCapability(t *testing.T) {
	provider := &visualContextProviderStub{content: validVisualContextJSON()}
	manager := llm.NewProviderManager()
	manager.RegisterProvider("text-only", provider, &llm.ProviderConfig{Model: "text-model", CapabilityTags: "chat,coding"})
	if err := manager.SetCurrent("text-only"); err != nil {
		t.Fatalf("set provider: %v", err)
	}

	_, _, err := analyzeVisualContext(
		context.Background(),
		manager,
		"text-only",
		"",
		[]model.VisualAttachmentInput{visualContextTestAttachment(t)},
		false,
		visualContextTestSigningKey,
		nil,
	)
	if VisualContextErrorCode(err) != VisualContextErrorUnsupportedModel {
		t.Fatalf("expected unsupported model error, got %v", err)
	}
	if len(provider.messages) != 0 {
		t.Fatal("text-only provider must not receive image content")
	}
}

func TestAnalyzeVisualContextRejectsUnverifiedModelOverride(t *testing.T) {
	provider := &visualContextProviderStub{content: validVisualContextJSON()}
	manager := llm.NewProviderManager()
	manager.RegisterProvider("vision-provider", provider, &llm.ProviderConfig{
		Model: "vision-model", CapabilityTags: "chat,vision",
	})
	_, _, err := analyzeVisualContext(
		context.Background(),
		manager,
		"vision-provider",
		"text-only-model",
		[]model.VisualAttachmentInput{visualContextTestAttachment(t)},
		false,
		visualContextTestSigningKey,
		nil,
	)
	if VisualContextErrorCode(err) != VisualContextErrorUnsupportedModel {
		t.Fatalf("expected unverified model override to be rejected, got %v", err)
	}
	if len(provider.messages) != 0 {
		t.Fatal("unverified model override must not receive image content")
	}
}

func TestAnalyzeVisualContextSendsImagesAndReturnsStrictContext(t *testing.T) {
	provider := &visualContextProviderStub{content: validVisualContextJSON()}
	manager := llm.NewProviderManager()
	manager.RegisterProvider("vision-provider", provider, &llm.ProviderConfig{Model: "vision-model", CapabilityTags: "chat, vision, coding"})
	if err := manager.SetCurrent("vision-provider"); err != nil {
		t.Fatalf("set provider: %v", err)
	}

	visualContext, prepared, err := analyzeVisualContext(
		context.Background(),
		manager,
		"vision-provider",
		"",
		[]model.VisualAttachmentInput{visualContextTestAttachment(t)},
		false,
		visualContextTestSigningKey,
		nil,
	)
	if err != nil {
		t.Fatalf("analyze visual context: %v", err)
	}
	if visualContext == nil || visualContext.SchemaVersion != model.VisualContextSchemaVersion || len(visualContext.Attachments) != 1 {
		t.Fatalf("unexpected visual context: %#v", visualContext)
	}
	if err := verifyVisualContextProof(visualContext, visualContextTestSigningKey); err != nil {
		t.Fatalf("expected server-issued visual context proof: %v", err)
	}
	if len(prepared) != 1 || len(provider.messages) != 2 || len(provider.messages[1].Parts) != 2 {
		t.Fatalf("expected real multimodal request, messages=%#v prepared=%d", provider.messages, len(prepared))
	}
	if provider.messages[1].Parts[1].ImageURL == nil || !strings.HasPrefix(provider.messages[1].Parts[1].ImageURL.URL, "data:image/png;base64,") {
		t.Fatalf("expected image data URL in multimodal request: %#v", provider.messages[1].Parts[1])
	}
	if provider.request.ResponseFormat == nil || provider.request.ResponseFormat.JSONSchema == nil || !provider.request.ResponseFormat.JSONSchema.Strict {
		t.Fatalf("expected strict visual response schema: %#v", provider.request.ResponseFormat)
	}
}

func TestDecodeVisualContextAnalysisRejectsUnknownFields(t *testing.T) {
	content := strings.TrimSuffix(validVisualContextJSON(), "}") + `,"unexpected":true}`
	if _, err := decodeVisualContextAnalysis(content); err == nil {
		t.Fatal("expected unknown field to be rejected")
	}
}

func TestDecodeVisualContextAnalysisRejectsMissingInteractionNotes(t *testing.T) {
	content := strings.Replace(validVisualContextJSON(), `,"interaction_notes":["Cards are clickable"]`, "", 1)
	if _, err := decodeVisualContextAnalysis(content); err == nil {
		t.Fatal("expected missing interaction_notes to be rejected")
	}
}

type visualContextProjectRepoStub struct {
	ProjectRepo
	project *model.Project
}

func (r *visualContextProjectRepoStub) FindByProjectID(_ context.Context, projectID string) (*model.Project, error) {
	if r.project == nil || r.project.ProjectID != projectID {
		return nil, errors.New("project not found")
	}
	return r.project, nil
}

func visualContextTrustFixture(t *testing.T) *model.VisualContext {
	t.Helper()
	prepared, err := prepareVisualAttachments([]model.VisualAttachmentInput{visualContextTestAttachment(t)})
	if err != nil {
		t.Fatalf("prepare trust fixture: %v", err)
	}
	visualContext := &model.VisualContext{
		SchemaVersion:      model.VisualContextSchemaVersion,
		ID:                 "visual-context-trusted",
		Summary:            "A compact dashboard",
		Layout:             []string{"Two-column desktop layout"},
		Components:         []string{"Metric cards"},
		ColorPalette:       []string{"#ffffff", "#111111"},
		Typography:         []string{"Sans-serif headings"},
		Spacing:            []string{"8px spacing scale"},
		ResponsiveBehavior: []string{"Collapse to one column"},
		InteractionNotes:   []string{"Cards are clickable"},
		Attachments:        []model.VisualAttachmentSummary{prepared[0].Summary},
		Provider:           "vision-provider",
		Model:              "vision-model",
		AnalyzedAt:         time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC),
	}
	if err := signVisualContext(visualContext, visualContextTestSigningKey); err != nil {
		t.Fatalf("sign visual context fixture: %v", err)
	}
	return visualContext
}

func TestBindProjectVisualContextRequiresExactStoredPlanSnapshot(t *testing.T) {
	trusted := visualContextTrustFixture(t)
	planJSON, err := json.Marshal(model.Plan{ID: "plan-1", VisualContext: trusted})
	if err != nil {
		t.Fatalf("marshal plan: %v", err)
	}
	generator := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo: &visualContextProjectRepoStub{project: &model.Project{
			ProjectID: "project-1",
			PlanData:  string(planJSON),
		}},
		VisualContextSigningKey: visualContextTestSigningKey,
	})

	bound, err := generator.BindProjectVisualContext(context.Background(), "project-1", trusted)
	if err != nil {
		t.Fatalf("bind trusted context: %v", err)
	}
	if bound == nil || bound.ID != trusted.ID || bound.Summary != trusted.Summary {
		t.Fatalf("expected the server-stored visual context, got %#v", bound)
	}

	forged := *trusted
	forged.Summary = "Forged client summary"
	if _, err := generator.BindProjectVisualContext(context.Background(), "project-1", &forged); VisualContextErrorCode(err) != VisualContextErrorContractInvalid {
		t.Fatalf("expected forged visual context to be rejected, got %v", err)
	}
}

func TestBindProjectVisualContextRejectsMatchingForgedStoredSnapshot(t *testing.T) {
	forged := visualContextTrustFixture(t)
	forged.Summary = "Forged client summary"
	planJSON, err := json.Marshal(model.Plan{ID: "plan-forged", VisualContext: forged})
	if err != nil {
		t.Fatalf("marshal forged plan: %v", err)
	}
	generator := NewGeneratorService(GeneratorServiceOptions{
		ProjectRepo: &visualContextProjectRepoStub{project: &model.Project{
			ProjectID: "project-forged",
			PlanData:  string(planJSON),
		}},
		VisualContextSigningKey: visualContextTestSigningKey,
	})
	if _, err := generator.BindProjectVisualContext(context.Background(), "project-forged", forged); VisualContextErrorCode(err) != VisualContextErrorContractInvalid {
		t.Fatalf("expected matching forged project snapshot to be rejected, got %v", err)
	}
}

func TestDiscussionVisualContextAcceptsSignedContextBeforePlanSelection(t *testing.T) {
	generator := NewGeneratorService(GeneratorServiceOptions{
		VisualContextSigningKey: visualContextTestSigningKey,
	})
	req := &GenerateRequest{
		Mode:              serviceWorkflowModeDiscuss,
		ConversationStage: serviceWorkflowStagePlanSelection,
		VisualContext:     visualContextTrustFixture(t),
	}
	if err := generator.prepareRequestVisualContext(context.Background(), req, nil); err != nil {
		t.Fatalf("expected signed discussion visual context to pass before plan selection: %v", err)
	}
}

func TestPlanVisualContextRejectsUnsignedReuse(t *testing.T) {
	visualContext := visualContextTrustFixture(t)
	visualContext.ServerProof = ""
	planService := &PlanService{visualContextSigningKey: visualContextTestSigningKey}
	req := &GeneratePlansRequest{VisualContext: visualContext}
	err := planService.prepareRequestVisualContext(context.Background(), req, nil)
	if VisualContextErrorCode(err) != VisualContextErrorContractInvalid {
		t.Fatalf("expected unsigned plan visual context to be rejected, got %v", err)
	}
}

func TestPlanVisualContextAcceptsServerSignedReuse(t *testing.T) {
	planService := &PlanService{visualContextSigningKey: visualContextTestSigningKey}
	req := &GeneratePlansRequest{VisualContext: visualContextTrustFixture(t)}
	if err := planService.prepareRequestVisualContext(context.Background(), req, nil); err != nil {
		t.Fatalf("expected signed visual context reuse to pass: %v", err)
	}
}
