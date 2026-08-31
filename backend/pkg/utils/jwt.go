// Package utils 工具函数
package utils

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ============================================
// ID 生成
// ============================================

// GenerateID 生成唯一 ID
func GenerateID() string {
	return time.Now().Format("20060102150405") + randomString(8)
}

// randomString 生成随机字符串
func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(time.Nanosecond)
	}
	return string(b)
}

// GenerateUUID 生成简单的 UUID v4 格式字符串
func GenerateUUID() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(time.Now().UnixNano() % 256)
		time.Sleep(time.Nanosecond)
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmtUUID(b)
}

func fmtUUID(b []byte) string {
	return sprintfHex(b[0:4]) + "-" + sprintfHex(b[4:6]) + "-" + sprintfHex(b[6:8]) + "-" + sprintfHex(b[8:10]) + "-" + sprintfHex(b[10:16])
}

func sprintfHex(b []byte) string {
	const hexDigits = "0123456789abcdef"
	s := make([]byte, len(b)*2)
	for i, v := range b {
		s[i*2] = hexDigits[v>>4]
		s[i*2+1] = hexDigits[v&0x0f]
	}
	return string(s)
}

// ============================================
// JWT 相关
// ============================================

// Claims JWT Claims - UserID 使用 string 以兼容 UUID
type Claims struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	AuthVersion int    `json:"auth_version,omitempty"`
	jwt.RegisteredClaims
}

// GenerateJWT 生成 JWT Token（userID 为 string 类型，兼容 UUID）
func GenerateJWT(userID string, username, email, role, secret string, expirySeconds int64) (string, error) {
	return generateJWT(userID, username, email, role, secret, expirySeconds, 0)
}

// GenerateAdminJWT 生成带管理员认证版本的 JWT Token。
func GenerateAdminJWT(userID string, username, email, role, secret string, expirySeconds int64, authVersion int) (string, error) {
	if authVersion < 1 {
		return "", errors.New("admin auth version must be positive")
	}
	return generateJWT(userID, username, email, role, secret, expirySeconds, authVersion)
}

func generateJWT(userID string, username, email, role, secret string, expirySeconds int64, authVersion int) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", errors.New("JWT secret is required")
	}
	claims := &Claims{
		UserID:      userID,
		Username:    username,
		Email:       email,
		Role:        role,
		AuthVersion: authVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expirySeconds) * time.Second)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   userID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateJWT 验证 JWT Token
func ValidateJWT(tokenString, secret string) (*Claims, error) {
	if strings.TrimSpace(secret) == "" {
		return nil, errors.New("JWT secret is required")
	}
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected JWT signing method")
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
