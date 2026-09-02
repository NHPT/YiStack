package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"path"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"yistack/internal/model"
	"yistack/pkg/llm"
)

const (
	MaxVisualAttachmentCount      = 4
	MaxVisualAttachmentBytes      = 5 * 1024 * 1024
	MaxVisualAttachmentTotalBytes = 12 * 1024 * 1024
	MaxVisualAttachmentDimension  = 8192
	MaxVisualAttachmentPixels     = 20_000_000
	MaxVisualRequestBodyBytes     = 20 * 1024 * 1024

	VisualContextErrorInvalidInput        = "visual_input_invalid"
	VisualContextErrorUnsupportedModel    = "visual_model_unsupported"
	VisualContextErrorAnalysisFailed      = "visual_analysis_failed"
	VisualContextErrorContractInvalid     = "visual_context_invalid"
	VisualContextErrorProviderUnavailable = "visual_provider_unavailable"
)

type visualContextAnalysis struct {
	SchemaVersion      string    `json:"schema_version"`
	Summary            string    `json:"summary"`
	Layout             []string  `json:"layout"`
	Components         []string  `json:"components"`
	ColorPalette       []string  `json:"color_palette"`
	Typography         []string  `json:"typography"`
	Spacing            []string  `json:"spacing"`
	ResponsiveBehavior []string  `json:"responsive_behavior"`
	InteractionNotes   *[]string `json:"interaction_notes"`
}

type preparedVisualAttachment struct {
	Input      model.VisualAttachmentInput
	Summary    model.VisualAttachmentSummary
	SourceSize int64
}

// VisualContextError 描述必须阻断视觉输入处理的稳定错误。
type VisualContextError struct {
	Code    string
	Message string
	Err     error
}

func (e *VisualContextError) Error() string {
	if e == nil {
		return ""
	}
	if strings.TrimSpace(e.Message) != "" {
		return e.Message
	}
	if e.Err != nil {
		return e.Err.Error()
	}
	return "视觉上下文处理失败"
}

func (e *VisualContextError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

// VisualContextErrorCode 返回视觉输入失败的稳定错误码。
func VisualContextErrorCode(err error) string {
	var visualErr *VisualContextError
	if errors.As(err, &visualErr) {
		return strings.TrimSpace(visualErr.Code)
	}
	return ""
}

func newVisualContextError(code, message string, err error) *VisualContextError {
	return &VisualContextError{
		Code:    strings.TrimSpace(code),
		Message: strings.TrimSpace(message),
		Err:     err,
	}
}

// PrepareVisualAttachments 校验并净化即将进入持久任务快照的图片输入。
func PrepareVisualAttachments(inputs []model.VisualAttachmentInput) ([]model.VisualAttachmentInput, error) {
	prepared, err := prepareVisualAttachments(inputs)
	if err != nil {
		return nil, err
	}
	result := make([]model.VisualAttachmentInput, 0, len(prepared))
	for _, attachment := range prepared {
		result = append(result, attachment.Input)
	}
	return result, nil
}

func prepareVisualAttachments(inputs []model.VisualAttachmentInput) ([]preparedVisualAttachment, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	if len(inputs) > MaxVisualAttachmentCount {
		return nil, newVisualContextError(
			VisualContextErrorInvalidInput,
			fmt.Sprintf("最多允许上传 %d 张参考图", MaxVisualAttachmentCount),
			nil,
		)
	}

	prepared := make([]preparedVisualAttachment, 0, len(inputs))
	sourceBytes := int64(0)
	sanitizedBytes := int64(0)
	for index, input := range inputs {
		attachment, err := prepareVisualAttachment(input)
		if err != nil {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("第 %d 张参考图无效: %s", index+1, err.Error()),
				err,
			)
		}
		sourceBytes += attachment.SourceSize
		sanitizedBytes += attachment.Input.Size
		if sourceBytes > MaxVisualAttachmentTotalBytes || sanitizedBytes > MaxVisualAttachmentTotalBytes {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("参考图总大小不能超过 %d MiB", MaxVisualAttachmentTotalBytes/(1024*1024)),
				nil,
			)
		}
		prepared = append(prepared, attachment)
	}
	return prepared, nil
}

