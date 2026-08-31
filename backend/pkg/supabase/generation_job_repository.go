package supabase

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
)

type GenerationJobRepository struct {
	supabase *Client
}

func (r *SupabaseRepository) GenerationJobRepository() *GenerationJobRepository {
	return &GenerationJobRepository{supabase: r.client}
}

func (r *GenerationJobRepository) CreateJob(_ context.Context, job *model.GenerationJob) error {
	data := generationJobData(job)
	result, err := r.supabase.AdminTable("generation_jobs").Insert(data)
	if err != nil {
		return fmt.Errorf("create generation job: %w", err)
	}
	if record, ok := firstDataMap(result.Data); ok {
		applyGenerationJob(job, record)
	}
	return nil
}

func (r *GenerationJobRepository) FindJobByID(_ context.Context, jobID string) (*model.GenerationJob, error) {
	return r.findJob(r.supabase.AdminTable("generation_jobs").Eq("id", jobID))
}

func (r *GenerationJobRepository) FindJobByIdempotencyKey(_ context.Context, userID, key string) (*model.GenerationJob, error) {
	return r.findJob(r.supabase.AdminTable("generation_jobs").Eq("user_id", userID).Eq("idempotency_key", key))
}

func (r *GenerationJobRepository) FindLatestJobByProjectID(_ context.Context, projectID string) (*model.GenerationJob, error) {
	return r.findJob(r.supabase.AdminTable("generation_jobs").Eq("project_id", projectID).Order("created_at", false))
}

func (r *GenerationJobRepository) FindActiveJobByProjectID(_ context.Context, projectID string) (*model.GenerationJob, error) {
	return r.findJob(r.supabase.AdminTable("generation_jobs").Eq("project_id", projectID).In("status", generationJobStatusValues()).Order("created_at", false))
}

