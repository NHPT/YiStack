package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/google/uuid"

	"yistack/internal/model"
)

const (
	generationJobLeaseDuration      = 2 * time.Minute
	generationJobHeartbeatInterval  = 10 * time.Second
	generationJobReplayPollInterval = 250 * time.Millisecond
	generationJobChunkFlushBytes    = 512
)

var generationJobPersistenceRetryDelays = []time.Duration{
	200 * time.Millisecond,
	500 * time.Millisecond,
}

var generationJobReadRetryDelays = []time.Duration{
	200 * time.Millisecond,
	500 * time.Millisecond,
	time.Second,
	2 * time.Second,
	5 * time.Second,
}

type GenerationJobSpec struct {
	ProjectID      string
	UserID         string
	IdempotencyKey string
	WorkflowStage  string
	WorkflowMode   string
	Provider       string
	Model          string
	RequestPayload string
}

type generationJobIDContextKey struct{}

func GenerationJobIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	jobID, _ := ctx.Value(generationJobIDContextKey{}).(string)
	return strings.TrimSpace(jobID)
}

type GenerationJobRunner func(ctx context.Context, handler StreamEventHandler) error
type GenerationEventConsumer func(event model.GenerationEvent) error

type GenerationJobStartResult struct {
	Job     *model.GenerationJob
	Created bool
}

type generationJobChunkData struct {
	metadata    map[string]json.RawMessage
	metadataKey string
	content     string
}

type generationJobChunkBuffer struct {
	metadata    map[string]json.RawMessage
	metadataKey string
	content     strings.Builder
	createdAt   time.Time
	eventKey    string
}

type GenerationJobService struct {
	repo              GenerationJobRepo
	workerID          string
	now               func() time.Time
	leaseDuration     time.Duration
	heartbeatInterval time.Duration

	activeMu sync.Mutex
	active   map[string]context.CancelFunc

	recoveryMu     sync.Mutex
	nextRecoveryAt time.Time
}

func NewGenerationJobService(repo GenerationJobRepo) *GenerationJobService {
	service := &GenerationJobService{
		repo:              repo,
		workerID:          "worker-" + uuid.NewString(),
		now:               func() time.Time { return time.Now().UTC() },
		leaseDuration:     generationJobLeaseDuration,
		heartbeatInterval: generationJobHeartbeatInterval,
		active:            make(map[string]context.CancelFunc),
	}
	service.recoverStaleJobs(context.Background(), true)
	return service
}

func (s *GenerationJobService) Available() bool { return s != nil && s.repo != nil }

func (s *GenerationJobService) recoverStaleJobs(ctx context.Context, force bool) {
	if !s.Available() {
		return
	}
	now := s.now()
	s.recoveryMu.Lock()
	if !force && now.Before(s.nextRecoveryAt) {
		s.recoveryMu.Unlock()
		return
	}
	s.nextRecoveryAt = now.Add(s.heartbeatIntervalValue())
	s.recoveryMu.Unlock()
	count, err := s.repo.InterruptStaleJobs(ctx, s.workerID, now)
	if err != nil {
		log.Printf("Warning: failed to recover stale generation jobs: %v", err)
		return
	}
	if count > 0 {
		log.Printf("Generation job recovery marked %d stale jobs interrupted", count)
	}
}

