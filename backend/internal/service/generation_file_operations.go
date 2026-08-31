package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	pathpkg "path"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"yistack/pkg/container"
)

const (
	GenerationFileOperationCreate  = "create"
	GenerationFileOperationReplace = "replace"
	GenerationFileOperationPatch   = "patch"
	GenerationFileOperationDelete  = "delete"

	generationMaxOperations       = 128
	generationMaxOperationContent = 1024 * 1024
	generationMaxPatchEdits       = 128
	generationFileRollbackTimeout = 30 * time.Second
)

var generationSHA256Pattern = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)

type GenerationTextEdit struct {
	OldText string `json:"old_text"`
	NewText string `json:"new_text"`
}

type GenerationFileOperation struct {
	Operation   string               `json:"operation"`
	Path        string               `json:"path"`
	Description string               `json:"description"`
	BaseHash    string               `json:"base_hash,omitempty"`
	Content     string               `json:"content,omitempty"`
	Edits       []GenerationTextEdit `json:"edits,omitempty"`
	ResultHash  string               `json:"result_hash,omitempty"`
}

type generationFileOperationWire struct {
	Operation   *string                   `json:"operation"`
	Path        *string                   `json:"path"`
	Description *string                   `json:"description"`
	BaseHash    *string                   `json:"base_hash,omitempty"`
	Content     *string                   `json:"content,omitempty"`
	Edits       *[]generationTextEditWire `json:"edits,omitempty"`
}

type generationTextEditWire struct {
	OldText *string `json:"old_text"`
	NewText *string `json:"new_text"`
}

type GenerationFileConflict struct {
	Operation    string `json:"operation"`
	Path         string `json:"path"`
	Kind         string `json:"kind"`
	ExpectedHash string `json:"expected_hash,omitempty"`
	ActualHash   string `json:"actual_hash,omitempty"`
	Message      string `json:"message"`
}

type generationFileWorkspace interface {
	PathExists(ctx context.Context, projectID, path string) (bool, error)
	ReadFile(ctx context.Context, projectID, path string) (string, error)
	WriteFile(ctx context.Context, projectID, path, content string) error
	CreateFile(ctx context.Context, projectID, path, content string) error
	DeletePath(ctx context.Context, projectID, path string) error
	PathDirty(ctx context.Context, projectID, path string) (bool, error)
}

type containerGenerationFileWorkspace struct {
	manager *container.Manager
}

func (w containerGenerationFileWorkspace) PathExists(ctx context.Context, projectID, path string) (bool, error) {
	return projectPathExistsInContainer(ctx, w.manager, projectID, path)
}

func (w containerGenerationFileWorkspace) ReadFile(ctx context.Context, projectID, path string) (string, error) {
	return readProjectFileInContainer(ctx, w.manager, projectID, path)
}

func (w containerGenerationFileWorkspace) WriteFile(ctx context.Context, projectID, path, content string) error {
	return writeFileInContainer(ctx, w.manager, projectID, path, content)
}

func (w containerGenerationFileWorkspace) CreateFile(ctx context.Context, projectID, path, content string) error {
	return createFileInContainer(ctx, w.manager, projectID, path, content)
}

func (w containerGenerationFileWorkspace) DeletePath(ctx context.Context, projectID, path string) error {
	return deletePathInContainer(ctx, w.manager, projectID, path)
}

func (w containerGenerationFileWorkspace) PathDirty(ctx context.Context, projectID, path string) (bool, error) {
	output, err := runGitInContainer(ctx, w.manager, projectID, "status", "--porcelain", "--", path)
	if err != nil {
		return false, err
	}
	return len(parseGitWorktreeFileRecords(output)) > 0, nil
}

type generationOperationPlan struct {
	operation     GenerationFileOperation
	existed       bool
	original      string
	originalHash  string
	resultContent string
	resultHash    string
	deleted       bool
}

type appliedGenerationOperation struct {
	path       string
	existed    bool
	original   string
	resultHash string
	deleted    bool
}

func generationContentHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func isProtectedGenerationPath(filePath string) bool {
	normalized := strings.ToLower(strings.TrimSpace(filePath))
	base := pathpkg.Base(normalized)
	for _, segment := range strings.Split(normalized, "/") {
		switch segment {
		case ".git", ".yistack", ".ssh", ".aws", ".gnupg":
			return true
		}
	}
	if base == ".env" || (strings.HasPrefix(base, ".env.") && base != ".env.example") ||
		base == "id_rsa" || base == "id_ed25519" || base == "credentials" ||
		base == ".npmrc" || base == ".pypirc" || base == ".netrc" {
		return true
	}
	switch strings.ToLower(pathpkg.Ext(base)) {
	case ".pem", ".key", ".p12", ".pfx":
		return true
	default:
		return false
	}
}

func containsPrivateKeyMaterial(content string) bool {
	normalized := strings.ToUpper(content)
	beginMarker := "-----BEGIN "
	return strings.Contains(normalized, beginMarker+"PRIVATE KEY-----") ||
		strings.Contains(normalized, beginMarker+"RSA PRIVATE KEY-----") ||
		strings.Contains(normalized, beginMarker+"OPENSSH PRIVATE KEY-----")
}

func normalizeGenerationBaseHash(value string) (string, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if !generationSHA256Pattern.MatchString(value) {
		return "", errors.New("must be a 64-character SHA-256 hex value")
	}
	return value, nil
}

func validateGenerationFileOperations(wires []generationFileOperationWire) ([]GenerationFileOperation, error) {
	if len(wires) == 0 {
		return nil, errors.New("operations must be a non-empty array")
	}
	if len(wires) > generationMaxOperations {
		return nil, fmt.Errorf("operations exceeds hard limit %d", generationMaxOperations)
	}
	operations := make([]GenerationFileOperation, 0, len(wires))
	seenPaths := make(map[string]struct{}, len(wires))
	for index, wire := range wires {
		operation, err := validateGenerationFileOperationWire(index, wire)
		if err != nil {
			return nil, err
		}
		if _, exists := seenPaths[operation.Path]; exists {
			return nil, fmt.Errorf("duplicate operation path %q", operation.Path)
		}
		seenPaths[operation.Path] = struct{}{}
		operations = append(operations, operation)
	}
	return operations, nil
}

func validateGenerationFileOperationWire(index int, wire generationFileOperationWire) (GenerationFileOperation, error) {
	if wire.Operation == nil || wire.Path == nil || wire.Description == nil {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d] must include operation, path and description", index)
	}
	operationType := strings.ToLower(strings.TrimSpace(*wire.Operation))
	normalizedPath, err := normalizeProjectRelativePath(*wire.Path)
	if err != nil {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].path is invalid: %w", index, err)
	}
	if isProtectedGenerationPath(normalizedPath) {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].path is protected: %s", index, normalizedPath)
	}
	description := strings.TrimSpace(*wire.Description)
	if description == "" {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].description must be non-empty", index)
	}

	operation := GenerationFileOperation{Operation: operationType, Path: normalizedPath, Description: description}
	switch operationType {
	case GenerationFileOperationCreate:
		if wire.Content == nil || wire.BaseHash != nil || wire.Edits != nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d] create must include content only", index)
		}
		operation.Content = *wire.Content
	case GenerationFileOperationReplace:
		if wire.Content == nil || wire.BaseHash == nil || wire.Edits != nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d] replace must include content and base_hash", index)
		}
		operation.Content = *wire.Content
		operation.BaseHash, err = normalizeGenerationBaseHash(*wire.BaseHash)
		if err != nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d].base_hash is invalid: %w", index, err)
		}
	case GenerationFileOperationPatch:
		if wire.Content != nil || wire.BaseHash == nil || wire.Edits == nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d] patch must include base_hash and edits", index)
		}
		operation.BaseHash, err = normalizeGenerationBaseHash(*wire.BaseHash)
		if err != nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d].base_hash is invalid: %w", index, err)
		}
		operation.Edits, err = validateGenerationTextEdits(index, *wire.Edits)
		if err != nil {
			return GenerationFileOperation{}, err
		}
	case GenerationFileOperationDelete:
		if wire.Content != nil || wire.BaseHash == nil || wire.Edits != nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d] delete must include base_hash only", index)
		}
		operation.BaseHash, err = normalizeGenerationBaseHash(*wire.BaseHash)
		if err != nil {
			return GenerationFileOperation{}, fmt.Errorf("operations[%d].base_hash is invalid: %w", index, err)
		}
	default:
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].operation must be create, replace, patch or delete", index)
	}
	if len(operation.Content) > generationMaxOperationContent {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].content exceeds hard limit %d bytes", index, generationMaxOperationContent)
	}
	if operation.Operation != GenerationFileOperationPatch && !utf8.ValidString(operation.Content) {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].content must be valid UTF-8", index)
	}
	if containsPrivateKeyMaterial(operation.Content) {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].content contains private key material", index)
	}
	if err := validateGeneratedSupabaseSecretContent(operation.Path, operation.Content); err != nil {
		return GenerationFileOperation{}, fmt.Errorf("operations[%d].content: %w", index, err)
	}
	return operation, nil
}