func prepareVisualAttachment(input model.VisualAttachmentInput) (preparedVisualAttachment, error) {
	contentType := strings.ToLower(strings.TrimSpace(input.ContentType))
	if contentType != "image/png" && contentType != "image/jpeg" {
		return preparedVisualAttachment{}, errors.New("仅支持 PNG 或 JPEG 图片")
	}

	data, err := decodeVisualDataURL(strings.TrimSpace(input.DataURL), contentType)
	if err != nil {
		return preparedVisualAttachment{}, err
	}
	if len(data) == 0 || len(data) > MaxVisualAttachmentBytes {
		return preparedVisualAttachment{}, fmt.Errorf("单张图片大小必须在 1 字节到 %d MiB 之间", MaxVisualAttachmentBytes/(1024*1024))
	}
	if input.Size > 0 && input.Size != int64(len(data)) {
		return preparedVisualAttachment{}, errors.New("声明大小与实际图片大小不一致")
	}

	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return preparedVisualAttachment{}, fmt.Errorf("图片无法解码: %w", err)
	}
	if !visualImageFormatMatchesContentType(format, contentType) {
		return preparedVisualAttachment{}, errors.New("图片内容与 MIME 类型不一致")
	}
	if config.Width <= 0 || config.Height <= 0 ||
		config.Width > MaxVisualAttachmentDimension ||
		config.Height > MaxVisualAttachmentDimension ||
		int64(config.Width)*int64(config.Height) > MaxVisualAttachmentPixels {
		return preparedVisualAttachment{}, fmt.Errorf(
			"图片尺寸超出限制（最大边长 %d，最大像素数 %d）",
			MaxVisualAttachmentDimension,
			MaxVisualAttachmentPixels,
		)
	}

	decoded, decodedFormat, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return preparedVisualAttachment{}, fmt.Errorf("图片内容损坏: %w", err)
	}
	if !visualImageFormatMatchesContentType(decodedFormat, contentType) {
		return preparedVisualAttachment{}, errors.New("图片解码格式与 MIME 类型不一致")
	}

	sanitized, err := encodeSanitizedVisualImage(decoded, contentType)
	if err != nil {
		return preparedVisualAttachment{}, fmt.Errorf("图片净化失败: %w", err)
	}
	if len(sanitized) > MaxVisualAttachmentBytes {
		return preparedVisualAttachment{}, fmt.Errorf("净化后的图片超过 %d MiB", MaxVisualAttachmentBytes/(1024*1024))
	}

	hash := sha256.Sum256(sanitized)
	name := sanitizeVisualAttachmentName(input.Name, contentType)
	return preparedVisualAttachment{
		Input: model.VisualAttachmentInput{
			Name:        name,
			ContentType: contentType,
			Size:        int64(len(sanitized)),
			DataURL:     "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(sanitized),
		},
		Summary: model.VisualAttachmentSummary{
			Name:        name,
			ContentType: contentType,
			Size:        int64(len(sanitized)),
			SHA256:      hex.EncodeToString(hash[:]),
			Width:       config.Width,
			Height:      config.Height,
		},
		SourceSize: int64(len(data)),
	}, nil
}

func decodeVisualDataURL(dataURL, contentType string) ([]byte, error) {
	expectedPrefix := "data:" + contentType + ";base64,"
	if !strings.HasPrefix(dataURL, expectedPrefix) {
		return nil, errors.New("data URL 与声明的 MIME 类型不一致")
	}
	encoded := strings.TrimPrefix(dataURL, expectedPrefix)
	if encoded == "" {
		return nil, errors.New("图片数据为空")
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("Base64 图片数据无效: %w", err)
	}
	return decoded, nil
}

