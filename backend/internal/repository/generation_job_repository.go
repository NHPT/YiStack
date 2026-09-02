package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"yistack/internal/model"
	"yistack/pkg/database"
)

type GenerationJobRepository struct {
	db *gorm.DB
}

type generationJobStaleGuard struct {
	leaseVersion     int64
	staleQueueBefore time.Time
	now              time.Time
}

func NewGenerationJobRepository(db database.Database) *GenerationJobRepository {
	return &GenerationJobRepository{db: db.GetDB()}
}

func (r *GenerationJobRepository) CreateJob(ctx context.Context, job *model.GenerationJob) error {
	return r.db.WithContext(ctx).Create(job).Error
}

func (r *GenerationJobRepository) FindJobByID(ctx context.Context, jobID string) (*model.GenerationJob, error) {
	var job model.GenerationJob
	if err := r.db.WithContext(ctx).Where("id = ?", jobID).First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *GenerationJobRepository) FindJobByIdempotencyKey(ctx context.Context, userID, key string) (*model.GenerationJob, error) {
	var job model.GenerationJob
	if err := r.db.WithContext(ctx).Where("user_id = ? AND idempotency_key = ?", userID, key).First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *GenerationJobRepository) FindLatestJobByProjectID(ctx context.Context, projectID string) (*model.GenerationJob, error) {
	var job model.GenerationJob
	if err := r.db.WithContext(ctx).Where("project_id = ?", projectID).Order("created_at DESC").First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *GenerationJobRepository) FindActiveJobByProjectID(ctx context.Context, projectID string) (*model.GenerationJob, error) {
	var job model.GenerationJob
	if err := r.db.WithContext(ctx).Where("project_id = ? AND status IN ?", projectID, generationActiveJobStatuses()).Order("created_at DESC").First(&job).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *GenerationJobRepository) SupersedeActiveJobs(ctx context.Context, projectID, reason string, now time.Time) ([]string, error) {
	var candidates []model.GenerationJob
	if err := r.db.WithContext(ctx).
		Where("project_id = ? AND status IN ?", projectID, generationActiveJobStatuses()).
		Order("created_at ASC").Find(&candidates).Error; err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(candidates))
	for _, job := range candidates {
		cancelledAt := now
		applied, err := r.transitionJobTerminal(ctx, job.ID, "", model.GenerationJobCompletion{
			Status: model.GenerationJobStatusCancelled, ErrorCode: "generation_superseded",
			ErrorMessage: "superseded by a newer generation request", StopReason: reason,
			ResultSummary: "{}", EventType: model.GenerationEventTypeError,
			EventPayload: generationTerminalErrorPayload(job.ID, "generation_superseded", "生成任务已由新请求替换"),
			CompletedAt:  now,
		}, &cancelledAt, nil)
		if err != nil {
			return ids, err
		}
		if applied {
			ids = append(ids, job.ID)
		}
	}
	return ids, nil
}

func (r *GenerationJobRepository) AcquireJobLease(ctx context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error) {
	result := r.db.WithContext(ctx).Model(&model.GenerationJob{}).
		Where("id = ? AND status = ?", jobID, model.GenerationJobStatusQueued).
		Updates(map[string]any{
			"status": model.GenerationJobStatusRunning, "worker_id": workerID,
			"lease_version": gorm.Expr("lease_version + 1"), "lease_expires_at": leaseUntil,
			"heartbeat_at": now, "started_at": now, "current_attempt": gorm.Expr("current_attempt + 1"), "updated_at": now,
		})
	return result.RowsAffected == 1, result.Error
}

func (r *GenerationJobRepository) HeartbeatJobLease(ctx context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error) {
	result := r.db.WithContext(ctx).Model(&model.GenerationJob{}).
		Where(
			"id = ? AND worker_id = ? AND status IN ? AND lease_expires_at > CURRENT_TIMESTAMP",
			jobID, workerID, generationActiveJobStatuses(),
		).
		Updates(map[string]any{
			"lease_version":    gorm.Expr("lease_version + 1"),
			"lease_expires_at": gorm.Expr("GREATEST(lease_expires_at, ?)", leaseUntil),
			"heartbeat_at":     now,
			"updated_at":       now,
		})
	return result.RowsAffected == 1, result.Error
}

func (r *GenerationJobRepository) UpdateJobPhase(ctx context.Context, jobID, workerID, status string, now time.Time) (bool, error) {
	result := r.db.WithContext(ctx).Model(&model.GenerationJob{}).
		Where("id = ? AND worker_id = ? AND status IN ?", jobID, workerID, generationActiveJobStatuses()).
		Updates(map[string]any{"status": status, "updated_at": now})
	return result.RowsAffected == 1, result.Error
}

