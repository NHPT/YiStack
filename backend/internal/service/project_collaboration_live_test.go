package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"yistack/internal/model"
)

func TestProjectCollaborationPresenceLifecycleAndReplay(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 9, 2, 8, 0, 0, 0, time.UTC)
	repo := newR64CollaborationRepo()
	users := &r64UserRepo{users: map[string]model.User{
		"owner": {ID: "owner", Username: "Owner", Status: "active"},
	}}
	project := &model.Project{ProjectID: "project-1", UserID: "owner"}
	projects := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &r64ProjectRepo{project: project}, CollaborationRepo: repo,
	})
	svc := NewProjectCollaborationService(repo, projects, users)
	svc.now = func() time.Time { return now }

	snapshot, err := svc.TouchPresence(ctx, "owner", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "client-owner-1", Activity: ProjectCollaborationActivityEditing, CurrentFile: "src/app.tsx",
	})
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.SchemaVersion != ProjectCollaborationSchemaVersion ||
		len(snapshot.Participants) != 1 ||
		!snapshot.Participants[0].IsSelf ||
		snapshot.Participants[0].CurrentFile != "src/app.tsx" ||
		len(snapshot.Events) != 1 ||
		snapshot.Events[0].EventType != ProjectCollaborationEventPresenceJoined {
		t.Fatalf("unexpected collaboration snapshot: %#v", snapshot)
	}

	now = now.Add(10 * time.Second)
	if _, err := svc.TouchPresence(ctx, "owner", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "client-owner-1", Activity: ProjectCollaborationActivityEditing, CurrentFile: "src/app.tsx",
	}); err != nil {
		t.Fatal(err)
	}
	if len(repo.events) != 1 {
		t.Fatalf("unchanged heartbeat should not append an event: %#v", repo.events)
	}

	if err := svc.RecordWorkspaceEvent(ctx, "owner", "project-1", ProjectCollaborationEventFileSaved, "src/app.tsx", strings.Repeat("a", 64)); err != nil {
		t.Fatal(err)
	}
	events, err := svc.Events(ctx, "owner", "project-1", 1)
	if err != nil || len(events) != 1 || events[0].EventType != ProjectCollaborationEventFileSaved {
		t.Fatalf("unexpected replay: %#v err=%v", events, err)
	}

	if err := svc.LeavePresence(ctx, "owner", "project-1", "client-owner-1"); err != nil {
		t.Fatal(err)
	}
	snapshot, err = svc.Snapshot(ctx, "owner", "project-1", "", 0)
	if err != nil || len(snapshot.Participants) != 0 {
		t.Fatalf("presence should be removed after leave: %#v err=%v", snapshot, err)
	}
}

func TestProjectCollaborationViewerCannotPublishWriteActivity(t *testing.T) {
	ctx := context.Background()
	repo := newR64CollaborationRepo()
	repo.members[r64MemberKey("project-1", "viewer")] = model.ProjectMember{
		ProjectID: "project-1", UserID: "viewer", Role: ProjectMemberRoleViewer, Status: "active",
	}
	users := &r64UserRepo{users: map[string]model.User{
		"viewer": {ID: "viewer", Username: "Viewer", Status: "active"},
	}}
	project := &model.Project{ProjectID: "project-1", UserID: "owner"}
	projects := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &r64ProjectRepo{project: project}, CollaborationRepo: repo,
	})
	svc := NewProjectCollaborationService(repo, projects, users)

	if _, err := svc.TouchPresence(ctx, "viewer", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "client-viewer-1", Activity: ProjectCollaborationActivityEditing,
	}); err == nil {
		t.Fatal("viewer must not publish editing presence")
	}
	if err := svc.RecordWorkspaceEvent(ctx, "viewer", "project-1", ProjectCollaborationEventFileSaved, "src/app.tsx", strings.Repeat("a", 64)); err == nil {
		t.Fatal("viewer must not publish file events")
	}
}

func TestProjectCollaborationRejectsUnsafePresenceInput(t *testing.T) {
	ctx := context.Background()
	repo := newR64CollaborationRepo()
	users := &r64UserRepo{users: map[string]model.User{
		"owner": {ID: "owner", Username: "Owner", Status: "active"},
	}}
	project := &model.Project{ProjectID: "project-1", UserID: "owner"}
	projects := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &r64ProjectRepo{project: project}, CollaborationRepo: repo,
	})
	svc := NewProjectCollaborationService(repo, projects, users)

	if _, err := svc.TouchPresence(ctx, "owner", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "bad client", Activity: ProjectCollaborationActivityViewing,
	}); err == nil {
		t.Fatal("invalid client ID must be rejected")
	}
	if _, err := svc.TouchPresence(ctx, "owner", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "client-owner-1", Activity: ProjectCollaborationActivityViewing, CurrentFile: "../secret",
	}); err == nil {
		t.Fatal("unsafe collaboration path must be rejected")
	}
}

func TestProjectCollaborationExpiresStalePresenceWithReplayableAuditEvent(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 9, 2, 9, 0, 0, 0, time.UTC)
	repo := newR64CollaborationRepo()
	users := &r64UserRepo{users: map[string]model.User{
		"owner": {ID: "owner", Username: "Owner", Status: "active"},
	}}
	project := &model.Project{ProjectID: "project-1", UserID: "owner"}
	projects := NewProjectService(ProjectServiceOptions{
		ProjectRepo: &r64ProjectRepo{project: project}, CollaborationRepo: repo,
	})
	svc := NewProjectCollaborationService(repo, projects, users)
	svc.now = func() time.Time { return now }

	joined, err := svc.TouchPresence(ctx, "owner", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "client-owner-1", Activity: ProjectCollaborationActivityViewing,
	})
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(projectCollaborationPresenceTTL + time.Second)
	snapshot, err := svc.Snapshot(ctx, "owner", "project-1", "", joined.Cursor)
	if err != nil {
		t.Fatal(err)
	}
	if len(snapshot.Participants) != 0 {
		t.Fatalf("expired presence must not remain active: %#v", snapshot.Participants)
	}
	if len(snapshot.Events) != 1 || snapshot.Events[0].EventType != ProjectCollaborationEventPresenceExpired {
		t.Fatalf("expiration must append a replayable audit event: %#v", snapshot.Events)
	}

	second, err := svc.Snapshot(ctx, "owner", "project-1", "", snapshot.Cursor)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Events) != 0 {
		t.Fatalf("expiration audit must be idempotent: %#v", second.Events)
	}

	now = now.Add(time.Second)
	rejoined, err := svc.TouchPresence(ctx, "owner", "project-1", ProjectCollaborationPresenceRequest{
		ClientID: "client-owner-1", Activity: ProjectCollaborationActivityViewing,
		AfterSequence: second.Cursor,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(rejoined.Events) != 1 ||
		rejoined.Events[0].EventType != ProjectCollaborationEventPresenceJoined ||
		len(rejoined.Participants) != 1 ||
		!rejoined.Participants[0].JoinedAt.Equal(now) {
		t.Fatalf("expired client must create a fresh joined session: %#v", rejoined)
	}
}
