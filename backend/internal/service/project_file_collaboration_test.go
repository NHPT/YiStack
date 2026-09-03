package service

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"yistack/internal/model"
)

func TestProjectFileContentRevisionUsesSHA256(t *testing.T) {
	const expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
	if actual := ProjectFileContentRevision("hello"); actual != expected {
		t.Fatalf("revision = %q, want %q", actual, expected)
	}
}

func TestGenerationCollaborationEventsCoverWritesAndDeletes(t *testing.T) {
	repo := newR64CollaborationRepo()
	generator := NewGeneratorService(GeneratorServiceOptions{CollaborationRepo: repo})
	req := &GenerateRequest{ProjectID: "project-1", UserID: "editor"}
	project := &model.Project{ProjectID: "project-1", UserID: "owner"}
	operations := []GenerationFileOperation{
		{
			Operation:  GenerationFileOperationPatch,
			Path:       "src/App.tsx",
			ResultHash: ProjectFileContentRevision("updated"),
		},
		{
			Operation: GenerationFileOperationDelete,
			Path:      "src/old.ts",
		},
	}

	if err := generator.recordGenerationCollaborationEvents(
		context.Background(),
		req,
		project,
		operations,
	); err != nil {
		t.Fatalf("record generation collaboration events: %v", err)
	}
	if len(repo.events) != 2 {
		t.Fatalf("event count = %d, want 2", len(repo.events))
	}
	if repo.events[0].EventType != ProjectCollaborationEventFileSaved ||
		repo.events[0].ResourceRevision != operations[0].ResultHash ||
		repo.events[1].EventType != ProjectCollaborationEventTreeChanged {
		t.Fatalf("unexpected generation events: %#v", repo.events)
	}
	var metadata map[string]interface{}
	if err := json.Unmarshal([]byte(repo.events[0].PayloadJSON), &metadata); err != nil {
		t.Fatalf("decode generation event metadata: %v", err)
	}
	if metadata["source"] != "generation" || metadata["operation"] != GenerationFileOperationPatch {
		t.Fatalf("unexpected generation event metadata: %#v", metadata)
	}
}

func TestProjectFileExpectedRevisionValidation(t *testing.T) {
	if _, err := normalizeExpectedProjectFileRevision("not-a-sha"); err == nil {
		t.Fatal("invalid expected revision must be rejected")
	} else {
		var target *ProjectFileRevisionValidationError
		if !errors.As(err, &target) {
			t.Fatalf("unexpected validation error: %T %v", err, err)
		}
	}
}

func TestProjectFileWriteRejectsViewerBeforeMutation(t *testing.T) {
	ctx := context.Background()
	repo := newR64CollaborationRepo()
	repo.members[r64MemberKey("project-1", "viewer")] = model.ProjectMember{
		ProjectID: "project-1",
		UserID:    "viewer",
		Role:      ProjectMemberRoleViewer,
		Status:    "active",
	}
	projects := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &r64ProjectRepo{project: &model.Project{
			ProjectID: "project-1",
			UserID:    "owner",
		}},
		CollaborationRepo: repo,
	})

	_, err := projects.WriteProjectFileAsUser(
		ctx,
		"viewer",
		"project-1",
		"src/App.tsx",
		"export default function App() { return null }",
		"",
	)
	var collaborationErr *ProjectCollaborationError
	if !errors.As(err, &collaborationErr) || collaborationErr.Code != "collaboration_write_forbidden" {
		t.Fatalf("viewer write error = %#v, want collaboration_write_forbidden", err)
	}
}

func TestProjectFileMutationEventIsPersistedWithRevision(t *testing.T) {
	repo := newR64CollaborationRepo()
	projects := NewProjectService(ProjectServiceOptions{CollaborationRepo: repo})
	revision := ProjectFileContentRevision("updated")

	status, detail := projects.recordProjectMutationEvent(
		context.Background(),
		"editor",
		"project-1",
		ProjectMemberRoleEditor,
		ProjectCollaborationEventFileSaved,
		"src/App.tsx",
		revision,
		map[string]interface{}{"source": "workspace"},
	)
	if status != "recorded" || detail != "" {
		t.Fatalf("event status = %q detail = %q", status, detail)
	}
	if len(repo.events) != 1 {
		t.Fatalf("event count = %d, want 1", len(repo.events))
	}
	event := repo.events[0]
	if event.ActorUserID != "editor" ||
		event.ResourcePath != "src/App.tsx" ||
		event.ResourceRevision != revision ||
		event.EventType != ProjectCollaborationEventFileSaved {
		t.Fatalf("unexpected mutation event: %#v", event)
	}
}