func (r *GenerationJobRepository) BindVisualContextSnapshot(
	ctx context.Context,
	jobID string,
	workerID string,
	attemptID string,
	requestPayload string,
	now time.Time,
) (bool, error) {
	applied := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		jobUpdate := tx.Model(&model.GenerationJob{}).
			Where("id = ? AND worker_id = ? AND status IN ?", jobID, workerID, generationActiveJobStatuses()).
			Updates(map[string]any{
				"request_payload": normalizedJSONObject(requestPayload),
				"updated_at":      now,
			})
		if jobUpdate.Error != nil {
			return jobUpdate.Error
		}
		if jobUpdate.RowsAffected != 1 {
			return nil
		}
		attemptUpdate := tx.Model(&model.GenerationAttempt{}).
			Where("id = ? AND job_id = ? AND status = ?", attemptID, jobID, model.GenerationJobStatusRunning).
			Updates(map[string]any{
				"input_snapshot": normalizedJSONObject(requestPayload),
				"updated_at":     now,
			})
		if attemptUpdate.Error != nil {
			return attemptUpdate.Error
		}
		if attemptUpdate.RowsAffected != 1 {
			return fmt.Errorf("generation attempt %s is not active", attemptID)
		}
		applied = true
		return nil
	})
	return applied, err
}
func (r *GenerationJobRepository) CompleteJob(ctx context.Context, jobID, workerID string, completion model.GenerationJobCompletion) (bool, error) {
	return r.transitionJobTerminal(ctx, jobID, workerID, completion, nil, nil)
}

func (r *GenerationJobRepository) CancelActiveJob(ctx context.Context, jobID, reason string, now time.Time) (bool, error) {
	cancelledAt := now
	return r.transitionJobTerminal(ctx, jobID, "", model.GenerationJobCompletion{
		Status: model.GenerationJobStatusCancelled, ErrorCode: "generation_cancelled",
		ErrorMessage: "generation cancelled", StopReason: reason, ResultSummary: "{}",
		EventType:    model.GenerationEventTypeError,
		EventPayload: generationTerminalErrorPayload(jobID, "generation_cancelled", "生成已停止"),
		CompletedAt:  now,
	}, &cancelledAt, nil)
}

func (r *GenerationJobRepository) InterruptStaleJobs(ctx context.Context, _ string, now time.Time) (int64, error) {
	staleQueueBefore := now.Add(-30 * time.Second)
	var candidates []model.GenerationJob
	if err := r.db.WithContext(ctx).Where(
		"(status = ? AND updated_at <= ?) OR (status IN ? AND status <> ? AND (lease_expires_at IS NULL OR lease_expires_at <= ?))",
		model.GenerationJobStatusQueued, staleQueueBefore, generationActiveJobStatuses(), model.GenerationJobStatusQueued, now,
	).Find(&candidates).Error; err != nil {
		return 0, err
	}
	var interrupted int64
	for _, job := range candidates {
		applied, err := r.transitionJobTerminal(ctx, job.ID, "", model.GenerationJobCompletion{
			Status: model.GenerationJobStatusInterrupted, ErrorCode: "generation_job_lease_lost",
			ErrorMessage: "generation worker lease expired before safe completion", StopReason: "generation_worker_interrupted",
			ResultSummary: "{}", EventType: model.GenerationEventTypeError,
			EventPayload: generationTerminalErrorPayload(job.ID, "generation_job_lease_lost", "生成任务因 worker 中断而停止"),
			CompletedAt:  now,
		}, nil, &generationJobStaleGuard{
			leaseVersion:     job.LeaseVersion,
			staleQueueBefore: staleQueueBefore,
			now:              now,
		})
		if err != nil {
			return interrupted, err
		}
		if applied {
			interrupted++
		}
	}
	return interrupted, nil
}

