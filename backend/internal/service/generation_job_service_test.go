package service

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/gorm"

	"yistack/internal/model"
)

type memoryGenerationJobRepo struct {
	mu               sync.Mutex
	jobs             map[string]*model.GenerationJob
	attempts         map[string]*model.GenerationAttempt
	events           map[string][]model.GenerationEvent
	appendErr        error
	appendErrs       []error
	appendPostErrs   []error
	listErrs         []error
	findByIDErrs     []error
	appendCalls      int
	listCalls        int
	findByIDCalls    int
	heartbeatCalls   int
	heartbeatErrs    []error
	completeCalls    int
	completeErrs     []error
	completePostErrs []error
	nextEventID      int64
	createdJobs      int
	createdEvents    int
}

func newMemoryGenerationJobRepo() *memoryGenerationJobRepo {
	return &memoryGenerationJobRepo{
		jobs:     make(map[string]*model.GenerationJob),
		attempts: make(map[string]*model.GenerationAttempt),
		events:   make(map[string][]model.GenerationEvent),
	}
}

func cloneGenerationJob(job *model.GenerationJob) *model.GenerationJob {
	if job == nil {
		return nil
	}
	copy := *job
	return &copy
}

func cloneGenerationAttempt(attempt *model.GenerationAttempt) *model.GenerationAttempt {
	if attempt == nil {
		return nil
	}
	copy := *attempt
	return &copy
}

func (r *memoryGenerationJobRepo) CreateJob(_ context.Context, job *model.GenerationJob) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, existing := range r.jobs {
		if existing.UserID == job.UserID && existing.IdempotencyKey == job.IdempotencyKey {
			return errors.New("duplicate idempotency key")
		}
		if existing.ProjectID == job.ProjectID && IsGenerationJobActiveStatus(existing.Status) {
			return errors.New("duplicate active generation job")
		}
	}
	r.jobs[job.ID] = cloneGenerationJob(job)
	r.createdJobs++
	return nil
}

func (r *memoryGenerationJobRepo) FindJobByID(_ context.Context, jobID string) (*model.GenerationJob, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.findByIDCalls++
	if len(r.findByIDErrs) > 0 {
		err := r.findByIDErrs[0]
		r.findByIDErrs = r.findByIDErrs[1:]
		return nil, err
	}
	job := r.jobs[jobID]
	if job == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return cloneGenerationJob(job), nil
}

func (r *memoryGenerationJobRepo) FindJobByIdempotencyKey(_ context.Context, userID, key string) (*model.GenerationJob, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, job := range r.jobs {
		if job.UserID == userID && job.IdempotencyKey == key {
			return cloneGenerationJob(job), nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *memoryGenerationJobRepo) FindLatestJobByProjectID(_ context.Context, projectID string) (*model.GenerationJob, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var latest *model.GenerationJob
	for _, job := range r.jobs {
		if job.ProjectID != projectID {
			continue
		}
		if latest == nil || job.CreatedAt.After(latest.CreatedAt) {
			latest = job
		}
	}
	if latest == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return cloneGenerationJob(latest), nil
}

func (r *memoryGenerationJobRepo) FindActiveJobByProjectID(_ context.Context, projectID string) (*model.GenerationJob, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var latest *model.GenerationJob
	for _, job := range r.jobs {
		if job.ProjectID != projectID || !IsGenerationJobActiveStatus(job.Status) {
			continue
		}
		if latest == nil || job.CreatedAt.After(latest.CreatedAt) {
			latest = job
		}
	}
	if latest == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return cloneGenerationJob(latest), nil
}

func (r *memoryGenerationJobRepo) SupersedeActiveJobs(_ context.Context, projectID, reason string, now time.Time) ([]string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ids := []string{}
	for _, job := range r.jobs {
		if job.ProjectID != projectID || !IsGenerationJobActiveStatus(job.Status) {
			continue
		}
		r.transitionLocked(job, GenerationJobCompletion{
			Status: model.GenerationJobStatusCancelled, ErrorCode: "generation_superseded",
			ErrorMessage: "superseded by a newer generation request", StopReason: reason,
			ResultSummary: "{}", EventType: string(StreamEventError),
			EventPayload: `{"code":"generation_superseded","message":"superseded"}`, CompletedAt: now,
		}, true)
		ids = append(ids, job.ID)
	}
	return ids, nil
}

func (r *memoryGenerationJobRepo) AcquireJobLease(_ context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	job := r.jobs[jobID]
	if job == nil || job.Status != model.GenerationJobStatusQueued {
		return false, nil
	}
	job.Status = model.GenerationJobStatusRunning
	job.WorkerID = workerID
	job.LeaseVersion++
	job.LeaseExpiresAt = &leaseUntil
	job.HeartbeatAt = &now
	job.StartedAt = &now
	job.CurrentAttempt++
	job.UpdatedAt = now
	return true, nil
}

func (r *memoryGenerationJobRepo) HeartbeatJobLease(_ context.Context, jobID, workerID string, leaseUntil, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.heartbeatCalls++
	if len(r.heartbeatErrs) > 0 {
		err := r.heartbeatErrs[0]
		r.heartbeatErrs = r.heartbeatErrs[1:]
		return false, err
	}
	job := r.jobs[jobID]
	if job == nil || job.WorkerID != workerID || !IsGenerationJobActiveStatus(job.Status) {
		return false, nil
	}
	job.LeaseExpiresAt = &leaseUntil
	job.HeartbeatAt = &now
	job.UpdatedAt = now
	return true, nil
}

func (r *memoryGenerationJobRepo) UpdateJobPhase(_ context.Context, jobID, workerID, status string, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	job := r.jobs[jobID]
	if job == nil || job.WorkerID != workerID || !IsGenerationJobActiveStatus(job.Status) {
		return false, nil
	}
	job.Status = status
	job.UpdatedAt = now
	return true, nil
}

func (r *memoryGenerationJobRepo) BindVisualContextSnapshot(
	_ context.Context,
	jobID string,
	workerID string,
	attemptID string,
	requestPayload string,
	now time.Time,
) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	job := r.jobs[jobID]
	attempt := r.attempts[attemptID]
	if job == nil || attempt == nil || job.WorkerID != workerID || !IsGenerationJobActiveStatus(job.Status) || attempt.Status != model.GenerationJobStatusRunning {
		return false, nil
	}
	job.RequestPayload = normalizeGenerationJobJSON(requestPayload)
	job.UpdatedAt = now
	attempt.InputSnapshot = normalizeGenerationJobJSON(requestPayload)
	attempt.UpdatedAt = now
	return true, nil
}
func (r *memoryGenerationJobRepo) CompleteJob(_ context.Context, jobID, workerID string, completion GenerationJobCompletion) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.completeCalls++
	if len(r.completeErrs) > 0 {
		err := r.completeErrs[0]
		r.completeErrs = r.completeErrs[1:]
		return false, err
	}
	job := r.jobs[jobID]
	if job == nil || job.WorkerID != workerID || !IsGenerationJobActiveStatus(job.Status) {
		return false, nil
	}
	r.transitionLocked(job, completion, completion.Status == model.GenerationJobStatusCancelled)
	if len(r.completePostErrs) > 0 {
		err := r.completePostErrs[0]
		r.completePostErrs = r.completePostErrs[1:]
		return false, err
	}
	return true, nil
}