func visualImageFormatMatchesContentType(format, contentType string) bool {
	switch contentType {
	case "image/png":
		return format == "png"
	case "image/jpeg":
		return format == "jpeg"
	default:
		return false
	}
}

func encodeSanitizedVisualImage(source image.Image, contentType string) ([]byte, error) {
	var buffer bytes.Buffer
	switch contentType {
	case "image/png":
		encoder := png.Encoder{CompressionLevel: png.BestSpeed}
		if err := encoder.Encode(&buffer, source); err != nil {
			return nil, err
		}
	case "image/jpeg":
		if err := jpeg.Encode(&buffer, source, &jpeg.Options{Quality: 90}); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unsupported visual content type %q", contentType)
	}
	return buffer.Bytes(), nil
}

func sanitizeVisualAttachmentName(name, contentType string) string {
	normalized := path.Base(strings.ReplaceAll(strings.TrimSpace(name), "\\", "/"))
	if normalized == "." || normalized == "/" || normalized == "" {
		if contentType == "image/jpeg" {
			return "reference.jpg"
		}
		return "reference.png"
	}
	for len(normalized) > 120 {
		_, size := utf8.DecodeLastRuneInString(normalized)
		normalized = normalized[:len(normalized)-size]
	}
	return normalized
}

func analyzeVisualContext(
	ctx context.Context,
	llmClient *llm.ProviderManager,
	requestedProvider string,
	requestedModel string,
	inputs []model.VisualAttachmentInput,
	inputsPrepared bool,
	signingKey string,
	recordUse llmProviderUseRecorder,
) (*model.VisualContext, []model.VisualAttachmentInput, error) {
	var prepared []preparedVisualAttachment
	var err error
	if inputsPrepared {
		prepared, err = inspectPreparedVisualAttachments(inputs)
	} else {
		prepared, err = prepareVisualAttachments(inputs)
	}
	if err != nil {
		return nil, nil, err
	}
	if len(prepared) == 0 {
		return nil, nil, nil
	}
	if strings.TrimSpace(signingKey) == "" {
		return nil, nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文签名服务未配置",
			nil,
		)
	}
	if llmClient == nil {
		return nil, nil, newVisualContextError(
			VisualContextErrorProviderUnavailable,
			"视觉模型运行时未初始化",
			nil,
		)
	}

	providerName := initialProviderName(llmClient, requestedProvider)
	if strings.TrimSpace(providerName) == "" {
		return nil, nil, newVisualContextError(
			VisualContextErrorProviderUnavailable,
			"没有可用于视觉分析的模型",
			nil,
		)
	}
	if !llmClient.SupportsCapability(providerName, "vision") {
		return nil, nil, newVisualContextError(
			VisualContextErrorUnsupportedModel,
			"当前模型未声明 vision 能力，无法处理图片",
			nil,
		)
	}
	providerConfig := llmClient.GetConfig(providerName)
	if providerConfig == nil || strings.TrimSpace(providerConfig.Model) == "" {
		return nil, nil, newVisualContextError(
			VisualContextErrorProviderUnavailable,
			"视觉模型配置不完整",
			nil,
		)
	}
	configuredModel := strings.TrimSpace(providerConfig.Model)
	requestedModel = strings.TrimSpace(requestedModel)
	if requestedModel != "" && requestedModel != configuredModel {
		return nil, nil, newVisualContextError(
			VisualContextErrorUnsupportedModel,
			"请求模型与已声明 vision 能力的运行时模型不一致",
			nil,
		)
	}
	modelName := configuredModel

	parts := []llm.MessageContentPart{{
		Type: "text",
		Text: strings.Join([]string{
			"分析这些界面参考图，并只返回 visual_context.v1 JSON。",
			"提取可由应用实现消费的布局、组件、颜色、字体、间距、响应式和交互约束。",
			"只描述图片中有证据支持的内容；不确定时明确写为未知，不得根据文件名猜测。",
		}, "\n"),
	}}
	sanitizedInputs := make([]model.VisualAttachmentInput, 0, len(prepared))
	summaries := make([]model.VisualAttachmentSummary, 0, len(prepared))
	for _, attachment := range prepared {
		parts = append(parts, llm.MessageContentPart{
			Type: "image_url",
			ImageURL: &llm.MessageImageURL{
				URL:    attachment.Input.DataURL,
				Detail: "high",
			},
		})
		sanitizedInputs = append(sanitizedInputs, attachment.Input)
		summaries = append(summaries, attachment.Summary)
	}

	response, err := llmClient.ChatWithProvider(ctx, providerName, &llm.ChatRequest{
		Model: modelName,
		Messages: []llm.Message{
			{Role: "system", Content: visualContextSystemPrompt()},
			{Role: "user", Parts: parts},
		},
		Temperature:    0,
		MaxTokens:      2500,
		ResponseFormat: visualContextResponseFormat(),
	})
	if err != nil {
		return nil, nil, newVisualContextError(
			VisualContextErrorAnalysisFailed,
			"视觉模型分析失败",
			err,
		)
	}
	recordLLMProviderUse(ctx, recordUse, providerName)
	if response == nil || len(response.Choices) == 0 {
		return nil, nil, newVisualContextError(
			VisualContextErrorAnalysisFailed,
			"视觉模型未返回分析结果",
			nil,
		)
	}

	analysis, err := decodeVisualContextAnalysis(response.Choices[0].Message.Content)
	if err != nil {
		return nil, nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉模型返回内容不符合 visual_context.v1",
			err,
		)
	}
	result := &model.VisualContext{
		SchemaVersion:      model.VisualContextSchemaVersion,
		ID:                 uuid.NewString(),
		Summary:            analysis.Summary,
		Layout:             analysis.Layout,
		Components:         analysis.Components,
		ColorPalette:       analysis.ColorPalette,
		Typography:         analysis.Typography,
		Spacing:            analysis.Spacing,
		ResponsiveBehavior: analysis.ResponsiveBehavior,
		InteractionNotes:   append([]string(nil), (*analysis.InteractionNotes)...),
		Attachments:        summaries,
		Provider:           providerName,
		Model:              modelName,
		AnalyzedAt:         time.Now().UTC(),
	}
	if err := signVisualContext(result, signingKey); err != nil {
		return nil, nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文签名失败",
			err,
		)
	}
	return result, sanitizedInputs, nil
}

