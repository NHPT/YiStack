package handler

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"yistack/config"
	"yistack/internal/middleware"
	"yistack/internal/service"
)

const previewProjectCookieName = "yistack_preview_project"

type PreviewGateway struct {
	projectService    *service.ProjectService
	jwtSecret         string
	previewBaseDomain string
	previewTokenTTL   time.Duration
}

func NewPreviewGateway(projectService *service.ProjectService, cfg *config.Config) *PreviewGateway {
	return &PreviewGateway{
		projectService:    projectService,
		jwtSecret:         previewJWTSecret(cfg),
		previewBaseDomain: previewBaseDomain(cfg),
		previewTokenTTL:   previewTokenTTL(cfg),
	}
}

func (g *PreviewGateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if g == nil || g.projectService == nil {
		http.Error(w, "preview gateway unavailable", http.StatusServiceUnavailable)
		return
	}

	projectID := projectIDFromPreviewRequest(r, g.previewBaseDomain)
	publicShareRequest := false
	if projectID == "" {
		if cookie, err := r.Cookie(previewProjectCookieName); err == nil {
			projectID = strings.TrimSpace(cookie.Value)
		}
	}
	if projectID == "" {
		if tokenProjectID, ok := projectIDFromPreviewAccessToken(previewTokenFromRequest(r), g.jwtSecret); ok {
			projectID = tokenProjectID
		}
	}
	if projectID == "" {
		if shareID, ok := previewShareIDFromRequestPath(r.URL.Path); ok {
			project, shareErr := g.projectService.GetProjectByPreviewShareID(r.Context(), shareID)
			if shareErr == nil && project != nil {
				projectID = strings.TrimSpace(project.ProjectID)
				publicShareRequest = true
				stripPreviewShareIDFromRequestPath(r, shareID)
			}
		}
	}
	if projectID == "" {
		http.Error(w, "missing project", http.StatusBadRequest)
		return
	}

	userID := ""
	previewToken := ""
	if publicShareRequest == false {
		authenticatedUserID, authenticatedPreviewToken, err := g.authenticateRequest(r, projectID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		userID = authenticatedUserID
		previewToken = authenticatedPreviewToken
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	project, err := g.projectService.GetProject(ctx, projectID)
	if err != nil || project == nil {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}
	if publicShareRequest == false && project.UserID != userID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	g.projectService.TouchProjectRuntimeActivity(ctx, project, "preview_gateway")

	target, err := g.projectService.ResolveProjectPreviewTarget(ctx, projectID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	if publicShareRequest == false {
		http.SetCookie(w, &http.Cookie{
			Name:     previewProjectCookieName,
			Value:    projectID,
			Path:     "/",
			HttpOnly: false,
			SameSite: http.SameSiteLaxMode,
		})
	}
	if previewToken != "" {
		http.SetCookie(w, &http.Cookie{
			Name:     previewTokenCookieName,
			Value:    previewToken,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   int(g.previewTokenTTL / time.Second),
		})
	}

	targetURL, err := url.Parse(fmt.Sprintf("http://%s:%d", target.TargetHost, target.InternalPort))
	if err != nil {
		http.Error(w, "invalid preview target", http.StatusInternalServerError)
		return
	}

	projectQuery := r.URL.Query()
	projectQuery.Del("project")
	r.URL.RawQuery = projectQuery.Encode()

	reverseProxy := httputil.NewSingleHostReverseProxy(targetURL)
	originalDirector := reverseProxy.Director
	reverseProxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = targetURL.Host
		req.Header.Set("X-Forwarded-Host", r.Host)
		req.Header.Set("X-Forwarded-Proto", proxyRequestScheme(r))
	}
	reverseProxy.ModifyResponse = func(resp *http.Response) error {
		if location := resp.Header.Get("Location"); location != "" {
			resp.Header.Set("Location", rewritePreviewRedirectLocation(location, targetURL, projectID, publicShareRequest))
		}
		return nil
	}
	reverseProxy.ErrorHandler = func(writer http.ResponseWriter, request *http.Request, proxyErr error) {
		http.Error(writer, proxyErr.Error(), http.StatusBadGateway)
	}
	reverseProxy.ServeHTTP(w, r)
}

func rewritePreviewRedirectLocation(location string, targetURL *url.URL, projectID string, publicShareRequest bool) string {
	parsed, parseErr := url.Parse(location)
	if parseErr != nil || parsed == nil {
		return location
	}
	if parsed.Host != "" && targetURL != nil && parsed.Host != targetURL.Host {
		return location
	}
	parsed.Scheme = ""
	parsed.Host = ""
	if strings.HasPrefix(parsed.Path, "/preview") == false {
		parsed.Path = "/preview" + normalizedPreviewRedirectPath(parsed.Path)
	}
	if publicShareRequest == false && strings.TrimSpace(projectID) != "" {
		query := parsed.Query()
		if strings.TrimSpace(query.Get("project")) == "" {
			query.Set("project", strings.TrimSpace(projectID))
		}
		parsed.RawQuery = query.Encode()
	}
	return parsed.String()
}

func normalizedPreviewRedirectPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return "/"
	}
	if strings.HasPrefix(path, "/") {
		return path
	}
	return "/" + path
}

