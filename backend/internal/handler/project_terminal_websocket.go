package handler

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/adaptor"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"

	"yistack/internal/service"
)

const (
	terminalWSTicketTTL     = 1 * time.Minute
	terminalWSReadLimit     = 64 * 1024
	terminalWSPingInterval  = 25 * time.Second
	terminalWSPongWait      = 60 * time.Second
	terminalWSWriteDeadline = 10 * time.Second
)

type terminalWSTicketClaims struct {
	ProjectID string `json:"project_id"`
	UserID    string `json:"user_id"`
	Rows      int    `json:"rows"`
	Cols      int    `json:"cols"`
	jwt.RegisteredClaims
}

type createTerminalWSTicketResponse struct {
	Ticket string `json:"ticket"`
}

type terminalWSClientMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Rows int    `json:"rows,omitempty"`
	Cols int    `json:"cols,omitempty"`
}

type terminalWSServerMessage struct {
	Type        string `json:"type"`
	Data        string `json:"data,omitempty"`
	SessionID   string `json:"sessionId,omitempty"`
	Message     string `json:"message,omitempty"`
	CloseReason string `json:"closeReason,omitempty"`
	ExitCode    *int   `json:"exitCode,omitempty"`
}

var terminalWSUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func (h *ProjectHandler) CreateTerminalWebSocketTicket(c context.Context, ctx *app.RequestContext) {
	projectID := ctx.Param("id")
	if projectID == "" {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Project ID is required",
		})
		return
	}

	_, project, ok := h.requireOwnedProject(c, ctx, projectID)
	if !ok {
		return
	}

	var req CreateTerminalSessionRequest
	if err := ctx.Bind(&req); err != nil {
		ctx.JSON(consts.StatusBadRequest, map[string]interface{}{
			"error": "Invalid request body",
		})
		return
	}

	uid, ok := h.currentUserID(ctx)
	if !ok {
		return
	}

	ticket, err := h.issueTerminalWSTicket(project.ProjectID, uid, req.Rows, req.Cols)
	if err != nil {
		ctx.JSON(consts.StatusInternalServerError, map[string]interface{}{
			"error":   "Failed to issue terminal websocket ticket",
			"details": err.Error(),
		})
		return
	}

	ctx.JSON(consts.StatusOK, map[string]interface{}{
		"success": true,
		"data": createTerminalWSTicketResponse{
			Ticket: ticket,
		},
	})
}

func (h *ProjectHandler) TerminalWebSocket() app.HandlerFunc {
	return adaptor.HertzHandler(http.HandlerFunc(h.handleTerminalWebSocket))
}

