package service

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type memoryGenerationWorkspace struct {
	files                 map[string]string
	dirty                 map[string]bool
	failPath              string
	respectContext        bool
	cancelAfterPath       string
	cancel                context.CancelFunc
	mutateOnFailurePath   string
	mutateOnFailureTarget string
	mutateOnFailureValue  string
}

func (w *memoryGenerationWorkspace) contextError(ctx context.Context) error {
	if !w.respectContext {
		return nil
	}
	return ctx.Err()
}

func (w *memoryGenerationWorkspace) failOperation(path string) error {
	if path != w.failPath {
		return nil
	}
	if path == w.mutateOnFailurePath && w.mutateOnFailureTarget != "" {
		w.files[w.mutateOnFailureTarget] = w.mutateOnFailureValue
	}
	return errors.New("injected operation failure")
}

func (w *memoryGenerationWorkspace) cancelAfterOperation(path string) {
	if path == w.cancelAfterPath && w.cancel != nil {
		w.cancel()
	}
}

func (w *memoryGenerationWorkspace) PathExists(ctx context.Context, _ string, path string) (bool, error) {
	if err := w.contextError(ctx); err != nil {
		return false, err
	}
	_, ok := w.files[path]
	return ok, nil
}

func (w *memoryGenerationWorkspace) ReadFile(ctx context.Context, _ string, path string) (string, error) {
	if err := w.contextError(ctx); err != nil {
		return "", err
	}
	content, ok := w.files[path]
	if !ok {
		return "", errors.New("file does not exist")
	}
	return content, nil
}

func (w *memoryGenerationWorkspace) WriteFile(ctx context.Context, _ string, path, content string) error {
	if err := w.contextError(ctx); err != nil {
		return err
	}
	if err := w.failOperation(path); err != nil {
		return err
	}
	w.files[path] = content
	w.cancelAfterOperation(path)
	return nil
}

func (w *memoryGenerationWorkspace) CreateFile(ctx context.Context, _ string, path, content string) error {
	if err := w.contextError(ctx); err != nil {
		return err
	}
	if err := w.failOperation(path); err != nil {
		return err
	}
	if _, exists := w.files[path]; exists {
		return errors.New("path already exists")
	}
	w.files[path] = content
	w.cancelAfterOperation(path)
	return nil
}

func (w *memoryGenerationWorkspace) DeletePath(ctx context.Context, _ string, path string) error {
	if err := w.contextError(ctx); err != nil {
		return err
	}
	if err := w.failOperation(path); err != nil {
		return err
	}
	delete(w.files, path)
	w.cancelAfterOperation(path)
	return nil
}

func (w *memoryGenerationWorkspace) PathDirty(ctx context.Context, _ string, path string) (bool, error) {
	if err := w.contextError(ctx); err != nil {
		return false, err
	}
	return w.dirty[path], nil
}

func TestApplyGenerationFileOperationsSupportsCreateReplacePatchDelete(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{
		"replace.txt": "before", "patch.txt": "hello world", "delete.txt": "remove",
	}, dirty: map[string]bool{}}
	operations := []GenerationFileOperation{
		{Operation: GenerationFileOperationCreate, Path: "create.txt", Content: "created", Description: "create"},
		{Operation: GenerationFileOperationReplace, Path: "replace.txt", BaseHash: generationContentHash("before"), Content: "after", Description: "replace"},
		{Operation: GenerationFileOperationPatch, Path: "patch.txt", BaseHash: generationContentHash("hello world"), Edits: []GenerationTextEdit{{OldText: "world", NewText: "YiStack"}}, Description: "patch"},
		{Operation: GenerationFileOperationDelete, Path: "delete.txt", BaseHash: generationContentHash("remove"), Description: "delete"},
	}

	applied, files, err := applyGenerationFileOperations(context.Background(), workspace, "project", operations, nil, func(StreamEventName, StreamEventPayload) error { return nil })
	if err != nil {
		t.Fatalf("expected operations to pass: %v", err)
	}
	if workspace.files["create.txt"] != "created" || workspace.files["replace.txt"] != "after" || workspace.files["patch.txt"] != "hello YiStack" {
		t.Fatalf("unexpected workspace files: %#v", workspace.files)
	}
	if _, exists := workspace.files["delete.txt"]; exists {
		t.Fatal("delete operation must remove the file")
	}
	if len(applied) != 4 || len(files) != 3 {
		t.Fatalf("unexpected normalized operations/files: %#v %#v", applied, files)
	}
	for _, operation := range applied {
		if len(operation.ResultHash) != 64 {
			t.Fatalf("expected server-side result hash, got %#v", operation)
		}
	}
}

func TestGenerationFileOperationsBlockDirtyAndStalePaths(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{"app.ts": "current"}, dirty: map[string]bool{"app.ts": true}}
	operation := GenerationFileOperation{Operation: GenerationFileOperationReplace, Path: "app.ts", BaseHash: generationContentHash("current"), Content: "next", Description: "replace"}
	_, _, err := applyGenerationFileOperations(context.Background(), workspace, "project", []GenerationFileOperation{operation}, nil, func(StreamEventName, StreamEventPayload) error { return nil })
	if GenerationFailureCode(err) != GenerationFailureCodeFileConflict || !strings.Contains(err.Error(), "uncommitted user changes") {
		t.Fatalf("expected dirty path conflict, got %v", err)
	}

	workspace.dirty["app.ts"] = false
	operation.BaseHash = generationContentHash("stale")
	_, _, err = applyGenerationFileOperations(context.Background(), workspace, "project", []GenerationFileOperation{operation}, nil, func(StreamEventName, StreamEventPayload) error { return nil })
	if GenerationFailureCode(err) != GenerationFailureCodeFileConflict || !strings.Contains(err.Error(), "changed since") {
		t.Fatalf("expected base hash conflict, got %v", err)
	}
}