func (r *GenerationJobRepository) findJob(table *Table) (*model.GenerationJob, error) {
	result, err := table.First()
	if err != nil {
		return nil, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return mapGenerationJob(record), nil
}

func (r *GenerationJobRepository) SupersedeActiveJobs(ctx context.Context, projectID, reason string, now time.Time) ([]string, error) {
	result, err := r.supabase.AdminTable("generation_jobs").Eq("project_id", projectID).In("status", generationJobStatusValues()).Select("id").SelectQuery()
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(result.Data))
	for _, item := range result.Data {
		record, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		id := generationString(record["id"])
		if id == "" {
			continue
		}
		applied, transitionErr := r.transitionJobTerminal(ctx, id, "", model.GenerationJobCompletion{
			Status: model.GenerationJobStatusCancelled, ErrorCode: "generation_superseded",
			ErrorMessage: "superseded by a newer generation request", StopReason: reason,
			ResultSummary: "{}", EventType: model.GenerationEventTypeError,
			EventPayload: generationTerminalErrorPayload(id, "generation_superseded", "生成任务已由新请求替换"),
			CompletedAt:  now,
		})
		if transitionErr != nil {
			return ids, transitionErr
		}
		if applied {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (r *GenerationJobRepository) AcquireJobLease(_ context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error) {
	result, err := r.supabase.AdminTable("generation_jobs").Eq("id", jobID).Eq("status", model.GenerationJobStatusQueued).Update(map[string]interface{}{
		"status": model.GenerationJobStatusRunning, "worker_id": workerID,
		"lease_version": 1, "lease_expires_at": leaseUntil, "heartbeat_at": now,
		"started_at": now, "current_attempt": 1, "updated_at": now,
	})
	return generationUpdateApplied(result), err
}

func (r *GenerationJobRepository) HeartbeatJobLease(_ context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error) {
	result, err := r.supabase.AdminTable("rpc/heartbeat_generation_job_lease").Insert(map[string]interface{}{
		"p_job_id": jobID, "p_worker_id": workerID,
		"p_lease_until": leaseUntil, "p_heartbeat_at": now,
	})
	if err != nil {
		return false, err
	}
	record, ok := firstDataMap(result.Data)
	return ok && generationBool(record["applied"]), nil
}

func (r *GenerationJobRepository) UpdateJobPhase(_ context.Context, jobID, workerID, status string, now time.Time) (bool, error) {
	result, err := r.supabase.AdminTable("generation_jobs").Eq("id", jobID).Eq("worker_id", workerID).In("status", generationJobStatusValues()).Update(map[string]interface{}{
		"status": status, "updated_at": now,
	})
	return generationUpdateApplied(result), err
}

func (r *GenerationJobRepository) CompleteJob(ctx context.Context, jobID, workerID string, completion model.GenerationJobCompletion) (bool, error) {
	return r.transitionJobTerminal(ctx, jobID, workerID, completion)
}

func (r *GenerationJobRepository) CancelActiveJob(ctx context.Context, jobID, reason string, now time.Time) (bool, error) {
	return r.transitionJobTerminal(ctx, jobID, "", model.GenerationJobCompletion{
		Status: model.GenerationJobStatusCancelled, ErrorCode: "generation_cancelled",
		ErrorMessage: "generation cancelled", StopReason: reason, ResultSummary: "{}",
		EventType:    model.GenerationEventTypeError,
		EventPayload: generationTerminalErrorPayload(jobID, "generation_cancelled", "生成已停止"),
		CompletedAt:  now,
	})
}

func (r *GenerationJobRepository) InterruptStaleJobs(_ context.Context, _ string, now time.Time) (int64, error) {
	result, err := r.supabase.AdminTable("generation_jobs").In("status", generationJobStatusValues()).SelectQuery()
	if err != nil {
		return 0, err
	}
	staleQueueBefore := now.Add(-30 * time.Second)
	var interrupted int64
	for _, item := range result.Data {
		record, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		job := mapGenerationJob(record)
		stale := job.Status == model.GenerationJobStatusQueued && !job.UpdatedAt.After(staleQueueBefore)
		if job.Status != model.GenerationJobStatusQueued && (job.LeaseExpiresAt == nil || !job.LeaseExpiresAt.After(now)) {
			stale = true
		}
		if !stale {
			continue
		}
		transitionResult, transitionErr := r.supabase.AdminTable("rpc/interrupt_stale_generation_job").Insert(map[string]interface{}{
			"p_job_id":                 job.ID,
			"p_expected_lease_version": job.LeaseVersion,
			"p_stale_queue_before":     staleQueueBefore,
			"p_now":                    now,
		})
		if transitionErr != nil {
			return interrupted, transitionErr
		}
		transitionRecord, applied := firstDataMap(transitionResult.Data)
		if applied && generationBool(transitionRecord["applied"]) {
			interrupted++
		}
	}
	return interrupted, nil
}

func (r *GenerationJobRepository) transitionJobTerminal(_ context.Context, jobID, workerID string, completion model.GenerationJobCompletion) (bool, error) {
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
	result, err := r.supabase.AdminTable("rpc/transition_generation_job_terminal").Insert(map[string]interface{}{
		"p_job_id": jobID, "p_worker_id": workerID, "p_status": completion.Status,
		"p_error_code": completion.ErrorCode, "p_error_message": completion.ErrorMessage,
		"p_stop_reason": completion.StopReason, "p_result_summary": generationJSONObject(completion.ResultSummary),
		"p_event_type": eventType, "p_event_payload": generationJSONObject(eventPayload),
		"p_completed_at": completion.CompletedAt,
	})
	if err != nil {
		return false, err
	}
	record, ok := firstDataMap(result.Data)
	return ok && generationBool(record["applied"]), nil
}

func (r *GenerationJobRepository) CreateAttempt(_ context.Context, attempt *model.GenerationAttempt) error {
	result, err := r.supabase.AdminTable("rpc/create_generation_attempt").Insert(map[string]interface{}{
		"p_id": attempt.ID, "p_job_id": attempt.JobID, "p_attempt_number": attempt.AttemptNumber,
		"p_kind": attempt.Kind, "p_status": attempt.Status, "p_provider": attempt.Provider, "p_model": attempt.Model,
		"p_input_snapshot": generationJSONObject(attempt.InputSnapshot), "p_result_summary": generationJSONObject(attempt.ResultSummary),
		"p_started_at": attempt.StartedAt, "p_created_at": attempt.CreatedAt, "p_updated_at": attempt.UpdatedAt,
	})
	if err != nil {
		return err
	}
	if record, ok := firstDataMap(result.Data); ok {
		attempt.ID = generationString(record["id"])
	}
	return nil
}

func (r *GenerationJobRepository) CompleteAttempt(_ context.Context, attemptID string, completion model.GenerationAttemptCompletion) error {
	_, err := r.supabase.AdminTable("generation_attempts").Eq("id", attemptID).Eq("status", model.GenerationJobStatusRunning).Update(map[string]interface{}{
		"status": completion.Status, "error_code": completion.ErrorCode, "error_message": completion.ErrorMessage,
		"failure_hash": completion.FailureHash, "result_summary": generationJSONObject(completion.ResultSummary),
		"completed_at": completion.CompletedAt, "updated_at": completion.CompletedAt,
	})
	return err
}

func (r *GenerationJobRepository) AppendEvent(_ context.Context, jobID, eventKey, eventType, payload string, now time.Time) (*model.GenerationEvent, bool, error) {
	result, err := r.supabase.AdminTable("rpc/append_generation_event").Insert(map[string]interface{}{
		"p_job_id": jobID, "p_event_key": eventKey, "p_event_type": eventType,
		"p_payload": generationJSONObject(payload), "p_created_at": now,
	})
	if err != nil {
		return nil, false, err
	}
	record, ok := firstDataMap(result.Data)
	if !ok {
		return nil, false, fmt.Errorf("append generation event returned no row")
	}
	event := mapGenerationEvent(record)
	return event, generationBool(record["created"]), nil
}

func (r *GenerationJobRepository) ListEvents(_ context.Context, jobID string, afterSequence int64, limit int) ([]model.GenerationEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 500
	}
	result, err := r.supabase.AdminTable("generation_events").Eq("job_id", jobID).Gt("sequence", afterSequence).Order("sequence", true).Limit(limit).SelectQuery()
	if err != nil {
		return nil, err
	}
	events := make([]model.GenerationEvent, 0, len(result.Data))
	for _, item := range result.Data {
		if record, ok := item.(map[string]interface{}); ok {
			events = append(events, *mapGenerationEvent(record))
		}
	}
	return events, nil
}

func generationUpdateApplied(result *QueryResult) bool { return result != nil && len(result.Data) > 0 }

func generationJobStatusValues() []interface{} {
	return []interface{}{model.GenerationJobStatusQueued, model.GenerationJobStatusRunning, model.GenerationJobStatusRepairing, model.GenerationJobStatusValidating, model.GenerationJobStatusPreviewing}
}

func generationJobData(job *model.GenerationJob) map[string]interface{} {
	return map[string]interface{}{
		"id": job.ID, "project_id": job.ProjectID, "user_id": job.UserID, "idempotency_key": job.IdempotencyKey,
		"status": job.Status, "workflow_stage": job.WorkflowStage, "workflow_mode": job.WorkflowMode,
		"provider": job.Provider, "model": job.Model, "request_payload": generationJSONObject(job.RequestPayload),
		"result_summary": generationJSONObject(job.ResultSummary), "event_sequence": job.EventSequence,
		"lease_version": job.LeaseVersion, "current_attempt": job.CurrentAttempt,
		"created_at": job.CreatedAt, "updated_at": job.UpdatedAt,
	}
}

func mapGenerationJob(record map[string]interface{}) *model.GenerationJob {
	job := &model.GenerationJob{
		ID: generationString(record["id"]), ProjectID: generationString(record["project_id"]), UserID: generationString(record["user_id"]),
		IdempotencyKey: generationString(record["idempotency_key"]), Status: generationString(record["status"]),
		WorkflowStage: generationString(record["workflow_stage"]), WorkflowMode: generationString(record["workflow_mode"]),
		Provider: generationString(record["provider"]), Model: generationString(record["model"]), RequestPayload: generationJSON(record["request_payload"]),
		ResultSummary: generationJSON(record["result_summary"]), ErrorCode: generationString(record["error_code"]), ErrorMessage: generationString(record["error_message"]),
		StopReason: generationString(record["stop_reason"]), CurrentAttempt: int(generationInt64(record["current_attempt"])),
		EventSequence: generationInt64(record["event_sequence"]), WorkerID: generationString(record["worker_id"]), LeaseVersion: generationInt64(record["lease_version"]),
	}
	job.LeaseExpiresAt = generationTimePointer(record["lease_expires_at"])
	job.HeartbeatAt = generationTimePointer(record["heartbeat_at"])
	job.StartedAt = generationTimePointer(record["started_at"])
	job.CompletedAt = generationTimePointer(record["completed_at"])
	job.CancelledAt = generationTimePointer(record["cancelled_at"])
	if value := generationTimePointer(record["created_at"]); value != nil {
		job.CreatedAt = *value
	}
	if value := generationTimePointer(record["updated_at"]); value != nil {
		job.UpdatedAt = *value
	}
	return job
}

func applyGenerationJob(job *model.GenerationJob, record map[string]interface{}) {
	*job = *mapGenerationJob(record)
}

func mapGenerationEvent(record map[string]interface{}) *model.GenerationEvent {
	event := &model.GenerationEvent{ID: generationInt64(record["id"]), JobID: generationString(record["job_id"]), ProjectID: generationString(record["project_id"]), Sequence: generationInt64(record["sequence"]), EventKey: generationString(record["event_key"]), EventType: generationString(record["event_type"]), Payload: generationJSON(record["payload"])}
	if value := generationTimePointer(record["created_at"]); value != nil {
		event.CreatedAt = *value
	}
	return event
}

func applyGenerationEvent(event *model.GenerationEvent, record map[string]interface{}) {
	*event = *mapGenerationEvent(record)
}

func generationTerminalErrorPayload(jobID, code, message string) string {
	payload, _ := json.Marshal(map[string]interface{}{
		"code": code, "blocking": true, "message": message, "details": message, "job_id": jobID,
	})
	return string(payload)
}

func generationBool(value interface{}) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		parsed, _ := strconv.ParseBool(typed)
		return parsed
	default:
		return false
	}
}

func generationJSONObject(value string) interface{} {
	if value == "" {
		return map[string]interface{}{}
	}
	var decoded interface{}
	if json.Unmarshal([]byte(value), &decoded) == nil {
		return decoded
	}
	return map[string]interface{}{}
}

func generationJSON(value interface{}) string {
	if value == nil {
		return "{}"
	}
	if text, ok := value.(string); ok {
		return text
	}
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func generationString(value interface{}) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprintf("%v", value)
}

func generationInt64(value interface{}) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case int64:
		return typed
	case int:
		return int64(typed)
	case string:
		parsed, _ := strconv.ParseInt(typed, 10, 64)
		return parsed
	default:
		return 0
	}
}

func generationTimePointer(value interface{}) *time.Time {
	text := generationString(value)
	if text == "" {
		return nil
	}
	parsed, ok := parseSupabaseTime(text)
	if !ok {
		return nil
	}
	return &parsed
}