func (r *memoryGenerationJobRepo) CancelActiveJob(_ context.Context, jobID, reason string, now time.Time) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	job := r.jobs[jobID]
	if job == nil || !IsGenerationJobActiveStatus(job.Status) {
		return false, nil
	}
	r.transitionLocked(job, GenerationJobCompletion{
		Status: model.GenerationJobStatusCancelled, ErrorCode: "generation_cancelled",
		ErrorMessage: "generation cancelled", StopReason: reason, ResultSummary: "{}",
		EventType:    string(StreamEventError),
		EventPayload: `{"code":"generation_cancelled","message":"cancelled"}`, CompletedAt: now,
	}, true)
	return true, nil
}

func (r *memoryGenerationJobRepo) InterruptStaleJobs(_ context.Context, _ string, now time.Time) (int64, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	staleQueueBefore := now.Add(-30 * time.Second)
	var count int64
	for _, job := range r.jobs {
		stale := job.Status == model.GenerationJobStatusQueued && !job.UpdatedAt.After(staleQueueBefore)
		if job.Status != model.GenerationJobStatusQueued && IsGenerationJobActiveStatus(job.Status) && (job.LeaseExpiresAt == nil || !job.LeaseExpiresAt.After(now)) {
			stale = true
		}
		if !stale {
			continue
		}
		r.transitionLocked(job, GenerationJobCompletion{
			Status: model.GenerationJobStatusInterrupted, ErrorCode: "generation_job_lease_lost",
			ErrorMessage: "generation worker lease expired before safe completion", StopReason: "generation_worker_interrupted",
			ResultSummary: "{}", EventType: string(StreamEventError),
			EventPayload: `{"code":"generation_job_lease_lost","message":"interrupted"}`, CompletedAt: now,
		}, false)
		count++
	}
	return count, nil
}

func (r *memoryGenerationJobRepo) transitionLocked(job *model.GenerationJob, completion GenerationJobCompletion, cancelled bool) {
	job.EventSequence++
	eventType := completion.EventType
	if eventType == "" {
		eventType = string(StreamEventError)
	}
	r.nextEventID++
	r.events[job.ID] = append(r.events[job.ID], model.GenerationEvent{
		ID: r.nextEventID, JobID: job.ID, ProjectID: job.ProjectID, Sequence: job.EventSequence,
		EventKey: "terminal", EventType: eventType, Payload: completion.EventPayload, CreatedAt: completion.CompletedAt,
	})
	r.createdEvents++
	job.Status = completion.Status
	job.ErrorCode = completion.ErrorCode
	job.ErrorMessage = completion.ErrorMessage
	job.StopReason = completion.StopReason
	job.ResultSummary = completion.ResultSummary
	job.CompletedAt = &completion.CompletedAt
	job.LeaseExpiresAt = nil
	job.UpdatedAt = completion.CompletedAt
	if cancelled {
		job.CancelledAt = &completion.CompletedAt
	}
	for _, attempt := range r.attempts {
		if attempt.JobID == job.ID && attempt.Status == model.GenerationJobStatusRunning {
			attempt.Status = completion.Status
			attempt.ErrorCode = completion.ErrorCode
			attempt.ErrorMessage = completion.ErrorMessage
			attempt.ResultSummary = completion.ResultSummary
			attempt.CompletedAt = &completion.CompletedAt
			attempt.UpdatedAt = completion.CompletedAt
		}
	}
}

