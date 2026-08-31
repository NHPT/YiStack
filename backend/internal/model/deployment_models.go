package model

import "time"

type ProjectDeploymentBinding struct {
	ID                  string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID           string    `gorm:"uniqueIndex;size:64;not null" json:"project_id"`
	UserID              string    `gorm:"index;type:uuid;not null" json:"user_id"`
	Provider            string    `gorm:"index;size:32;not null" json:"provider"`
	ProviderProjectID   string    `gorm:"size:255;not null" json:"provider_project_id"`
	ProviderProjectName string    `gorm:"size:255;not null" json:"provider_project_name"`
	TeamID              string    `gorm:"size:255" json:"team_id,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

func (ProjectDeploymentBinding) TableName() string { return "project_deployment_bindings" }

type ProjectDeploymentRelease struct {
	ID                           string     `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID                    string     `gorm:"index;size:64;not null" json:"project_id"`
	UserID                       string     `gorm:"index;type:uuid;not null" json:"user_id"`
	Provider                     string     `gorm:"index;size:32;not null" json:"provider"`
	ProviderDeploymentID         string     `gorm:"index;size:255;not null" json:"provider_deployment_id"`
	ProviderProjectID            string     `gorm:"size:255;not null" json:"provider_project_id"`
	Kind                         string     `gorm:"index;size:32;not null" json:"kind"`
	Target                       string     `gorm:"index;size:32;not null" json:"target"`
	Status                       string     `gorm:"index;size:32;not null" json:"status"`
	URL                          string     `gorm:"size:1000" json:"url"`
	SourceCommitSHA              string     `gorm:"size:64;not null" json:"source_commit_sha"`
	ArtifactSHA256               string     `gorm:"size:64;not null" json:"artifact_sha256"`
	ArtifactFileCount            int        `gorm:"not null;default:0" json:"artifact_file_count"`
	ArtifactSize                 int64      `gorm:"not null;default:0" json:"artifact_size"`
	PreviousProviderDeploymentID string     `gorm:"size:255" json:"previous_provider_deployment_id,omitempty"`
	EnvironmentKeys              string     `gorm:"type:text;not null;default:'[]'" json:"environment_keys"`
	SecretCiphertext             string     `gorm:"type:text" json:"-"`
	SecretNonce                  string     `gorm:"size:255" json:"-"`
	SecretKeyVersion             string     `gorm:"size:32" json:"-"`
	ErrorCode                    string     `gorm:"size:128" json:"error_code,omitempty"`
	ErrorMessage                 string     `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt                    time.Time  `json:"created_at"`
	UpdatedAt                    time.Time  `json:"updated_at"`
	ReadyAt                      *time.Time `json:"ready_at,omitempty"`
}

func (ProjectDeploymentRelease) TableName() string { return "project_deployment_releases" }

type ProjectDeploymentDomain struct {
	ID                 string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID          string    `gorm:"uniqueIndex:project_deployment_domain_unique;size:64;not null" json:"project_id"`
	UserID             string    `gorm:"index;type:uuid;not null" json:"user_id"`
	Provider           string    `gorm:"index;size:32;not null" json:"provider"`
	Domain             string    `gorm:"uniqueIndex:project_deployment_domain_unique;size:255;not null" json:"domain"`
	Status             string    `gorm:"index;size:32;not null" json:"status"`
	Verified           bool      `gorm:"not null;default:false" json:"verified"`
	VerificationType   string    `gorm:"size:32" json:"verification_type,omitempty"`
	VerificationDomain string    `gorm:"size:255" json:"verification_domain,omitempty"`
	VerificationValue  string    `gorm:"size:1000" json:"verification_value,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (ProjectDeploymentDomain) TableName() string { return "project_deployment_domains" }

type ProjectDeploymentOperation struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	UserID         string    `gorm:"uniqueIndex:project_deployment_operation_unique;type:uuid;not null" json:"user_id"`
	ProjectID      string    `gorm:"index;size:64;not null" json:"project_id"`
	IdempotencyKey string    `gorm:"uniqueIndex:project_deployment_operation_unique;size:255;not null" json:"idempotency_key"`
	Kind           string    `gorm:"index;size:32;not null" json:"kind"`
	RequestHash    string    `gorm:"size:64;not null" json:"request_hash"`
	Status         string    `gorm:"index;size:32;not null" json:"status"`
	Result         string    `gorm:"type:text" json:"result"`
	ErrorCode      string    `gorm:"size:128" json:"error_code"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (ProjectDeploymentOperation) TableName() string { return "project_deployment_operations" }