func validateGenerationTextEdits(operationIndex int, wires []generationTextEditWire) ([]GenerationTextEdit, error) {
	if len(wires) == 0 {
		return nil, fmt.Errorf("operations[%d].edits must be a non-empty array", operationIndex)
	}
	if len(wires) > generationMaxPatchEdits {
		return nil, fmt.Errorf("operations[%d].edits exceeds hard limit %d", operationIndex, generationMaxPatchEdits)
	}
	edits := make([]GenerationTextEdit, 0, len(wires))
	totalSize := 0
	for editIndex, wire := range wires {
		if wire.OldText == nil || wire.NewText == nil {
			return nil, fmt.Errorf("operations[%d].edits[%d] must include old_text and new_text", operationIndex, editIndex)
		}
		if *wire.OldText == "" {
			return nil, fmt.Errorf("operations[%d].edits[%d].old_text must be non-empty", operationIndex, editIndex)
		}
		if *wire.OldText == *wire.NewText {
			return nil, fmt.Errorf("operations[%d].edits[%d] must change content", operationIndex, editIndex)
		}
		if !utf8.ValidString(*wire.OldText) || !utf8.ValidString(*wire.NewText) {
			return nil, fmt.Errorf("operations[%d].edits[%d] must be valid UTF-8", operationIndex, editIndex)
		}
		if containsPrivateKeyMaterial(*wire.NewText) {
			return nil, fmt.Errorf("operations[%d].edits[%d].new_text contains private key material", operationIndex, editIndex)
		}
		if err := validateGeneratedSupabaseSecretContent("patch", *wire.NewText); err != nil {
			return nil, fmt.Errorf("operations[%d].edits[%d].new_text: %w", operationIndex, editIndex, err)
		}
		totalSize += len(*wire.OldText) + len(*wire.NewText)
		if totalSize > generationMaxOperationContent {
			return nil, fmt.Errorf("operations[%d].edits exceeds hard content limit %d bytes", operationIndex, generationMaxOperationContent)
		}
		edits = append(edits, GenerationTextEdit{OldText: *wire.OldText, NewText: *wire.NewText})
	}
	return edits, nil
}

func applyGenerationTextEdits(content string, edits []GenerationTextEdit) (string, error) {
	result := content
	for index, edit := range edits {
		matches := strings.Count(result, edit.OldText)
		if matches != 1 {
			return "", fmt.Errorf("edits[%d].old_text must match exactly once, matched %d times", index, matches)
		}
		result = strings.Replace(result, edit.OldText, edit.NewText, 1)
	}
	if len(result) > generationMaxOperationContent {
		return "", fmt.Errorf("patched content exceeds hard limit %d bytes", generationMaxOperationContent)
	}
	if !utf8.ValidString(result) {
		return "", errors.New("patched content must be valid UTF-8")
	}
	return result, nil
}