func (s *GenerationJobService) Start(ctx context.Context, spec GenerationJobSpec, runner GenerationJobRunner) (*GenerationJobStartResult, error) {
	if !s.Available() {
		return nil, errors.New("generation job repository not available")
	}
	if strings.TrimSpace(spec.ProjectID) == "" || strings.TrimSpace(spec.UserID) == "" || runner == nil {
		return nil, errors.New("generation job requires project, user and runner")
	}
	s.recoverStaleJobs(ctx, false)
	spec.IdempotencyKey = strings.TrimSpace(spec.IdempotencyKey)
	if spec.IdempotencyKey == "" {
		spec.IdempotencyKey = uuid.NewString()
	}
	existing, findErr := s.repo.FindJobByIdempotencyKey(ctx, spec.UserID, spec.IdempotencyKey)
	if findErr == nil {
		if existing.ProjectID != spec.ProjectID {
			return nil, errors.New("generation idempotency key belongs to another project")
		}
		return &GenerationJobStartResult{Job: existing, Created: false}, nil
	}
	if !IsGenerationJobNotFoundError(findErr) {
		return nil, fmt.Errorf("read generation idempotency key: %w", findErr)
	}

	now := s.now()
	superseded, err := s.repo.SupersedeActiveJobs(ctx, spec.ProjectID, "superseded_by_new_generation", now)
	if err != nil {
		return nil, fmt.Errorf("supersede active generation jobs: %w", err)
	}
	for _, jobID := range superseded {
		s.cancelLocal(jobID)
	}

	job := &model.GenerationJob{
		ID: uuid.NewString(), ProjectID: spec.ProjectID, UserID: spec.UserID,
		IdempotencyKey: spec.IdempotencyKey, Status: model.GenerationJobStatusQueued,
		WorkflowStage: spec.WorkflowStage, WorkflowMode: spec.WorkflowMode,
		Provider: spec.Provider, Model: spec.Model,
		RequestPayload: normalizeGenerationJobJSON(spec.RequestPayload), ResultSummary: "{}",
		CreatedAt: now, UpdatedAt: now,
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		if existing, findErr := s.repo.FindJobByIdempotencyKey(ctx, spec.UserID, spec.IdempotencyKey); findErr == nil {
			if existing.ProjectID != spec.ProjectID {
				return nil, errors.New("generation idempotency key belongs to another project")
			}
			return &GenerationJobStartResult{Job: existing, Created: false}, nil
		}
		return nil, fmt.Errorf("create generation job: %w", err)
	}
	go s.run(job, runner)
	return &GenerationJobStartResult{Job: job, Created: true}, nil
}

