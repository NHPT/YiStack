package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
	"yistack/pkg/utils"
)

const (
	ProjectCollaborationSchemaVersion = "project_collaboration.v1"

	ProjectCollaborationActivityIdle       = "idle"
	ProjectCollaborationActivityViewing    = "viewing"
	ProjectCollaborationActivityEditing    = "editing"
	ProjectCollaborationActivityGenerating = "generating"

	ProjectCollaborationEventPresenceJoined  = "presence_joined"
	ProjectCollaborationEventPresenceUpdated = "presence_updated"
	ProjectCollaborationEventPresenceLeft    = "presence_left"
	ProjectCollaborationEventPresenceExpired = "presence_expired"
	ProjectCollaborationEventFileSaved       = "file_saved"
	ProjectCollaborationEventTreeChanged     = "tree_changed"

	projectCollaborationPresenceTTL = 45 * time.Second
	projectCollaborationEventLimit  = 100
)

type ProjectCollaborationPresenceRequest struct {
	ClientID      string `json:"client_id"`
	Activity      string `json:"activity"`
	CurrentFile   string `json:"current_file"`
	AfterSequence int64  `json:"after_sequence"`
}

type ProjectCollaborationParticipant struct {
	SessionID   string    `json:"session_id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	Role        string    `json:"role"`
	Activity    string    `json:"activity"`
	CurrentFile string    `json:"current_file,omitempty"`
	IsSelf      bool      `json:"is_self"`
	JoinedAt    time.Time `json:"joined_at"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

type ProjectCollaborationEventView struct {
	Sequence         int64                  `json:"sequence"`
	ID               string                 `json:"id"`
	ProjectID        string                 `json:"project_id"`
	EventType        string                 `json:"event_type"`
	ActorUserID      string                 `json:"actor_user_id"`
	ActorUsername    string                 `json:"actor_username"`
	SessionID        string                 `json:"session_id,omitempty"`
	ResourcePath     string                 `json:"resource_path,omitempty"`
	ResourceRevision string                 `json:"resource_revision,omitempty"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt        time.Time              `json:"created_at"`
}

type ProjectCollaborationSnapshot struct {
	SchemaVersion string                            `json:"schema_version"`
	ProjectID     string                            `json:"project_id"`
	SessionID     string                            `json:"session_id,omitempty"`
	Cursor        int64                             `json:"cursor"`
	Participants  []ProjectCollaborationParticipant `json:"participants"`
	Events        []ProjectCollaborationEventView   `json:"events"`
}

func validCollaborationActivity(activity string) bool {
	switch activity {
	case ProjectCollaborationActivityIdle,
		ProjectCollaborationActivityViewing,
		ProjectCollaborationActivityEditing,
		ProjectCollaborationActivityGenerating:
		return true
	default:
		return false
	}
}

func normalizeCollaborationClientID(value string) (string, error) {
	value = strings.TrimSpace(value)
	if len(value) < 8 || len(value) > 128 {
		return "", &ProjectCollaborationError{Code: "collaboration_client_invalid", Message: "Collaboration client ID must contain 8 to 128 characters"}
	}
	for _, character := range value {
		allowed := character >= 'a' && character <= 'z' ||
			character >= 'A' && character <= 'Z' ||
			character >= '0' && character <= '9' ||
			character == '-' || character == '_' || character == '.' || character == ':'
		if !allowed {
			return "", &ProjectCollaborationError{Code: "collaboration_client_invalid", Message: "Collaboration client ID contains unsupported characters"}
		}
	}
	return value, nil
}

func normalizeCollaborationActivity(activity, role string) (string, error) {
	activity = strings.ToLower(strings.TrimSpace(activity))
	if activity == "" {
		activity = ProjectCollaborationActivityViewing
	}
	if !validCollaborationActivity(activity) {
		return "", &ProjectCollaborationError{Code: "collaboration_activity_invalid", Message: "Collaboration activity is invalid"}
	}
	if role == ProjectMemberRoleViewer &&
		(activity == ProjectCollaborationActivityEditing || activity == ProjectCollaborationActivityGenerating) {
		return "", &ProjectCollaborationError{Code: "collaboration_activity_forbidden", Message: "Viewer role cannot publish write activity"}
	}
	return activity, nil
}

func normalizeCollaborationFilePath(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	path, err := normalizeProjectRelativePath(value)
	if err != nil || len(path) > 1024 {
		return "", &ProjectCollaborationError{Code: "collaboration_path_invalid", Message: "Collaboration file path is invalid"}
	}
	return path, nil
}

func (s *ProjectCollaborationService) accessDecision(ctx context.Context, userID, projectID string) (ProjectAccessDecision, error) {
	if s == nil || s.repo == nil || s.projects == nil {
		return ProjectAccessDecision{}, &ProjectCollaborationError{Code: "collaboration_unavailable", Message: "Project collaboration is unavailable"}
	}
	decision := s.projects.AuthorizeProjectAccess(ctx, strings.TrimSpace(userID), strings.TrimSpace(projectID))
	if !decision.CanRead() {
		return decision, &ProjectCollaborationError{Code: "collaboration_forbidden", Message: "Project collaboration access denied"}
	}
	return decision, nil
}

func (s *ProjectCollaborationService) TouchPresence(
	ctx context.Context,
	userID,
	projectID string,
	req ProjectCollaborationPresenceRequest,
) (*ProjectCollaborationSnapshot, error) {
	decision, err := s.accessDecision(ctx, userID, projectID)
	if err != nil {
		return nil, err
	}
	clientID, err := normalizeCollaborationClientID(req.ClientID)
	if err != nil {
		return nil, err
	}
	activity, err := normalizeCollaborationActivity(req.Activity, decision.AccessRole)
	if err != nil {
		return nil, err
	}
	currentFile, err := normalizeCollaborationFilePath(req.CurrentFile)
	if err != nil {
		return nil, err
	}

	now := s.now().UTC()
	if err := s.repo.ExpireCollaborationSessions(ctx, projectID, now); err != nil {
		return nil, err
	}
	session := &model.ProjectCollaborationSession{
		ID: utils.GenerateUUID(), ProjectID: projectID, UserID: userID, ClientID: clientID,
		Role: decision.AccessRole, Activity: activity, CurrentFile: currentFile, Status: "active",
		JoinedAt: now, LastSeenAt: now, ExpiresAt: now.Add(projectCollaborationPresenceTTL), UpdatedAt: now,
	}
	eventType := ProjectCollaborationEventPresenceJoined
	existing, findErr := s.repo.FindCollaborationSession(ctx, projectID, userID, clientID)
	if findErr == nil && existing != nil {
		session.ID = existing.ID
		if existing.Status == "active" && existing.ExpiresAt.After(now) {
			session.JoinedAt = existing.JoinedAt
			eventType = ProjectCollaborationEventPresenceUpdated
			if existing.Role == session.Role &&
				existing.Activity == session.Activity &&
				existing.CurrentFile == session.CurrentFile {
				eventType = ""
			}
		}
	} else if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		return nil, findErr
	}

	var event *model.ProjectCollaborationEvent
	if eventType != "" {
		event = newProjectCollaborationEvent(projectID, userID, session.ID, eventType, currentFile, "", map[string]interface{}{
			"activity": activity,
			"role":     decision.AccessRole,
		}, now)
	}
	if err := s.repo.UpsertCollaborationSessionWithEvent(ctx, session, event); err != nil {
		return nil, err
	}
	afterSequence := req.AfterSequence
	if afterSequence < 0 {
		afterSequence = 0
	}
	return s.Snapshot(ctx, userID, projectID, session.ID, afterSequence)
}

func (s *ProjectCollaborationService) LeavePresence(ctx context.Context, userID, projectID, clientID string) error {
	if _, err := s.accessDecision(ctx, userID, projectID); err != nil {
		return err
	}
	clientID, err := normalizeCollaborationClientID(clientID)
	if err != nil {
		return err
	}
	session, err := s.repo.FindCollaborationSession(ctx, projectID, userID, clientID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	now := s.now().UTC()
	event := newProjectCollaborationEvent(projectID, userID, session.ID, ProjectCollaborationEventPresenceLeft, session.CurrentFile, "", map[string]interface{}{
		"activity": session.Activity,
		"role":     session.Role,
	}, now)
	return s.repo.LeaveCollaborationSessionWithEvent(ctx, projectID, userID, clientID, now, event)
}

func (s *ProjectCollaborationService) Snapshot(
	ctx context.Context,
	userID,
	projectID,
	sessionID string,
	afterSequence int64,
) (*ProjectCollaborationSnapshot, error) {
	if _, err := s.accessDecision(ctx, userID, projectID); err != nil {
		return nil, err
	}
	now := s.now().UTC()
	if err := s.repo.ExpireCollaborationSessions(ctx, projectID, now); err != nil {
		return nil, err
	}
	sessions, err := s.repo.ListActiveCollaborationSessions(ctx, projectID, now)
	if err != nil {
		return nil, err
	}
	events, err := s.repo.ListCollaborationEvents(ctx, projectID, afterSequence, projectCollaborationEventLimit)
	if err != nil {
		return nil, err
	}
	participants := make([]ProjectCollaborationParticipant, 0, len(sessions))
	for _, session := range sessions {
		username := "Collaborator"
		avatarURL := ""
		if user, userErr := s.users.FindByID(ctx, session.UserID); userErr == nil && user != nil {
			if strings.TrimSpace(user.Username) != "" {
				username = strings.TrimSpace(user.Username)
			}
			avatarURL = strings.TrimSpace(user.AvatarURL)
		}
		participants = append(participants, ProjectCollaborationParticipant{
			SessionID: session.ID, UserID: session.UserID, Username: username,
			AvatarURL: avatarURL, Role: session.Role, Activity: session.Activity,
			CurrentFile: session.CurrentFile, IsSelf: session.UserID == userID && session.ID == sessionID,
			JoinedAt: session.JoinedAt, LastSeenAt: session.LastSeenAt, ExpiresAt: session.ExpiresAt,
		})
	}
	eventViews, cursor := s.collaborationEventViews(ctx, events, afterSequence)
	return &ProjectCollaborationSnapshot{
		SchemaVersion: ProjectCollaborationSchemaVersion, ProjectID: projectID,
		SessionID: sessionID, Cursor: cursor, Participants: participants, Events: eventViews,
	}, nil
}

func (s *ProjectCollaborationService) Events(ctx context.Context, userID, projectID string, afterSequence int64) ([]ProjectCollaborationEventView, error) {
	if _, err := s.accessDecision(ctx, userID, projectID); err != nil {
		return nil, err
	}
	if err := s.repo.ExpireCollaborationSessions(ctx, projectID, s.now().UTC()); err != nil {
		return nil, err
	}
	events, err := s.repo.ListCollaborationEvents(ctx, projectID, afterSequence, projectCollaborationEventLimit)
	if err != nil {
		return nil, err
	}
	eventViews, _ := s.collaborationEventViews(ctx, events, afterSequence)
	return eventViews, nil
}

func (s *ProjectCollaborationService) collaborationEventViews(
	ctx context.Context,
	events []model.ProjectCollaborationEvent,
	cursor int64,
) ([]ProjectCollaborationEventView, int64) {
	eventViews := make([]ProjectCollaborationEventView, 0, len(events))
	usernames := map[string]string{}
	for _, event := range events {
		username, ok := usernames[event.ActorUserID]
		if !ok {
			username = "Collaborator"
			if s.users != nil {
				user, userErr := s.users.FindByID(ctx, event.ActorUserID)
				if userErr == nil && user != nil && strings.TrimSpace(user.Username) != "" {
					username = strings.TrimSpace(user.Username)
				}
			}
			usernames[event.ActorUserID] = username
		}
		metadata := map[string]interface{}{}
		if err := json.Unmarshal([]byte(event.PayloadJSON), &metadata); err != nil {
			metadata = map[string]interface{}{}
		}
		eventViews = append(eventViews, ProjectCollaborationEventView{
			Sequence: event.Sequence, ID: event.ID, ProjectID: event.ProjectID, EventType: event.EventType,
			ActorUserID: event.ActorUserID, ActorUsername: username, SessionID: event.SessionID,
			ResourcePath: event.ResourcePath, ResourceRevision: event.ResourceRevision,
			Metadata: metadata, CreatedAt: event.CreatedAt,
		})
		if event.Sequence > cursor {
			cursor = event.Sequence
		}
	}
	return eventViews, cursor
}

func (s *ProjectCollaborationService) RecordWorkspaceEvent(
	ctx context.Context,
	userID,
	projectID,
	eventType,
	resourcePath,
	resourceRevision string,
) error {
	decision, err := s.accessDecision(ctx, userID, projectID)
	if err != nil {
		return err
	}
	if !decision.CanWrite() {
		return &ProjectCollaborationError{Code: "collaboration_write_forbidden", Message: "Project role does not allow collaboration writes"}
	}
	switch eventType {
	case ProjectCollaborationEventFileSaved, ProjectCollaborationEventTreeChanged:
	default:
		return &ProjectCollaborationError{Code: "collaboration_event_invalid", Message: "Collaboration event type is invalid"}
	}
	resourcePath, err = normalizeCollaborationFilePath(resourcePath)
	if err != nil {
		return err
	}
	resourceRevision = strings.ToLower(strings.TrimSpace(resourceRevision))
	if resourceRevision != "" && (len(resourceRevision) != 64 || !isLowerHex(resourceRevision)) {
		return &ProjectCollaborationError{Code: "collaboration_revision_invalid", Message: "Collaboration resource revision is invalid"}
	}
	return s.repo.AppendCollaborationEvent(ctx, newProjectCollaborationEvent(
		projectID, userID, "", eventType, resourcePath, resourceRevision,
		map[string]interface{}{"role": decision.AccessRole}, s.now().UTC(),
	))
}

func newProjectCollaborationEvent(
	projectID,
	userID,
	sessionID,
	eventType,
	resourcePath,
	resourceRevision string,
	payload map[string]interface{},
	createdAt time.Time,
) *model.ProjectCollaborationEvent {
	encoded, err := json.Marshal(payload)
	if err != nil {
		encoded = []byte("{}")
	}
	return &model.ProjectCollaborationEvent{
		ID: utils.GenerateUUID(), ProjectID: strings.TrimSpace(projectID),
		ActorUserID: strings.TrimSpace(userID), SessionID: strings.TrimSpace(sessionID),
		EventType: eventType, ResourcePath: resourcePath, ResourceRevision: resourceRevision,
		PayloadJSON: string(encoded), CreatedAt: createdAt,
	}
}

func isLowerHex(value string) bool {
	for _, character := range value {
		if character >= '0' && character <= '9' {
			continue
		}
		if character >= 'a' && character <= 'f' {
			continue
		}
		return false
	}
	return true
}