func (r *memoryGenerationJobRepo) CreateAttempt(_ context.Context, attempt *model.GenerationAttempt) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.attempts[attempt.ID] = cloneGenerationAttempt(attempt)
	if job := r.jobs[attempt.JobID]; job != nil && job.CurrentAttempt < attempt.AttemptNumber {
		job.CurrentAttempt = attempt.AttemptNumber
		job.UpdatedAt = attempt.UpdatedAt
	}
	return nil
}

func (r *memoryGenerationJobRepo) CompleteAttempt(_ context.Context, attemptID string, completion GenerationAttemptCompletion) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	attempt := r.attempts[attemptID]
	if attempt == nil || attempt.Status != model.GenerationJobStatusRunning {
		return nil
	}
	attempt.Status = completion.Status
	attempt.ErrorCode = completion.ErrorCode
	attempt.ErrorMessage = completion.ErrorMessage
	attempt.FailureHash = completion.FailureHash
	attempt.ResultSummary = completion.ResultSummary
	attempt.CompletedAt = &completion.CompletedAt
	attempt.UpdatedAt = completion.CompletedAt
	return nil
}

func (r *memoryGenerationJobRepo) AppendEvent(_ context.Context, jobID, eventKey, eventType, payload string, now time.Time) (*model.GenerationEvent, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.appendCalls++
	if len(r.appendErrs) > 0 {
		err := r.appendErrs[0]
		r.appendErrs = r.appendErrs[1:]
		return nil, false, err
	}
	if r.appendErr != nil {
		return nil, false, r.appendErr
	}
	for _, event := range r.events[jobID] {
		if event.EventKey == eventKey {
			copy := event
			return &copy, false, nil
		}
	}
	job := r.jobs[jobID]
	if job == nil {
		return nil, false, gorm.ErrRecordNotFound
	}
	if !IsGenerationJobActiveStatus(job.Status) {
		return nil, false, context.Canceled
	}
	job.EventSequence++
	r.nextEventID++
	event := model.GenerationEvent{
		ID: r.nextEventID, JobID: jobID, ProjectID: job.ProjectID, Sequence: job.EventSequence,
		EventKey: eventKey, EventType: eventType, Payload: payload, CreatedAt: now,
	}
	r.events[jobID] = append(r.events[jobID], event)
	r.createdEvents++
	if len(r.appendPostErrs) > 0 {
		err := r.appendPostErrs[0]
		r.appendPostErrs = r.appendPostErrs[1:]
		return nil, false, err
	}
	copy := event
	return &copy, true, nil
}

func (r *memoryGenerationJobRepo) ListEvents(_ context.Context, jobID string, afterSequence int64, limit int) ([]model.GenerationEvent, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.listCalls++
	if len(r.listErrs) > 0 {
		err := r.listErrs[0]
		r.listErrs = r.listErrs[1:]
		return nil, err
	}
	events := make([]model.GenerationEvent, 0)
	for _, event := range r.events[jobID] {
		if event.Sequence > afterSequence {
			events = append(events, event)
		}
	}
	sort.Slice(events, func(i, j int) bool { return events[i].Sequence < events[j].Sequence })
	if limit > 0 && len(events) > limit {
		events = events[:limit]
	}
	return events, nil
}

func waitGenerationJobStatus(t *testing.T, repo GenerationJobRepo, jobID, status string) *model.GenerationJob {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		job, err := repo.FindJobByID(context.Background(), jobID)
		if err == nil && job.Status == status {
			return job
		}
		time.Sleep(5 * time.Millisecond)
	}
	job, err := repo.FindJobByID(context.Background(), jobID)
	if err != nil {
		t.Fatalf("read generation job: %v", err)
	}
	t.Fatalf("job %s did not reach %s; current status is %s", jobID, status, job.Status)
	return nil
}

func generationJobTestSpec(projectID, key string) GenerationJobSpec {
	return GenerationJobSpec{
		ProjectID: projectID, UserID: "11111111-1111-1111-1111-111111111111",
		IdempotencyKey: key, WorkflowStage: "implementation", WorkflowMode: "implement",
		Provider: "test", Model: "test-model", RequestPayload: `{"prompt":"build"}`,
	}
}

