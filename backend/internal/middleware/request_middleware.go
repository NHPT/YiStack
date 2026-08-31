package middleware

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
)

// LoggerConfig 日志配置
type LoggerConfig struct {
	EnableRequestBody  bool
	EnableResponseBody bool
	ExcludePaths       []string
}

// RequestLogger 请求日志中间件
func RequestLogger(cfg *LoggerConfig) app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		start := time.Now()
		path := string(ctx.Request.URI().Path())
		method := string(ctx.Request.Method())
		clientIP := string(ctx.ClientIP())

		log.Printf("[REQUEST] %s %s from %s", method, path, clientIP)
		if cfg != nil && cfg.EnableRequestBody && !shouldExcludePath(path, cfg.ExcludePaths) {
			if len(ctx.Request.Body()) > 0 {
				log.Printf("[REQUEST_BODY] %s %s: %s", method, path, string(ctx.Request.Body()))
			}
		}

		ctx.Next(c)

		latency := time.Since(start)
		status := ctx.Response.StatusCode()
		logLevel := "INFO"
		if status >= 500 {
			logLevel = "ERROR"
		} else if status >= 400 {
			logLevel = "WARN"
		}

		log.Printf("[RESPONSE] %s %s %d %s [%s]", method, path, status, latency.String(), logLevel)
	}
}

func shouldExcludePath(path string, excludePaths []string) bool {
	for _, p := range excludePaths {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// RequestID 生成请求 ID
func RequestID() app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		requestID := fmt.Sprintf("%d", time.Now().UnixNano())
		ctx.Set("request_id", requestID)
		ctx.Response.Header.Set("X-Request-ID", requestID)
		ctx.Next(c)
	}
}