func (h *ProjectHandler) handleTerminalWebSocket(w http.ResponseWriter, r *http.Request) {
	allowedOrigin := h.isAllowedWebSocketOrigin(r)
	if !allowedOrigin {
		http.Error(w, "forbidden origin", http.StatusForbidden)
		return
	}

	claims, err := h.validateTerminalWSTicket(strings.TrimSpace(r.URL.Query().Get("ticket")))
	if err != nil {
		http.Error(w, "invalid terminal websocket ticket", http.StatusUnauthorized)
		return
	}

	if h.projectService == nil {
		http.Error(w, "project service not available", http.StatusServiceUnavailable)
		return
	}

	project, err := h.projectService.GetProject(r.Context(), claims.ProjectID)
	if err != nil {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}
	if strings.TrimSpace(project.UserID) != strings.TrimSpace(claims.UserID) {
		http.Error(w, "forbidden project access", http.StatusForbidden)
		return
	}

	conn, err := terminalWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade terminal websocket failed for project %s: %v", claims.ProjectID, err)
		return
	}
	defer conn.Close()

	info, err := h.projectService.CreateTerminalSession(r.Context(), claims.ProjectID, claims.Rows, claims.Cols)
	if err != nil {
		_ = writeTerminalWSJSON(conn, terminalWSServerMessage{
			Type:    "error",
			Message: err.Error(),
		})
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "terminal startup failed"), time.Now().Add(terminalWSWriteDeadline))
		return
	}

	sessionID := info.SessionID
	defer func() {
		closeCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := h.projectService.CloseTerminalSession(closeCtx, claims.ProjectID, sessionID); err != nil {
			log.Printf("close terminal session %s failed: %v", sessionID, err)
		}
	}()

	stream, unsubscribe, err := h.projectService.SubscribeTerminalSession(r.Context(), claims.ProjectID, sessionID, 0)
	if err != nil {
		_ = writeTerminalWSJSON(conn, terminalWSServerMessage{
			Type:    "error",
			Message: err.Error(),
		})
		_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "terminal stream failed"), time.Now().Add(terminalWSWriteDeadline))
		return
	}
	defer unsubscribe()

	if err := writeTerminalWSJSON(conn, terminalWSServerMessage{
		Type:      "ready",
		SessionID: sessionID,
	}); err != nil {
		return
	}

	conn.SetReadLimit(terminalWSReadLimit)
	_ = conn.SetReadDeadline(time.Now().Add(terminalWSPongWait))
	conn.SetPongHandler(func(string) error {
		if err := h.projectService.TouchTerminalSession(r.Context(), claims.ProjectID, sessionID); err != nil {
			log.Printf("touch terminal session %s failed: %v", sessionID, err)
		}
		return conn.SetReadDeadline(time.Now().Add(terminalWSPongWait))
	})

	errCh := make(chan error, 2)

	go func() {
		ticker := time.NewTicker(terminalWSPingInterval)
		defer ticker.Stop()
		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(terminalWSWriteDeadline)); err != nil {
				errCh <- err
				return
			}
		}
	}()

	go func() {
		for event := range stream {
			msg := terminalWSServerMessage{
				Type:        event.Type,
				Data:        event.Data,
				CloseReason: event.CloseReason,
				ExitCode:    event.ExitCode,
			}
			if err := writeTerminalWSJSON(conn, msg); err != nil {
				errCh <- err
				return
			}
			if event.Type == service.TerminalStreamEventTypeClosed {
				errCh <- nil
				return
			}
		}
		errCh <- nil
	}()

	for {
		var msg terminalWSClientMessage
		if err := conn.ReadJSON(&msg); err != nil {
			break
		}

		switch msg.Type {
		case "input":
			if err := h.projectService.SendTerminalInput(r.Context(), claims.ProjectID, sessionID, msg.Data); err != nil {
				_ = writeTerminalWSJSON(conn, terminalWSServerMessage{
					Type:    "error",
					Message: err.Error(),
				})
			}
		case "resize":
			if err := h.projectService.ResizeTerminalSession(r.Context(), claims.ProjectID, sessionID, msg.Rows, msg.Cols); err != nil {
				_ = writeTerminalWSJSON(conn, terminalWSServerMessage{
					Type:    "error",
					Message: err.Error(),
				})
			}
		case "ping":
			if err := h.projectService.TouchTerminalSession(r.Context(), claims.ProjectID, sessionID); err != nil {
				_ = writeTerminalWSJSON(conn, terminalWSServerMessage{
					Type:    "error",
					Message: err.Error(),
				})
				return
			}
			if err := writeTerminalWSJSON(conn, terminalWSServerMessage{Type: "pong"}); err != nil {
				return
			}
		default:
			_ = writeTerminalWSJSON(conn, terminalWSServerMessage{
				Type:    "error",
				Message: fmt.Sprintf("unsupported terminal websocket message type: %s", msg.Type),
			})
		}

		select {
		case streamErr := <-errCh:
			if streamErr != nil {
				log.Printf("terminal websocket stream ended for project %s: %v", claims.ProjectID, streamErr)
			}
			return
		default:
		}
	}
}

func writeTerminalWSJSON(conn *websocket.Conn, payload terminalWSServerMessage) error {
	_ = conn.SetWriteDeadline(time.Now().Add(terminalWSWriteDeadline))
	return conn.WriteJSON(payload)
}

