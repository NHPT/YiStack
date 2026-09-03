package model

import "time"

type ProjectMember struct {
	ID              string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID       string    `gorm:"uniqueIndex:project_member_unique;size:64;not null" json:"project_id"`
	UserID          string    `gorm:"uniqueIndex:project_member_unique;index;type:uuid;not null" json:"user_id"`
	Role            string    `gorm:"index;size:32;not null" json:"role"`
	Status          string    `gorm:"index;size:32;not null" json:"status"`
	InvitedByUserID string    `gorm:"type:uuid;not null" json:"invited_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (ProjectMember) TableName() string { return "project_members" }

type ProjectCollaborationAudit struct {
	ID           string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID    string    `gorm:"index;size:64;not null" json:"project_id"`
	ActorUserID  string    `gorm:"index;type:uuid;not null" json:"actor_user_id"`
	TargetUserID string    `gorm:"index;type:uuid;not null" json:"target_user_id"`
	Action       string    `gorm:"index;size:32;not null" json:"action"`
	PreviousRole string    `gorm:"size:32" json:"previous_role,omitempty"`
	NextRole     string    `gorm:"size:32" json:"next_role,omitempty"`
	MetadataJSON string    `gorm:"type:text;not null;default:'{}'" json:"metadata_json"`
	CreatedAt    time.Time `json:"created_at"`
}

func (ProjectCollaborationAudit) TableName() string { return "project_collaboration_audits" }

type ProjectCollaborationSession struct {
	ID          string    `gorm:"primaryKey;type:uuid" json:"id"`
	ProjectID   string    `gorm:"uniqueIndex:project_collaboration_session_unique;index;size:64;not null" json:"project_id"`
	UserID      string    `gorm:"uniqueIndex:project_collaboration_session_unique;index;type:uuid;not null" json:"user_id"`
	ClientID    string    `gorm:"uniqueIndex:project_collaboration_session_unique;size:128;not null" json:"client_id"`
	Role        string    `gorm:"index;size:32;not null" json:"role"`
	Activity    string    `gorm:"index;size:32;not null" json:"activity"`
	CurrentFile string    `gorm:"size:1024" json:"current_file,omitempty"`
	Status      string    `gorm:"index;size:32;not null" json:"status"`
	JoinedAt    time.Time `json:"joined_at"`
	LastSeenAt  time.Time `gorm:"index;not null" json:"last_seen_at"`
	ExpiresAt   time.Time `gorm:"index;not null" json:"expires_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (ProjectCollaborationSession) TableName() string {
	return "project_collaboration_sessions"
}

type ProjectCollaborationEvent struct {
	Sequence         int64     `gorm:"primaryKey;autoIncrement" json:"sequence"`
	ID               string    `gorm:"uniqueIndex;type:uuid;not null" json:"id"`
	ProjectID        string    `gorm:"index;size:64;not null" json:"project_id"`
	ActorUserID      string    `gorm:"index;type:uuid;not null" json:"actor_user_id"`
	SessionID        string    `gorm:"index;type:uuid" json:"session_id,omitempty"`
	EventType        string    `gorm:"index;size:64;not null" json:"event_type"`
	ResourcePath     string    `gorm:"size:1024" json:"resource_path,omitempty"`
	ResourceRevision string    `gorm:"size:64" json:"resource_revision,omitempty"`
	PayloadJSON      string    `gorm:"type:text;not null;default:'{}'" json:"payload_json"`
	CreatedAt        time.Time `gorm:"index;not null" json:"created_at"`
}

func (ProjectCollaborationEvent) TableName() string {
	return "project_collaboration_events"
}

type OfficialProjectTemplate struct {
	ID               string    `gorm:"primaryKey;type:uuid" json:"id"`
	Slug             string    `gorm:"uniqueIndex;size:100;not null" json:"slug"`
	Name             string    `gorm:"size:255;not null" json:"name"`
	Description      string    `gorm:"type:text" json:"description"`
	AppType          string    `gorm:"index;size:50;not null" json:"app_type"`
	Status           string    `gorm:"index;size:32;not null" json:"status"`
	CurrentVersionID string    `gorm:"type:uuid" json:"current_version_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (OfficialProjectTemplate) TableName() string { return "official_project_templates" }

type OfficialProjectTemplateVersion struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	TemplateID     string    `gorm:"uniqueIndex:official_template_version_unique;index;type:uuid;not null" json:"template_id"`
	Version        int       `gorm:"uniqueIndex:official_template_version_unique;not null" json:"version"`
	Status         string    `gorm:"index;size:32;not null" json:"status"`
	ManifestJSON   string    `gorm:"type:text;not null" json:"manifest_json"`
	FilesJSON      string    `gorm:"type:text;not null" json:"-"`
	ChecksumSHA256 string    `gorm:"size:64;not null" json:"checksum_sha256"`
	CreatedBy      string    `gorm:"size:64;not null" json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
}

func (OfficialProjectTemplateVersion) TableName() string { return "official_project_template_versions" }

type OfficialProjectTemplateAudit struct {
	ID                     string    `gorm:"primaryKey;type:uuid" json:"id"`
	TemplateID             string    `gorm:"index;type:uuid;not null" json:"template_id"`
	ActorID                string    `gorm:"index;size:64;not null" json:"actor_id"`
	Action                 string    `gorm:"index;size:32;not null" json:"action"`
	PreviousVersionID      string    `gorm:"type:uuid" json:"previous_version_id,omitempty"`
	NextVersionID          string    `gorm:"type:uuid" json:"next_version_id,omitempty"`
	ExpectedCurrentVersion string    `gorm:"type:uuid" json:"expected_current_version_id,omitempty"`
	CreatedAt              time.Time `json:"created_at"`
}

func (OfficialProjectTemplateAudit) TableName() string { return "official_project_template_audits" }