func (s *GenerationJobService) run(job *model.GenerationJob, runner GenerationJobRunner) {
	now := s.now()
	initialLeaseUntil := now.Add(s.leaseDurationValue())
	acquired, err := s.repo.AcquireJobLease(
		context.Background(),
		job.ID,
		s.workerID,
		initialLeaseUntil,
		now,
	)
	if err != nil || !acquired {
		if err != nil {
			log.Printf("Generation job %s lease acquisition failed: %v", job.ID, err)
		}
		return
	}

	runCtx, cancel := context.WithCancel(context.Background())
	runCtx = context.WithValue(runCtx, generationJobIDContextKey{}, job.ID)
	s.registerLocal(job.ID, cancel)
	defer func() {
		cancel()
		s.unregisterLocal(job.ID)
	}()

	attempt := &model.GenerationAttempt{
		ID: uuid.NewString(), JobID: job.ID, AttemptNumber: 1, Kind: model.GenerationAttemptKindInitial,
		Status: model.GenerationJobStatusRunning, Provider: job.Provider, Model: job.Model,
		InputSnapshot: normalizeGenerationJobJSON(job.RequestPayload), ResultSummary: "{}",
		StartedAt: now, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.repo.CreateAttempt(context.Background(), attempt); err != nil {
		s.failBeforeRun(job, attempt, "generation_attempt_persistence_failed", err)
		return
	}

	heartbeatDone := make(chan struct{})
	defer close(heartbeatDone)
	var leaseLost atomic.Bool
	go s.heartbeat(
		runCtx,
		cancel,
		job.ID,
		initialLeaseUntil,
		heartbeatDone,
		&leaseLost,
	)

	var ordinal atomic.Int64
	resultSummary := "{}"
	terminalEventType := ""
	terminalEventPayload := ""
	repairAttempts := map[string]string{}
	var persistMu sync.Mutex
	var pendingChunk *generationJobChunkBuffer
	visualContextBound := false
	flushPendingChunk := func() error {
		if pendingChunk == nil {
			return nil
		}
		payload := make(map[string]json.RawMessage, len(pendingChunk.metadata)+1)
		for key, value := range pendingChunk.metadata {
			payload[key] = value
		}
		content, err := json.Marshal(pendingChunk.content.String())
		if err != nil {
			return fmt.Errorf("encode generation chunk content: %w", err)
		}
		payload["content"] = content
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode generation event: %w", err)
		}
		if pendingChunk.eventKey == "" {
			pendingChunk.eventKey = generationJobEventKey(
				StreamEventChunk,
				payload,
				ordinal.Add(1),
			)
		}
		if err := s.appendEventWithRetry(
			runCtx,
			job.ID,
			pendingChunk.eventKey,
			string(StreamEventChunk),
			string(encoded),
			pendingChunk.createdAt,
		); err != nil {
			return fmt.Errorf("persist generation event: %w", err)
		}
		pendingChunk = nil
		return nil
	}
	persistHandler := func(eventName StreamEventName, payload StreamEventPayload) error {
		persistMu.Lock()
		defer persistMu.Unlock()
		if eventName == StreamEventChunk {
			chunk, coalescible, err := generationJobCoalescibleChunk(payload)
			if err != nil {
				return err
			}
			if coalescible {
				if pendingChunk != nil &&
					pendingChunk.metadataKey != chunk.metadataKey {
					if err := flushPendingChunk(); err != nil {
						return err
					}
				}
				if pendingChunk == nil {
					pendingChunk = &generationJobChunkBuffer{
						metadata:    chunk.metadata,
						metadataKey: chunk.metadataKey,
						createdAt:   s.now(),
					}
				}
				pendingChunk.content.WriteString(chunk.content)
				if pendingChunk.content.Len() >= generationJobChunkFlushBytes {
					return flushPendingChunk()
				}
				return nil
			}
		}
		if err := flushPendingChunk(); err != nil {
			return err
		}
		if err := s.persistRepairAttemptEvent(job, eventName, payload, repairAttempts); err != nil {
			return err
		}
		encoded, err := json.Marshal(payload)
		if err != nil {
			return fmt.Errorf("encode generation event: %w", err)
		}
		if eventName == StreamEventVisualContext && visualContextBound == false {
			snapshot, mergeErr := mergeGenerationJobVisualContextSnapshot(job.RequestPayload, encoded)
			if mergeErr != nil {
				return mergeErr
			}
			applied, bindErr := s.repo.BindVisualContextSnapshot(
				context.Background(),
				job.ID,
				s.workerID,
				attempt.ID,
				snapshot,
				s.now(),
			)
			if bindErr != nil {
				return fmt.Errorf("persist generation visual context snapshot: %w", bindErr)
			}
			if applied == false {
				return context.Canceled
			}
			job.RequestPayload = snapshot
			attempt.InputSnapshot = snapshot
			visualContextBound = true
		}
		if eventName == StreamEventDone || eventName == StreamEventError {
			if eventName == StreamEventError || terminalEventType == "" {
				terminalEventType = string(eventName)
				terminalEventPayload = normalizeGenerationJobJSON(string(encoded))
			}
			if eventName == StreamEventDone {
				resultSummary = normalizeGenerationJobJSON(string(encoded))
			}
			return nil
		}
		if phase := generationJobPhaseForEvent(eventName, payload); phase != "" {
			updated, phaseErr := s.repo.UpdateJobPhase(context.Background(), job.ID, s.workerID, phase, s.now())
			if phaseErr != nil {
				return phaseErr
			}
			if !updated {
				return context.Canceled
			}
		}
		key := generationJobEventKey(eventName, payload, ordinal.Add(1))
		if err := s.appendEventWithRetry(runCtx, job.ID, key, string(eventName), string(encoded), s.now()); err != nil {
			return fmt.Errorf("persist generation event: %w", err)
		}
		return nil
	}
	var eventErrMu sync.Mutex
	var eventErr error
	handler := func(eventName StreamEventName, payload StreamEventPayload) error {
		err := persistHandler(eventName, payload)
		if err != nil {
			eventErrMu.Lock()
			if eventErr == nil {
				eventErr = err
			}
			eventErrMu.Unlock()
			cancel()
		}
		return err
	}

	runErr := runner(runCtx, handler)
	eventErrMu.Lock()
	durableEventErr := eventErr
	eventErrMu.Unlock()
	if durableEventErr == nil {
		persistMu.Lock()
		durableEventErr = flushPendingChunk()
		persistMu.Unlock()
	}
	if durableEventErr != nil {
		runErr = durableEventErr
	}
	if runErr == nil && terminalEventType == string(StreamEventError) {
		_, message := generationJobTerminalErrorFields(terminalEventPayload)
		if message == "" {
			message = "generation failed"
		}
		runErr = errors.New(message)
	}
	if runErr == nil && terminalEventType == "" {
		defaultDone := map[string]any{"message": "Generation completed", "progress": 100}
		terminalEventType = string(StreamEventDone)
		terminalEventPayload = normalizeGenerationJobJSONValue(defaultDone)
		resultSummary = terminalEventPayload
	}

	completedAt := s.now()
	status := model.GenerationJobStatusSucceeded
	errorCode := ""
	errorMessage := ""
	stopReason := ""
	if runErr != nil {
		status = model.GenerationJobStatusFailed
		errorCode = GenerationFailureCode(runErr)
		if payloadCode, payloadMessage := generationJobTerminalErrorFields(terminalEventPayload); payloadCode != "" {
			errorCode = payloadCode
			if payloadMessage != "" {
				errorMessage = payloadMessage
			}
		}
		if errorCode == "" {
			errorCode = "generation_failed"
		}
		if errorMessage == "" {
			errorMessage = runErr.Error()
		}
		stopReason = errorCode
		if errors.Is(runErr, context.Canceled) {
			status = model.GenerationJobStatusCancelled
			errorCode = "generation_cancelled"
			errorMessage = "generation cancelled"
			stopReason = "generation_cancelled"
			if leaseLost.Load() {
				status = model.GenerationJobStatusInterrupted
				errorCode = "generation_job_lease_lost"
				errorMessage = "generation worker lease lost before safe completion"
				stopReason = "generation_worker_interrupted"
			}
		}
		if terminalEventPayload == "" || terminalEventType != string(StreamEventError) || errors.Is(runErr, context.Canceled) {
			terminalEventPayload = normalizeGenerationJobJSONValue(map[string]any{
				"code": errorCode, "blocking": true, "message": errorMessage,
				"details": errorMessage, "job_id": job.ID,
			})
		}
		terminalEventType = string(StreamEventError)
	}
	if status == model.GenerationJobStatusSucceeded {
		terminalEventType = string(StreamEventDone)
		if terminalEventPayload == "" {
			terminalEventPayload = resultSummary
		}
	}

	completed, completeErr := s.completeJobWithRetry(job.ID, s.workerID, GenerationJobCompletion{
		Status: status, ErrorCode: errorCode, ErrorMessage: errorMessage, StopReason: stopReason,
		ResultSummary: resultSummary, EventType: terminalEventType, EventPayload: terminalEventPayload,
		CompletedAt: completedAt,
	})
	if completeErr != nil {
		log.Printf("Generation job %s terminal transition failed: %v", job.ID, completeErr)
	} else if !completed {
		log.Printf("Generation job %s terminal transition skipped because durable state already changed", job.ID)
	}
}