func (r *GenerationJobRepository) transitionJobTerminal(
	ctx context.Context, jobID, workerID string,
	completion model.GenerationJobCompletion,
	cancelledAt *time.Time,
	staleGuard *generationJobStaleGuard,
) (bool, error) {
	applied := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND status IN ?", jobID, generationActiveJobStatuses())
		if workerID != "" {
			query = query.Where("worker_id = ?", workerID)
		}
		var job model.GenerationJob
		if staleGuard != nil {
			query = query.
				Where("lease_version = ?", staleGuard.leaseVersion).
				Where(
					"(status = ? AND updated_at <= ?) OR (status <> ? AND (lease_expires_at IS NULL OR lease_expires_at <= ?))",
					model.GenerationJobStatusQueued, staleGuard.staleQueueBefore, model.GenerationJobStatusQueued, staleGuard.now,
				)
		}
		if err := query.First(&job).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}

		eventType := completion.EventType
		if eventType == "" {
			eventType = model.GenerationEventTypeError
			if completion.Status == model.GenerationJobStatusSucceeded {
				eventType = model.GenerationEventTypeDone
			}
		}
		eventPayload := completion.EventPayload
		if eventPayload == "" {
			if eventType == model.GenerationEventTypeDone {
				eventPayload = completion.ResultSummary
			} else {
				eventPayload = generationTerminalErrorPayload(jobID, completion.ErrorCode, completion.ErrorMessage)
			}
		}
		nextSequence := job.EventSequence + 1
		event := model.GenerationEvent{
			JobID: job.ID, ProjectID: job.ProjectID, Sequence: nextSequence,
			EventKey: "terminal", EventType: eventType,
			Payload: normalizedJSONObject(eventPayload), CreatedAt: completion.CompletedAt,
		}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}

		updates := map[string]any{
			"status": completion.Status, "error_code": completion.ErrorCode,
			"error_message": completion.ErrorMessage, "stop_reason": completion.StopReason,
			"result_summary": normalizedJSONObject(completion.ResultSummary),
			"event_sequence": nextSequence, "completed_at": completion.CompletedAt,
			"lease_expires_at": nil, "updated_at": completion.CompletedAt,
		}
		if cancelledAt != nil {
			updates["cancelled_at"] = *cancelledAt
		}
		updateQuery := tx.Model(&model.GenerationJob{}).
			Where("id = ? AND event_sequence = ? AND status IN ?", jobID, job.EventSequence, generationActiveJobStatuses())
		if workerID != "" {
			updateQuery = updateQuery.Where("worker_id = ?", workerID)
		}
		result := updateQuery.Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("generation job terminal CAS rejected")
		}
		if err := tx.Model(&model.GenerationAttempt{}).
			Where("job_id = ? AND status = ?", jobID, model.GenerationJobStatusRunning).
			Updates(map[string]any{
				"status": completion.Status, "error_code": completion.ErrorCode,
				"error_message": completion.ErrorMessage, "result_summary": normalizedJSONObject(completion.ResultSummary),
				"completed_at": completion.CompletedAt, "updated_at": completion.CompletedAt,
			}).Error; err != nil {
			return err
		}
		applied = true
		return nil
	})
	return applied, err
}

func generationTerminalErrorPayload(jobID, code, message string) string {
	payload, _ := json.Marshal(map[string]any{
		"code": code, "blocking": true, "message": message, "details": message, "job_id": jobID,
	})
	return string(payload)
}

func (r *GenerationJobRepository) CreateAttempt(ctx context.Context, attempt *model.GenerationAttempt) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(attempt).Error; err != nil {
			return err
		}
		return tx.Model(&model.GenerationJob{}).
			Where("id = ? AND current_attempt < ?", attempt.JobID, attempt.AttemptNumber).
			Updates(map[string]any{"current_attempt": attempt.AttemptNumber, "updated_at": attempt.UpdatedAt}).Error
	})
}

func (r *GenerationJobRepository) CompleteAttempt(ctx context.Context, attemptID string, completion model.GenerationAttemptCompletion) error {
	return r.db.WithContext(ctx).Model(&model.GenerationAttempt{}).Where("id = ? AND status = ?", attemptID, model.GenerationJobStatusRunning).Updates(map[string]any{
		"status": completion.Status, "error_code": completion.ErrorCode, "error_message": completion.ErrorMessage,
		"failure_hash": completion.FailureHash, "result_summary": normalizedJSONObject(completion.ResultSummary),
		"completed_at": completion.CompletedAt, "updated_at": completion.CompletedAt,
	}).Error
}

func (r *GenerationJobRepository) AppendEvent(ctx context.Context, jobID, eventKey, eventType, payload string, now time.Time) (*model.GenerationEvent, bool, error) {
	var event model.GenerationEvent
	created := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.GenerationEvent
		err := tx.Where("job_id = ? AND event_key = ?", jobID, eventKey).First(&existing).Error
		if err == nil {
			event = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var job model.GenerationJob
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", jobID).First(&job).Error; err != nil {
			return err
		}
		if err := tx.Where("job_id = ? AND event_key = ?", jobID, eventKey).First(&existing).Error; err == nil {
			event = existing
			return nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if !model.IsGenerationJobActiveStatus(job.Status) {
			return context.Canceled
		}
		next := job.EventSequence + 1
		if err := tx.Model(&model.GenerationJob{}).Where("id = ? AND event_sequence = ?", jobID, job.EventSequence).Updates(map[string]any{"event_sequence": next, "updated_at": now}).Error; err != nil {
			return err
		}
		event = model.GenerationEvent{JobID: job.ID, ProjectID: job.ProjectID, Sequence: next, EventKey: eventKey, EventType: eventType, Payload: normalizedJSONObject(payload), CreatedAt: now}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}
		created = true
		return nil
	})
	return &event, created, err
}

func (r *GenerationJobRepository) ListEvents(ctx context.Context, jobID string, afterSequence int64, limit int) ([]model.GenerationEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 500
	}
	var events []model.GenerationEvent
	err := r.db.WithContext(ctx).Where("job_id = ? AND sequence > ?", jobID, afterSequence).Order("sequence ASC").Limit(limit).Find(&events).Error
	return events, err
}

func generationActiveJobStatuses() []string {
	return []string{model.GenerationJobStatusQueued, model.GenerationJobStatusRunning, model.GenerationJobStatusRepairing, model.GenerationJobStatusValidating, model.GenerationJobStatusPreviewing}
}

func normalizedJSONObject(value string) string {
	if value == "" {
		return "{}"
	}
	return value
}