func visualContextSystemPrompt() string {
	return strings.Join([]string{
		"你是 YiStack 的视觉上下文分析器。",
		"你必须真实检查输入图片，不得用文件名、用户文本或模式匹配替代视觉理解。",
		"返回内容必须严格符合 visual_context.v1 JSON Schema，不得包含 Markdown 或额外字段。",
	}, "\n")
}

func visualContextResponseFormat() *llm.ChatResponseFormat {
	stringArray := func(minItems int) map[string]any {
		return map[string]any{
			"type":     "array",
			"items":    map[string]any{"type": "string", "minLength": 1, "maxLength": 500},
			"minItems": minItems,
			"maxItems": 32,
		}
	}
	return &llm.ChatResponseFormat{
		Type: "json_schema",
		JSONSchema: &llm.ChatResponseJSONSchema{
			Name:   "visual_context_v1",
			Strict: true,
			Schema: map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required": []string{
					"schema_version",
					"summary",
					"layout",
					"components",
					"color_palette",
					"typography",
					"spacing",
					"responsive_behavior",
					"interaction_notes",
				},
				"properties": map[string]any{
					"schema_version":      map[string]any{"type": "string", "const": model.VisualContextSchemaVersion},
					"summary":             map[string]any{"type": "string", "minLength": 1, "maxLength": 2000},
					"layout":              stringArray(1),
					"components":          stringArray(1),
					"color_palette":       stringArray(1),
					"typography":          stringArray(1),
					"spacing":             stringArray(1),
					"responsive_behavior": stringArray(1),
					"interaction_notes":   stringArray(0),
				},
			},
		},
	}
}