func TestGenerationJobBindsVisualContextIntoJobAndAttemptSnapshots(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	spec := generationJobTestSpec("project-visual-context", "visual-context")
	spec.RequestPayload = `{"prompt":"build","visual_attachments":[{"name":"reference.png","data_url":"data:image/png;base64,AAAA"}]}`
	visualContext := map[string]any{
		"schema_version": "visual_context.v1",
		"id":             "visual-context-1",
		"server_proof":   strings.Repeat("a", 64),
	}
	started, err := jobs.Start(context.Background(), spec, func(_ context.Context, handler StreamEventHandler) error {
		if err := handler(StreamEventVisualContext, map[string]any{"visual_context": visualContext}); err != nil {
			return err
		}
		return handler(StreamEventDone, map[string]any{"message": "done"})
	})
	if err != nil {
		t.Fatalf("start visual generation job: %v", err)
	}
	job := waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
	if !strings.Contains(job.RequestPayload, `"visual_attachments"`) || !strings.Contains(job.RequestPayload, `"visual_context"`) {
		t.Fatalf("job snapshot must bind image and visual context: %s", job.RequestPayload)
	}
	repo.mu.Lock()
	defer repo.mu.Unlock()
	for _, attempt := range repo.attempts {
		if attempt.JobID != job.ID || attempt.Kind != model.GenerationAttemptKindInitial {
			continue
		}
		if !strings.Contains(attempt.InputSnapshot, `"visual_attachments"`) || !strings.Contains(attempt.InputSnapshot, `"visual_context"`) {
			t.Fatalf("attempt snapshot must bind image and visual context: %s", attempt.InputSnapshot)
		}
		return
	}
	t.Fatal("initial generation attempt not found")
}

func TestGenerationJobContinuesAfterRequestContextCancellation(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	requestCtx, cancelRequest := context.WithCancel(context.Background())
	runnerContext := make(chan context.Context, 1)
	release := make(chan struct{})

	started, err := jobs.Start(requestCtx, generationJobTestSpec("project-request-context", "request-context"), func(ctx context.Context, handler StreamEventHandler) error {
		runnerContext <- ctx
		<-release
		if err := handler(StreamEventProgress, map[string]any{"message": "still running"}); err != nil {
			return err
		}
		return handler(StreamEventDone, map[string]any{"message": "done", "progress": 100})
	})
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	runCtx := <-runnerContext
	if GenerationJobIDFromContext(runCtx) != started.Job.ID {
		t.Fatalf("runner context job id = %q, want %q", GenerationJobIDFromContext(runCtx), started.Job.ID)
	}
	cancelRequest()
	if runCtx.Err() != nil {
		t.Fatalf("background runner inherited request cancellation: %v", runCtx.Err())
	}
	close(release)
	waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
}

func TestGenerationJobHeartbeatRetriesTransientFailureWithinLease(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	repo.heartbeatErrs = []error{errors.New("request failed with status 503")}
	jobs := NewGenerationJobService(repo)
	jobs.heartbeatInterval = 5 * time.Millisecond
	jobs.leaseDuration = time.Second
	release := make(chan struct{})
	started, err := jobs.Start(
		context.Background(),
		generationJobTestSpec("project-heartbeat-retry", "heartbeat-retry"),
		func(_ context.Context, handler StreamEventHandler) error {
			<-release
			return handler(StreamEventDone, map[string]any{"message": "done"})
		},
	)
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for {
		repo.mu.Lock()
		calls := repo.heartbeatCalls
		repo.mu.Unlock()
		if calls >= 2 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("heartbeat calls = %d, want at least 2", calls)
		}
		time.Sleep(5 * time.Millisecond)
	}
	close(release)
	waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
}

func TestGenerationJobHeartbeatPermanentFailureLosesLease(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	repo.heartbeatErrs = []error{errors.New("heartbeat permission denied")}
	jobs := NewGenerationJobService(repo)
	jobs.heartbeatInterval = 5 * time.Millisecond
	jobs.leaseDuration = time.Second
	started, err := jobs.Start(
		context.Background(),
		generationJobTestSpec(
			"project-heartbeat-permanent",
			"heartbeat-permanent",
		),
		func(ctx context.Context, _ StreamEventHandler) error {
			<-ctx.Done()
			return ctx.Err()
		},
	)
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	job := waitGenerationJobStatus(
		t,
		repo,
		started.Job.ID,
		model.GenerationJobStatusInterrupted,
	)
	if job.ErrorCode != "generation_job_lease_lost" {
		t.Fatalf("heartbeat failure error code = %q", job.ErrorCode)
	}
}