func (h *ProjectHandler) issueTerminalWSTicket(projectID, userID string, rows, cols int) (string, error) {
	if strings.TrimSpace(h.authJWTSecret) == "" {
		return "", fmt.Errorf("auth jwt secret not configured")
	}

	rows, cols = normalizeTerminalWebSocketSize(rows, cols)
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, terminalWSTicketClaims{
		ProjectID: strings.TrimSpace(projectID),
		UserID:    strings.TrimSpace(userID),
		Rows:      rows,
		Cols:      cols,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(terminalWSTicketTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-5 * time.Second)),
		},
	})

	return token.SignedString([]byte(h.authJWTSecret))
}

func (h *ProjectHandler) validateTerminalWSTicket(tokenString string) (*terminalWSTicketClaims, error) {
	if strings.TrimSpace(h.authJWTSecret) == "" {
		return nil, fmt.Errorf("auth jwt secret not configured")
	}
	if strings.TrimSpace(tokenString) == "" {
		return nil, fmt.Errorf("missing terminal websocket ticket")
	}

	claims := &terminalWSTicketClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(h.authJWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid or expired terminal websocket ticket")
	}
	if strings.TrimSpace(claims.ProjectID) == "" || strings.TrimSpace(claims.UserID) == "" {
		return nil, fmt.Errorf("invalid terminal websocket ticket payload")
	}
	return claims, nil
}

func (h *ProjectHandler) isAllowedWebSocketOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}
	originURL, err := neturl.Parse(origin)
	if err == nil {
		requestHosts := candidateRequestHosts(r)
		for _, requestHost := range requestHosts {
			if requestHost != "" && strings.EqualFold(originURL.Host, requestHost) {
				return true
			}
		}
		for _, requestHost := range requestHosts {
			if requestHost != "" && sameHostname(originURL.Hostname(), requestHostname(requestHost)) {
				return true
			}
		}
		if isDevelopmentLocalOrigin(originURL.Hostname(), requestHosts, h.allowedOrigins) {
			return true
		}
	}
	for _, allowed := range h.allowedOrigins {
		allowed = strings.TrimSpace(allowed)
		if allowed == "" {
			continue
		}
		if allowed == "*" || strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

func candidateRequestHosts(r *http.Request) []string {
	hosts := []string{strings.TrimSpace(r.Host)}
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-Host")); forwarded != "" {
		for _, part := range strings.Split(forwarded, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				hosts = append(hosts, part)
			}
		}
	}
	return hosts
}

func requestHostname(hostport string) string {
	if host, _, err := net.SplitHostPort(hostport); err == nil {
		return host
	}
	return hostport
}

func sameHostname(left, right string) bool {
	return strings.EqualFold(strings.Trim(strings.TrimSpace(left), "[]"), strings.Trim(strings.TrimSpace(right), "[]"))
}

func isLoopbackHost(host string) bool {
	host = strings.Trim(strings.ToLower(strings.TrimSpace(host)), "[]")
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func isDevelopmentLocalOrigin(originHost string, requestHosts, allowedOrigins []string) bool {
	if len(allowedOrigins) > 0 {
		return false
	}
	if !isLocalDevHost(originHost) {
		return false
	}
	for _, requestHost := range requestHosts {
		if isLocalDevHost(requestHostname(requestHost)) {
			return true
		}
	}
	return false
}

func isLocalDevHost(host string) bool {
	host = strings.Trim(strings.ToLower(strings.TrimSpace(host)), "[]")
	if host == "" {
		return false
	}
	if isLoopbackHost(host) || host == "0.0.0.0" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsPrivate() || ip.IsLoopback())
}

func normalizeTerminalWebSocketSize(rows, cols int) (int, int) {
	if rows <= 0 {
		rows = 24
	}
	if cols <= 0 {
		cols = 80
	}
	if rows > 200 {
		rows = 200
	}
	if cols > 400 {
		cols = 400
	}
	return rows, cols
}