func decodeVisualContextAnalysis(content string) (visualContextAnalysis, error) {
	var result visualContextAnalysis
	decoder := json.NewDecoder(strings.NewReader(strings.TrimSpace(content)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&result); err != nil {
		return result, err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return result, errors.New("visual context contains trailing JSON")
		}
		return result, err
	}
	if err := validateVisualContextAnalysis(&result); err != nil {
		return result, err
	}
	return result, nil
}

func validateVisualContextAnalysis(result *visualContextAnalysis) error {
	if result == nil || result.SchemaVersion != model.VisualContextSchemaVersion {
		return fmt.Errorf("schema_version must be %q", model.VisualContextSchemaVersion)
	}
	result.Summary = strings.TrimSpace(result.Summary)
	if result.Summary == "" || len(result.Summary) > 2000 {
		return errors.New("summary must contain 1 to 2000 bytes")
	}
	requiredLists := []struct {
		name  string
		items *[]string
	}{
		{name: "layout", items: &result.Layout},
		{name: "components", items: &result.Components},
		{name: "color_palette", items: &result.ColorPalette},
		{name: "typography", items: &result.Typography},
		{name: "spacing", items: &result.Spacing},
		{name: "responsive_behavior", items: &result.ResponsiveBehavior},
	}
	for _, field := range requiredLists {
		if err := normalizeVisualContextList(field.name, field.items, true); err != nil {
			return err
		}
	}
	if result.InteractionNotes == nil {
		return errors.New("interaction_notes is missing")
	}
	return normalizeVisualContextList("interaction_notes", result.InteractionNotes, false)
}

func normalizeVisualContextList(name string, items *[]string, required bool) error {
	if items == nil {
		return fmt.Errorf("%s is missing", name)
	}
	if len(*items) > 32 {
		return fmt.Errorf("%s contains too many items", name)
	}
	normalized := make([]string, 0, len(*items))
	for _, item := range *items {
		value := strings.TrimSpace(item)
		if value == "" || len(value) > 500 {
			return fmt.Errorf("%s contains an invalid item", name)
		}
		normalized = append(normalized, value)
	}
	if required && len(normalized) == 0 {
		return fmt.Errorf("%s must not be empty", name)
	}
	*items = normalized
	return nil
}