func TestGenerationJobTerminalTransitionRetriesTransientFailure(t *testing.T) {
	testCases := []struct {
		name      string
		configure func(*memoryGenerationJobRepo)
	}{
		{
			name: "before commit",
			configure: func(repo *memoryGenerationJobRepo) {
				repo.completeErrs = []error{
					errors.New("request failed with status 521"),
				}
			},
		},
		{
			name: "after ambiguous commit",
			configure: func(repo *memoryGenerationJobRepo) {
				repo.completePostErrs = []error{io.ErrUnexpectedEOF}
			},
		},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			repo := newMemoryGenerationJobRepo()
			testCase.configure(repo)
			jobs := NewGenerationJobService(repo)
			started, err := jobs.Start(
				context.Background(),
				generationJobTestSpec(
					"project-terminal-retry-"+testCase.name,
					"terminal-retry-"+testCase.name,
				),
				func(_ context.Context, handler StreamEventHandler) error {
					return handler(
						StreamEventDone,
						map[string]any{"message": "done"},
					)
				},
			)
			if err != nil {
				t.Fatalf("start generation job: %v", err)
			}
			waitGenerationJobStatus(
				t,
				repo,
				started.Job.ID,
				model.GenerationJobStatusSucceeded,
			)
			deadline := time.Now().Add(2 * time.Second)
			for {
				repo.mu.Lock()
				completeCalls := repo.completeCalls
				createdEvents := repo.createdEvents
				repo.mu.Unlock()
				if completeCalls >= 2 {
					if createdEvents != 1 {
						t.Fatalf(
							"terminal events=%d, want 1",
							createdEvents,
						)
					}
					break
				}
				if time.Now().After(deadline) {
					t.Fatalf(
						"terminal retry calls=%d, want 2",
						completeCalls,
					)
				}
				time.Sleep(5 * time.Millisecond)
			}
			repo.mu.Lock()
			completeCalls := repo.completeCalls
			repo.mu.Unlock()
			if completeCalls != 2 {
				t.Fatalf(
					"terminal retry calls=%d, want 2",
					completeCalls,
				)
			}
		})
	}
}

func TestGenerationJobIdempotencyRunsOnce(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	release := make(chan struct{})
	var runs atomic.Int32
	runner := func(_ context.Context, handler StreamEventHandler) error {
		runs.Add(1)
		<-release
		return handler(StreamEventDone, map[string]any{"message": "done"})
	}

	first, err := jobs.Start(context.Background(), generationJobTestSpec("project-idempotent", "same-key"), runner)
	if err != nil {
		t.Fatalf("start first generation job: %v", err)
	}
	second, err := jobs.Start(context.Background(), generationJobTestSpec("project-idempotent", "same-key"), runner)
	if err != nil {
		t.Fatalf("start idempotent generation job: %v", err)
	}
	if second.Created || second.Job.ID != first.Job.ID {
		t.Fatalf("idempotent start created another job: first=%s second=%s created=%v", first.Job.ID, second.Job.ID, second.Created)
	}
	close(release)
	waitGenerationJobStatus(t, repo, first.Job.ID, model.GenerationJobStatusSucceeded)
	if runs.Load() != 1 {
		t.Fatalf("runner executed %d times, want 1", runs.Load())
	}
	if repo.createdJobs != 1 {
		t.Fatalf("created %d durable jobs, want 1", repo.createdJobs)
	}
}

func TestGenerationJobSupersedesActiveProjectJob(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	firstRunning := make(chan struct{})
	first, err := jobs.Start(context.Background(), generationJobTestSpec("project-supersede", "first"), func(ctx context.Context, _ StreamEventHandler) error {
		close(firstRunning)
		<-ctx.Done()
		return ctx.Err()
	})
	if err != nil {
		t.Fatalf("start first generation job: %v", err)
	}
	<-firstRunning

	second, err := jobs.Start(context.Background(), generationJobTestSpec("project-supersede", "second"), func(_ context.Context, handler StreamEventHandler) error {
		return handler(StreamEventDone, map[string]any{"message": "replacement done"})
	})
	if err != nil {
		t.Fatalf("start replacement generation job: %v", err)
	}
	oldJob := waitGenerationJobStatus(t, repo, first.Job.ID, model.GenerationJobStatusCancelled)
	if oldJob.ErrorCode != "generation_superseded" {
		t.Fatalf("superseded job error code = %q", oldJob.ErrorCode)
	}
	waitGenerationJobStatus(t, repo, second.Job.ID, model.GenerationJobStatusSucceeded)
	oldEvents, _ := repo.ListEvents(context.Background(), first.Job.ID, 0, 100)
	if len(oldEvents) != 1 || oldEvents[0].EventKey != "terminal" {
		t.Fatalf("superseded job events = %#v", oldEvents)
	}
}

func TestGenerationJobStopPersistsSingleTerminalEvent(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	running := make(chan struct{})
	started, err := jobs.Start(context.Background(), generationJobTestSpec("project-stop", "stop"), func(ctx context.Context, _ StreamEventHandler) error {
		close(running)
		<-ctx.Done()
		return ctx.Err()
	})
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	<-running
	stopped, err := jobs.StopProject(context.Background(), "project-stop", "user_requested_stop")
	if err != nil || !stopped {
		t.Fatalf("stop generation job: stopped=%v err=%v", stopped, err)
	}
	waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusCancelled)
	time.Sleep(20 * time.Millisecond)
	events, _ := repo.ListEvents(context.Background(), started.Job.ID, 0, 100)
	terminalCount := 0
	for _, event := range events {
		if event.EventKey == "terminal" {
			terminalCount++
		}
	}
	if terminalCount != 1 {
		t.Fatalf("terminal event count = %d, events=%#v", terminalCount, events)
	}
}

