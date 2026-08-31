package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
)

const (
	terminalDefaultRows      = 24
	terminalDefaultCols      = 80
	terminalMaxRows          = 200
	terminalMaxCols          = 400
	terminalIdleTimeout      = 30 * time.Minute
	terminalClosedRetention  = 1 * time.Minute
	terminalCleanupInterval  = 1 * time.Minute
	terminalOutputBufferSize = 4096
)

type TerminalSessionInfo struct {
	SessionID string `json:"sessionId"`
	Rows      int    `json:"rows"`
	Cols      int    `json:"cols"`
}

type TerminalOutput struct {
	Data        string `json:"data"`
	Cursor      int64  `json:"cursor"`
	Closed      bool   `json:"closed"`
	ExitCode    *int   `json:"exitCode,omitempty"`
	CloseReason string `json:"closeReason,omitempty"`
}

const (
	TerminalStreamEventTypeOutput = "output"
	TerminalStreamEventTypeClosed = "closed"
)

type TerminalStreamEvent struct {
	Type        string
	Data        string
	ExitCode    *int
	CloseReason string
}

type projectTerminalChunk struct {
	cursor int64
	data   string
}

type projectTerminalSession struct {
	id        string
	projectID string
	container string
	cmd       *exec.Cmd
	ptyFile   *os.File
	createdAt time.Time

	mu          sync.Mutex
	lastActive  time.Time
	nextCursor  int64
	chunks      []projectTerminalChunk
	subscribers map[string]chan TerminalStreamEvent
	closed      bool
	closedAt    time.Time
	exitCode    *int
	closeReason string
	closeOnce   sync.Once
}

type projectTerminalSessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*projectTerminalSession
}

func newProjectTerminalSessionManager() *projectTerminalSessionManager {
	manager := &projectTerminalSessionManager{
		sessions: make(map[string]*projectTerminalSession),
	}
	go manager.cleanupLoop()
	return manager
}

func normalizeTerminalSize(rows, cols int) (int, int) {
	if rows <= 0 {
		rows = terminalDefaultRows
	}
	if cols <= 0 {
		cols = terminalDefaultCols
	}
	if rows > terminalMaxRows {
		rows = terminalMaxRows
	}
	if cols > terminalMaxCols {
		cols = terminalMaxCols
	}
	return rows, cols
}

func (m *projectTerminalSessionManager) create(projectID, containerID string, rows, cols int) (*TerminalSessionInfo, error) {
	rows, cols = normalizeTerminalSize(rows, cols)

	sessionID := uuid.NewString()
	args := []string{
		"exec",
		"-it",
		"--workdir",
		"/workspace",
		"-e",
		"TERM=xterm-256color",
		containerID,
		"/bin/sh",
		"-lc",
		`if command -v bash >/dev/null 2>&1; then exec bash -li; else exec sh -i; fi`,
	}
	cmd := exec.Command("podman", args...)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptyFile, err := pty.StartWithSize(cmd, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
	if err != nil {
		return nil, fmt.Errorf("start container terminal: %w", err)
	}

	now := time.Now()
	session := &projectTerminalSession{
		id:          sessionID,
		projectID:   projectID,
		container:   containerID,
		cmd:         cmd,
		ptyFile:     ptyFile,
		createdAt:   now,
		lastActive:  now,
		subscribers: make(map[string]chan TerminalStreamEvent),
	}

	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	go m.captureOutput(session)
	go m.waitForExit(session)

	return &TerminalSessionInfo{
		SessionID: sessionID,
		Rows:      rows,
		Cols:      cols,
	}, nil
}

func (m *projectTerminalSessionManager) captureOutput(session *projectTerminalSession) {
	buffer := make([]byte, terminalOutputBufferSize)
	for {
		n, err := session.ptyFile.Read(buffer)
		if n > 0 {
			session.appendOutput(string(buffer[:n]))
		}
		if err != nil {
			if !errors.Is(err, io.EOF) && !errors.Is(err, os.ErrClosed) {
				session.setCloseReason(err.Error())
			}
			return
		}
	}
}

func (m *projectTerminalSessionManager) waitForExit(session *projectTerminalSession) {
	err := session.cmd.Wait()
	var exitCode *int
	closeReason := ""

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			code := exitErr.ExitCode()
			exitCode = &code
			if code != 0 {
				closeReason = err.Error()
			}
		} else {
			code := -1
			exitCode = &code
			closeReason = err.Error()
		}
	} else {
		code := 0
		exitCode = &code
	}

	session.markClosed(exitCode, closeReason)
}