func inspectPreparedVisualAttachments(inputs []model.VisualAttachmentInput) ([]preparedVisualAttachment, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	if len(inputs) > MaxVisualAttachmentCount {
		return nil, newVisualContextError(
			VisualContextErrorInvalidInput,
			fmt.Sprintf("最多允许上传 %d 张参考图", MaxVisualAttachmentCount),
			nil,
		)
	}

	prepared := make([]preparedVisualAttachment, 0, len(inputs))
	totalBytes := 0
	for index, input := range inputs {
		contentType := strings.ToLower(strings.TrimSpace(input.ContentType))
		if contentType != "image/png" && contentType != "image/jpeg" {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("第 %d 张参考图无效: 仅支持 PNG 或 JPEG 图片", index+1),
				nil,
			)
		}
		data, err := decodeVisualDataURL(strings.TrimSpace(input.DataURL), contentType)
		if err != nil || len(data) == 0 || len(data) > MaxVisualAttachmentBytes || input.Size != int64(len(data)) {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("第 %d 张参考图的已净化快照无效", index+1),
				err,
			)
		}
		config, format, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil || !visualImageFormatMatchesContentType(format, contentType) {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("第 %d 张参考图的已净化快照无法解码", index+1),
				err,
			)
		}
		if config.Width <= 0 || config.Height <= 0 ||
			config.Width > MaxVisualAttachmentDimension ||
			config.Height > MaxVisualAttachmentDimension ||
			int64(config.Width)*int64(config.Height) > MaxVisualAttachmentPixels {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("第 %d 张参考图尺寸超出限制", index+1),
				nil,
			)
		}
		totalBytes += len(data)
		if totalBytes > MaxVisualAttachmentTotalBytes {
			return nil, newVisualContextError(
				VisualContextErrorInvalidInput,
				fmt.Sprintf("参考图总大小不能超过 %d MiB", MaxVisualAttachmentTotalBytes/(1024*1024)),
				nil,
			)
		}
		hash := sha256.Sum256(data)
		name := sanitizeVisualAttachmentName(input.Name, contentType)
		prepared = append(prepared, preparedVisualAttachment{
			Input: model.VisualAttachmentInput{
				Name:        name,
				ContentType: contentType,
				Size:        int64(len(data)),
				DataURL:     "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(data),
			},
			Summary: model.VisualAttachmentSummary{
				Name:        name,
				ContentType: contentType,
				Size:        int64(len(data)),
				SHA256:      hex.EncodeToString(hash[:]),
				Width:       config.Width,
				Height:      config.Height,
			},
			SourceSize: int64(len(data)),
		})
	}
	return prepared, nil
}

func (s *GeneratorService) prepareRequestVisualContext(
	ctx context.Context,
	req *GenerateRequest,
	handler StreamEventHandler,
) error {
	if req == nil {
		return nil
	}
	if len(req.VisualAttachments) == 0 {
		if req.VisualContext == nil {
			return nil
		}
		if req.Mode == serviceWorkflowModeDiscuss && req.ConversationStage == serviceWorkflowStagePlanSelection {
			if err := validateReusableVisualContext(req.VisualContext); err != nil {
				return err
			}
			if err := verifyVisualContextProof(req.VisualContext, s.visualContextSigningKey); err != nil {
				return err
			}
			return emitVisualContextReady(handler, req.VisualContext)
		}
		trustedContext, err := s.loadTrustedProjectVisualContext(ctx, req.ProjectID, req.VisualContext)
		if err != nil {
			return err
		}
		req.VisualContext = trustedContext
		return emitVisualContextReady(handler, req.VisualContext)
	}

	_ = emitWorkflowStep(
		handler,
		"analyze-visual-context",
		"visual_analysis",
		"分析视觉参考",
		"正在使用具备 vision 能力的模型分析参考图。",
		"running",
		nil,
	)
	visualContext, prepared, err := analyzeVisualContext(
		ctx,
		s.llmClient,
		req.Provider,
		req.Model,
		req.VisualAttachments,
		req.VisualAttachmentsPrepared,
		s.visualContextSigningKey,
		s.recordProviderUse,
	)
	if err != nil {
		_ = emitVisualContextFailure(handler, err)
		return err
	}
	req.VisualAttachments = prepared
	req.VisualAttachmentsPrepared = true
	req.VisualContext = visualContext
	return emitVisualContextReady(handler, visualContext)
}

func (s *PlanService) prepareRequestVisualContext(
	ctx context.Context,
	req *GeneratePlansRequest,
	handler StreamEventHandler,
) error {
	if req == nil {
		return nil
	}
	if len(req.VisualAttachments) == 0 {
		if req.VisualContext == nil {
			return nil
		}
		if err := validateReusableVisualContext(req.VisualContext); err != nil {
			return err
		}
		if err := verifyVisualContextProof(req.VisualContext, s.visualContextSigningKey); err != nil {
			return err
		}
		return emitVisualContextReady(handler, req.VisualContext)
	}

	_ = emitWorkflowStep(
		handler,
		"analyze-visual-context",
		"visual_analysis",
		"分析视觉参考",
		"正在使用具备 vision 能力的模型分析参考图。",
		"running",
		nil,
	)
	visualContext, prepared, err := analyzeVisualContext(
		ctx,
		s.llmClient,
		req.Provider,
		"",
		req.VisualAttachments,
		req.VisualAttachmentsPrepared,
		s.visualContextSigningKey,
		s.recordProviderUse,
	)
	if err != nil {
		_ = emitVisualContextFailure(handler, err)
		return err
	}
	req.VisualAttachments = prepared
	req.VisualAttachmentsPrepared = true
	req.VisualContext = visualContext
	return emitVisualContextReady(handler, visualContext)
}