func TestGenerationJobCursorReplay(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(context.Background(), generationJobTestSpec("project-replay", "replay"), func(_ context.Context, handler StreamEventHandler) error {
		if err := handler(StreamEventProgress, map[string]any{"message": "one"}); err != nil {
			return err
		}
		if err := handler(StreamEventProgress, map[string]any{"message": "two"}); err != nil {
			return err
		}
		return handler(StreamEventDone, map[string]any{"message": "done"})
	})
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	job := waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
	var replayed []int64
	err = jobs.StreamEvents(context.Background(), job.ID, 1, func(event model.GenerationEvent) error {
		replayed = append(replayed, event.Sequence)
		return nil
	})
	if err != nil {
		t.Fatalf("replay generation events: %v", err)
	}
	if len(replayed) != 2 || replayed[0] != 2 || replayed[1] != 3 {
		t.Fatalf("replayed sequences = %v, want [2 3]", replayed)
	}
}

func TestGenerationJobCoalescesDurableChunksWithoutChangingContentOrOrder(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(
		context.Background(),
		generationJobTestSpec("project-chunk-coalescing", "chunk-coalescing"),
		func(_ context.Context, handler StreamEventHandler) error {
			for index := 0; index < 300; index++ {
				if err := handler(StreamEventChunk, map[string]any{
					"provider": "ollama-cloud",
					"model":    "gpt-oss:20b",
					"stage":    "draft",
					"sequence": json.Number("9007199254740993"),
					"content":  "a",
				}); err != nil {
					return err
				}
			}
			if err := handler(StreamEventChunk, map[string]any{
				"provider": "ollama-cloud",
				"model":    "gpt-oss:20b",
				"stage":    "final",
				"sequence": json.Number("9007199254740993"),
				"content":  "!",
			}); err != nil {
				return err
			}
			if err := handler(StreamEventProgress, map[string]any{
				"message": "model stream complete",
			}); err != nil {
				return err
			}
			for index := 0; index < 700; index++ {
				if err := handler(StreamEventChunk, map[string]any{
					"provider": "ollama-cloud",
					"model":    "gpt-oss:20b",
					"stage":    "final",
					"sequence": json.Number("9007199254740993"),
					"content":  "b",
				}); err != nil {
					return err
				}
			}
			return handler(StreamEventDone, map[string]any{
				"message":  "done",
				"progress": 100,
			})
		},
	)
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	waitGenerationJobStatus(
		t,
		repo,
		started.Job.ID,
		model.GenerationJobStatusSucceeded,
	)
	events, err := repo.ListEvents(
		context.Background(),
		started.Job.ID,
		0,
		100,
	)
	if err != nil {
		t.Fatalf("list generation events: %v", err)
	}
	wantTypes := []string{"chunk", "chunk", "progress", "chunk", "chunk", "done"}
	if len(events) != len(wantTypes) {
		t.Fatalf("durable event count = %d, want %d: %#v", len(events), len(wantTypes), events)
	}
	var content strings.Builder
	terminalCount := 0
	for index, event := range events {
		if event.Sequence != int64(index+1) {
			t.Fatalf("event %d sequence = %d, want %d", index, event.Sequence, index+1)
		}
		if event.EventType != wantTypes[index] {
			t.Fatalf("event %d type = %q, want %q", index, event.EventType, wantTypes[index])
		}
		if event.EventKey == "terminal" {
			terminalCount++
		}
		if event.EventType != StreamEventChunk {
			continue
		}
		var rawPayload map[string]json.RawMessage
		if err := json.Unmarshal([]byte(event.Payload), &rawPayload); err != nil {
			t.Fatalf("decode raw chunk %d: %v", index, err)
		}
		if got := string(rawPayload["sequence"]); got != "9007199254740993" {
			t.Fatalf("chunk %d sequence metadata = %s", index, got)
		}
		var payload map[string]any
		if err := json.Unmarshal([]byte(event.Payload), &payload); err != nil {
			t.Fatalf("decode chunk %d: %v", index, err)
		}
		if payload["provider"] != "ollama-cloud" || payload["model"] != "gpt-oss:20b" {
			t.Fatalf("chunk %d metadata changed: %#v", index, payload)
		}
		wantStage := "final"
		if index == 0 {
			wantStage = "draft"
		}
		if payload["stage"] != wantStage {
			t.Fatalf("chunk %d stage = %#v, want %q", index, payload["stage"], wantStage)
		}
		chunkContent, ok := payload["content"].(string)
		if !ok {
			t.Fatalf("chunk %d content is not a string: %#v", index, payload["content"])
		}
		content.WriteString(chunkContent)
	}
	wantContent := strings.Repeat("a", 300) + "!" + strings.Repeat("b", 700)
	if content.String() != wantContent {
		t.Fatalf("coalesced content length = %d, want %d", content.Len(), len(wantContent))
	}
	if terminalCount != 1 {
		t.Fatalf("terminal event count = %d, want 1", terminalCount)
	}
	if repo.appendCalls != 5 {
		t.Fatalf("durable non-terminal writes = %d, want 5 for 1001 source chunks plus progress", repo.appendCalls)
	}
}

