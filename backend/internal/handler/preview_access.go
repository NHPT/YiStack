package handler

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"yistack/config"
)

const previewTokenCookieName = "yistack_preview_token"

type previewAccessClaims struct {
	UserID    string `json:"userId"`
	ProjectID string `json:"projectId"`
	Scope     string `json:"scope"`
	jwt.RegisteredClaims
}

func issuePreviewAccessToken(projectID, userID, jwtSecret string, ttl time.Duration) (string, error) {
	projectID = strings.TrimSpace(projectID)
	userID = strings.TrimSpace(userID)
	jwtSecret = strings.TrimSpace(jwtSecret)
	if projectID == "" || userID == "" || jwtSecret == "" {
		return "", fmt.Errorf("preview token context is incomplete")
	}
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}

	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, previewAccessClaims{
		UserID:    userID,
		ProjectID: projectID,
		Scope:     "preview",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-1 * time.Minute)),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	})
	return token.SignedString([]byte(jwtSecret))
}

func validatePreviewAccessToken(tokenString, expectedProjectID, jwtSecret string) (string, error) {
	tokenString = strings.TrimSpace(tokenString)
	expectedProjectID = strings.TrimSpace(expectedProjectID)
	jwtSecret = strings.TrimSpace(jwtSecret)
	if tokenString == "" || expectedProjectID == "" || jwtSecret == "" {
		return "", fmt.Errorf("preview token is invalid")
	}

	claims := &previewAccessClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid or expired preview token")
	}
	if claims.Scope != "preview" || strings.TrimSpace(claims.ProjectID) != expectedProjectID || strings.TrimSpace(claims.UserID) == "" {
		return "", fmt.Errorf("preview token does not match project")
	}
	return strings.TrimSpace(claims.UserID), nil
}

func projectIDFromPreviewAccessToken(tokenString, jwtSecret string) (string, bool) {
	tokenString = strings.TrimSpace(tokenString)
	jwtSecret = strings.TrimSpace(jwtSecret)
	if tokenString == "" || jwtSecret == "" {
		return "", false
	}

	claims := &previewAccessClaims{}
	_, _, err := jwt.NewParser().ParseUnverified(tokenString, claims)
	if err != nil || claims.Scope != "preview" {
		return "", false
	}

	projectID := strings.TrimSpace(claims.ProjectID)
	if projectID == "" {
		return "", false
	}
	return projectID, true
}

func attachPreviewToken(previewURL, token string) string {
	previewURL = strings.TrimSpace(previewURL)
	token = strings.TrimSpace(token)
	if previewURL == "" || token == "" {
		return previewURL
	}

	parsed, err := url.Parse(previewURL)
	if err != nil {
		return previewURL
	}

	query := parsed.Query()
	query.Set("preview_token", token)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func previewJWTSecret(cfg *config.Config) string {
	if cfg != nil && strings.TrimSpace(cfg.JWT.Secret) != "" {
		return strings.TrimSpace(cfg.JWT.Secret)
	}
	return ""
}

func previewTokenTTL(cfg *config.Config) time.Duration {
	if cfg != nil && cfg.Container.PreviewTokenTTLSeconds > 0 {
		return time.Duration(cfg.Container.PreviewTokenTTLSeconds) * time.Second
	}
	return 15 * time.Minute
}