func preflightGenerationFileOperations(
	ctx context.Context,
	workspace generationFileWorkspace,
	projectID string,
	operations []GenerationFileOperation,
	ownedPaths map[string]struct{},
) ([]generationOperationPlan, error) {
	if workspace == nil {
		return nil, errors.New("generation file workspace not available")
	}
	plans := make([]generationOperationPlan, 0, len(operations))
	for _, operation := range operations {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if _, owned := ownedPaths[operation.Path]; !owned {
			dirty, err := workspace.PathDirty(ctx, projectID, operation.Path)
			if err != nil {
				return nil, newGenerationFileConflict(operation, "dirty_check_failed", operation.BaseHash, "", err.Error(), err)
			}
			if dirty {
				return nil, newGenerationFileConflict(operation, "dirty_path", operation.BaseHash, "", "target path has uncommitted user changes", nil)
			}
		}

		exists, err := workspace.PathExists(ctx, projectID, operation.Path)
		if err != nil {
			return nil, newGenerationFileConflict(operation, "stat_failed", operation.BaseHash, "", err.Error(), err)
		}
		plan := generationOperationPlan{operation: operation, existed: exists}
		if operation.Operation == GenerationFileOperationCreate {
			if exists {
				return nil, newGenerationFileConflict(operation, "path_exists", "", "", "create target already exists", nil)
			}
			plan.resultContent = operation.Content
			plan.resultHash = generationContentHash(operation.Content)
			plans = append(plans, plan)
			continue
		}
		if !exists {
			return nil, newGenerationFileConflict(operation, "path_missing", operation.BaseHash, "", "target file does not exist", nil)
		}
		content, err := workspace.ReadFile(ctx, projectID, operation.Path)
		if err != nil {
			return nil, newGenerationFileConflict(operation, "read_failed", operation.BaseHash, "", err.Error(), err)
		}
		actualHash := generationContentHash(content)
		if actualHash != operation.BaseHash {
			return nil, newGenerationFileConflict(operation, "base_hash_mismatch", operation.BaseHash, actualHash, "target file changed since the model snapshot", nil)
		}
		plan.original = content
		plan.originalHash = actualHash
		switch operation.Operation {
		case GenerationFileOperationReplace:
			plan.resultContent = operation.Content
			plan.resultHash = generationContentHash(operation.Content)
		case GenerationFileOperationPatch:
			patched, patchErr := applyGenerationTextEdits(content, operation.Edits)
			if patchErr != nil {
				return nil, newGenerationFileConflict(operation, "patch_context_mismatch", operation.BaseHash, actualHash, patchErr.Error(), patchErr)
			}
			plan.resultContent = patched
			plan.resultHash = generationContentHash(patched)
		case GenerationFileOperationDelete:
			plan.deleted = true
			plan.resultHash = generationContentHash("")
		}
		if !plan.deleted && plan.resultHash == plan.originalHash {
			return nil, newGenerationFileConflict(operation, "no_content_change", operation.BaseHash, actualHash, "operation does not change target content", nil)
		}
		plans = append(plans, plan)
	}
	return plans, nil
}

