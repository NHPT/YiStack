package service

import (
	"context"
	"errors"
	"testing"

	"yistack/internal/model"
)

type adminUserRepoStub struct {
	user                 *model.User
	deleteID             string
	deleteAdminID        string
	deleteDetail         string
	deleteIP             string
	auditCommitted       bool
	deleteErr            error
	updateUsed           bool
	deleteDone           bool
	postDeleteFindErr    error
	postDeleteFindErrors []error
	commitOnDeleteError  bool
	postDeleteFinds      int
}

func (r *adminUserRepoStub) Create(context.Context, *model.User) error { return nil }
func (r *adminUserRepoStub) FindByID(context.Context, string) (*model.User, error) {
	if r.user == nil {
		return nil, errors.New("user not found")
	}
	if r.deleteDone {
		if r.postDeleteFindErr != nil {
			return nil, r.postDeleteFindErr
		}
		if len(r.postDeleteFindErrors) > 0 {
			nextErr := r.postDeleteFindErrors[0]
			r.postDeleteFindErrors = r.postDeleteFindErrors[1:]
			if nextErr != nil {
				return nil, nextErr
			}
		}
		if r.postDeleteFinds <= 0 {
			return nil, errors.New("user not found")
		}
		r.postDeleteFinds--
	}
	copy := *r.user
	return &copy, nil
}
func (r *adminUserRepoStub) FindByEmail(context.Context, string) (*model.User, error) {
	return nil, errors.New("user not found")
}
func (r *adminUserRepoStub) FindByUsername(context.Context, string) (*model.User, error) {
	return nil, errors.New("user not found")
}
func (r *adminUserRepoStub) Update(context.Context, *model.User) error {
	r.updateUsed = true
	return nil
}
func (r *adminUserRepoStub) UpdateLLMConfig(context.Context, string, string, string, int) error {
	return nil
}
func (r *adminUserRepoStub) Delete(_ context.Context, userID string) error {
	r.deleteID = userID
	if r.commitOnDeleteError {
		r.deleteDone = true
	}
	return r.deleteErr
}
func (r *adminUserRepoStub) DeleteWithAudit(_ context.Context, userID, adminID, detail, ipAddress string) error {
	r.deleteID = userID
	r.deleteAdminID = adminID
	r.deleteDetail = detail
	r.deleteIP = ipAddress
	if r.deleteErr == nil || r.commitOnDeleteError {
		r.auditCommitted = true
	}
	if r.commitOnDeleteError {
		r.deleteDone = true
	}
	return r.deleteErr
}
func (r *adminUserRepoStub) List(context.Context, int, int) ([]model.User, int64, error) {
	return nil, 0, nil
}

type adminUserAuditRepoStub struct {
	created *model.AdminAuditLog
}

func (r *adminUserAuditRepoStub) Create(_ context.Context, audit *model.AdminAuditLog) error {
	copy := *audit
	r.created = &copy
	return nil
}
func (r *adminUserAuditRepoStub) List(context.Context, int, int) ([]model.AdminAuditLog, error) {
	return nil, nil
}
func (r *adminUserAuditRepoStub) Count(context.Context) (int64, error) { return 0, nil }

type adminUserProjectCleanerStub struct {
	userID string
	err    error
}

func (c *adminUserProjectCleanerStub) BeginUserProjectOperation(string) (func(), error) {
	return func() {}, nil
}

func (c *adminUserProjectCleanerStub) DeleteUserWithProjectResources(
	ctx context.Context,
	userID string,
	deleteUser func(context.Context) error,
) error {
	c.userID = userID
	if c.err != nil {
		return c.err
	}
	return deleteUser(ctx)
}

func TestAdminConsoleDeleteUserPermanentlyDeletesAndAudits(t *testing.T) {
	userRepo := &adminUserRepoStub{user: &model.User{
		ID:     "10000000-0000-0000-0000-000000000001",
		Email:  "user@example.test",
		Status: "deleted",
	}}
	auditRepo := &adminUserAuditRepoStub{}
	projectCleaner := &adminUserProjectCleanerStub{}
	adminService := NewAdminConsoleService(nil, userRepo, auditRepo, nil, nil, projectCleaner)

	deleted, err := adminService.DeleteUser(
		context.Background(),
		"20000000-0000-0000-0000-000000000001",
		userRepo.user.ID,
		"127.0.0.1",
	)
	if err != nil {
		t.Fatalf("DeleteUser() error = %v", err)
	}
	if deleted.ID != userRepo.user.ID || userRepo.deleteID != userRepo.user.ID {
		t.Fatalf("DeleteUser() did not delete %q", userRepo.user.ID)
	}
	if userRepo.updateUsed {
		t.Fatal("DeleteUser() used a status update instead of physical deletion")
	}
	if projectCleaner.userID != userRepo.user.ID {
		t.Fatalf("DeleteUser() did not clean project resources for %q", userRepo.user.ID)
	}
	if !userRepo.auditCommitted ||
		userRepo.deleteAdminID != "20000000-0000-0000-0000-000000000001" ||
		userRepo.deleteDetail != "Permanently deleted user: user@example.test" ||
		userRepo.deleteIP != "127.0.0.1" {
		t.Fatalf("DeleteUser() atomic audit input = %#v", userRepo)
	}
	if auditRepo.created != nil {
		t.Fatalf("DeleteUser() wrote a non-transactional audit: %#v", auditRepo.created)
	}
}