func mergeGenerationJobVisualContextSnapshot(requestPayload string, eventPayload []byte) (string, error) {
	var request map[string]json.RawMessage
	if err := json.Unmarshal([]byte(normalizeGenerationJobJSON(requestPayload)), &request); err != nil {
		return "", fmt.Errorf("decode generation request snapshot: %w", err)
	}
	var event map[string]json.RawMessage
	if err := json.Unmarshal(eventPayload, &event); err != nil {
		return "", fmt.Errorf("decode visual context event: %w", err)
	}
	visualContext, ok := event["visual_context"]
	if !ok || len(visualContext) == 0 || string(visualContext) == "null" {
		return "", errors.New("visual context event is missing visual_context")
	}
	request["visual_context"] = visualContext
	merged, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("encode generation visual context snapshot: %w", err)
	}
	return normalizeGenerationJobJSON(string(merged)), nil
}
func (s *GenerationJobService) failBeforeRun(job *model.GenerationJob, _ *model.GenerationAttempt, code string, err error) {
	now := s.now()
	message := err.Error()
	payload := normalizeGenerationJobJSONValue(map[string]any{
		"code": code, "blocking": true, "message": message, "details": message, "job_id": job.ID,
	})
	_, _ = s.completeJobWithRetry(job.ID, s.workerID, GenerationJobCompletion{
		Status: model.GenerationJobStatusFailed, ErrorCode: code, ErrorMessage: message,
		StopReason: code, ResultSummary: "{}", EventType: string(StreamEventError),
		EventPayload: payload, CompletedAt: now,
	})
}