func applyGenerationFileOperations(
	ctx context.Context,
	workspace generationFileWorkspace,
	projectID string,
	operations []GenerationFileOperation,
	ownedPaths map[string]struct{},
	handler StreamEventHandler,
) ([]GenerationFileOperation, []FileToGenerate, error) {
	plans, err := preflightGenerationFileOperations(ctx, workspace, projectID, operations, ownedPaths)
	if err != nil {
		return nil, nil, err
	}
	applied := make([]appliedGenerationOperation, 0, len(plans))
	normalized := make([]GenerationFileOperation, 0, len(plans))
	files := make([]FileToGenerate, 0, len(plans))
	for _, plan := range plans {
		if err := ctx.Err(); err != nil {
			return nil, nil, rollbackGenerationFileOperations(ctx, workspace, projectID, applied, err)
		}
		if err := recheckGenerationOperationPlan(ctx, workspace, projectID, plan); err != nil {
			return nil, nil, rollbackGenerationFileOperations(ctx, workspace, projectID, applied, err)
		}

		operation := plan.operation
		meta := map[string]any{"operation": operation.Operation, "path": operation.Path, "base_hash": operation.BaseHash}
		_ = emitWorkflowStep(handler, "file-operation:"+operation.Path, generationOperationStepKind(operation.Operation), generationOperationStepTitle(operation.Operation), operation.Path, "running", meta)
		switch operation.Operation {
		case GenerationFileOperationCreate:
			err = workspace.CreateFile(ctx, projectID, operation.Path, plan.resultContent)
		case GenerationFileOperationReplace, GenerationFileOperationPatch:
			err = workspace.WriteFile(ctx, projectID, operation.Path, plan.resultContent)
		case GenerationFileOperationDelete:
			err = workspace.DeletePath(ctx, projectID, operation.Path)
		}
		if err != nil {
			failure := newGenerationFileConflict(operation, "apply_failed", operation.BaseHash, "", err.Error(), err)
			meta["reason_code"] = failure.Code
			_ = emitWorkflowStep(handler, "file-operation:"+operation.Path, generationOperationStepKind(operation.Operation), generationOperationStepTitle(operation.Operation), failure.Error(), "failed", meta)
			return nil, nil, rollbackGenerationFileOperations(ctx, workspace, projectID, applied, failure)
		}
		applied = append(applied, appliedGenerationOperation{
			path: operation.Path, existed: plan.existed, original: plan.original,
			resultHash: plan.resultHash, deleted: plan.deleted,
		})
		if verifyErr := verifyGenerationOperationResult(ctx, workspace, projectID, plan); verifyErr != nil {
			return nil, nil, rollbackGenerationFileOperations(ctx, workspace, projectID, applied, verifyErr)
		}

		operation.ResultHash = plan.resultHash
		normalized = append(normalized, operation)
		if !plan.deleted {
			files = append(files, FileToGenerate{Path: operation.Path, Content: plan.resultContent, Description: operation.Description})
		}
		meta["result_hash"] = operation.ResultHash
		meta["content"] = plan.resultContent
		_ = emitWorkflowStep(handler, "file-operation:"+operation.Path, generationOperationStepKind(operation.Operation), generationOperationStepTitle(operation.Operation), "文件操作已应用并完成结果 hash 校验。", "done", meta)
	}
	return normalized, files, nil
}

func recheckGenerationOperationPlan(ctx context.Context, workspace generationFileWorkspace, projectID string, plan generationOperationPlan) error {
	exists, err := workspace.PathExists(ctx, projectID, plan.operation.Path)
	if err != nil {
		return newGenerationFileConflict(plan.operation, "concurrent_stat_failed", plan.originalHash, "", err.Error(), err)
	}
	if exists != plan.existed {
		return newGenerationFileConflict(plan.operation, "concurrent_existence_change", plan.originalHash, "", "target existence changed after preflight", nil)
	}
	if !exists {
		return nil
	}
	content, err := workspace.ReadFile(ctx, projectID, plan.operation.Path)
	if err != nil {
		return newGenerationFileConflict(plan.operation, "concurrent_read_failed", plan.originalHash, "", err.Error(), err)
	}
	actualHash := generationContentHash(content)
	if actualHash != plan.originalHash {
		return newGenerationFileConflict(plan.operation, "concurrent_hash_change", plan.originalHash, actualHash, "target changed after preflight", nil)
	}
	return nil
}