func emitVisualContextFailure(handler StreamEventHandler, err error) error {
	code := VisualContextErrorCode(err)
	if code == "" {
		code = VisualContextErrorAnalysisFailed
	}
	return emitStreamEvent(handler, StreamEventError, map[string]any{
		"code":     code,
		"blocking": true,
		"message":  err.Error(),
		"details":  err.Error(),
	})
}

func emitVisualContextReady(handler StreamEventHandler, visualContext *model.VisualContext) error {
	if visualContext == nil {
		return nil
	}
	if err := emitStreamEvent(handler, StreamEventVisualContext, map[string]any{
		"visual_context": visualContext,
	}); err != nil {
		return err
	}
	return emitWorkflowStep(
		handler,
		"analyze-visual-context",
		"visual_analysis",
		"视觉参考分析完成",
		fmt.Sprintf("已提取 %d 张参考图的布局、组件和视觉约束。", len(visualContext.Attachments)),
		"done",
		map[string]any{"visual_context_id": visualContext.ID},
	)
}

// BindProjectVisualContext replaces a client-supplied context with the matching server-stored Plan snapshot.
func (s *GeneratorService) BindProjectVisualContext(
	ctx context.Context,
	projectID string,
	requested *model.VisualContext,
) (*model.VisualContext, error) {
	return s.loadTrustedProjectVisualContext(ctx, projectID, requested)
}

func (s *GeneratorService) loadTrustedProjectVisualContext(
	ctx context.Context,
	projectID string,
	requested *model.VisualContext,
) (*model.VisualContext, error) {
	if err := validateReusableVisualContext(requested); err != nil {
		return nil, err
	}
	if s == nil || s.projectRepo == nil || strings.TrimSpace(projectID) == "" {
		return nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文缺少可信项目方案绑定",
			nil,
		)
	}
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil || project == nil {
		return nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"无法验证视觉上下文的项目方案绑定",
			err,
		)
	}
	var plan model.Plan
	if err := json.Unmarshal([]byte(strings.TrimSpace(project.PlanData)), &plan); err != nil || plan.VisualContext == nil {
		return nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"项目方案未包含可复用的视觉上下文",
			err,
		)
	}
	if err := validateReusableVisualContext(plan.VisualContext); err != nil {
		return nil, err
	}
	if err := verifyVisualContextProof(plan.VisualContext, s.visualContextSigningKey); err != nil {
		return nil, err
	}
	requestedJSON, requestedErr := json.Marshal(requested)
	storedJSON, storedErr := json.Marshal(plan.VisualContext)
	if requestedErr != nil || storedErr != nil || bytes.Equal(requestedJSON, storedJSON) == false {
		return nil, newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文与项目已保存方案不一致",
			nil,
		)
	}
	return plan.VisualContext, nil
}

