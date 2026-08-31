package middleware

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"yistack/config"
)

// CORS 跨域中间件
func CORS() app.HandlerFunc {
	cfg := config.Get()
	corsCfg := cfg.CORS

	return func(c context.Context, ctx *app.RequestContext) {
		origin := string(ctx.Request.Header.Get("Origin"))
		allowOrigin := ""
		if origin != "" && len(corsCfg.AllowedOrigins) > 0 {
			allowed := false
			for _, allowedOrigin := range corsCfg.AllowedOrigins {
				if allowedOrigin == "*" || allowedOrigin == origin {
					allowed = true
					break
				}
			}
			if allowed {
				allowOrigin = origin
			}
		}

		if allowOrigin != "" {
			ctx.Response.Header.Set("Access-Control-Allow-Origin", allowOrigin)
		}
		ctx.Response.Header.Set("Access-Control-Allow-Methods", strings.Join(corsCfg.AllowedMethods, ", "))
		ctx.Response.Header.Set("Access-Control-Allow-Headers", strings.Join(corsCfg.AllowedHeaders, ", "))
		ctx.Response.Header.Set("Access-Control-Max-Age", fmt.Sprintf("%d", corsCfg.MaxAge))
		ctx.Response.Header.Set("Access-Control-Allow-Credentials", "true")

		if len(corsCfg.ExposedHeaders) > 0 {
			ctx.Response.Header.Set("Access-Control-Expose-Headers", strings.Join(corsCfg.ExposedHeaders, ", "))
		}

		if string(ctx.Request.Method()) == "OPTIONS" {
			ctx.AbortWithStatus(consts.StatusOK)
			return
		}

		ctx.Next(c)
	}
}

// SecurityHeaders 安全头中间件
func SecurityHeaders() app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		ctx.Response.Header.Set("X-Content-Type-Options", "nosniff")
		ctx.Response.Header.Set("X-Frame-Options", "DENY")
		ctx.Response.Header.Set("X-XSS-Protection", "1; mode=block")
		ctx.Response.Header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		ctx.Response.Header.Set("Content-Security-Policy", "default-src 'self'")
		ctx.Next(c)
	}
}