func TestGenerationJobFlushesBufferedChunkWhenRunnerReturns(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(
		context.Background(),
		generationJobTestSpec("project-chunk-return", "chunk-return"),
		func(_ context.Context, handler StreamEventHandler) error {
			return handler(StreamEventChunk, map[string]any{
				"provider": "test",
				"content":  "tail",
			})
		},
	)
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
	events, err := repo.ListEvents(context.Background(), started.Job.ID, 0, 10)
	if err != nil {
		t.Fatalf("list generation events: %v", err)
	}
	if len(events) != 2 || events[0].EventType != StreamEventChunk || events[1].EventKey != "terminal" {
		t.Fatalf("runner return events = %#v", events)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(events[0].Payload), &payload); err != nil {
		t.Fatalf("decode buffered chunk: %v", err)
	}
	if payload["content"] != "tail" || payload["provider"] != "test" {
		t.Fatalf("buffered chunk changed: %#v", payload)
	}
}

func TestGenerationJobStreamRetriesTransientReads(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(
		context.Background(),
		generationJobTestSpec("project-replay-retry", "replay-retry"),
		func(_ context.Context, handler StreamEventHandler) error {
			if err := handler(
				StreamEventProgress,
				map[string]any{"message": "one"},
			); err != nil {
				return err
			}
			return handler(
				StreamEventDone,
				map[string]any{"message": "done"},
			)
		},
	)
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	job := waitGenerationJobStatus(
		t,
		repo,
		started.Job.ID,
		model.GenerationJobStatusSucceeded,
	)
	repo.mu.Lock()
	repo.listErrs = []error{
		errors.New("request failed with status 503"),
	}
	repo.findByIDErrs = []error{
		errors.New("http2: server sent GOAWAY"),
	}
	repo.listCalls = 0
	repo.findByIDCalls = 0
	repo.mu.Unlock()

	var replayed []int64
	ctx, cancel := context.WithTimeout(
		context.Background(),
		3*time.Second,
	)
	defer cancel()
	err = jobs.StreamEvents(
		ctx,
		job.ID,
		0,
		func(event model.GenerationEvent) error {
			replayed = append(replayed, event.Sequence)
			return nil
		},
	)
	if err != nil {
		t.Fatalf("replay generation events: %v", err)
	}
	if len(replayed) != 2 ||
		replayed[0] != 1 || replayed[1] != 2 {
		t.Fatalf("replayed sequences = %v, want [1 2]", replayed)
	}
	if repo.listCalls != 3 || repo.findByIDCalls != 2 {
		t.Fatalf(
			"read calls = list:%d job:%d, want list:3 job:2",
			repo.listCalls,
			repo.findByIDCalls,
		)
	}
}

func TestGenerationEventPersistenceFailureFailsJob(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	repo.appendErr = errors.New("event store unavailable")
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(context.Background(), generationJobTestSpec("project-event-failure", "event-failure"), func(_ context.Context, handler StreamEventHandler) error {
		_ = handler(StreamEventProgress, map[string]any{"message": "cannot persist"})
		return nil
	})
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	job := waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusFailed)
	if job.ErrorCode == "generation_cancelled" {
		t.Fatalf("event persistence failure was misclassified as cancellation: %#v", job)
	}
	if repo.appendCalls != 1 {
		t.Fatalf("permanent event persistence failure was retried %d times", repo.appendCalls)
	}
}

func TestGenerationEventPersistenceRetriesAmbiguousTransientFailureIdempotently(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	repo.appendPostErrs = []error{io.ErrUnexpectedEOF}
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(context.Background(), generationJobTestSpec("project-event-retry", "event-retry"), func(_ context.Context, handler StreamEventHandler) error {
		if err := handler(StreamEventProgress, map[string]any{"message": "persist once"}); err != nil {
			return err
		}
		return handler(StreamEventDone, map[string]any{"message": "done"})
	})
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
	events, err := repo.ListEvents(context.Background(), started.Job.ID, 0, 100)
	if err != nil {
		t.Fatalf("list generation events: %v", err)
	}
	if repo.appendCalls != 2 {
		t.Fatalf("append calls = %d, want 2", repo.appendCalls)
	}
	if len(events) != 2 || events[0].EventKey != "event:000001:progress" || events[1].EventKey != "terminal" {
		t.Fatalf("ambiguous retry created duplicate or missing events: %#v", events)
	}
	if repo.createdEvents != 2 {
		t.Fatalf("created events = %d, want 2", repo.createdEvents)
	}
}

