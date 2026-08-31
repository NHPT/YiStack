package middleware

import (
	"context"
	"log"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
)

// ErrorResponse 统一错误响应结构。
type ErrorResponse struct {
	Success    bool   `json:"success"`
	Error      string `json:"error"`
	ReasonCode string `json:"reason_code,omitempty"`
}

// respondError 发送错误响应
func respondError(ctx *app.RequestContext, status int, code int, message string) {
	ctx.JSON(status, ErrorResponse{
		Success:    false,
		Error:      message,
		ReasonCode: responseReasonCode(code),
	})
}

// respondSuccess 发送成功响应
func respondSuccess(ctx *app.RequestContext, data any) {
	ctx.JSON(consts.StatusOK, map[string]any{
		"success": true,
		"data":    data,
	})
}

// responseReasonCode 将旧内部错误编号映射为稳定诊断原因码，不再对外暴露数字 code。
func responseReasonCode(code int) string {
	switch code {
	case 1001:
		return "param_error"
	case 1002:
		return "auth_required"
	case 1003:
		return "forbidden"
	case 1004:
		return "admin_password_change_required"
	case 2001:
		return "not_found"
	case 3001:
		return "internal_error"
	default:
		return "api_error"
	}
}

// ErrorHandler 错误处理中间件
func ErrorHandler() app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		ctx.Next(c)
		if len(ctx.Errors) > 0 {
			err := ctx.Errors[0]
			log.Printf("[ERROR] %s: %v", ctx.Request.URI().Path(), err.Err)
			switch err.Err.(type) {
			case *ValidationError:
				respondError(ctx, consts.StatusBadRequest, 1001, err.Err.Error())
			case *AuthenticationError:
				respondError(ctx, consts.StatusUnauthorized, 1002, err.Err.Error())
			case *AuthorizationError:
				respondError(ctx, consts.StatusForbidden, 1003, err.Err.Error())
			case *NotFoundError:
				respondError(ctx, consts.StatusNotFound, 2001, err.Err.Error())
			default:
				respondError(ctx, consts.StatusInternalServerError, 3001, "internal server error")
			}
		}
	}
}

// ValidationError 验证错误
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

// NewValidationError 创建验证错误
func NewValidationError(msg string) *ValidationError { return &ValidationError{Message: msg} }

// AuthenticationError 认证错误
type AuthenticationError struct{ Message string }

func (e *AuthenticationError) Error() string { return e.Message }

// NewAuthenticationError 创建认证错误
func NewAuthenticationError(msg string) *AuthenticationError {
	return &AuthenticationError{Message: msg}
}

// AuthorizationError 权限错误
type AuthorizationError struct{ Message string }

func (e *AuthorizationError) Error() string { return e.Message }

// NewAuthorizationError 创建权限错误
func NewAuthorizationError(msg string) *AuthorizationError { return &AuthorizationError{Message: msg} }

// NotFoundError 未找到错误
type NotFoundError struct{ Message string }

func (e *NotFoundError) Error() string { return e.Message }

// NewNotFoundError 创建未找到错误
func NewNotFoundError(msg string) *NotFoundError { return &NotFoundError{Message: msg} }

// Recovery 恢复中间件
func Recovery() app.HandlerFunc {
	return func(c context.Context, ctx *app.RequestContext) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %v", err)
				respondError(ctx, consts.StatusInternalServerError, 3001, "internal server error")
				ctx.Abort()
			}
		}()
		ctx.Next(c)
	}
}