func TestAdminConsoleDeleteUserDoesNotAuditFailedDeletion(t *testing.T) {
	userRepo := &adminUserRepoStub{
		user:      &model.User{ID: "10000000-0000-0000-0000-000000000002"},
		deleteErr: errors.New("delete failed"),
	}
	auditRepo := &adminUserAuditRepoStub{}
	adminService := NewAdminConsoleService(
		nil,
		userRepo,
		auditRepo,
		nil,
		nil,
		&adminUserProjectCleanerStub{},
	)

	if _, err := adminService.DeleteUser(
		context.Background(),
		"20000000-0000-0000-0000-000000000001",
		userRepo.user.ID,
		"127.0.0.1",
	); err == nil {
		t.Fatal("DeleteUser() succeeded after repository deletion failed")
	}
	if auditRepo.created != nil {
		if userRepo.auditCommitted {
			t.Fatal("DeleteUser() committed an audit after transactional deletion failure")
		}
		t.Fatalf("DeleteUser() wrote an audit after failure: %#v", auditRepo.created)
	}
}

func TestAdminConsoleDeleteUserConfirmsCommitAfterAmbiguousRepositoryError(t *testing.T) {
	userRepo := &adminUserRepoStub{
		user:                &model.User{ID: "10000000-0000-0000-0000-000000000004"},
		deleteErr:           errors.New("connection closed before response"),
		commitOnDeleteError: true,
		postDeleteFinds:     1,
	}
	auditRepo := &adminUserAuditRepoStub{}
	projectCleaner := &adminUserProjectCleanerStub{}
	adminService := NewAdminConsoleService(nil, userRepo, auditRepo, nil, nil, projectCleaner)

	if _, err := adminService.DeleteUser(
		context.Background(),
		"20000000-0000-0000-0000-000000000001",
		userRepo.user.ID,
		"127.0.0.1",
	); err != nil {
		t.Fatalf("DeleteUser() did not confirm committed deletion: %v", err)
	}
	if !userRepo.auditCommitted {
		t.Fatal("DeleteUser() did not atomically audit the confirmed deletion")
	}
	if auditRepo.created != nil {
		t.Fatalf("DeleteUser() duplicated the atomic audit: %#v", auditRepo.created)
	}
}

func TestAdminConsoleDeleteUserStopsBeforeDatabaseDeleteWhenProjectCleanupFails(t *testing.T) {
	userRepo := &adminUserRepoStub{
		user: &model.User{ID: "10000000-0000-0000-0000-000000000003"},
	}
	auditRepo := &adminUserAuditRepoStub{}
	projectCleaner := &adminUserProjectCleanerStub{err: errors.New("cleanup failed")}
	adminService := NewAdminConsoleService(nil, userRepo, auditRepo, nil, nil, projectCleaner)

	if _, err := adminService.DeleteUser(
		context.Background(),
		"20000000-0000-0000-0000-000000000001",
		userRepo.user.ID,
		"127.0.0.1",
	); err == nil {
		t.Fatal("DeleteUser() succeeded after project resource cleanup failed")
	}
	if userRepo.deleteID != "" {
		t.Fatalf("DeleteUser() deleted the database row after cleanup failure: %q", userRepo.deleteID)
	}
	if auditRepo.created != nil {
		t.Fatalf("DeleteUser() wrote an audit after cleanup failure: %#v", auditRepo.created)
	}
}

func TestDeleteUserReportsUnknownOutcomeWhenCommitCannotBeConfirmed(t *testing.T) {
	userRepo := &adminUserRepoStub{
		user:                &model.User{ID: "10000000-0000-0000-0000-000000000005"},
		deleteErr:           errors.New("connection closed before response"),
		commitOnDeleteError: true,
		postDeleteFindErr:   errors.New("confirmation endpoint unavailable"),
	}
	adminService := NewAdminConsoleService(
		nil,
		userRepo,
		&adminUserAuditRepoStub{},
		nil,
		nil,
		&adminUserProjectCleanerStub{},
	)

	_, err := adminService.DeleteUser(
		context.Background(),
		"20000000-0000-0000-0000-000000000001",
		userRepo.user.ID,
		"127.0.0.1",
	)
	if !isUserDeletionOutcomeUnknown(err) {
		t.Fatalf("DeleteUser() error = %v, want unknown deletion outcome", err)
	}
}

func TestDeleteUserMixedConfirmationErrorsRemainUnknown(t *testing.T) {
	userRepo := &adminUserRepoStub{
		user:            &model.User{ID: "10000000-0000-0000-0000-000000000006"},
		deleteErr:       errors.New("connection closed before response"),
		deleteDone:      true,
		postDeleteFinds: 1,
		postDeleteFindErrors: []error{
			nil,
			errors.New("confirmation endpoint unavailable"),
			errors.New("confirmation endpoint unavailable"),
		},
	}
	adminService := NewAdminConsoleService(nil, userRepo, nil, nil, nil, nil)

	err := adminService.deleteUserWithAuditAndConfirm(
		context.Background(),
		userRepo.user.ID,
		"20000000-0000-0000-0000-000000000001",
		"delete user",
		"127.0.0.1",
	)
	if !isUserDeletionOutcomeUnknown(err) {
		t.Fatalf("deleteUserWithAuditAndConfirm() error = %v, want unknown deletion outcome", err)
	}
}