func (s *GenerationJobService) heartbeat(
	ctx context.Context,
	cancel context.CancelFunc,
	jobID string,
	leaseValidUntil time.Time,
	done <-chan struct{},
	leaseLost *atomic.Bool,
) {
	interval := s.heartbeatIntervalValue()
	timer := time.NewTimer(interval)
	defer timer.Stop()
	transientFailures := 0
	for {
		select {
		case <-done:
			return
		case <-ctx.Done():
			return
		case <-timer.C:
			now := s.now()
			nextLeaseUntil := now.Add(s.leaseDurationValue())
			updated, err := s.repo.HeartbeatJobLease(
				context.Background(),
				jobID,
				s.workerID,
				nextLeaseUntil,
				now,
			)
			if err == nil && updated {
				leaseValidUntil = nextLeaseUntil
				transientFailures = 0
				timer.Reset(interval)
				continue
			}
			if err != nil &&
				isRetryableGenerationJobPersistenceError(err) &&
				s.now().Before(leaseValidUntil) {
				delay := generationJobHeartbeatRetryDelay(
					transientFailures,
					leaseValidUntil.Sub(s.now()),
				)
				transientFailures++
				log.Printf(
					"Warning: generation job %s heartbeat failed transiently (attempt %d): %v; retrying in %s",
					jobID,
					transientFailures,
					err,
					delay,
				)
				timer.Reset(delay)
				continue
			}
			if err != nil {
				log.Printf(
					"Generation job %s heartbeat failed and lease ownership was lost: %v",
					jobID,
					err,
				)
			}
			if leaseLost != nil {
				leaseLost.Store(true)
			}
			cancel()
			return
		}
	}
}

func (s *GenerationJobService) leaseDurationValue() time.Duration {
	if s != nil && s.leaseDuration > 0 {
		return s.leaseDuration
	}
	return generationJobLeaseDuration
}

func (s *GenerationJobService) heartbeatIntervalValue() time.Duration {
	if s != nil && s.heartbeatInterval > 0 {
		return s.heartbeatInterval
	}
	return generationJobHeartbeatInterval
}

