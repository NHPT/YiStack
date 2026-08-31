package service

import (
	"context"
	"errors"
	"time"

	"yistack/internal/model"

	"gorm.io/gorm"
)

const generationEventReplayLimit = 500

type GenerationJobCompletion = model.GenerationJobCompletion
type GenerationAttemptCompletion = model.GenerationAttemptCompletion

// GenerationJobRepo defines the durable job, attempt, lease and event boundary.
type GenerationJobRepo interface {
	CreateJob(ctx context.Context, job *model.GenerationJob) error
	FindJobByID(ctx context.Context, jobID string) (*model.GenerationJob, error)
	FindJobByIdempotencyKey(ctx context.Context, userID, idempotencyKey string) (*model.GenerationJob, error)
	FindLatestJobByProjectID(ctx context.Context, projectID string) (*model.GenerationJob, error)
	FindActiveJobByProjectID(ctx context.Context, projectID string) (*model.GenerationJob, error)
	SupersedeActiveJobs(ctx context.Context, projectID, reason string, now time.Time) ([]string, error)
	AcquireJobLease(ctx context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error)
	HeartbeatJobLease(ctx context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error)
	UpdateJobPhase(ctx context.Context, jobID, workerID, status string, now time.Time) (bool, error)
	CompleteJob(ctx context.Context, jobID, workerID string, completion GenerationJobCompletion) (bool, error)
	CancelActiveJob(ctx context.Context, jobID, reason string, now time.Time) (bool, error)
	InterruptStaleJobs(ctx context.Context, workerID string, now time.Time) (int64, error)
	CreateAttempt(ctx context.Context, attempt *model.GenerationAttempt) error
	CompleteAttempt(ctx context.Context, attemptID string, completion GenerationAttemptCompletion) error
	AppendEvent(ctx context.Context, jobID, eventKey, eventType, payload string, now time.Time) (*model.GenerationEvent, bool, error)
	ListEvents(ctx context.Context, jobID string, afterSequence int64, limit int) ([]model.GenerationEvent, error)
}

func IsGenerationJobActiveStatus(status string) bool {
	return model.IsGenerationJobActiveStatus(status)
}

func IsGenerationJobTerminalStatus(status string) bool {
	return model.IsGenerationJobTerminalStatus(status)
}

func IsGenerationJobNotFoundError(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