func (g *PreviewGateway) authenticateRequest(r *http.Request, projectID string) (string, string, error) {
	previewToken := previewTokenFromRequest(r)
	if previewToken != "" {
		userID, err := validatePreviewAccessToken(previewToken, projectID, g.jwtSecret)
		if err == nil {
			return userID, previewToken, nil
		}
	}

	tokenString := ""
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		tokenString = strings.TrimSpace(authHeader[7:])
	}
	if tokenString == "" {
		if cookie, err := r.Cookie("yistack_token"); err == nil {
			tokenString = strings.TrimSpace(cookie.Value)
		}
	}
	if tokenString == "" {
		return "", "", fmt.Errorf("missing authorization token")
	}

	claims := &middleware.JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(g.jwtSecret), nil
	})
	if err != nil || !token.Valid || strings.TrimSpace(claims.UserID) == "" {
		return "", "", fmt.Errorf("invalid or expired token")
	}
	return claims.UserID, "", nil
}

func previewTokenFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	previewToken := strings.TrimSpace(r.URL.Query().Get("preview_token"))
	if previewToken != "" {
		return previewToken
	}
	if cookie, err := r.Cookie(previewTokenCookieName); err == nil {
		return strings.TrimSpace(cookie.Value)
	}
	return ""
}

func previewShareIDFromRequestPath(path string) (string, bool) {
	normalizedPath := strings.TrimSpace(path)
	if normalizedPath == "" || normalizedPath == "/" {
		return "", false
	}
	normalizedPath = strings.TrimPrefix(normalizedPath, "/")
	parts := strings.Split(normalizedPath, "/")
	if len(parts) == 0 {
		return "", false
	}
	shareID := strings.TrimSpace(parts[0])
	if servicePreviewShareIDIsValid(shareID) == false {
		return "", false
	}
	return shareID, true
}

func servicePreviewShareIDIsValid(shareID string) bool {
	return service.ProjectPreviewShareIDIsValid(shareID)
}

func stripPreviewShareIDFromRequestPath(r *http.Request, shareID string) {
	if r == nil || r.URL == nil {
		return
	}
	normalizedShareID := strings.TrimSpace(shareID)
	if normalizedShareID == "" {
		return
	}
	path := strings.TrimSpace(r.URL.Path)
	if path == "" {
		r.URL.Path = "/"
		return
	}
	prefix := "/" + normalizedShareID
	if path == prefix {
		r.URL.Path = "/"
		return
	}
	prefixWithSlash := prefix + "/"
	if strings.HasPrefix(path, prefixWithSlash) {
		r.URL.Path = strings.TrimPrefix(path, prefix)
	}
	if r.URL.Path == "" {
		r.URL.Path = "/"
	}
}

func proxyRequestScheme(r *http.Request) string {
	if r == nil {
		return "http"
	}
	if proto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); proto != "" {
		return proto
	}
	if r.TLS != nil {
		return "https"
	}
	return "http"
}

func previewBaseDomain(cfg *config.Config) string {
	if cfg == nil {
		return ""
	}
	return strings.TrimSpace(cfg.Container.PreviewBaseDomain)
}

func projectIDFromPreviewRequest(r *http.Request, baseDomain string) string {
	if r == nil {
		return ""
	}

	projectID := strings.TrimSpace(r.URL.Query().Get("project"))
	if projectID != "" {
		return projectID
	}

	if hostProjectID, ok := service.ProjectIDFromPreviewHost(requestHost(r), baseDomain); ok {
		return hostProjectID
	}

	return ""
}

func requestHost(r *http.Request) string {
	if r == nil {
		return ""
	}

	host := strings.TrimSpace(r.Host)
	if host == "" {
		host = strings.TrimSpace(r.URL.Host)
	}
	if normalized, _, err := net.SplitHostPort(host); err == nil {
		return normalized
	}
	return strings.TrimSpace(host)
}
