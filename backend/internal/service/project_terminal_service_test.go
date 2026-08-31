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