func (s *projectTerminalSession) appendOutput(data string) {
	if data == "" {
		return
	}
	s.mu.Lock()
	s.nextCursor++
	s.lastActive = time.Now()
	s.chunks = append(s.chunks, projectTerminalChunk{
		cursor: s.nextCursor,
		data:   data,
	})
	subscribers := s.snapshotSubscribersLocked()
	s.mu.Unlock()

	s.broadcastEvent(subscribers, TerminalStreamEvent{
		Type: TerminalStreamEventTypeOutput,
		Data: data,
	})
}

func (s *projectTerminalSession) setCloseReason(reason string) {
	if strings.TrimSpace(reason) == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closeReason == "" {
		s.closeReason = reason
	}
}

func (s *projectTerminalSession) markClosed(exitCode *int, reason string) {
	s.closeOnce.Do(func() {
		_ = s.ptyFile.Close()

		s.mu.Lock()
		s.closed = true
		s.closedAt = time.Now()
		s.lastActive = s.closedAt
		if exitCode != nil {
			code := *exitCode
			s.exitCode = &code
		}
		if strings.TrimSpace(reason) != "" && s.closeReason == "" {
			s.closeReason = reason
		}
		closeReason := s.closeReason
		closeCode := cloneTerminalExitCodeLocked(s.exitCode)
		subscribers := s.snapshotSubscribersLocked()
		s.subscribers = make(map[string]chan TerminalStreamEvent)
		s.mu.Unlock()

		s.broadcastEvent(subscribers, TerminalStreamEvent{
			Type:        TerminalStreamEventTypeClosed,
			ExitCode:    closeCode,
			CloseReason: closeReason,
		})
		for _, subscriber := range subscribers {
			close(subscriber)
		}
	})
}

func cloneTerminalExitCodeLocked(exitCode *int) *int {
	if exitCode == nil {
		return nil
	}
	code := *exitCode
	return &code
}

func (s *projectTerminalSession) snapshotSubscribersLocked() []chan TerminalStreamEvent {
	subscribers := make([]chan TerminalStreamEvent, 0, len(s.subscribers))
	for _, subscriber := range s.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	return subscribers
}

func (s *projectTerminalSession) broadcastEvent(subscribers []chan TerminalStreamEvent, event TerminalStreamEvent) {
	for _, subscriber := range subscribers {
		subscriber <- event
	}
}

func (m *projectTerminalSessionManager) get(sessionID string) (*projectTerminalSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	session, ok := m.sessions[sessionID]
	if !ok {
		return nil, errors.New("terminal session not found")
	}
	return session, nil
}

func (m *projectTerminalSessionManager) read(projectID, sessionID string, cursor int64) (*TerminalOutput, error) {
	session, err := m.get(sessionID)
	if err != nil {
		return nil, err
	}
	if session.projectID != projectID {
		return nil, errors.New("terminal session does not belong to project")
	}

	session.mu.Lock()
	defer session.mu.Unlock()

	var builder strings.Builder
	for _, chunk := range session.chunks {
		if chunk.cursor > cursor {
			builder.WriteString(chunk.data)
		}
	}
	session.lastActive = time.Now()

	output := &TerminalOutput{
		Data:        builder.String(),
		Cursor:      session.nextCursor,
		Closed:      session.closed,
		CloseReason: session.closeReason,
	}
	if session.exitCode != nil {
		code := *session.exitCode
		output.ExitCode = &code
	}
	return output, nil
}