func verifyGenerationOperationResult(ctx context.Context, workspace generationFileWorkspace, projectID string, plan generationOperationPlan) error {
	exists, err := workspace.PathExists(ctx, projectID, plan.operation.Path)
	if err != nil {
		return newGenerationFileConflict(plan.operation, "result_stat_failed", plan.resultHash, "", err.Error(), err)
	}
	if plan.deleted {
		if exists {
			return newGenerationFileConflict(plan.operation, "delete_not_applied", plan.resultHash, "", "deleted path still exists", nil)
		}
		return nil
	}
	if !exists {
		return newGenerationFileConflict(plan.operation, "result_missing", plan.resultHash, "", "written path does not exist", nil)
	}
	content, err := workspace.ReadFile(ctx, projectID, plan.operation.Path)
	if err != nil {
		return newGenerationFileConflict(plan.operation, "result_read_failed", plan.resultHash, "", err.Error(), err)
	}
	actualHash := generationContentHash(content)
	if actualHash != plan.resultHash {
		return newGenerationFileConflict(plan.operation, "result_hash_mismatch", plan.resultHash, actualHash, "written content hash does not match", nil)
	}
	return nil
}

func rollbackGenerationFileOperations(
	_ context.Context,
	workspace generationFileWorkspace,
	projectID string,
	applied []appliedGenerationOperation,
	cause error,
) error {
	rollbackCtx, cancel := context.WithTimeout(
		context.Background(),
		generationFileRollbackTimeout,
	)
	defer cancel()

	var rollbackErrors []string
	for index := len(applied) - 1; index >= 0; index-- {
		item := applied[index]
		exists, err := workspace.PathExists(rollbackCtx, projectID, item.path)
		if err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %v", item.path, err))
			continue
		}
		if item.deleted {
			if exists {
				rollbackErrors = append(rollbackErrors, fmt.Sprintf(
					"%s: rollback conflict: deleted path was recreated concurrently",
					item.path,
				))
				continue
			}
			if err := workspace.CreateFile(rollbackCtx, projectID, item.path, item.original); err != nil {
				rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %v", item.path, err))
			}
			continue
		}
		if !exists {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf(
				"%s: rollback conflict: generated path is missing",
				item.path,
			))
			continue
		}
		content, err := workspace.ReadFile(rollbackCtx, projectID, item.path)
		if err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %v", item.path, err))
			continue
		}
		actualHash := generationContentHash(content)
		if actualHash != item.resultHash {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf(
				"%s: rollback conflict: expected generated hash %s, got %s",
				item.path,
				item.resultHash,
				actualHash,
			))
			continue
		}
		if item.existed {
			err = workspace.WriteFile(rollbackCtx, projectID, item.path, item.original)
		} else {
			err = workspace.DeletePath(rollbackCtx, projectID, item.path)
		}
		if err != nil {
			rollbackErrors = append(rollbackErrors, fmt.Sprintf("%s: %v", item.path, err))
		}
	}
	if len(rollbackErrors) == 0 {
		return cause
	}
	sort.Strings(rollbackErrors)
	return fmt.Errorf("%w; rollback failed: %s", cause, strings.Join(rollbackErrors, "; "))
}

func generationOperationStepKind(operation string) string {
	switch operation {
	case GenerationFileOperationCreate:
		return "create_file"
	case GenerationFileOperationDelete:
		return "delete_file"
	default:
		return "write_file"
	}
}

func generationOperationStepTitle(operation string) string {
	switch operation {
	case GenerationFileOperationCreate:
		return "创建文件"
	case GenerationFileOperationReplace:
		return "替换文件"
	case GenerationFileOperationPatch:
		return "更新文件"
	case GenerationFileOperationDelete:
		return "删除文件"
	default:
		return "文件操作"
	}
}

func (s *GeneratorService) activeGenerationFileWorkspace() generationFileWorkspace {
	if s == nil {
		return nil
	}
	if s.fileWorkspace != nil {
		return s.fileWorkspace
	}
	if s.containerMgr != nil {
		return containerGenerationFileWorkspace{manager: s.containerMgr}
	}
	return nil
}