func validateReusableVisualContext(visualContext *model.VisualContext) error {
	if visualContext == nil {
		return nil
	}
	interactionNotes := append([]string(nil), visualContext.InteractionNotes...)
	analysis := visualContextAnalysis{
		SchemaVersion:      visualContext.SchemaVersion,
		Summary:            visualContext.Summary,
		Layout:             append([]string(nil), visualContext.Layout...),
		Components:         append([]string(nil), visualContext.Components...),
		ColorPalette:       append([]string(nil), visualContext.ColorPalette...),
		Typography:         append([]string(nil), visualContext.Typography...),
		Spacing:            append([]string(nil), visualContext.Spacing...),
		ResponsiveBehavior: append([]string(nil), visualContext.ResponsiveBehavior...),
		InteractionNotes:   &interactionNotes,
	}
	if err := validateVisualContextAnalysis(&analysis); err != nil {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"复用的视觉上下文不符合 visual_context.v1",
			err,
		)
	}
	if strings.TrimSpace(visualContext.ID) == "" ||
		strings.TrimSpace(visualContext.ServerProof) == "" ||
		strings.TrimSpace(visualContext.Provider) == "" ||
		strings.TrimSpace(visualContext.Model) == "" ||
		len(visualContext.Attachments) == 0 {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"复用的视觉上下文缺少分析来源证据",
			nil,
		)
	}
	return nil
}

func visualContextProofPayload(visualContext *model.VisualContext) ([]byte, error) {
	if visualContext == nil {
		return nil, errors.New("visual context is missing")
	}
	unsigned := *visualContext
	unsigned.ServerProof = ""
	return json.Marshal(unsigned)
}

func signVisualContext(visualContext *model.VisualContext, signingKey string) error {
	key := strings.TrimSpace(signingKey)
	if key == "" {
		return errors.New("visual context signing key is missing")
	}
	payload, err := visualContextProofPayload(visualContext)
	if err != nil {
		return err
	}
	mac := hmac.New(sha256.New, []byte(key))
	if _, err := mac.Write(payload); err != nil {
		return err
	}
	visualContext.ServerProof = hex.EncodeToString(mac.Sum(nil))
	return nil
}

func verifyVisualContextProof(visualContext *model.VisualContext, signingKey string) error {
	key := strings.TrimSpace(signingKey)
	if key == "" {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文签名服务未配置",
			nil,
		)
	}
	proof, err := hex.DecodeString(strings.TrimSpace(visualContext.ServerProof))
	if err != nil || len(proof) != sha256.Size {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文缺少有效的服务端证明",
			err,
		)
	}
	payload, err := visualContextProofPayload(visualContext)
	if err != nil {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文证明无法验证",
			err,
		)
	}
	mac := hmac.New(sha256.New, []byte(key))
	if _, err := mac.Write(payload); err != nil {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文证明无法验证",
			err,
		)
	}
	if hmac.Equal(proof, mac.Sum(nil)) == false {
		return newVisualContextError(
			VisualContextErrorContractInvalid,
			"视觉上下文服务端证明不匹配",
			nil,
		)
	}
	return nil
}
func visualContextPromptSection(visualContext *model.VisualContext) string {
	if visualContext == nil {
		return ""
	}
	encoded, err := json.Marshal(visualContext)
	if err != nil {
		return ""
	}
	return strings.Join([]string{
		"已验证视觉上下文（visual_context.v1）：",
		string(encoded),
		"方案与实现必须实际遵循其中的布局、组件、颜色、字体、间距、响应式和交互约束。不得用通用模板覆盖这些约束。",
	}, "\n")
}

func appendVisualContextPrompt(base string, visualContext *model.VisualContext) string {
	visualSection := visualContextPromptSection(visualContext)
	if visualSection == "" {
		return strings.TrimSpace(base)
	}
	if strings.TrimSpace(base) == "" {
		return visualSection
	}
	return strings.TrimSpace(base) + "\n\n" + visualSection
}

func marshalVisualAttachmentsSnapshot(attachments []model.VisualAttachmentInput) string {
	if len(attachments) == 0 {
		return ""
	}
	encoded, err := json.Marshal(attachments)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func marshalVisualContextSnapshot(visualContext *model.VisualContext) string {
	if visualContext == nil {
		return ""
	}
	encoded, err := json.Marshal(visualContext)
	if err != nil {
		return ""
	}
	return string(encoded)
}