func (m *projectTerminalSessionManager) write(projectID, sessionID, input string) error {
	session, err := m.get(sessionID)
	if err != nil {
		return err
	}
	if session.projectID != projectID {
		return errors.New("terminal session does not belong to project")
	}
	if input == "" {
		return nil
	}

	session.mu.Lock()
	closed := session.closed
	session.lastActive = time.Now()
	session.mu.Unlock()
	if closed {
		return errors.New("terminal session already closed")
	}

	_, err = session.ptyFile.WriteString(input)
	if err != nil {
		return fmt.Errorf("write terminal input: %w", err)
	}
	return nil
}

func (m *projectTerminalSessionManager) resize(projectID, sessionID string, rows, cols int) error {
	session, err := m.get(sessionID)
	if err != nil {
		return err
	}
	if session.projectID != projectID {
		return errors.New("terminal session does not belong to project")
	}
	rows, cols = normalizeTerminalSize(rows, cols)

	session.mu.Lock()
	closed := session.closed
	session.lastActive = time.Now()
	session.mu.Unlock()
	if closed {
		return errors.New("terminal session already closed")
	}

	return pty.Setsize(session.ptyFile, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
}

func (m *projectTerminalSessionManager) touch(projectID, sessionID string) error {
	session, err := m.get(sessionID)
	if err != nil {
		return err
	}
	if session.projectID != projectID {
		return errors.New("terminal session does not belong to project")
	}

	session.mu.Lock()
	defer session.mu.Unlock()
	if session.closed {
		return errors.New("terminal session already closed")
	}
	session.lastActive = time.Now()
	return nil
}

func (m *projectTerminalSessionManager) close(projectID, sessionID string) error {
	session, err := m.get(sessionID)
	if err != nil {
		return err
	}
	if session.projectID != projectID {
		return errors.New("terminal session does not belong to project")
	}

	if session.cmd != nil && session.cmd.Process != nil {
		_ = session.cmd.Process.Kill()
	}
	session.markClosed(nil, "terminal session closed")

	m.mu.Lock()
	delete(m.sessions, sessionID)
	m.mu.Unlock()
	return nil
}

func (m *projectTerminalSessionManager) subscribe(projectID, sessionID string, cursor int64) (<-chan TerminalStreamEvent, func(), error) {
	session, err := m.get(sessionID)
	if err != nil {
		return nil, nil, err
	}
	if session.projectID != projectID {
		return nil, nil, errors.New("terminal session does not belong to project")
	}

	subscriberID := uuid.NewString()
	stream := make(chan TerminalStreamEvent, 128)

	session.mu.Lock()
	var backlog strings.Builder
	for _, chunk := range session.chunks {
		if chunk.cursor > cursor {
			backlog.WriteString(chunk.data)
		}
	}
	closed := session.closed
	closeReason := session.closeReason
	exitCode := cloneTerminalExitCodeLocked(session.exitCode)
	session.lastActive = time.Now()
	if !closed {
		session.subscribers[subscriberID] = stream
	}
	session.mu.Unlock()

	if backlog.Len() > 0 {
		stream <- TerminalStreamEvent{
			Type: TerminalStreamEventTypeOutput,
			Data: backlog.String(),
		}
	}
	if closed {
		stream <- TerminalStreamEvent{
			Type:        TerminalStreamEventTypeClosed,
			ExitCode:    exitCode,
			CloseReason: closeReason,
		}
		close(stream)
		return stream, func() {}, nil
	}

	unsubscribe := func() {
		session.mu.Lock()
		subscriber, ok := session.subscribers[subscriberID]
		if ok {
			delete(session.subscribers, subscriberID)
		}
		session.mu.Unlock()
		if ok {
			close(subscriber)
		}
	}

	return stream, unsubscribe, nil
}

func (m *projectTerminalSessionManager) cleanupLoop() {
	ticker := time.NewTicker(terminalCleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		m.cleanupExpiredSessions(time.Now())
	}
}

func (m *projectTerminalSessionManager) cleanupExpiredSessions(now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, session := range m.sessions {
		session.mu.Lock()
		idleFor := now.Sub(session.lastActive)
		closed := session.closed
		closedAt := session.closedAt
		hasSubscribers := len(session.subscribers) > 0
		session.mu.Unlock()

		if (!hasSubscribers && idleFor > terminalIdleTimeout) || (closed && !closedAt.IsZero() && now.Sub(closedAt) > terminalClosedRetention) {
			if session.cmd != nil && session.cmd.Process != nil {
				_ = session.cmd.Process.Kill()
			}
			session.markClosed(nil, "terminal session expired")
			delete(m.sessions, id)
		}
	}
}

func (s *ProjectService) CreateTerminalSession(ctx context.Context, projectID string, rows, cols int) (*TerminalSessionInfo, error) {
	if s == nil || s.terminalMgr == nil {
		return nil, errors.New("terminal manager not available")
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found: %w", err)
	}
	if !projectNeedsRuntime(project.AppType) {
		return nil, errors.New("runtime is disabled for this app type")
	}
	if s.containerMgr == nil {
		containerErr := errors.New("container manager not available")
		_ = s.persistRuntimeUnavailable(ctx, project, "开发终端无法连接容器管理器", containerErr)
		return nil, containerErr
	}
	if _, ensureErr := s.ensureProjectContainerRunning(ctx, project); ensureErr != nil {
		return nil, fmt.Errorf("failed to ensure project container is running: %w", ensureErr)
	}

	containerInfo, exists, err := s.containerMgr.SyncProject(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("sync project container: %w", err)
	}
	if !exists || containerInfo == nil || strings.TrimSpace(containerInfo.ContainerID) == "" {
		return nil, fmt.Errorf("project %s container not found", projectID)
	}

	return s.terminalMgr.create(projectID, containerInfo.ContainerID, rows, cols)
}

func (s *ProjectService) ReadTerminalOutput(ctx context.Context, projectID, sessionID string, cursor int64) (*TerminalOutput, error) {
	if s == nil || s.terminalMgr == nil {
		return nil, errors.New("terminal manager not available")
	}
	return s.terminalMgr.read(projectID, sessionID, cursor)
}

func (s *ProjectService) SendTerminalInput(ctx context.Context, projectID, sessionID, input string) error {
	if s == nil || s.terminalMgr == nil {
		return errors.New("terminal manager not available")
	}
	return s.terminalMgr.write(projectID, sessionID, input)
}

func (s *ProjectService) ResizeTerminalSession(ctx context.Context, projectID, sessionID string, rows, cols int) error {
	if s == nil || s.terminalMgr == nil {
		return errors.New("terminal manager not available")
	}
	return s.terminalMgr.resize(projectID, sessionID, rows, cols)
}

func (s *ProjectService) CloseTerminalSession(ctx context.Context, projectID, sessionID string) error {
	if s == nil || s.terminalMgr == nil {
		return errors.New("terminal manager not available")
	}
	return s.terminalMgr.close(projectID, sessionID)
}

func (s *ProjectService) SubscribeTerminalSession(ctx context.Context, projectID, sessionID string, cursor int64) (<-chan TerminalStreamEvent, func(), error) {
	if s == nil || s.terminalMgr == nil {
		return nil, nil, errors.New("terminal manager not available")
	}
	return s.terminalMgr.subscribe(projectID, sessionID, cursor)
}

func (s *ProjectService) TouchTerminalSession(ctx context.Context, projectID, sessionID string) error {
	if s == nil || s.terminalMgr == nil {
		return errors.New("terminal manager not available")
	}
	return s.terminalMgr.touch(projectID, sessionID)
}

func init() {
	if _, err := exec.LookPath("podman"); err != nil {
		log.Printf("Warning: podman binary not found for terminal sessions: %v", err)
	}
}