func generationJobHeartbeatRetryDelay(
	failureCount int,
	leaseRemaining time.Duration,
) time.Duration {
	delayIndex := failureCount
	if delayIndex >= len(generationJobPersistenceRetryDelays) {
		delayIndex = len(generationJobPersistenceRetryDelays) - 1
	}
	delay := generationJobPersistenceRetryDelays[delayIndex]
	if leaseRemaining > 0 && delay >= leaseRemaining {
		delay = leaseRemaining / 2
	}
	if delay < time.Millisecond {
		return time.Millisecond
	}
	return delay
}

func (s *GenerationJobService) appendEventWithRetry(ctx context.Context, jobID, eventKey, eventType, payload string, createdAt time.Time) error {
	var lastErr error
	for attempt := 0; attempt <= len(generationJobPersistenceRetryDelays); attempt++ {
		if _, _, err := s.repo.AppendEvent(context.Background(), jobID, eventKey, eventType, payload, createdAt); err == nil {
			return nil
		} else {
			lastErr = err
		}
		if !isRetryableGenerationJobPersistenceError(lastErr) || attempt == len(generationJobPersistenceRetryDelays) {
			return lastErr
		}
		delay := generationJobPersistenceRetryDelays[attempt]
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return ctx.Err()
		case <-timer.C:
		}
	}
	return lastErr
}

func (s *GenerationJobService) completeJobWithRetry(
	jobID string,
	workerID string,
	completion GenerationJobCompletion,
) (bool, error) {
	var lastErr error
	for attempt := 0; attempt <= len(generationJobPersistenceRetryDelays); attempt++ {
		applied, err := s.repo.CompleteJob(
			context.Background(),
			jobID,
			workerID,
			completion,
		)
		if err == nil {
			if applied {
				return true, nil
			}
			job, findErr := s.repo.FindJobByID(context.Background(), jobID)
			if findErr == nil {
				return generationJobCompletionMatches(job, completion), nil
			}
			err = findErr
		}
		lastErr = err
		if !isRetryableGenerationJobPersistenceError(lastErr) ||
			attempt == len(generationJobPersistenceRetryDelays) {
			return false, lastErr
		}
		delay := generationJobPersistenceRetryDelays[attempt]
		log.Printf(
			"Warning: generation job %s terminal transition failed transiently (attempt %d): %v; retrying in %s",
			jobID,
			attempt+1,
			lastErr,
			delay,
		)
		time.Sleep(delay)
	}
	return false, lastErr
}

func generationJobCompletionMatches(
	job *model.GenerationJob,
	completion GenerationJobCompletion,
) bool {
	if job == nil ||
		!IsGenerationJobTerminalStatus(job.Status) ||
		job.Status != completion.Status {
		return false
	}
	return completion.ErrorCode == "" ||
		job.ErrorCode == completion.ErrorCode
}

func isRetryableGenerationJobPersistenceError(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, io.EOF) ||
		errors.Is(err, io.ErrUnexpectedEOF) ||
		errors.Is(err, syscall.ECONNRESET) ||
		errors.Is(err, syscall.ECONNREFUSED) ||
		errors.Is(err, syscall.EPIPE) ||
		errors.Is(err, syscall.ETIMEDOUT) {
		return true
	}
	var networkErr net.Error
	if errors.As(err, &networkErr) && (networkErr.Timeout() || networkErr.Temporary()) {
		return true
	}
	message := strings.ToLower(err.Error())
	for _, marker := range []string{
		"connection reset",
		"server sent goaway",
		"server closed idle connection",
		"tls handshake timeout",
		"temporarily unavailable",
		"request failed with status 408",
		"request failed with status 425",
		"request failed with status 429",
		"request failed with status 5",
	} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