func TestGenerationEventPersistenceRetriesHTTP2GoAwayIdempotently(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	repo.appendPostErrs = []error{
		errors.New(
			"failed to read response: http2: server sent GOAWAY and closed the connection; " +
				"LastStreamID=19999, ErrCode=NO_ERROR",
		),
	}
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(
		context.Background(),
		generationJobTestSpec("project-event-goaway", "event-goaway"),
		func(_ context.Context, handler StreamEventHandler) error {
			if err := handler(
				StreamEventProgress,
				map[string]any{"message": "persist once"},
			); err != nil {
				return err
			}
			return handler(
				StreamEventDone,
				map[string]any{"message": "done"},
			)
		},
	)
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	waitGenerationJobStatus(
		t,
		repo,
		started.Job.ID,
		model.GenerationJobStatusSucceeded,
	)
	events, err := repo.ListEvents(
		context.Background(),
		started.Job.ID,
		0,
		100,
	)
	if err != nil {
		t.Fatalf("list generation events: %v", err)
	}
	if repo.appendCalls != 2 {
		t.Fatalf(
			"append calls = %d, want 2",
			repo.appendCalls,
		)
	}
	if len(events) != 2 ||
		events[0].EventKey != "event:000001:progress" ||
		events[1].EventKey != "terminal" {
		t.Fatalf(
			"GOAWAY retry created duplicate or missing events: %#v",
			events,
		)
	}
	if repo.createdEvents != 2 {
		t.Fatalf(
			"created events = %d, want 2",
			repo.createdEvents,
		)
	}
}

func TestGenerationJobStartupInterruptsOnlyStaleJobs(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	now := time.Now().UTC()
	expiredLease := now.Add(-time.Minute)
	repo.jobs["stale-queued"] = &model.GenerationJob{
		ID: "stale-queued", ProjectID: "project-stale-queued", UserID: "user", IdempotencyKey: "stale-queued",
		Status: model.GenerationJobStatusQueued, ResultSummary: "{}", CreatedAt: now.Add(-time.Minute), UpdatedAt: now.Add(-time.Minute),
	}
	repo.jobs["fresh-queued"] = &model.GenerationJob{
		ID: "fresh-queued", ProjectID: "project-fresh-queued", UserID: "user", IdempotencyKey: "fresh-queued",
		Status: model.GenerationJobStatusQueued, ResultSummary: "{}", CreatedAt: now, UpdatedAt: now,
	}
	repo.jobs["stale-running"] = &model.GenerationJob{
		ID: "stale-running", ProjectID: "project-stale-running", UserID: "user", IdempotencyKey: "stale-running",
		Status: model.GenerationJobStatusRunning, WorkerID: "dead-worker", LeaseExpiresAt: &expiredLease,
		ResultSummary: "{}", CreatedAt: now.Add(-time.Minute), UpdatedAt: now.Add(-time.Minute),
	}

	_ = NewGenerationJobService(repo)
	waitGenerationJobStatus(t, repo, "stale-queued", model.GenerationJobStatusInterrupted)
	waitGenerationJobStatus(t, repo, "stale-running", model.GenerationJobStatusInterrupted)
	fresh, err := repo.FindJobByID(context.Background(), "fresh-queued")
	if err != nil {
		t.Fatalf("read fresh queued job: %v", err)
	}
	if fresh.Status != model.GenerationJobStatusQueued {
		t.Fatalf("fresh queued job status = %s, want queued", fresh.Status)
	}
}

func TestGenerationJobStatusSweepInterruptsExpiredCurrentWorkerLease(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	now := time.Now().UTC()
	expiredLease := now.Add(-time.Second)
	repo.mu.Lock()
	repo.jobs["expired-current-worker"] = &model.GenerationJob{
		ID: "expired-current-worker", ProjectID: "project-expired-current-worker", UserID: "user",
		IdempotencyKey: "expired-current-worker", Status: model.GenerationJobStatusRunning,
		WorkerID: jobs.workerID, LeaseExpiresAt: &expiredLease, ResultSummary: "{}",
		CreatedAt: now.Add(-time.Minute), UpdatedAt: now.Add(-time.Minute),
	}
	repo.mu.Unlock()
	jobs.recoveryMu.Lock()
	jobs.nextRecoveryAt = time.Time{}
	jobs.recoveryMu.Unlock()

	job, err := jobs.LatestJob(context.Background(), "project-expired-current-worker")
	if err != nil {
		t.Fatalf("read latest generation job: %v", err)
	}
	if job.Status != model.GenerationJobStatusInterrupted {
		t.Fatalf("expired current-worker job status = %s, want interrupted", job.Status)
	}
}

func TestGenerationJobRepairAttemptUpdatesCurrentAttempt(t *testing.T) {
	repo := newMemoryGenerationJobRepo()
	jobs := NewGenerationJobService(repo)
	started, err := jobs.Start(context.Background(), generationJobTestSpec("project-repair-attempt", "repair-attempt"), func(_ context.Context, handler StreamEventHandler) error {
		if err := handler(StreamEventStep, map[string]any{"id": "generation-repair:1", "status": "running"}); err != nil {
			return err
		}
		if err := handler(StreamEventStep, map[string]any{"id": "generation-repair:1", "status": "done"}); err != nil {
			return err
		}
		return handler(StreamEventDone, map[string]any{"message": "repaired"})
	})
	if err != nil {
		t.Fatalf("start generation job: %v", err)
	}
	job := waitGenerationJobStatus(t, repo, started.Job.ID, model.GenerationJobStatusSucceeded)
	if job.CurrentAttempt != 2 {
		t.Fatalf("current attempt = %d, want 2", job.CurrentAttempt)
	}
}