func TestGenerationPatchRequiresUniqueExactContext(t *testing.T) {
	_, err := applyGenerationTextEdits("same same", []GenerationTextEdit{{OldText: "same", NewText: "next"}})
	if err == nil || !strings.Contains(err.Error(), "matched 2 times") {
		t.Fatalf("expected ambiguous patch to fail, got %v", err)
	}
}

func TestValidateGenerationPatchReportsNoOpAsEditError(t *testing.T) {
	operation := GenerationFileOperationPatch
	path := "events.py"
	description := "repair event"
	baseHash := generationContentHash("before")
	oldText := "before"
	newText := "before"
	edits := []generationTextEditWire{{
		OldText: &oldText,
		NewText: &newText,
	}}

	_, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation: &operation, Path: &path, Description: &description,
		BaseHash: &baseHash, Edits: &edits,
	}})
	if err == nil ||
		!strings.Contains(err.Error(), "must change content") ||
		strings.Contains(err.Error(), "base_hash is invalid") {
		t.Fatalf("expected precise no-op edit error, got %v", err)
	}
}

func TestGenerationFileOperationsRollbackAppliedChanges(t *testing.T) {
	workspace := &memoryGenerationWorkspace{files: map[string]string{}, dirty: map[string]bool{}, failPath: "second.txt"}
	operations := []GenerationFileOperation{
		{Operation: GenerationFileOperationCreate, Path: "first.txt", Content: "first", Description: "first"},
		{Operation: GenerationFileOperationCreate, Path: "second.txt", Content: "second", Description: "second"},
	}
	_, _, err := applyGenerationFileOperations(context.Background(), workspace, "project", operations, nil, func(StreamEventName, StreamEventPayload) error { return nil })
	if GenerationFailureCode(err) != GenerationFailureCodeFileConflict {
		t.Fatalf("expected apply conflict, got %v", err)
	}
	if len(workspace.files) != 0 {
		t.Fatalf("expected first operation to be rolled back, got %#v", workspace.files)
	}
}

func TestGenerationFileOperationsRollbackUsesIndependentContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	workspace := &memoryGenerationWorkspace{
		files: map[string]string{}, dirty: map[string]bool{},
		respectContext: true, cancelAfterPath: "first.txt", cancel: cancel,
	}
	operations := []GenerationFileOperation{{
		Operation: GenerationFileOperationCreate,
		Path:      "first.txt", Content: "first", Description: "first",
	}}

	_, _, err := applyGenerationFileOperations(ctx, workspace, "project", operations, nil, func(StreamEventName, StreamEventPayload) error { return nil })
	if err == nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("expected cancelled verification, got %v", err)
	}
	if len(workspace.files) != 0 {
		t.Fatalf("expected independent rollback to remove generated file, got %#v", workspace.files)
	}
}

func TestGenerationFileOperationsRollbackPreservesConcurrentChanges(t *testing.T) {
	workspace := &memoryGenerationWorkspace{
		files: map[string]string{}, dirty: map[string]bool{}, failPath: "second.txt",
		mutateOnFailurePath: "second.txt", mutateOnFailureTarget: "first.txt",
		mutateOnFailureValue: "user edit",
	}
	operations := []GenerationFileOperation{
		{Operation: GenerationFileOperationCreate, Path: "first.txt", Content: "generated", Description: "first"},
		{Operation: GenerationFileOperationCreate, Path: "second.txt", Content: "second", Description: "second"},
	}

	_, _, err := applyGenerationFileOperations(context.Background(), workspace, "project", operations, nil, func(StreamEventName, StreamEventPayload) error { return nil })
	if err == nil || !strings.Contains(err.Error(), "rollback conflict") {
		t.Fatalf("expected rollback conflict, got %v", err)
	}
	if workspace.files["first.txt"] != "user edit" {
		t.Fatalf("rollback overwrote concurrent content: %#v", workspace.files)
	}
}

func TestValidateGenerationFileOperationsRejectsProtectedPath(t *testing.T) {
	operation := "create"
	path := ".env.local"
	description := "secret"
	content := "TOKEN=value"
	_, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation: &operation, Path: &path, Description: &description, Content: &content,
	}})
	if err == nil || !strings.Contains(err.Error(), "protected") {
		t.Fatalf("expected protected path rejection, got %v", err)
	}
}

func TestValidateGenerationFileOperationsRejectsPrivateKeyMaterial(t *testing.T) {
	operation := "create"
	path := "notes.txt"
	description := "unsafe"
	content := "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret"
	_, err := validateGenerationFileOperations([]generationFileOperationWire{{
		Operation: &operation, Path: &path, Description: &description, Content: &content,
	}})
	if err == nil || !strings.Contains(err.Error(), "private key material") {
		t.Fatalf("expected private key material rejection, got %v", err)
	}
	if !isProtectedGenerationPath(".ssh/config") || !isProtectedGenerationPath(".npmrc") {
		t.Fatal("expected secret configuration paths to be protected")
	}
}
