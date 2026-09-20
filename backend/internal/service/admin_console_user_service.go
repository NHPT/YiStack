package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"yistack/internal/model"
)

// ListUsers 获取用户列表。
func (s *AdminConsoleService) ListUsers(ctx context.Context, offset, limit int) ([]model.User, int64, error) {
	if s == nil || s.userRepo == nil {
		return nil, 0, fmt.Errorf("user service not available")
	}
	return s.userRepo.List(ctx, offset, limit)
}

// UpdateUser 更新用户角色与状态。
func (s *AdminConsoleService) UpdateUser(ctx context.Context, operatorID, userID, role, status, ip string) (*model.User, error) {
	if s == nil || s.userRepo == nil {
		return nil, fmt.Errorf("user service not available")
	}
	unlockUser := func() {}
	if s.projectCleaner != nil {
		var err error
		unlockUser, err = s.projectCleaner.BeginUserProjectOperation(userID)
		if err != nil {
			return nil, err
		}
	}
	defer unlockUser()

	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if role != "" {
		user.Role = role
	}
	if status != "" {
		user.Status = status
	}
	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}
	s.writeAudit(ctx, operatorID, "update_user", "user", userID, "Updated user: role="+role+" status="+status, ip)
	return user, nil
}

// DeleteUser 永久删除普通用户及其关联业务数据。
func (s *AdminConsoleService) DeleteUser(ctx context.Context, operatorID, userID, ip string) (*model.User, error) {
	if s == nil || s.userRepo == nil {
		return nil, fmt.Errorf("user service not available")
	}
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if s.projectCleaner == nil {
		return nil, fmt.Errorf("project cleanup service not available")
	}
	auditDetail := "Permanently deleted user: " + user.Email
	if err := s.projectCleaner.DeleteUserWithProjectResources(
		ctx,
		userID,
		func(deleteCtx context.Context) error {
			return s.deleteUserWithAuditAndConfirm(deleteCtx, userID, operatorID, auditDetail, ip)
		},
	); err != nil {
		return nil, err
	}
	return user, nil
}

type userDeletionOutcomeUnknownError struct {
	cause error
}

func (e *userDeletionOutcomeUnknownError) Error() string {
	return e.cause.Error()
}

func (e *userDeletionOutcomeUnknownError) Unwrap() error {
	return e.cause
}

func isUserDeletionOutcomeUnknown(err error) bool {
	var unknownErr *userDeletionOutcomeUnknownError
	return errors.As(err, &unknownErr)
}
func (s *AdminConsoleService) deleteUserWithAuditAndConfirm(
	ctx context.Context, userID, operatorID, detail, ip string,
) error {
	deleteErr := s.userRepo.DeleteWithAudit(ctx, userID, operatorID, detail, ip)
	if deleteErr == nil {
		return nil
	}

	verifyCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	var verifyErr error
	allChecksConfirmedPresent := true
	for attempt := 0; attempt < 3; attempt++ {
		_, verifyErr = s.userRepo.FindByID(verifyCtx, userID)
		if isUserNotFoundRepositoryError(verifyErr) {
			return nil
		} else if verifyErr != nil {
			allChecksConfirmedPresent = false
		}
		if attempt < 2 {
			select {
			case <-verifyCtx.Done():
				return &userDeletionOutcomeUnknownError{cause: fmt.Errorf(
					"%w; user deletion outcome remains unknown: %v",
					deleteErr,
					verifyCtx.Err(),
				)}
			case <-time.After(200 * time.Millisecond):
			}
		}
	}
	if allChecksConfirmedPresent {
		return deleteErr
	}
	return &userDeletionOutcomeUnknownError{cause: fmt.Errorf(
		"%w; user deletion outcome remains unknown: %v", deleteErr, verifyErr,
	)}
}

func isUserNotFoundRepositoryError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return message == "record not found" ||
		message == "user not found" ||
		strings.Contains(message, "pgrst116")
}

// ListAuditLogs 获取审计日志。
func (s *AdminConsoleService) ListAuditLogs(ctx context.Context, offset, limit int) ([]model.AdminAuditLog, error) {
	if s == nil || s.auditRepo == nil {
		return nil, fmt.Errorf("audit service not available")
	}
	return s.auditRepo.List(ctx, offset, limit)
}