func waitGenerationJobReadRetry(
	ctx context.Context,
	failureCount int,
) error {
	if failureCount < 1 {
		failureCount = 1
	}
	delayIndex := failureCount - 1
	if delayIndex >= len(generationJobReadRetryDelays) {
		delayIndex = len(generationJobReadRetryDelays) - 1
	}
	timer := time.NewTimer(
		generationJobReadRetryDelays[delayIndex],
	)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (s *GenerationJobService) persistRepairAttemptEvent(job *model.GenerationJob, eventName StreamEventName, payload StreamEventPayload, attempts map[string]string) error {
	if eventName != StreamEventStep {
		return nil
	}
	step, ok := payload.(map[string]any)
	if !ok {
		return nil
	}
	id, _ := step["id"].(string)
	if !strings.HasPrefix(id, "generation-repair:") {
		return nil
	}
	status, _ := step["status"].(string)
	attemptText := strings.TrimPrefix(id, "generation-repair:")
	attemptNumber, err := strconv.Atoi(attemptText)
	if err != nil || attemptNumber <= 0 {
		return nil
	}
	if status == "running" {
		if _, exists := attempts[id]; exists {
			return nil
		}
		now := s.now()
		attempt := &model.GenerationAttempt{
			ID: uuid.NewString(), JobID: job.ID, AttemptNumber: attemptNumber + 1, Kind: model.GenerationAttemptKindRepair,
			Status: model.GenerationJobStatusRunning, Provider: job.Provider, Model: job.Model,
			InputSnapshot: normalizeGenerationJobJSONValue(step), ResultSummary: "{}", StartedAt: now, CreatedAt: now, UpdatedAt: now,
		}
		if err := s.repo.CreateAttempt(context.Background(), attempt); err != nil {
			return fmt.Errorf("persist generation repair attempt: %w", err)
		}
		attempts[id] = attempt.ID
		return nil
	}
	attemptID := attempts[id]
	if attemptID == "" || (status != "done" && status != "failed") {
		return nil
	}
	completionStatus := model.GenerationJobStatusSucceeded
	if status == "failed" {
		completionStatus = model.GenerationJobStatusFailed
	}
	now := s.now()
	if err := s.repo.CompleteAttempt(context.Background(), attemptID, GenerationAttemptCompletion{Status: completionStatus, ResultSummary: normalizeGenerationJobJSONValue(step), CompletedAt: now}); err != nil {
		return err
	}
	delete(attempts, id)
	return nil
}

func (s *GenerationJobService) StreamEvents(ctx context.Context, jobID string, cursor int64, consume GenerationEventConsumer) error {
	if !s.Available() || consume == nil {
		return errors.New("generation event stream is not available")
	}
	readFailureCount := 0
	for {
		s.recoverStaleJobs(ctx, false)
		events, err := s.repo.ListEvents(ctx, jobID, cursor, generationEventReplayLimit)
		if err != nil {
			if isRetryableGenerationJobPersistenceError(err) {
				readFailureCount++
				if retryErr := waitGenerationJobReadRetry(
					ctx,
					readFailureCount,
				); retryErr != nil {
					return retryErr
				}
				continue
			}
			return fmt.Errorf("list generation events: %w", err)
		}
		for _, event := range events {
			if event.Sequence <= cursor {
				continue
			}
			if err := consume(event); err != nil {
				return err
			}
			cursor = event.Sequence
		}
		job, err := s.repo.FindJobByID(ctx, jobID)
		if err != nil {
			if isRetryableGenerationJobPersistenceError(err) {
				readFailureCount++
				if retryErr := waitGenerationJobReadRetry(
					ctx,
					readFailureCount,
				); retryErr != nil {
					return retryErr
				}
				continue
			}
			return err
		}
		readFailureCount = 0
		if IsGenerationJobTerminalStatus(job.Status) && cursor >= job.EventSequence {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(generationJobReplayPollInterval):
		}
	}
}

func (s *GenerationJobService) LatestJob(ctx context.Context, projectID string) (*model.GenerationJob, error) {
	if !s.Available() {
		return nil, errors.New("generation job repository not available")
	}
	s.recoverStaleJobs(ctx, false)
	return s.repo.FindLatestJobByProjectID(ctx, projectID)
}

func (s *GenerationJobService) Job(ctx context.Context, jobID string) (*model.GenerationJob, error) {
	if !s.Available() {
		return nil, errors.New("generation job repository not available")
	}
	s.recoverStaleJobs(ctx, false)
	return s.repo.FindJobByID(ctx, jobID)
}

func (s *GenerationJobService) StopProject(ctx context.Context, projectID, reason string) (bool, error) {
	if !s.Available() {
		return false, errors.New("generation job repository not available")
	}
	s.recoverStaleJobs(ctx, false)
	job, err := s.repo.FindActiveJobByProjectID(ctx, projectID)
	if err != nil {
		if IsGenerationJobNotFoundError(err) {
			return false, nil
		}
		return false, err
	}
	now := s.now()
	stopped, err := s.repo.CancelActiveJob(ctx, job.ID, reason, now)
	if err != nil || !stopped {
		return stopped, err
	}
	s.cancelLocal(job.ID)
	return true, nil
}

func (s *GenerationJobService) registerLocal(jobID string, cancel context.CancelFunc) {
	s.activeMu.Lock()
	defer s.activeMu.Unlock()
	s.active[jobID] = cancel
}

func (s *GenerationJobService) unregisterLocal(jobID string) {
	s.activeMu.Lock()
	defer s.activeMu.Unlock()
	delete(s.active, jobID)
}

func (s *GenerationJobService) cancelLocal(jobID string) {
	s.activeMu.Lock()
	cancel := s.active[jobID]
	s.activeMu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func generationJobPhaseForEvent(eventName StreamEventName, payload StreamEventPayload) string {
	if eventName != StreamEventStep {
		return ""
	}
	step, ok := payload.(map[string]any)
	if !ok || step["status"] != "running" {
		return ""
	}
	id, _ := step["id"].(string)
	switch {
	case strings.HasPrefix(id, "generation-repair:"):
		return model.GenerationJobStatusRepairing
	case strings.HasPrefix(id, "project-validation"):
		return model.GenerationJobStatusValidating
	case id == "preview-server" || id == "browser-acceptance":
		return model.GenerationJobStatusPreviewing
	default:
		return ""
	}
}

func generationJobEventKey(eventName StreamEventName, payload StreamEventPayload, ordinal int64) string {
	if eventName == StreamEventDone || eventName == StreamEventError {
		return "terminal"
	}
	return fmt.Sprintf("event:%06d:%s", ordinal, eventName)
}

func generationJobCoalescibleChunk(
	payload StreamEventPayload,
) (*generationJobChunkData, bool, error) {
	source, ok := payload.(map[string]any)
	if !ok {
		return nil, false, nil
	}
	content, ok := source["content"].(string)
	if !ok {
		return nil, false, nil
	}
	metadata := make(map[string]any, len(source)-1)
	for key, value := range source {
		if key != "content" {
			metadata[key] = value
		}
	}
	encoded, err := json.Marshal(metadata)
	if err != nil {
		return nil, false, fmt.Errorf("encode generation event: %w", err)
	}
	var snapshot map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &snapshot); err != nil {
		return nil, false, fmt.Errorf("snapshot generation chunk metadata: %w", err)
	}
	return &generationJobChunkData{
		metadata:    snapshot,
		metadataKey: string(encoded),
		content:     content,
	}, true, nil
}

func generationJobTerminalErrorFields(payload string) (string, string) {
	var decoded map[string]any
	if json.Unmarshal([]byte(payload), &decoded) != nil {
		return "", ""
	}
	code, _ := decoded["code"].(string)
	message, _ := decoded["message"].(string)
	if message == "" {
		message, _ = decoded["error"].(string)
	}
	return strings.TrimSpace(code), strings.TrimSpace(message)
}

func normalizeGenerationJobJSON(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || !json.Valid([]byte(value)) {
		return "{}"
	}
	return value
}

func normalizeGenerationJobJSONValue(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(encoded)
}
