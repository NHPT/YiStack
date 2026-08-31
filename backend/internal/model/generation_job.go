package model

import "time"

const (
	GenerationJobStatusQueued      = "queued"
	GenerationJobStatusRunning     = "running"
	GenerationJobStatusRepairing   = "repairing"
	GenerationJobStatusValidating  = "validating"
	GenerationJobStatusPreviewing  = "previewing"
	GenerationJobStatusSucceeded   = "succeeded"
	GenerationJobStatusFailed      = "failed"
	GenerationJobStatusCancelled   = "cancelled"
	GenerationJobStatusInterrupted = "interrupted"

	GenerationAttemptKindInitial = "initial"
	GenerationAttemptKindRepair  = "repair"

	GenerationEventTypeDone  = "done"
	GenerationEventTypeError = "error"
)

type GenerationJobCompletion struct {
	Status        string
	ErrorCode     string
	ErrorMessage  string
	StopReason    string
	ResultSummary string
	EventType     string
	EventPayload  string
	CompletedAt   time.Time
}

type GenerationAttemptCompletion struct {
	Status        string
	ErrorCode     string
	ErrorMessage  string
	FailureHash   string
	ResultSummary string
	CompletedAt   time.Time
}

func IsGenerationJobActiveStatus(status string) bool {
	switch status {
	case GenerationJobStatusQueued, GenerationJobStatusRunning, GenerationJobStatusRepairing, GenerationJobStatusValidating, GenerationJobStatusPreviewing:
		return true
	default:
		return false
	}
}

func IsGenerationJobTerminalStatus(status string) bool {
	switch status {
	case GenerationJobStatusSucceeded, GenerationJobStatusFailed, GenerationJobStatusCancelled, GenerationJobStatusInterrupted:
		return true
	default:
		return false
	}
}

// GenerationJob is the durable source of truth for one generation lifecycle.
type GenerationJob struct {
	ID             string     `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID      string     `gorm:"index;size:64;not null" json:"project_id"`
	UserID         string     `gorm:"index;type:uuid;not null" json:"user_id"`
	IdempotencyKey string     `gorm:"size:128;not null" json:"idempotency_key"`
	Status         string     `gorm:"index;size:32;not null" json:"status"`
	WorkflowStage  string     `gorm:"size:64" json:"workflow_stage"`
	WorkflowMode   string     `gorm:"size:64" json:"workflow_mode"`
	Provider       string     `gorm:"size:128" json:"provider"`
	Model          string     `gorm:"size:255" json:"model"`
	RequestPayload string     `gorm:"type:jsonb;not null;default:'{}'" json:"request_payload"`
	ResultSummary  string     `gorm:"type:jsonb;not null;default:'{}'" json:"result_summary"`
	ErrorCode      string     `gorm:"size:64" json:"error_code"`
	ErrorMessage   string     `gorm:"type:text" json:"error_message"`
	StopReason     string     `gorm:"size:128" json:"stop_reason"`
	CurrentAttempt int        `gorm:"not null;default:0" json:"current_attempt"`
	EventSequence  int64      `gorm:"not null;default:0" json:"event_sequence"`
	WorkerID       string     `gorm:"index;size:128" json:"worker_id"`
	LeaseVersion   int64      `gorm:"not null;default:0" json:"lease_version"`
	LeaseExpiresAt *time.Time `gorm:"index" json:"lease_expires_at,omitempty"`
	HeartbeatAt    *time.Time `json:"heartbeat_at,omitempty"`
	StartedAt      *time.Time `json:"started_at,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

func (GenerationJob) TableName() string { return "generation_jobs" }

// GenerationAttempt records a worker or repair attempt under a job.
type GenerationAttempt struct {
	ID            string     `gorm:"primaryKey;type:uuid" json:"id"`
	JobID         string     `gorm:"index;type:uuid;not null" json:"job_id"`
	AttemptNumber int        `gorm:"not null" json:"attempt_number"`
	Kind          string     `gorm:"size:32;not null" json:"kind"`
	Status        string     `gorm:"index;size:32;not null" json:"status"`
	Provider      string     `gorm:"size:128" json:"provider"`
	Model         string     `gorm:"size:255" json:"model"`
	InputSnapshot string     `gorm:"type:jsonb;not null;default:'{}'" json:"input_snapshot"`
	ResultSummary string     `gorm:"type:jsonb;not null;default:'{}'" json:"result_summary"`
	ErrorCode     string     `gorm:"size:64" json:"error_code"`
	ErrorMessage  string     `gorm:"type:text" json:"error_message"`
	FailureHash   string     `gorm:"size:64" json:"failure_hash"`
	StartedAt     time.Time  `json:"started_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (GenerationAttempt) TableName() string { return "generation_attempts" }

// GenerationEvent is an append-only SSE event with a per-job monotonic sequence.
type GenerationEvent struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	JobID     string    `gorm:"index;type:uuid;not null" json:"job_id"`
	ProjectID string    `gorm:"index;size:64;not null" json:"project_id"`
	Sequence  int64     `gorm:"not null" json:"sequence"`
	EventKey  string    `gorm:"size:255;not null" json:"event_key"`
	EventType string    `gorm:"index;size:32;not null" json:"event_type"`
	Payload   string    `gorm:"type:jsonb;not null" json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

func (GenerationEvent) TableName() string { return "generation_events" }
