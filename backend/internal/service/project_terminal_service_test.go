package service

import (
	"testing"
	"time"
)

func TestCleanupExpiredSessionsKeepsActiveSubscribers(t *testing.T) {
	manager := &projectTerminalSessionManager{
		sessions: map[string]*projectTerminalSession{
			"active": {
				id:          "active",
				projectID:   "proj-1",
				lastActive:  time.Now().Add(-2 * terminalIdleTimeout),
				subscribers: map[string]chan TerminalStreamEvent{"sub-1": make(chan TerminalStreamEvent, 1)},
			},
		},
	}

	manager.cleanupExpiredSessions(time.Now())

	if _, ok := manager.sessions["active"]; !ok {
		t.Fatalf("expected active subscribed session to be retained")
	}
}

func TestCleanupExpiredSessionsRemovesDisconnectedIdleSession(t *testing.T) {
	manager := &projectTerminalSessionManager{
		sessions: map[string]*projectTerminalSession{
			"idle": {
				id:          "idle",
				projectID:   "proj-1",
				lastActive:  time.Now().Add(-2 * terminalIdleTimeout),
				subscribers: map[string]chan TerminalStreamEvent{},
			},
		},
	}

	manager.cleanupExpiredSessions(time.Now())

	if _, ok := manager.sessions["idle"]; ok {
		t.Fatalf("expected disconnected idle session to be cleaned up")

	}
}
func TestCloseUserRemovesSessionsAcrossProjects(t *testing.T) {
	manager := &projectTerminalSessionManager{
		sessions: map[string]*projectTerminalSession{
			"owned": {
				id:          "owned",
				projectID:   "owned-project",
				userID:      "target-user",
				lastActive:  time.Now(),
				subscribers: map[string]chan TerminalStreamEvent{},
			},
			"collaborator": {
				id:          "collaborator",
				projectID:   "other-project",
				userID:      "target-user",
				lastActive:  time.Now(),
				subscribers: map[string]chan TerminalStreamEvent{},
			},
			"other-user": {
				id:          "other-user",
				projectID:   "other-project",
				userID:      "other-user",
				lastActive:  time.Now(),
				subscribers: map[string]chan TerminalStreamEvent{},
			},
		},
	}

	manager.closeUser("target-user")

	if _, ok := manager.sessions["owned"]; ok {
		t.Fatal("owned project terminal was retained after user deletion")
	}
	if _, ok := manager.sessions["collaborator"]; ok {
		t.Fatal("collaborator terminal was retained after user deletion")
	}
	if _, ok := manager.sessions["other-user"]; !ok {
		t.Fatal("another user's terminal was closed")
	}
}
