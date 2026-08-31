package middleware

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

// RateLimiterConfig 限流配置
type RateLimiterConfig struct {
	RequestsPerWindow int
	WindowSize        int
	SkipPaths         []string
}

// RateLimiter 限流器
type RateLimiter struct {
	config   *RateLimiterConfig
	visitors map[string]*visitor
	mu       sync.RWMutex
}

type visitor struct {
	count    int
	lastSeen time.Time
}

// NewRateLimiter 创建限流器
func NewRateLimiter(cfg *RateLimiterConfig) *RateLimiter {
	if cfg.RequestsPerWindow == 0 {
		cfg.RequestsPerWindow = 100
	}
	if cfg.WindowSize == 0 {
		cfg.WindowSize = 60
	}

	rl := &RateLimiter{
		config:   cfg,
		visitors: make(map[string]*visitor),
	}
	go rl.cleanupVisitors()
	return rl
}

// RateLimit 限流中间件
func (rl *RateLimiter) RateLimit() app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		path := string(ctx.Request.URI().Path())
		for _, skipPath := range rl.config.SkipPaths {
			if strings.HasPrefix(path, skipPath) {
				ctx.Next(c)
				return
			}
		}
		if strings.HasSuffix(path, "/runtime-status") {
			ctx.Next(c)
			return
		}
		if strings.Contains(path, "/terminal/sessions") {
			ctx.Next(c)
			return
		}
		if strings.Contains(path, "/terminal/ws-ticket") || strings.Contains(path, "/terminal/ws") {
			ctx.Next(c)
			return
		}

		clientID := rl.getClientID(ctx)
		if !rl.allow(clientID) {
			respondError(ctx, consts.StatusTooManyRequests, 1001, "rate limit exceeded, please try again later")
			ctx.Abort()
			return
		}

		ctx.Next(c)
	}
}

func (rl *RateLimiter) allow(clientID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[clientID]
	if !exists {
		rl.visitors[clientID] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}

	if time.Since(v.lastSeen) > time.Duration(rl.config.WindowSize)*time.Second {
		v.count = 1
		v.lastSeen = time.Now()
		return true
	}

	if v.count >= rl.config.RequestsPerWindow {
		return false
	}

	v.count++
	return true
}

func (rl *RateLimiter) getClientID(ctx *app.RequestContext) string {
	if userID, exists := ctx.Get("user_id"); exists {
		return fmt.Sprintf("user_%v", userID)
	}

	ip := string(ctx.Request.Header.Get("X-Forwarded-For"))
	if ip == "" {
		ip = string(ctx.ClientIP())
	}
	return fmt.Sprintf("ip_%s", ip)
}

func (rl *RateLimiter) cleanupVisitors() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		for key, v := range rl.visitors {
			if time.Since(v.lastSeen) > time.Duration(rl.config.WindowSize)*time.Second*2 {
				delete(rl.visitors, key)
			}
		}
		rl.mu.Unlock()
	}
}

// NewRateLimiterConfig 创建限流配置
func NewRateLimiterConfig(requestsPerMinute int) *RateLimiterConfig {
	return &RateLimiterConfig{
		RequestsPerWindow: requestsPerMinute,
		WindowSize:        60,
		SkipPaths: []string{
			"/api/health",
		},
	}
}
