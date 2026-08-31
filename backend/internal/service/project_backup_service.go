package service

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"yistack/config"
	"yistack/internal/model"
)

var projectBackupIDSanitizer = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

type ProjectBackupResultRecord struct {
	Status         string   `json:"status"`
	ProjectID      string   `json:"project_id"`
	BackupID       string   `json:"backup_id"`
	BackupCreated  bool     `json:"backup_created"`
	FileName       string   `json:"file_name"`
	ManifestName   string   `json:"manifest_name"`
	SizeBytes      int64    `json:"size_bytes"`
	FileCount      int      `json:"file_count"`
	DirectoryCount int      `json:"directory_count"`
	ExcludedPaths  []string `json:"excluded_paths"`
	ChecksumSHA256 string   `json:"checksum_sha256"`
	CreatedAt      string   `json:"created_at"`
	Source         string   `json:"source"`
	Message        string   `json:"message"`
	Recovery       string   `json:"recovery"`
}

type ProjectBackupListResult struct {
	Status      string                    `json:"status"`
	ProjectID   string                    `json:"project_id"`
	BackupCount int                       `json:"backup_count"`
	Backups     []ProjectBackupListRecord `json:"backups"`
	Message     string                    `json:"message"`
	Recovery    string                    `json:"recovery"`
}

type ProjectBackupPolicyReadiness struct {
	Status                string                   `json:"status"`
	ProjectID             string                   `json:"project_id"`
	AutoBackupEnabled     bool                     `json:"auto_backup_enabled"`
	BackupDirConfigured   bool                     `json:"backup_dir_configured"`
	BackupDir             string                   `json:"backup_dir"`
	AvailableBackupCount  int                      `json:"available_backup_count"`
	LatestAvailableBackup *ProjectBackupListRecord `json:"latest_available_backup"`
	Message               string                   `json:"message"`
	Recovery              string                   `json:"recovery"`
}

type ProjectBackupRemoteStorageReadiness struct {
	Status                string                   `json:"status"`
	ProjectID             string                   `json:"project_id"`
	RemoteBackupEnabled   bool                     `json:"remote_backup_enabled"`
	Provider              string                   `json:"provider"`
	ProviderConfigured    bool                     `json:"provider_configured"`
	Bucket                string                   `json:"bucket"`
	BucketConfigured      bool                     `json:"bucket_configured"`
	Prefix                string                   `json:"prefix"`
	Endpoint              string                   `json:"endpoint"`
	Region                string                   `json:"region"`
	CredentialsConfigured bool                     `json:"credentials_configured"`
	AvailableBackupCount  int                      `json:"available_backup_count"`
	LatestAvailableBackup *ProjectBackupListRecord `json:"latest_available_backup"`
	Message               string                   `json:"message"`
	Recovery              string                   `json:"recovery"`
}

type ProjectBackupRemoteUploadResult struct {
	Status                string `json:"status"`
	ProjectID             string `json:"project_id"`
	BackupID              string `json:"backup_id"`
	Uploaded              bool   `json:"uploaded"`
	Provider              string `json:"provider"`
	Bucket                string `json:"bucket"`
	Prefix                string `json:"prefix"`
	ArchiveObjectKey      string `json:"archive_object_key"`
	ManifestObjectKey     string `json:"manifest_object_key"`
	ArchiveSizeBytes      int64  `json:"archive_size_bytes"`
	ManifestSizeBytes     int64  `json:"manifest_size_bytes"`
	ChecksumSHA256        string `json:"checksum_sha256"`
	ChecksumVerified      bool   `json:"checksum_verified"`
	CredentialsConfigured bool   `json:"credentials_configured"`
	Message               string `json:"message"`
	Recovery              string `json:"recovery"`
}

type ProjectBackupRemoteInventoryResult struct {
	Status                string                               `json:"status"`
	ProjectID             string                               `json:"project_id"`
	RemoteBackupEnabled   bool                                 `json:"remote_backup_enabled"`
	Provider              string                               `json:"provider"`
	Bucket                string                               `json:"bucket"`
	Prefix                string                               `json:"prefix"`
	Endpoint              string                               `json:"endpoint"`
	Region                string                               `json:"region"`
	CredentialsConfigured bool                                 `json:"credentials_configured"`
	ObjectCount           int                                  `json:"object_count"`
	CandidateCount        int                                  `json:"candidate_count"`
	CompleteCount         int                                  `json:"complete_count"`
	Candidates            []ProjectBackupRemoteInventoryRecord `json:"candidates"`
	Message               string                               `json:"message"`
	Recovery              string                               `json:"recovery"`
}

type ProjectBackupRemoteInventoryRecord struct {
	Status               string `json:"status"`
	ProjectID            string `json:"project_id"`
	BackupID             string `json:"backup_id"`
	ArchiveObjectKey     string `json:"archive_object_key"`
	ManifestObjectKey    string `json:"manifest_object_key"`
	ArchiveSizeBytes     int64  `json:"archive_size_bytes"`
	ManifestSizeBytes    int64  `json:"manifest_size_bytes"`
	ArchiveLastModified  string `json:"archive_last_modified"`
	ManifestLastModified string `json:"manifest_last_modified"`
	Message              string `json:"message"`
}

type ProjectBackupRemoteDownloadResult struct {
	Status                string `json:"status"`
	ProjectID             string `json:"project_id"`
	BackupID              string `json:"backup_id"`
	Downloaded            bool   `json:"downloaded"`
	Provider              string `json:"provider"`
	Bucket                string `json:"bucket"`
	Prefix                string `json:"prefix"`
	ArchiveObjectKey      string `json:"archive_object_key"`
	ManifestObjectKey     string `json:"manifest_object_key"`
	FileName              string `json:"file_name"`
	ManifestName          string `json:"manifest_name"`
	ArchiveSizeBytes      int64  `json:"archive_size_bytes"`
	ManifestSizeBytes     int64  `json:"manifest_size_bytes"`
	ChecksumSHA256        string `json:"checksum_sha256"`
	ChecksumVerified      bool   `json:"checksum_verified"`
	CredentialsConfigured bool   `json:"credentials_configured"`
	Message               string `json:"message"`
	Recovery              string `json:"recovery"`
}

type ProjectBackupRemoteRestoreResult struct {
	Status                string   `json:"status"`
	ProjectID             string   `json:"project_id"`
	BackupID              string   `json:"backup_id"`
	Downloaded            bool     `json:"downloaded"`
	Restored              bool     `json:"restored"`
	DownloadStatus        string   `json:"download_status"`
	RestoreStatus         string   `json:"restore_status"`
	CanRestore            bool     `json:"can_restore"`
	Provider              string   `json:"provider"`
	Bucket                string   `json:"bucket"`
	Prefix                string   `json:"prefix"`
	ArchiveObjectKey      string   `json:"archive_object_key"`
	ManifestObjectKey     string   `json:"manifest_object_key"`
	FileName              string   `json:"file_name"`
	ManifestName          string   `json:"manifest_name"`
	RestoredFiles         int      `json:"restored_files"`
	RestoredDirectories   int      `json:"restored_directories"`
	ArchiveEntryCount     int      `json:"archive_entry_count"`
	ConflictPaths         []string `json:"conflict_paths"`
	UnsafePaths           []string `json:"unsafe_paths"`
	ChecksumSHA256        string   `json:"checksum_sha256"`
	ChecksumVerified      bool     `json:"checksum_verified"`
	CredentialsConfigured bool     `json:"credentials_configured"`
	Message               string   `json:"message"`
	Recovery              string   `json:"recovery"`
}

type ProjectBackupListRecord struct {
	Status         string   `json:"status"`
	ProjectID      string   `json:"project_id"`
	BackupID       string   `json:"backup_id"`
	FileName       string   `json:"file_name"`
	ManifestName   string   `json:"manifest_name"`
	SizeBytes      int64    `json:"size_bytes"`
	FileCount      int      `json:"file_count"`
	DirectoryCount int      `json:"directory_count"`
	ExcludedPaths  []string `json:"excluded_paths"`
	ChecksumSHA256 string   `json:"checksum_sha256"`
	CreatedAt      string   `json:"created_at"`
	Source         string   `json:"source"`
	Message        string   `json:"message"`
	Recovery       string   `json:"recovery"`
}

type ProjectBackupRestorePreflightResult struct {
	Status            string   `json:"status"`
	ProjectID         string   `json:"project_id"`
	BackupID          string   `json:"backup_id"`
	CanRestore        bool     `json:"can_restore"`
	FileName          string   `json:"file_name"`
	ManifestName      string   `json:"manifest_name"`
	SizeBytes         int64    `json:"size_bytes"`
	FileCount         int      `json:"file_count"`
	DirectoryCount    int      `json:"directory_count"`
	ArchiveEntryCount int      `json:"archive_entry_count"`
	ConflictPaths     []string `json:"conflict_paths"`
	UnsafePaths       []string `json:"unsafe_paths"`
	ChecksumSHA256    string   `json:"checksum_sha256"`
	ChecksumVerified  bool     `json:"checksum_verified"`
	Message           string   `json:"message"`
	Recovery          string   `json:"recovery"`
}

type ProjectBackupRestoreResult struct {
	Status              string   `json:"status"`
	ProjectID           string   `json:"project_id"`
	BackupID            string   `json:"backup_id"`
	Restored            bool     `json:"restored"`
	FileName            string   `json:"file_name"`
	ManifestName        string   `json:"manifest_name"`
	RestoredFiles       int      `json:"restored_files"`
	RestoredDirectories int      `json:"restored_directories"`
	ArchiveEntryCount   int      `json:"archive_entry_count"`
	ConflictPaths       []string `json:"conflict_paths"`
	UnsafePaths         []string `json:"unsafe_paths"`
	ChecksumSHA256      string   `json:"checksum_sha256"`
	ChecksumVerified    bool     `json:"checksum_verified"`
	Message             string   `json:"message"`
	Recovery            string   `json:"recovery"`
}

type ProjectBackupDownloadDescriptor struct {
	ProjectID        string
	BackupID         string
	FileName         string
	ManifestName     string
	ArchivePath      string
	SizeBytes        int64
	ChecksumSHA256   string
	ChecksumVerified bool
	Message          string
	Recovery         string
}

type projectBackupManifest struct {
	SchemaVersion  string   `json:"schema_version"`
	ProjectID      string   `json:"project_id"`
	BackupID       string   `json:"backup_id"`
	FileName       string   `json:"file_name"`
	SizeBytes      int64    `json:"size_bytes"`
	FileCount      int      `json:"file_count"`
	DirectoryCount int      `json:"directory_count"`
	ExcludedPaths  []string `json:"excluded_paths"`
	ChecksumSHA256 string   `json:"checksum_sha256"`
	CreatedAt      string   `json:"created_at"`
	Source         string   `json:"source"`
}

type projectBackupEntry struct {
	AbsPath string
	RelPath string
	Info    fs.FileInfo
}

var projectBackupExcludedDirectoryNames = map[string]struct{}{
	".cache":       {},
	".next":        {},
	".turbo":       {},
	".yistack":     {},
	"build":        {},
	"coverage":     {},
	"dist":         {},
	"node_modules": {},
}

func isTrustedProjectBackupSource(source string) bool {
	switch strings.TrimSpace(source) {
	case "project_host_directory", "automatic_policy":
		return true
	default:
		return false
	}
}

func (s *ProjectService) CreateProjectBackup(ctx context.Context, projectID string) (*ProjectBackupResultRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	return s.createProjectBackupForProject(ctx, project, "project_host_directory", "备份归档和 manifest 已写入项目备份目录；当前入口只创建本地备份，不启动容器、不执行 Git 写操作，也不上传远端存储。")
}

func (s *ProjectService) RunProjectAutomaticBackup(ctx context.Context, projectID string) (*ProjectBackupResultRecord, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	projectCfg := s.projectBackupConfig(ctx)
	if !projectCfg.AutoBackup {
		return blockedProjectBackup(project.ProjectID, "项目自动备份策略已关闭", "请先启用 PROJECT_AUTO_BACKUP；当前入口不会创建备份目录、读取项目代码目录、启动容器或执行 Git。"), nil
	}
	if strings.TrimSpace(projectCfg.BackupDir) == "" {
		return blockedProjectBackup(project.ProjectID, "项目自动备份目录未配置", "请先配置 PROJECT_BACKUP_DIR；当前入口不会创建备份目录、读取项目代码目录、启动容器或执行 Git。"), nil
	}

	return s.createProjectBackupForProject(ctx, project, "automatic_policy", "自动备份策略执行已创建本地备份归档和 manifest；当前入口只执行一次受控本地备份，不启动容器、不执行 Git 操作、不恢复、不下载，也不上传远端存储。")
}

func (s *ProjectService) createProjectBackupForProject(ctx context.Context, project *model.Project, source, recovery string) (*ProjectBackupResultRecord, error) {
	sourceDir, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		return nil, err
	}
	if info, statErr := os.Stat(sourceDir); statErr != nil {
		return blockedProjectBackup(project.ProjectID, fmt.Sprintf("项目目录不可用：%s", statErr.Error()), "请确认项目目录仍存在，或重新进入 Workspace 触发项目运行时恢复后再创建备份。"), nil
	} else if !info.IsDir() {
		return blockedProjectBackup(project.ProjectID, "项目目录不是目录", "请检查项目目录配置，修复后再创建备份。"), nil
	}

	projectCfg := s.projectBackupConfig(ctx)
	entries, excludedPaths, totalSize, err := collectProjectBackupEntries(sourceDir, projectCfg.MaxProjectSize)
	if err != nil {
		return blockedProjectBackup(project.ProjectID, err.Error(), "请删除无关依赖或构建产物，或调整项目大小上限后再创建备份。"), nil
	}
	if len(entries) == 0 {
		return blockedProjectBackup(project.ProjectID, "项目目录没有可备份文件", "请先生成或保存项目文件后再创建备份。"), nil
	}

	backupRoot, err := prepareProjectBackupRoot(projectCfg.BackupDir, project.ProjectID)
	if err != nil {
		return nil, err
	}

	createdAt := time.Now().UTC()
	backupID := buildProjectBackupID(project.ProjectID, createdAt)
	fileName := backupID + ".tar.gz"
	manifestName := backupID + ".manifest.json"
	archivePath := filepath.Join(backupRoot, fileName)
	manifestPath := filepath.Join(backupRoot, manifestName)

	sizeBytes, checksum, fileCount, directoryCount, err := writeProjectBackupArchive(archivePath, sourceDir, entries)
	if err != nil {
		_ = os.Remove(archivePath)
		return nil, err
	}

	manifest := projectBackupManifest{
		SchemaVersion:  "project_backup_manifest.v1",
		ProjectID:      project.ProjectID,
		BackupID:       backupID,
		FileName:       fileName,
		SizeBytes:      sizeBytes,
		FileCount:      fileCount,
		DirectoryCount: directoryCount,
		ExcludedPaths:  excludedPaths,
		ChecksumSHA256: checksum,
		CreatedAt:      createdAt.Format(time.RFC3339),
		Source:         source,
	}
	if err := writeProjectBackupManifest(manifestPath, manifest); err != nil {
		_ = os.Remove(archivePath)
		_ = os.Remove(manifestPath)
		return nil, err
	}

	return &ProjectBackupResultRecord{
		Status:         "created",
		ProjectID:      project.ProjectID,
		BackupID:       backupID,
		BackupCreated:  true,
		FileName:       fileName,
		ManifestName:   manifestName,
		SizeBytes:      sizeBytes,
		FileCount:      fileCount,
		DirectoryCount: directoryCount,
		ExcludedPaths:  excludedPaths,
		ChecksumSHA256: checksum,
		CreatedAt:      createdAt.Format(time.RFC3339),
		Source:         source,
		Message:        fmt.Sprintf("项目备份已创建，源文件大小约 %d bytes，归档大小 %d bytes", totalSize, sizeBytes),
		Recovery:       recovery,
	}, nil
}

func (s *ProjectService) ListProjectBackups(ctx context.Context, projectID string) (*ProjectBackupListResult, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	projectCfg := s.projectBackupConfig(ctx)
	backupRoot, err := resolveProjectBackupRoot(projectCfg.BackupDir, project.ProjectID)
	if err != nil {
		return nil, err
	}

	dirEntries, err := os.ReadDir(backupRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return emptyProjectBackupList(project.ProjectID), nil
		}
		return nil, fmt.Errorf("read project backup directory: %w", err)
	}

	records := make([]ProjectBackupListRecord, 0)
	for _, entry := range dirEntries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".manifest.json") {
			continue
		}
		records = append(records, readProjectBackupListRecord(backupRoot, project.ProjectID, entry.Name()))
	}

	sort.SliceStable(records, func(i, j int) bool {
		leftTime, leftErr := time.Parse(time.RFC3339, records[i].CreatedAt)
		rightTime, rightErr := time.Parse(time.RFC3339, records[j].CreatedAt)
		if leftErr == nil && rightErr == nil && !leftTime.Equal(rightTime) {
			return leftTime.After(rightTime)
		}
		if leftErr == nil && rightErr != nil {
			return true
		}
		if leftErr != nil && rightErr == nil {
			return false
		}
		return records[i].ManifestName > records[j].ManifestName
	})

	if len(records) == 0 {
		return emptyProjectBackupList(project.ProjectID), nil
	}
	return &ProjectBackupListResult{
		Status:      "ready",
		ProjectID:   project.ProjectID,
		BackupCount: len(records),
		Backups:     records,
		Message:     fmt.Sprintf("已从本地备份 manifest 读取 %d 条备份记录", len(records)),
		Recovery:    "该列表只读取本地 manifest 与归档文件状态，不启动容器、不执行 Git 操作、不下载或恢复备份。",
	}, nil
}

func (s *ProjectService) GetProjectBackupPolicyReadiness(ctx context.Context, projectID string) (*ProjectBackupPolicyReadiness, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	projectCfg := s.projectBackupConfig(ctx)
	readiness := &ProjectBackupPolicyReadiness{
		Status:              "blocked",
		ProjectID:           project.ProjectID,
		AutoBackupEnabled:   projectCfg.AutoBackup,
		BackupDirConfigured: strings.TrimSpace(projectCfg.BackupDir) != "",
		BackupDir:           strings.TrimSpace(projectCfg.BackupDir),
		Message:             "项目自动备份策略尚未就绪",
		Recovery:            "请启用 PROJECT_AUTO_BACKUP 并配置 PROJECT_BACKUP_DIR 后，再继续接入自动备份调度。",
	}
	if !readiness.AutoBackupEnabled {
		readiness.Status = "disabled"
		readiness.Message = "项目自动备份策略已关闭"
		readiness.Recovery = "如需启用自动备份，请将 PROJECT_AUTO_BACKUP 设置为 true；当前只读检查不会创建备份或修改项目。"
		return readiness, nil
	}
	if !readiness.BackupDirConfigured {
		readiness.Message = "项目自动备份目录未配置"
		readiness.Recovery = "请配置 PROJECT_BACKUP_DIR；当前只读检查不会创建备份目录、读取项目代码目录或启动容器。"
		return readiness, nil
	}

	backupList, err := s.ListProjectBackups(ctx, project.ProjectID)
	if err != nil {
		return nil, err
	}
	for _, backup := range backupList.Backups {
		if backup.Status != "available" {
			continue
		}
		backupCopy := backup
		if readiness.LatestAvailableBackup == nil {
			readiness.LatestAvailableBackup = &backupCopy
		}
		readiness.AvailableBackupCount++
	}
	if readiness.AvailableBackupCount == 0 {
		readiness.Status = "empty"
		readiness.Message = "项目自动备份策略已开启，但当前没有可用本地备份"
		readiness.Recovery = "可先手动创建一次本地备份；后续自动调度接入时会沿用同一备份目录和 manifest 校验规则。"
		return readiness, nil
	}

	readiness.Status = "ready"
	readiness.Message = fmt.Sprintf("项目自动备份策略可观测，当前有 %d 条可用本地备份", readiness.AvailableBackupCount)
	readiness.Recovery = "该 readiness 只读取配置和本地 manifest 列表，不创建备份、不读取项目代码目录、不启动容器、不执行 Git 操作，也不上传远端存储。"
	return readiness, nil
}

func (s *ProjectService) GetProjectBackupRemoteStorageReadiness(ctx context.Context, projectID string) (*ProjectBackupRemoteStorageReadiness, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	projectCfg := s.projectBackupConfig(ctx)
	provider := strings.ToLower(strings.TrimSpace(projectCfg.RemoteBackupProvider))
	bucket := strings.TrimSpace(projectCfg.RemoteBackupBucket)
	readiness := &ProjectBackupRemoteStorageReadiness{
		Status:                "blocked",
		ProjectID:             project.ProjectID,
		RemoteBackupEnabled:   projectCfg.RemoteBackupEnabled,
		Provider:              provider,
		ProviderConfigured:    provider != "",
		Bucket:                bucket,
		BucketConfigured:      bucket != "",
		Prefix:                strings.Trim(strings.TrimSpace(projectCfg.RemoteBackupPrefix), "/"),
		Endpoint:              strings.TrimSpace(projectCfg.RemoteBackupEndpoint),
		Region:                strings.TrimSpace(projectCfg.RemoteBackupRegion),
		CredentialsConfigured: projectCfg.RemoteBackupCredentials,
		Message:               "项目备份远端存储尚未就绪",
		Recovery:              "请启用 PROJECT_BACKUP_REMOTE_ENABLED，并配置 provider、bucket 与访问凭据；当前只读检查不会上传、下载或创建远端对象。",
	}
	if !readiness.RemoteBackupEnabled {
		readiness.Status = "disabled"
		readiness.Message = "项目备份远端存储策略已关闭"
		readiness.Recovery = "如需启用远端备份存储，请将 PROJECT_BACKUP_REMOTE_ENABLED 设置为 true；当前只读检查不会读取项目代码目录、创建备份或触碰远端对象。"
		return readiness, nil
	}
	if !readiness.ProviderConfigured {
		readiness.Message = "项目备份远端存储 provider 未配置"
		readiness.Recovery = "请配置 PROJECT_BACKUP_REMOTE_PROVIDER，例如 s3；当前只读检查不会初始化云 SDK 或访问网络。"
		return readiness, nil
	}
	if provider != "s3" {
		readiness.Message = fmt.Sprintf("项目备份远端存储 provider 尚不受支持：%s", provider)
		readiness.Recovery = "当前 readiness 只接受 s3 / S3-compatible 配置；请调整 PROJECT_BACKUP_REMOTE_PROVIDER 后重试。"
		return readiness, nil
	}
	if !readiness.BucketConfigured {
		readiness.Message = "项目备份远端存储 bucket 未配置"
		readiness.Recovery = "请配置 PROJECT_BACKUP_REMOTE_BUCKET；当前只读检查不会创建 bucket 或上传对象。"
		return readiness, nil
	}
	if !readiness.CredentialsConfigured {
		readiness.Message = "项目备份远端存储凭据未配置完整"
		readiness.Recovery = "请同时配置 PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID 与 PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY；响应只暴露 credentials_configured 布尔值，不返回密钥。"
		return readiness, nil
	}

	backupList, err := s.ListProjectBackups(ctx, project.ProjectID)
	if err != nil {
		return nil, err
	}
	for _, backup := range backupList.Backups {
		if backup.Status != "available" {
			continue
		}
		backupCopy := backup
		if readiness.LatestAvailableBackup == nil {
			readiness.LatestAvailableBackup = &backupCopy
		}
		readiness.AvailableBackupCount++
	}
	if readiness.AvailableBackupCount == 0 {
		readiness.Status = "empty"
		readiness.Message = "项目备份远端存储配置已就绪，但当前没有可上传的本地备份"
		readiness.Recovery = "请先创建本地备份或等待自动备份生成 automatic_policy 归档；当前只读检查不会创建备份或上传远端对象。"
		return readiness, nil
	}

	readiness.Status = "ready"
	readiness.Message = fmt.Sprintf("项目备份远端存储前置条件已就绪，当前有 %d 条可上传本地备份", readiness.AvailableBackupCount)
	readiness.Recovery = "该 readiness 只读取远端存储配置和本地 manifest 列表，不上传、不下载、不创建远端对象、不启动容器、不执行 Git 操作。"
	return readiness, nil
}

func (s *ProjectService) UploadProjectBackupToRemoteStorage(ctx context.Context, projectID, backupID string) (*ProjectBackupRemoteUploadResult, error) {
	normalizedBackupID := strings.TrimSpace(backupID)
	result := &ProjectBackupRemoteUploadResult{
		Status:   "blocked",
		BackupID: normalizedBackupID,
		Message:  "项目备份远端上传尚未执行",
		Recovery: "请先确认远端存储 readiness 与本地备份 manifest 均可用，再发起显式远端上传。",
	}
	if !isSafeProjectBackupIdentity(normalizedBackupID) {
		result.Message = "backup_id 为空或包含不安全字符"
		return result, nil
	}

	readiness, err := s.GetProjectBackupRemoteStorageReadiness(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result.ProjectID = readiness.ProjectID
	result.Provider = readiness.Provider
	result.Bucket = readiness.Bucket
	result.Prefix = readiness.Prefix
	result.CredentialsConfigured = readiness.CredentialsConfigured
	if readiness.Status != "ready" {
		result.Message = fmt.Sprintf("项目备份远端上传被 readiness 阻断：%s", readiness.Message)
		result.Recovery = readiness.Recovery
		return result, nil
	}

	secretCfg := s.projectSecretConfig()
	if strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID) == "" || strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey) == "" {
		result.Message = "项目备份远端上传凭据内容不可用"
		result.Recovery = "请同时配置 PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID 与 PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY；上传响应只暴露 credentials_configured 布尔值，不返回密钥。"
		return result, nil
	}

	download, err := s.PrepareProjectBackupDownload(ctx, projectID, normalizedBackupID)
	if err != nil {
		result.Message = fmt.Sprintf("项目备份远端上传前本地归档校验失败：%s", err.Error())
		result.Recovery = "请重新读取本地备份列表，选择 available 备份后再上传；当前不会创建备份、启动容器或执行 Git。"
		return result, nil
	}
	result.ProjectID = download.ProjectID
	result.BackupID = download.BackupID
	result.ArchiveSizeBytes = download.SizeBytes
	result.ChecksumSHA256 = download.ChecksumSHA256
	result.ChecksumVerified = download.ChecksumVerified

	manifestPath := filepath.Join(filepath.Dir(download.ArchivePath), download.ManifestName)
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		result.Message = fmt.Sprintf("项目备份远端上传前读取 manifest 失败：%s", err.Error())
		result.Recovery = "请确认本地备份 manifest 仍存在，或重新创建备份后再上传。"
		return result, nil
	}
	result.ManifestSizeBytes = int64(len(manifestBytes))
	result.ArchiveObjectKey = buildProjectBackupRemoteObjectKey(readiness.Prefix, download.ProjectID, download.BackupID, download.FileName)
	result.ManifestObjectKey = buildProjectBackupRemoteObjectKey(readiness.Prefix, download.ProjectID, download.BackupID, download.ManifestName)

	archiveFile, err := os.Open(download.ArchivePath)
	if err != nil {
		result.Message = fmt.Sprintf("项目备份远端上传前打开归档失败：%s", err.Error())
		result.Recovery = "请确认本地备份归档仍存在，或重新创建备份后再上传。"
		return result, nil
	}
	defer archiveFile.Close()

	remote := projectBackupS3RemoteConfig{
		Provider:        readiness.Provider,
		Bucket:          readiness.Bucket,
		Endpoint:        readiness.Endpoint,
		Region:          readiness.Region,
		AccessKeyID:     strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID),
		SecretAccessKey: strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey),
	}
	client := s.backupRemoteHTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	if err := uploadProjectBackupS3Object(ctx, client, remote, result.ArchiveObjectKey, archiveFile, download.SizeBytes, download.ChecksumSHA256, "application/gzip"); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("项目备份归档远端上传失败：%s", err.Error())
		result.Recovery = "归档上传未确认完成；请检查远端存储网络、bucket 权限、endpoint、region 与凭据后重试。"
		return result, nil
	}

	manifestChecksum := sha256.Sum256(manifestBytes)
	if err := uploadProjectBackupS3Object(ctx, client, remote, result.ManifestObjectKey, bytes.NewReader(manifestBytes), int64(len(manifestBytes)), hex.EncodeToString(manifestChecksum[:]), "application/json"); err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("项目备份 manifest 远端上传失败：%s", err.Error())
		result.Recovery = "归档可能已上传但 manifest 未确认完成；请检查远端对象状态后重试，避免把远端备份误判为完整可恢复。"
		return result, nil
	}

	result.Status = "uploaded"
	result.Uploaded = true
	result.Message = "项目备份归档和 manifest 已上传到远端存储"
	result.Recovery = "远端上传只读取已校验的本地备份归档与 manifest，不读取项目代码目录、不创建新备份、不启动容器、不执行 Git 操作，也不下载远端对象。"
	return result, nil
}

func (s *ProjectService) ListProjectBackupRemoteInventory(ctx context.Context, projectID string) (*ProjectBackupRemoteInventoryResult, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	projectCfg := s.projectBackupConfig(ctx)
	provider := strings.ToLower(strings.TrimSpace(projectCfg.RemoteBackupProvider))
	bucket := strings.TrimSpace(projectCfg.RemoteBackupBucket)
	result := &ProjectBackupRemoteInventoryResult{
		Status:                "blocked",
		ProjectID:             project.ProjectID,
		RemoteBackupEnabled:   projectCfg.RemoteBackupEnabled,
		Provider:              provider,
		Bucket:                bucket,
		Prefix:                strings.Trim(strings.TrimSpace(projectCfg.RemoteBackupPrefix), "/"),
		Endpoint:              strings.TrimSpace(projectCfg.RemoteBackupEndpoint),
		Region:                strings.TrimSpace(projectCfg.RemoteBackupRegion),
		CredentialsConfigured: projectCfg.RemoteBackupCredentials,
		Candidates:            []ProjectBackupRemoteInventoryRecord{},
		Message:               "项目备份远端对象清单尚未读取",
		Recovery:              "请先启用远端备份存储并配置 provider、bucket 与访问凭据；当前入口只读列举远端对象，不下载、不恢复、不创建或覆盖远端对象。",
	}
	if !result.RemoteBackupEnabled {
		result.Status = "disabled"
		result.Message = "项目备份远端存储策略已关闭"
		result.Recovery = "如需读取远端备份对象清单，请将 PROJECT_BACKUP_REMOTE_ENABLED 设置为 true；当前入口不会读取项目代码目录、创建备份或触碰远端对象内容。"
		return result, nil
	}
	if provider == "" {
		result.Message = "项目备份远端存储 provider 未配置"
		result.Recovery = "请配置 PROJECT_BACKUP_REMOTE_PROVIDER，例如 s3；当前入口不会初始化云 SDK。"
		return result, nil
	}
	if provider != "s3" {
		result.Message = fmt.Sprintf("项目备份远端存储 provider 尚不受支持：%s", provider)
		result.Recovery = "当前远端对象清单只支持 s3 / S3-compatible ListObjectsV2。"
		return result, nil
	}
	if bucket == "" {
		result.Message = "项目备份远端存储 bucket 未配置"
		result.Recovery = "请配置 PROJECT_BACKUP_REMOTE_BUCKET；当前入口不会创建 bucket 或上传对象。"
		return result, nil
	}
	secretCfg := s.projectSecretConfig()
	if !result.CredentialsConfigured ||
		strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID) == "" ||
		strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey) == "" {
		result.Message = "项目备份远端存储凭据未配置完整"
		result.Recovery = "请同时配置 PROJECT_BACKUP_REMOTE_ACCESS_KEY_ID 与 PROJECT_BACKUP_REMOTE_SECRET_ACCESS_KEY；响应只暴露 credentials_configured 布尔值，不返回密钥。"
		return result, nil
	}

	remote := projectBackupS3RemoteConfig{
		Provider:        provider,
		Bucket:          bucket,
		Endpoint:        result.Endpoint,
		Region:          result.Region,
		AccessKeyID:     strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID),
		SecretAccessKey: strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey),
	}
	client := s.backupRemoteHTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	objectPrefix := buildProjectBackupRemoteObjectKey(result.Prefix, project.ProjectID, "", "")
	if objectPrefix != "" {
		objectPrefix += "/"
	}
	objects, err := listProjectBackupS3Objects(ctx, client, remote, objectPrefix)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("项目备份远端对象清单读取失败：%s", err.Error())
		result.Recovery = "请检查远端 endpoint、region、bucket ListBucket 权限、网络和凭据后重试；当前未下载远端对象内容，也未恢复项目。"
		return result, nil
	}
	result.ObjectCount = len(objects)
	result.Candidates = buildProjectBackupRemoteInventoryRecords(result.Prefix, project.ProjectID, objects)
	result.CandidateCount = len(result.Candidates)
	for _, candidate := range result.Candidates {
		if candidate.Status == "complete" {
			result.CompleteCount++
		}
	}
	if result.CandidateCount == 0 {
		result.Status = "empty"
		result.Message = "远端对象存储中尚未发现当前项目的备份对象"
		result.Recovery = "请先通过远端上传入口上传本地备份归档和 manifest；当前入口只读列举 object key，不下载对象内容。"
		return result, nil
	}
	result.Status = "ready"
	result.Message = fmt.Sprintf("已读取远端备份对象清单，发现 %d 个候选，其中 %d 个同时具备归档和 manifest", result.CandidateCount, result.CompleteCount)
	result.Recovery = "complete 只表示远端 object key 同时存在归档和 manifest；后续真正下载或恢复前仍需读取 manifest 并复核 checksum。当前入口不下载对象内容、不恢复项目、不创建或覆盖远端对象。"
	return result, nil
}

func (s *ProjectService) DownloadProjectBackupFromRemoteStorage(ctx context.Context, projectID, backupID string) (*ProjectBackupRemoteDownloadResult, error) {
	normalizedBackupID := strings.TrimSpace(backupID)
	result := &ProjectBackupRemoteDownloadResult{
		Status:   "blocked",
		BackupID: normalizedBackupID,
		Message:  "项目备份远端下载尚未执行",
		Recovery: "请先确认远端对象清单中存在 complete 候选，再发起显式远端下载；当前入口只导入本地备份缓存，不恢复项目。",
	}
	if !isSafeProjectBackupIdentity(normalizedBackupID) {
		result.Message = "backup_id 为空或包含不安全字符"
		return result, nil
	}

	inventory, err := s.ListProjectBackupRemoteInventory(ctx, projectID)
	if err != nil {
		return nil, err
	}
	result.ProjectID = inventory.ProjectID
	result.Provider = inventory.Provider
	result.Bucket = inventory.Bucket
	result.Prefix = inventory.Prefix
	result.CredentialsConfigured = inventory.CredentialsConfigured
	if inventory.Status != "ready" {
		result.Message = fmt.Sprintf("项目备份远端下载被对象清单状态阻断：%s", inventory.Message)
		result.Recovery = inventory.Recovery
		return result, nil
	}

	var candidate *ProjectBackupRemoteInventoryRecord
	for i := range inventory.Candidates {
		if inventory.Candidates[i].BackupID == normalizedBackupID {
			candidate = &inventory.Candidates[i]
			break
		}
	}
	if candidate == nil {
		result.Message = "远端对象清单中未发现指定 backup_id"
		result.Recovery = "请重新读取远端对象清单并选择存在的 complete 候选；当前不会下载任何对象。"
		return result, nil
	}
	if candidate.Status != "complete" {
		result.Message = fmt.Sprintf("远端备份候选不完整：%s", candidate.Status)
		result.Recovery = "只有同时具备归档和 manifest object key 的 complete 候选才允许导入本地备份缓存。"
		return result, nil
	}
	result.ArchiveObjectKey = candidate.ArchiveObjectKey
	result.ManifestObjectKey = candidate.ManifestObjectKey

	projectCfg := s.projectBackupConfig(ctx)
	secretCfg := s.projectSecretConfig()
	remote := projectBackupS3RemoteConfig{
		Provider:        inventory.Provider,
		Bucket:          inventory.Bucket,
		Endpoint:        inventory.Endpoint,
		Region:          inventory.Region,
		AccessKeyID:     strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID),
		SecretAccessKey: strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey),
	}
	client := s.backupRemoteHTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	manifestBytes, err := downloadProjectBackupS3ObjectBytes(ctx, client, remote, result.ManifestObjectKey, 10*1024*1024)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("项目备份远端 manifest 下载失败：%s", err.Error())
		result.Recovery = "请检查远端对象权限、网络、endpoint、region 与凭据后重试；当前未写入本地备份目录。"
		return result, nil
	}
	result.ManifestSizeBytes = int64(len(manifestBytes))

	manifestName := normalizedBackupID + ".manifest.json"
	manifest, err := parseTrustedProjectBackupManifestBytes(manifestBytes, inventory.ProjectID, normalizedBackupID)
	if err != nil {
		result.Message = fmt.Sprintf("项目备份远端 manifest 身份校验失败：%s", err.Error())
		result.Recovery = "远端 manifest 与当前项目或 backup_id 不匹配，已阻断本地导入。"
		return result, nil
	}
	if manifest.FileName != normalizedBackupID+".tar.gz" {
		result.Message = "项目备份远端 manifest 指向的归档文件名与 backup_id 不一致"
		result.Recovery = "请确认远端对象来自 YiStack 受控上传链路；当前不会写入本地备份目录。"
		return result, nil
	}
	result.FileName = manifest.FileName
	result.ManifestName = manifestName
	result.ArchiveSizeBytes = manifest.SizeBytes
	result.ChecksumSHA256 = manifest.ChecksumSHA256

	backupRoot, err := prepareProjectBackupRoot(projectCfg.BackupDir, inventory.ProjectID)
	if err != nil {
		result.Message = fmt.Sprintf("项目本地备份目录不可用：%s", err.Error())
		result.Recovery = "请配置 PROJECT_BACKUP_DIR 后重试；当前未下载归档对象。"
		return result, nil
	}
	archivePath := filepath.Join(backupRoot, manifest.FileName)
	manifestPath := filepath.Join(backupRoot, manifestName)
	if _, statErr := os.Stat(archivePath); statErr == nil {
		result.Message = "本地备份归档已存在，远端下载不会覆盖"
		result.Recovery = "请先通过本地备份列表确认现有备份状态，或人工迁移旧备份后再导入远端候选。"
		return result, nil
	} else if !os.IsNotExist(statErr) {
		return nil, fmt.Errorf("stat local backup archive: %w", statErr)
	}
	if _, statErr := os.Stat(manifestPath); statErr == nil {
		result.Message = "本地备份 manifest 已存在，远端下载不会覆盖"
		result.Recovery = "请先通过本地备份列表确认现有备份状态，或人工迁移旧 manifest 后再导入远端候选。"
		return result, nil
	} else if !os.IsNotExist(statErr) {
		return nil, fmt.Errorf("stat local backup manifest: %w", statErr)
	}

	archiveTmp, actualChecksum, err := downloadProjectBackupS3ObjectToTempFile(ctx, client, remote, result.ArchiveObjectKey, backupRoot, manifest.SizeBytes)
	if err != nil {
		result.Status = "failed"
		result.Message = fmt.Sprintf("项目备份远端归档下载失败：%s", err.Error())
		result.Recovery = "归档未导入本地备份目录；请检查远端对象、网络和凭据后重试。"
		return result, nil
	}
	archivePublished := false
	defer func() {
		if !archivePublished {
			_ = os.Remove(archiveTmp)
		}
	}()
	if actualChecksum != manifest.ChecksumSHA256 {
		result.Message = "项目备份远端归档 checksum 与 manifest 不一致"
		result.Recovery = "远端归档可能损坏或与 manifest 不匹配，已阻断本地导入。"
		return result, nil
	}
	result.ChecksumVerified = true

	manifestTmp, err := writeProjectBackupRemoteDownloadedManifestTemp(backupRoot, manifestBytes)
	if err != nil {
		return nil, err
	}
	manifestPublished := false
	defer func() {
		if !manifestPublished {
			_ = os.Remove(manifestTmp)
		}
	}()
	if err := os.Rename(archiveTmp, archivePath); err != nil {
		return nil, fmt.Errorf("publish remote backup archive: %w", err)
	}
	archivePublished = true
	if err := os.Rename(manifestTmp, manifestPath); err != nil {
		_ = os.Remove(archivePath)
		return nil, fmt.Errorf("publish remote backup manifest: %w", err)
	}
	manifestPublished = true

	result.Status = "downloaded"
	result.Downloaded = true
	result.Message = "项目备份远端归档和 manifest 已导入本地备份目录"
	result.Recovery = "远端下载只写入本地备份缓存；真正恢复仍需通过本地恢复预检和 confirm_restore=true 的受控恢复入口。"
	return result, nil
}

func (s *ProjectService) RestoreProjectBackupFromRemoteStorage(ctx context.Context, projectID, backupID string, confirmRestore bool) (*ProjectBackupRemoteRestoreResult, error) {
	normalizedBackupID := strings.TrimSpace(backupID)
	result := &ProjectBackupRemoteRestoreResult{
		Status:        "blocked",
		ProjectID:     strings.TrimSpace(projectID),
		BackupID:      normalizedBackupID,
		ConflictPaths: []string{},
		UnsafePaths:   []string{},
		Message:       "项目备份远端恢复尚未执行",
		Recovery:      "请先确认远端对象清单中存在 complete 候选，并带 confirm_restore=true 发起受控恢复。",
	}
	if !isSafeProjectBackupIdentity(normalizedBackupID) {
		result.Message = "backup_id 为空或包含不安全字符"
		return result, nil
	}
	if !confirmRestore {
		result.Message = "项目备份远端恢复缺少显式确认"
		result.Recovery = "远端恢复会先导入备份缓存再写入项目目录；请先确认恢复风险，并带 confirm_restore=true 重新发起。"
		return result, nil
	}

	download, err := s.DownloadProjectBackupFromRemoteStorage(ctx, projectID, normalizedBackupID)
	if err != nil {
		return nil, err
	}
	result.ProjectID = download.ProjectID
	result.BackupID = download.BackupID
	result.Downloaded = download.Downloaded
	result.DownloadStatus = download.Status
	result.Provider = download.Provider
	result.Bucket = download.Bucket
	result.Prefix = download.Prefix
	result.ArchiveObjectKey = download.ArchiveObjectKey
	result.ManifestObjectKey = download.ManifestObjectKey
	result.FileName = download.FileName
	result.ManifestName = download.ManifestName
	result.ChecksumSHA256 = download.ChecksumSHA256
	result.ChecksumVerified = download.ChecksumVerified
	result.CredentialsConfigured = download.CredentialsConfigured
	if download.Status != "downloaded" || !download.Downloaded {
		if download.Status == "failed" {
			result.Status = "failed"
		}
		result.Message = fmt.Sprintf("项目备份远端恢复未执行：远端下载导入未完成，download_status=%s。%s", download.Status, download.Message)
		result.Recovery = download.Recovery
		return result, nil
	}

	preflight, err := s.PreflightProjectBackupRestore(ctx, projectID, normalizedBackupID)
	if err != nil {
		return nil, err
	}
	result.CanRestore = preflight.CanRestore
	result.RestoreStatus = preflight.Status
	result.FileName = preflight.FileName
	result.ManifestName = preflight.ManifestName
	result.ArchiveEntryCount = preflight.ArchiveEntryCount
	result.ConflictPaths = preflight.ConflictPaths
	result.UnsafePaths = preflight.UnsafePaths
	result.ChecksumSHA256 = preflight.ChecksumSHA256
	result.ChecksumVerified = preflight.ChecksumVerified
	if preflight.Status != "ready" || !preflight.CanRestore {
		result.Message = "项目备份远端恢复预检未通过，恢复已阻断"
		result.Recovery = preflight.Recovery
		return result, nil
	}

	restore, err := s.RestoreProjectBackup(ctx, projectID, normalizedBackupID, true)
	if err != nil {
		return nil, err
	}
	result.RestoreStatus = restore.Status
	result.Restored = restore.Restored
	result.FileName = restore.FileName
	result.ManifestName = restore.ManifestName
	result.RestoredFiles = restore.RestoredFiles
	result.RestoredDirectories = restore.RestoredDirectories
	result.ArchiveEntryCount = restore.ArchiveEntryCount
	result.ConflictPaths = restore.ConflictPaths
	result.UnsafePaths = restore.UnsafePaths
	result.ChecksumSHA256 = restore.ChecksumSHA256
	result.ChecksumVerified = restore.ChecksumVerified
	result.Message = restore.Message
	result.Recovery = restore.Recovery
	if restore.Status != "restored" || !restore.Restored {
		result.Message = fmt.Sprintf("项目备份远端恢复未完成：%s", restore.Message)
		return result, nil
	}

	result.Status = "restored"
	result.Message = "项目备份远端完整候选已导入本地缓存并完成受控恢复"
	result.Recovery = "恢复已通过远端下载校验、本地恢复预检和恢复前二次校验；当前入口不会启动容器或执行 Git 操作。"
	return result, nil
}

func (s *ProjectService) PreflightProjectBackupRestore(ctx context.Context, projectID, backupID string) (*ProjectBackupRestorePreflightResult, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	targetDir, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		return nil, err
	}

	result := &ProjectBackupRestorePreflightResult{
		Status:        "blocked",
		ProjectID:     project.ProjectID,
		BackupID:      strings.TrimSpace(backupID),
		ConflictPaths: []string{},
		UnsafePaths:   []string{},
		Message:       "备份恢复预检未通过",
		Recovery:      "请重新选择可信备份，或清理目标项目目录中的冲突路径后再发起恢复预检。",
	}
	if !isSafeProjectBackupIdentity(result.BackupID) {
		result.Message = "backup_id 为空或包含不安全字符"
		return result, nil
	}

	projectCfg := s.projectBackupConfig(ctx)
	backupRoot, err := resolveProjectBackupRoot(projectCfg.BackupDir, project.ProjectID)
	if err != nil {
		return nil, err
	}

	manifestName := result.BackupID + ".manifest.json"
	result.ManifestName = manifestName
	manifest, err := readTrustedProjectBackupManifest(backupRoot, project.ProjectID, result.BackupID, manifestName)
	if err != nil {
		result.Message = fmt.Sprintf("备份 manifest 预检失败：%s", err.Error())
		return result, nil
	}
	result.FileName = manifest.FileName
	result.SizeBytes = manifest.SizeBytes
	result.FileCount = manifest.FileCount
	result.DirectoryCount = manifest.DirectoryCount
	result.ChecksumSHA256 = manifest.ChecksumSHA256

	archivePath := filepath.Join(backupRoot, manifest.FileName)
	archiveInfo, err := os.Stat(archivePath)
	if err != nil {
		result.Message = fmt.Sprintf("备份归档不可用：%s", err.Error())
		result.Recovery = "请确认本地备份归档仍存在，或重新创建备份后再预检恢复。"
		return result, nil
	}
	if archiveInfo.IsDir() || !archiveInfo.Mode().IsRegular() {
		result.Message = "备份归档不是 regular 文件"
		result.Recovery = "请人工清理异常归档路径，或重新创建备份后再预检恢复。"
		return result, nil
	}
	if manifest.SizeBytes > 0 && archiveInfo.Size() != manifest.SizeBytes {
		result.Message = "备份归档大小与 manifest 不一致"
		result.Recovery = "请重新创建备份，或检查本地备份目录是否被人工修改。"
		return result, nil
	}

	actualChecksum, err := checksumProjectBackupArchive(archivePath)
	if err != nil {
		result.Message = fmt.Sprintf("计算备份归档 checksum 失败：%s", err.Error())
		return result, nil
	}
	if actualChecksum != manifest.ChecksumSHA256 {
		result.Message = "备份归档 checksum 与 manifest 不一致"
		result.Recovery = "该备份归档可能已损坏或被替换；请重新创建备份后再预检恢复。"
		return result, nil
	}
	result.ChecksumVerified = true

	inspection, err := inspectProjectBackupArchiveForRestore(archivePath, targetDir)
	if err != nil {
		result.Message = fmt.Sprintf("读取备份归档失败：%s", err.Error())
		result.Recovery = "请确认归档是 YiStack 创建的有效 .tar.gz 备份，或重新创建备份。"
		return result, nil
	}
	result.ArchiveEntryCount = inspection.EntryCount
	result.ConflictPaths = inspection.ConflictPaths
	result.UnsafePaths = inspection.UnsafePaths
	if len(result.UnsafePaths) > 0 {
		result.Message = "备份归档包含不安全路径或不支持的条目类型"
		result.Recovery = "恢复已被预检阻断；请丢弃该备份或人工审查归档内容。"
		return result, nil
	}
	if len(result.ConflictPaths) > 0 {
		result.Message = "目标项目目录存在同名路径，恢复会覆盖当前文件"
		result.Recovery = "请先创建当前项目的新备份并清理目标目录，或等待后续受控恢复流程处理覆盖策略。"
		return result, nil
	}
	if result.ArchiveEntryCount == 0 {
		result.Message = "备份归档没有可恢复条目"
		result.Recovery = "请重新创建备份后再预检恢复。"
		return result, nil
	}

	result.Status = "ready"
	result.CanRestore = true
	result.Message = "备份恢复预检通过"
	result.Recovery = "manifest、归档 checksum、tar 条目安全性和目标目录冲突均已完成只读校验；当前接口不会解包、写入项目目录、启动容器或执行 Git 操作。"
	return result, nil
}

func (s *ProjectService) PrepareProjectBackupDownload(ctx context.Context, projectID, backupID string) (*ProjectBackupDownloadDescriptor, error) {
	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}

	normalizedBackupID := strings.TrimSpace(backupID)
	if !isSafeProjectBackupIdentity(normalizedBackupID) {
		return nil, fmt.Errorf("backup_id is empty or unsafe")
	}

	projectCfg := s.projectBackupConfig(ctx)
	backupRoot, err := resolveProjectBackupRoot(projectCfg.BackupDir, project.ProjectID)
	if err != nil {
		return nil, err
	}

	manifestName := normalizedBackupID + ".manifest.json"
	manifest, err := readTrustedProjectBackupManifest(backupRoot, project.ProjectID, normalizedBackupID, manifestName)
	if err != nil {
		return nil, fmt.Errorf("prepare backup download manifest: %w", err)
	}

	archivePath := filepath.Join(backupRoot, manifest.FileName)
	archiveInfo, err := os.Stat(archivePath)
	if err != nil {
		return nil, fmt.Errorf("prepare backup download archive: %w", err)
	}
	if archiveInfo.IsDir() || !archiveInfo.Mode().IsRegular() {
		return nil, fmt.Errorf("prepare backup download archive: archive is not a regular file")
	}
	if manifest.SizeBytes > 0 && archiveInfo.Size() != manifest.SizeBytes {
		return nil, fmt.Errorf("prepare backup download archive: archive size does not match manifest")
	}

	actualChecksum, err := checksumProjectBackupArchive(archivePath)
	if err != nil {
		return nil, fmt.Errorf("prepare backup download checksum: %w", err)
	}
	if actualChecksum != manifest.ChecksumSHA256 {
		return nil, fmt.Errorf("prepare backup download checksum: archive checksum does not match manifest")
	}

	return &ProjectBackupDownloadDescriptor{
		ProjectID:        project.ProjectID,
		BackupID:         normalizedBackupID,
		FileName:         manifest.FileName,
		ManifestName:     manifestName,
		ArchivePath:      archivePath,
		SizeBytes:        archiveInfo.Size(),
		ChecksumSHA256:   actualChecksum,
		ChecksumVerified: true,
		Message:          "项目本地备份归档已通过下载前校验",
		Recovery:         "该入口只读取本地 manifest 与归档并返回下载流，不写项目目录、不启动容器、不执行 Git 操作，也不上传或下载远端存储。",
	}, nil
}

func (s *ProjectService) RestoreProjectBackup(ctx context.Context, projectID, backupID string, confirmRestore bool) (*ProjectBackupRestoreResult, error) {
	preflight, err := s.PreflightProjectBackupRestore(ctx, projectID, backupID)
	if err != nil {
		return nil, err
	}

	result := &ProjectBackupRestoreResult{
		Status:            "blocked",
		ProjectID:         preflight.ProjectID,
		BackupID:          preflight.BackupID,
		FileName:          preflight.FileName,
		ManifestName:      preflight.ManifestName,
		ArchiveEntryCount: preflight.ArchiveEntryCount,
		ConflictPaths:     preflight.ConflictPaths,
		UnsafePaths:       preflight.UnsafePaths,
		ChecksumSHA256:    preflight.ChecksumSHA256,
		ChecksumVerified:  preflight.ChecksumVerified,
		Message:           preflight.Message,
		Recovery:          preflight.Recovery,
	}
	if !confirmRestore {
		result.Message = "备份恢复缺少显式确认"
		result.Recovery = "请先查看恢复预检结果，并在确认目标目录不会被覆盖后带 confirm_restore=true 重新发起恢复。"
		return result, nil
	}
	if preflight.Status != "ready" || !preflight.CanRestore {
		result.Message = "备份恢复预检未通过，恢复已阻断"
		return result, nil
	}

	project, err := s.projectRepo.FindByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, fmt.Errorf("project not found")
	}
	targetDir, err := secureProjectHostDirectory(currentProjectRootDir(), project.ProjectID, project.DirectoryPath)
	if err != nil {
		return nil, err
	}
	projectCfg := s.projectBackupConfig(ctx)
	backupRoot, err := resolveProjectBackupRoot(projectCfg.BackupDir, project.ProjectID)
	if err != nil {
		return nil, err
	}
	manifest, err := readTrustedProjectBackupManifest(backupRoot, project.ProjectID, preflight.BackupID, preflight.ManifestName)
	if err != nil {
		result.Message = fmt.Sprintf("备份 manifest 恢复前复核失败：%s", err.Error())
		return result, nil
	}

	archivePath := filepath.Join(backupRoot, manifest.FileName)
	archiveInfo, err := os.Stat(archivePath)
	if err != nil {
		result.Message = fmt.Sprintf("备份归档恢复前复核失败：%s", err.Error())
		result.Recovery = "恢复已中止；请重新创建备份或重新执行恢复预检，确认本地归档仍存在。"
		return result, nil
	}
	if archiveInfo.IsDir() || !archiveInfo.Mode().IsRegular() {
		result.Message = "备份归档恢复前复核失败：归档不是 regular 文件"
		result.Recovery = "恢复已中止；请人工清理异常归档路径，或重新创建备份后再恢复。"
		return result, nil
	}
	if manifest.SizeBytes > 0 && archiveInfo.Size() != manifest.SizeBytes {
		result.Message = "备份归档恢复前复核失败：归档大小与 manifest 不一致"
		result.Recovery = "恢复已中止；本地归档可能已被修改，请重新创建备份后再恢复。"
		return result, nil
	}
	actualChecksum, err := checksumProjectBackupArchive(archivePath)
	if err != nil {
		result.Message = fmt.Sprintf("备份归档恢复前 checksum 复核失败：%s", err.Error())
		result.Recovery = "恢复已中止；请重新执行恢复预检，确认本地归档完整性。"
		return result, nil
	}
	if actualChecksum != manifest.ChecksumSHA256 {
		result.ChecksumVerified = false
		result.Message = "备份归档恢复前复核失败：checksum 与 manifest 不一致"
		result.Recovery = "恢复已中止；该备份归档可能已损坏或被替换，请重新创建备份后再恢复。"
		return result, nil
	}
	result.ChecksumSHA256 = actualChecksum
	result.ChecksumVerified = true
	restoreStats, err := restoreProjectBackupArchive(archivePath, targetDir)
	if err != nil {
		result.Message = fmt.Sprintf("备份恢复执行失败：%s", err.Error())
		result.Recovery = "恢复已中止；请重新执行恢复预检确认目标目录状态，必要时人工检查项目目录。"
		return result, nil
	}

	result.Status = "restored"
	result.Restored = true
	result.RestoredFiles = restoreStats.FileCount
	result.RestoredDirectories = restoreStats.DirectoryCount
	result.Message = fmt.Sprintf("项目备份已恢复，写入文件 %d 个，目录 %d 个", restoreStats.FileCount, restoreStats.DirectoryCount)
	result.Recovery = "恢复已从本地备份归档写入项目宿主目录；该入口不启动容器、不执行 Git 操作、不下载或上传远端存储。请重新打开项目或刷新 Workspace 文件树确认恢复结果。"
	return result, nil
}

func (s *ProjectService) projectBackupConfig(ctx context.Context) config.ProjectConfig {
	cfg := config.Get().Project
	if s.projectCfg != nil {
		cfg = *s.projectCfg
	}
	if s != nil && s.systemConfigSvc != nil {
		if items, err := s.systemConfigSvc.ListConfigItems(ctx); err == nil {
			ApplyProjectRuntimeConfigItems(&cfg, items)
		}
	}
	return cfg
}

func (s *ProjectService) projectSecretConfig() config.ProjectSecretConfig {
	if s != nil && s.projectSecretCfg != nil {
		return *s.projectSecretCfg
	}
	return config.Get().ProjectSecrets
}

func blockedProjectBackup(projectID, message, recovery string) *ProjectBackupResultRecord {
	return &ProjectBackupResultRecord{
		Status:        "blocked",
		ProjectID:     projectID,
		BackupCreated: false,
		Message:       message,
		Recovery:      recovery,
	}
}

func buildProjectBackupID(projectID string, createdAt time.Time) string {
	safeProjectID := projectBackupIDSanitizer.ReplaceAllString(strings.TrimSpace(projectID), "-")
	safeProjectID = strings.Trim(safeProjectID, "-._")
	if safeProjectID == "" {
		safeProjectID = "project"
	}
	return fmt.Sprintf("%s-%s", safeProjectID, createdAt.UTC().Format("20060102T150405.000000000Z"))
}

func prepareProjectBackupRoot(baseDir, projectID string) (string, error) {
	backupRoot, err := resolveProjectBackupRoot(baseDir, projectID)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(backupRoot, 0o755); err != nil {
		return "", fmt.Errorf("create project backup directory: %w", err)
	}
	return backupRoot, nil
}

func resolveProjectBackupRoot(baseDir, projectID string) (string, error) {
	baseDir = strings.TrimSpace(baseDir)
	if baseDir == "" {
		return "", fmt.Errorf("project backup directory is not configured")
	}
	cleanBase := filepath.Clean(baseDir)
	if cleanBase == "/" || cleanBase == "." {
		return "", fmt.Errorf("refuse to use unsafe project backup directory: %s", baseDir)
	}
	safeProjectID := projectBackupIDSanitizer.ReplaceAllString(strings.TrimSpace(projectID), "-")
	safeProjectID = strings.Trim(safeProjectID, "-._")
	if safeProjectID == "" {
		return "", fmt.Errorf("project id is required")
	}
	backupRoot := filepath.Join(cleanBase, safeProjectID)
	return backupRoot, nil
}

func emptyProjectBackupList(projectID string) *ProjectBackupListResult {
	return &ProjectBackupListResult{
		Status:      "empty",
		ProjectID:   projectID,
		BackupCount: 0,
		Backups:     []ProjectBackupListRecord{},
		Message:     "当前项目还没有本地备份 manifest",
		Recovery:    "可先在项目列表创建一次本地备份；列表读取不会创建目录、启动容器或执行 Git 操作。",
	}
}

func readProjectBackupListRecord(backupRoot, projectID, manifestName string) ProjectBackupListRecord {
	record := ProjectBackupListRecord{
		Status:       "manifest_invalid",
		ProjectID:    projectID,
		ManifestName: manifestName,
		Message:      "备份 manifest 无法作为可信记录读取",
		Recovery:     "请重新创建备份，或人工检查本地备份目录中的 manifest 与归档文件。",
	}
	if !isSafeProjectBackupFileName(manifestName) {
		record.Message = "备份 manifest 文件名不安全"
		return record
	}

	manifestPath := filepath.Join(backupRoot, manifestName)
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		record.Message = fmt.Sprintf("读取备份 manifest 失败：%s", err.Error())
		return record
	}

	var manifest projectBackupManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		record.Message = fmt.Sprintf("解析备份 manifest 失败：%s", err.Error())
		return record
	}
	record.BackupID = manifest.BackupID
	record.FileName = manifest.FileName
	record.SizeBytes = manifest.SizeBytes
	record.FileCount = manifest.FileCount
	record.DirectoryCount = manifest.DirectoryCount
	record.ExcludedPaths = manifest.ExcludedPaths
	record.ChecksumSHA256 = manifest.ChecksumSHA256
	record.CreatedAt = manifest.CreatedAt
	record.Source = manifest.Source

	if manifest.SchemaVersion != "project_backup_manifest.v1" ||
		manifest.ProjectID != projectID ||
		manifest.BackupID == "" ||
		manifest.FileName == "" ||
		!isTrustedProjectBackupSource(manifest.Source) ||
		!isSafeProjectBackupFileName(manifest.FileName) {
		record.Message = "备份 manifest 身份字段不可信"
		return record
	}

	archivePath := filepath.Join(backupRoot, manifest.FileName)
	if info, err := os.Stat(archivePath); err != nil {
		record.Status = "archive_missing"
		record.Message = "备份 manifest 存在，但归档文件缺失或不可读"
		record.Recovery = "请重新创建备份，或检查备份目录是否被人工清理。"
		return record
	} else if info.IsDir() || !info.Mode().IsRegular() {
		record.Status = "archive_missing"
		record.Message = "备份 manifest 指向的归档不是 regular 文件"
		record.Recovery = "请重新创建备份，或人工清理异常归档路径。"
		return record
	}

	record.Status = "available"
	record.Message = "备份 manifest 与归档文件均可观测"
	record.Recovery = "当前列表仅确认本地文件存在；恢复、下载、远端上传和自动调度由后续治理任务提供。"
	return record
}

func isSafeProjectBackupFileName(name string) bool {
	trimmed := strings.TrimSpace(name)
	return trimmed != "" && trimmed == filepath.Base(trimmed) && !strings.Contains(trimmed, string(filepath.Separator))
}

func isSafeProjectBackupIdentity(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed != "" && projectBackupIDSanitizer.ReplaceAllString(trimmed, "-") == trimmed && !strings.Contains(trimmed, "/") && !strings.Contains(trimmed, "\\")
}

func readTrustedProjectBackupManifest(backupRoot, projectID, backupID, manifestName string) (projectBackupManifest, error) {
	var manifest projectBackupManifest
	if !isSafeProjectBackupFileName(manifestName) {
		return manifest, fmt.Errorf("manifest file name is unsafe")
	}
	manifestBytes, err := os.ReadFile(filepath.Join(backupRoot, manifestName))
	if err != nil {
		return manifest, fmt.Errorf("read manifest: %w", err)
	}
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return manifest, fmt.Errorf("parse manifest: %w", err)
	}
	if manifest.SchemaVersion != "project_backup_manifest.v1" ||
		manifest.ProjectID != projectID ||
		manifest.BackupID != backupID ||
		manifest.FileName == "" ||
		!isTrustedProjectBackupSource(manifest.Source) ||
		!isSafeProjectBackupFileName(manifest.FileName) ||
		strings.TrimSpace(manifest.ChecksumSHA256) == "" {
		return manifest, fmt.Errorf("manifest identity fields are not trusted")
	}
	return manifest, nil
}

func parseTrustedProjectBackupManifestBytes(manifestBytes []byte, projectID, backupID string) (projectBackupManifest, error) {
	var manifest projectBackupManifest
	if len(manifestBytes) == 0 {
		return manifest, fmt.Errorf("manifest is empty")
	}
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return manifest, fmt.Errorf("parse manifest: %w", err)
	}
	if manifest.SchemaVersion != "project_backup_manifest.v1" ||
		manifest.ProjectID != projectID ||
		manifest.BackupID != backupID ||
		manifest.FileName == "" ||
		!isTrustedProjectBackupSource(manifest.Source) ||
		!isSafeProjectBackupFileName(manifest.FileName) ||
		strings.TrimSpace(manifest.ChecksumSHA256) == "" {
		return manifest, fmt.Errorf("manifest identity fields are not trusted")
	}
	if manifest.SizeBytes <= 0 {
		return manifest, fmt.Errorf("manifest archive size is invalid")
	}
	return manifest, nil
}

func checksumProjectBackupArchive(archivePath string) (string, error) {
	file, err := os.Open(archivePath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

type projectBackupS3RemoteConfig struct {
	Provider        string
	Bucket          string
	Endpoint        string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
}

type projectBackupS3Object struct {
	Key          string
	SizeBytes    int64
	LastModified string
}

type projectBackupS3ListObjectsV2Response struct {
	XMLName               xml.Name `xml:"ListBucketResult"`
	IsTruncated           bool     `xml:"IsTruncated"`
	NextContinuationToken string   `xml:"NextContinuationToken"`
	Contents              []struct {
		Key          string `xml:"Key"`
		LastModified string `xml:"LastModified"`
		Size         int64  `xml:"Size"`
	} `xml:"Contents"`
}

func buildProjectBackupRemoteObjectKey(prefix, projectID, backupID, fileName string) string {
	parts := []string{}
	for _, part := range []string{prefix, projectID, backupID, fileName} {
		trimmed := strings.Trim(strings.TrimSpace(part), "/")
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return strings.Join(parts, "/")
}

func buildProjectBackupRemoteInventoryRecords(prefix, projectID string, objects []projectBackupS3Object) []ProjectBackupRemoteInventoryRecord {
	objectPrefix := buildProjectBackupRemoteObjectKey(prefix, projectID, "", "")
	if objectPrefix != "" {
		objectPrefix += "/"
	}
	recordsByBackupID := map[string]*ProjectBackupRemoteInventoryRecord{}
	for _, object := range objects {
		if object.Key == "" || !strings.HasPrefix(object.Key, objectPrefix) {
			continue
		}
		relativeKey := strings.TrimPrefix(object.Key, objectPrefix)
		segments := strings.Split(relativeKey, "/")
		if len(segments) < 2 || !isSafeProjectBackupIdentity(segments[0]) {
			continue
		}
		backupID := segments[0]
		fileName := segments[len(segments)-1]
		if fileName == "" {
			continue
		}
		isManifestObject := strings.HasSuffix(fileName, ".manifest.json")
		isArchiveObject := strings.HasSuffix(fileName, ".tar.gz")
		if !isManifestObject && !isArchiveObject {
			continue
		}
		record := recordsByBackupID[backupID]
		if record == nil {
			record = &ProjectBackupRemoteInventoryRecord{
				ProjectID: projectID,
				BackupID:  backupID,
				Status:    "archive_only",
			}
			recordsByBackupID[backupID] = record
		}
		if isManifestObject {
			record.ManifestObjectKey = object.Key
			record.ManifestSizeBytes = object.SizeBytes
			record.ManifestLastModified = object.LastModified
			continue
		}
		if isArchiveObject {
			record.ArchiveObjectKey = object.Key
			record.ArchiveSizeBytes = object.SizeBytes
			record.ArchiveLastModified = object.LastModified
		}
	}

	records := make([]ProjectBackupRemoteInventoryRecord, 0, len(recordsByBackupID))
	for _, record := range recordsByBackupID {
		switch {
		case record.ArchiveObjectKey != "" && record.ManifestObjectKey != "":
			record.Status = "complete"
			record.Message = "远端归档和 manifest object key 均存在"
		case record.ManifestObjectKey != "":
			record.Status = "manifest_only"
			record.Message = "远端仅发现 manifest，归档 object key 缺失"
		default:
			record.Status = "archive_only"
			record.Message = "远端仅发现归档，manifest object key 缺失"
		}
		records = append(records, *record)
	}
	sort.SliceStable(records, func(i, j int) bool {
		left := records[i].ManifestLastModified
		if left == "" {
			left = records[i].ArchiveLastModified
		}
		right := records[j].ManifestLastModified
		if right == "" {
			right = records[j].ArchiveLastModified
		}
		if left == right {
			return records[i].BackupID > records[j].BackupID
		}
		return left > right
	})
	return records
}

func listProjectBackupS3Objects(ctx context.Context, client projectBackupRemoteHTTPClient, remote projectBackupS3RemoteConfig, prefix string) ([]projectBackupS3Object, error) {
	if client == nil {
		return nil, fmt.Errorf("remote backup http client is not configured")
	}
	objects := []projectBackupS3Object{}
	continuationToken := ""
	for page := 0; page < 10; page++ {
		endpoint, err := buildProjectBackupS3ListObjectsURL(remote, prefix, continuationToken)
		if err != nil {
			return nil, err
		}
		payloadHash := emptyProjectBackupS3PayloadHash()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, fmt.Errorf("build remote inventory request: %w", err)
		}
		req.Header.Set("X-Amz-Content-Sha256", payloadHash)
		signProjectBackupS3Request(req, remote, payloadHash, time.Now().UTC())

		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("remote inventory request failed: %w", err)
		}
		bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
		_ = resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("read remote inventory response: %w", readErr)
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("remote inventory returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
		}

		var listResponse projectBackupS3ListObjectsV2Response
		if err := xml.Unmarshal(bodyBytes, &listResponse); err != nil {
			return nil, fmt.Errorf("parse remote inventory response: %w", err)
		}
		for _, item := range listResponse.Contents {
			objects = append(objects, projectBackupS3Object{
				Key:          item.Key,
				SizeBytes:    item.Size,
				LastModified: item.LastModified,
			})
		}
		if !listResponse.IsTruncated {
			return objects, nil
		}
		continuationToken = strings.TrimSpace(listResponse.NextContinuationToken)
		if continuationToken == "" {
			return nil, fmt.Errorf("remote inventory response is truncated without continuation token")
		}
	}
	return nil, fmt.Errorf("remote inventory listing exceeded page limit")
}

func downloadProjectBackupS3ObjectBytes(ctx context.Context, client projectBackupRemoteHTTPClient, remote projectBackupS3RemoteConfig, objectKey string, maxSizeBytes int64) ([]byte, error) {
	if maxSizeBytes <= 0 {
		return nil, fmt.Errorf("remote backup max download size is invalid")
	}
	resp, err := getProjectBackupS3Object(ctx, client, remote, objectKey)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxSizeBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read remote object: %w", err)
	}
	if int64(len(bodyBytes)) > maxSizeBytes {
		return nil, fmt.Errorf("remote object exceeds max download size")
	}
	return bodyBytes, nil
}

func downloadProjectBackupS3ObjectToTempFile(ctx context.Context, client projectBackupRemoteHTTPClient, remote projectBackupS3RemoteConfig, objectKey, targetDir string, expectedSizeBytes int64) (string, string, error) {
	if expectedSizeBytes <= 0 {
		return "", "", fmt.Errorf("remote archive expected size is invalid")
	}
	resp, err := getProjectBackupS3Object(ctx, client, remote, objectKey)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	tmpFile, err := os.CreateTemp(targetDir, ".remote-backup-download-*.tar.gz")
	if err != nil {
		return "", "", fmt.Errorf("create remote backup temp archive: %w", err)
	}
	tmpPath := tmpFile.Name()
	keepTmp := false
	defer func() {
		if !keepTmp {
			_ = os.Remove(tmpPath)
		}
	}()

	hash := sha256.New()
	limitedReader := io.LimitReader(resp.Body, expectedSizeBytes+1)
	written, copyErr := io.Copy(io.MultiWriter(tmpFile, hash), limitedReader)
	closeErr := tmpFile.Close()
	if copyErr != nil {
		return "", "", fmt.Errorf("write remote backup temp archive: %w", copyErr)
	}
	if closeErr != nil {
		return "", "", fmt.Errorf("close remote backup temp archive: %w", closeErr)
	}
	if written != expectedSizeBytes {
		return "", "", fmt.Errorf("remote archive size mismatch: got %d want %d", written, expectedSizeBytes)
	}
	keepTmp = true
	return tmpPath, hex.EncodeToString(hash.Sum(nil)), nil
}

func getProjectBackupS3Object(ctx context.Context, client projectBackupRemoteHTTPClient, remote projectBackupS3RemoteConfig, objectKey string) (*http.Response, error) {
	if client == nil {
		return nil, fmt.Errorf("remote backup http client is not configured")
	}
	endpoint, err := buildProjectBackupS3ObjectURL(remote, objectKey)
	if err != nil {
		return nil, err
	}
	payloadHash := emptyProjectBackupS3PayloadHash()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build remote download request: %w", err)
	}
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	signProjectBackupS3Request(req, remote, payloadHash, time.Now().UTC())
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("remote download request failed: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("remote download returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}
	return resp, nil
}

func uploadProjectBackupS3Object(ctx context.Context, client projectBackupRemoteHTTPClient, remote projectBackupS3RemoteConfig, objectKey string, body io.Reader, sizeBytes int64, checksumSHA256, contentType string) error {
	if client == nil {
		return fmt.Errorf("remote backup http client is not configured")
	}
	endpoint, err := buildProjectBackupS3ObjectURL(remote, objectKey)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, body)
	if err != nil {
		return fmt.Errorf("build remote upload request: %w", err)
	}
	req.ContentLength = sizeBytes
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", checksumSHA256)
	signProjectBackupS3Request(req, remote, checksumSHA256, time.Now().UTC())

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("remote upload request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("remote upload returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}
	return nil
}

func buildProjectBackupS3ObjectURL(remote projectBackupS3RemoteConfig, objectKey string) (string, error) {
	bucket := strings.TrimSpace(remote.Bucket)
	if bucket == "" {
		return "", fmt.Errorf("remote backup bucket is not configured")
	}
	if strings.TrimSpace(objectKey) == "" {
		return "", fmt.Errorf("remote backup object key is not configured")
	}
	endpoint := strings.TrimRight(strings.TrimSpace(remote.Endpoint), "/")
	escapedKey := escapeProjectBackupS3ObjectKey(objectKey)
	if endpoint != "" {
		parsed, err := url.Parse(endpoint)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return "", fmt.Errorf("remote backup endpoint is invalid")
		}
		parsed.Path = path.Join(parsed.Path, bucket, strings.Trim(objectKey, "/"))
		return parsed.String(), nil
	}
	region := strings.TrimSpace(remote.Region)
	if region == "" {
		region = "us-east-1"
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucket, region, escapedKey), nil
}

func buildProjectBackupS3ListObjectsURL(remote projectBackupS3RemoteConfig, prefix, continuationToken string) (string, error) {
	bucket := strings.TrimSpace(remote.Bucket)
	if bucket == "" {
		return "", fmt.Errorf("remote backup bucket is not configured")
	}
	var parsed *url.URL
	endpoint := strings.TrimRight(strings.TrimSpace(remote.Endpoint), "/")
	if endpoint != "" {
		endpointURL, err := url.Parse(endpoint)
		if err != nil || endpointURL.Scheme == "" || endpointURL.Host == "" {
			return "", fmt.Errorf("remote backup endpoint is invalid")
		}
		endpointURL.Path = path.Join(endpointURL.Path, bucket)
		parsed = endpointURL
	} else {
		region := strings.TrimSpace(remote.Region)
		if region == "" {
			region = "us-east-1"
		}
		defaultURL, err := url.Parse(fmt.Sprintf("https://%s.s3.%s.amazonaws.com/", bucket, region))
		if err != nil {
			return "", fmt.Errorf("build remote backup list endpoint: %w", err)
		}
		parsed = defaultURL
	}
	query := parsed.Query()
	query.Set("list-type", "2")
	if strings.TrimSpace(prefix) != "" {
		query.Set("prefix", strings.TrimSpace(prefix))
	}
	if strings.TrimSpace(continuationToken) != "" {
		query.Set("continuation-token", strings.TrimSpace(continuationToken))
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func escapeProjectBackupS3ObjectKey(objectKey string) string {
	segments := strings.Split(strings.Trim(objectKey, "/"), "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func emptyProjectBackupS3PayloadHash() string {
	hash := sha256.Sum256(nil)
	return hex.EncodeToString(hash[:])
}

func signProjectBackupS3Request(req *http.Request, remote projectBackupS3RemoteConfig, payloadHash string, now time.Time) {
	region := strings.TrimSpace(remote.Region)
	if region == "" {
		region = "us-east-1"
	}
	amzDate := now.UTC().Format("20060102T150405Z")
	dateStamp := now.UTC().Format("20060102")
	req.Header.Set("Host", req.URL.Host)
	req.Header.Set("X-Amz-Date", amzDate)

	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n", req.URL.Host, payloadHash, amzDate)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := strings.Join([]string{
		req.Method,
		req.URL.EscapedPath(),
		req.URL.RawQuery,
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, region)
	hashedCanonicalRequest := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		credentialScope,
		hex.EncodeToString(hashedCanonicalRequest[:]),
	}, "\n")
	signature := hex.EncodeToString(hmacSHA256(deriveProjectBackupS3SigningKey(remote.SecretAccessKey, dateStamp, region), []byte(stringToSign)))
	req.Header.Set("Authorization", fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		strings.TrimSpace(remote.AccessKeyID),
		credentialScope,
		signedHeaders,
		signature,
	))
}

func deriveProjectBackupS3SigningKey(secretAccessKey, dateStamp, region string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretAccessKey), []byte(dateStamp))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte("s3"))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func hmacSHA256(key, data []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(data)
	return mac.Sum(nil)
}

type projectBackupRestoreArchiveInspection struct {
	EntryCount    int
	ConflictPaths []string
	UnsafePaths   []string
}

type projectBackupRestoreArchiveStats struct {
	FileCount      int
	DirectoryCount int
}

func inspectProjectBackupArchiveForRestore(archivePath, targetDir string) (projectBackupRestoreArchiveInspection, error) {
	inspection := projectBackupRestoreArchiveInspection{
		ConflictPaths: []string{},
		UnsafePaths:   []string{},
	}

	file, err := os.Open(archivePath)
	if err != nil {
		return inspection, err
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return inspection, err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	seenConflicts := make(map[string]struct{})
	seenUnsafe := make(map[string]struct{})
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return inspection, err
		}
		inspection.EntryCount++

		cleanName, safe := cleanProjectBackupRestoreEntryName(header.Name, header.Typeflag)
		if !safe {
			appendUniqueProjectBackupPath(&inspection.UnsafePaths, seenUnsafe, header.Name)
			continue
		}
		targetPath, err := secureHostPathWithinProjectRoot(targetDir, filepath.Join(targetDir, filepath.FromSlash(cleanName)))
		if err != nil {
			appendUniqueProjectBackupPath(&inspection.UnsafePaths, seenUnsafe, cleanName)
			continue
		}
		if _, err := os.Lstat(targetPath); err == nil {
			appendUniqueProjectBackupPath(&inspection.ConflictPaths, seenConflicts, cleanName)
		} else if !os.IsNotExist(err) {
			appendUniqueProjectBackupPath(&inspection.ConflictPaths, seenConflicts, cleanName)
		}
	}
	sort.Strings(inspection.ConflictPaths)
	sort.Strings(inspection.UnsafePaths)
	return inspection, nil
}

func restoreProjectBackupArchive(archivePath, targetDir string) (projectBackupRestoreArchiveStats, error) {
	var stats projectBackupRestoreArchiveStats
	stagingDir, err := os.MkdirTemp(filepath.Dir(targetDir), ".project-restore-*")
	if err != nil {
		return stats, fmt.Errorf("create restore staging directory: %w", err)
	}
	publishStaging := false
	defer func() {
		if !publishStaging {
			_ = os.RemoveAll(stagingDir)
		}
	}()

	if err := extractProjectBackupArchiveToStaging(archivePath, stagingDir, &stats); err != nil {
		return stats, err
	}
	if err := publishProjectBackupRestoreStaging(stagingDir, targetDir); err != nil {
		return stats, err
	}
	publishStaging = true
	_ = os.RemoveAll(stagingDir)
	return stats, nil
}

func extractProjectBackupArchiveToStaging(archivePath, stagingDir string, stats *projectBackupRestoreArchiveStats) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return fmt.Errorf("open restore archive: %w", err)
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("open restore gzip archive: %w", err)
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read restore tar entry: %w", err)
		}
		cleanName, safe := cleanProjectBackupRestoreEntryName(header.Name, header.Typeflag)
		if !safe {
			return fmt.Errorf("unsafe restore archive entry: %s", header.Name)
		}
		targetPath, err := secureHostPathWithinProjectRoot(stagingDir, filepath.Join(stagingDir, filepath.FromSlash(cleanName)))
		if err != nil {
			return fmt.Errorf("resolve restore staging path %s: %w", cleanName, err)
		}
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, safeProjectBackupRestoreMode(header.FileInfo().Mode().Perm(), 0o755)); err != nil {
				return fmt.Errorf("create restore directory %s: %w", cleanName, err)
			}
			stats.DirectoryCount++
		case tar.TypeReg, 0:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
				return fmt.Errorf("create restore parent directory %s: %w", cleanName, err)
			}
			outFile, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, safeProjectBackupRestoreMode(header.FileInfo().Mode().Perm(), 0o644))
			if err != nil {
				return fmt.Errorf("create restore file %s: %w", cleanName, err)
			}
			if _, err := io.Copy(outFile, tarReader); err != nil {
				_ = outFile.Close()
				return fmt.Errorf("write restore file %s: %w", cleanName, err)
			}
			if err := outFile.Close(); err != nil {
				return fmt.Errorf("close restore file %s: %w", cleanName, err)
			}
			stats.FileCount++
		default:
			return fmt.Errorf("unsupported restore archive entry type %d at %s", header.Typeflag, cleanName)
		}
	}
	return nil
}

func publishProjectBackupRestoreStaging(stagingDir, targetDir string) error {
	entries, err := os.ReadDir(stagingDir)
	if err != nil {
		return fmt.Errorf("read restore staging directory: %w", err)
	}
	for _, entry := range entries {
		sourcePath := filepath.Join(stagingDir, entry.Name())
		targetPath, err := secureHostPathWithinProjectRoot(targetDir, filepath.Join(targetDir, entry.Name()))
		if err != nil {
			return fmt.Errorf("resolve restore target path %s: %w", entry.Name(), err)
		}
		if _, err := os.Lstat(targetPath); err == nil {
			return fmt.Errorf("restore target path already exists: %s", entry.Name())
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("inspect restore target path %s: %w", entry.Name(), err)
		}
		if err := os.Rename(sourcePath, targetPath); err != nil {
			return fmt.Errorf("publish restore path %s: %w", entry.Name(), err)
		}
	}
	return nil
}

func safeProjectBackupRestoreMode(mode fs.FileMode, fallback fs.FileMode) fs.FileMode {
	mode = mode.Perm()
	if mode == 0 {
		return fallback
	}
	return mode
}

func cleanProjectBackupRestoreEntryName(name string, typeflag byte) (string, bool) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" || strings.HasPrefix(trimmed, "/") || strings.Contains(trimmed, "\\") {
		return trimmed, false
	}
	cleanName := path.Clean(trimmed)
	if cleanName == "." || cleanName == ".." || strings.HasPrefix(cleanName, "../") {
		return cleanName, false
	}
	switch typeflag {
	case tar.TypeReg, 0, tar.TypeDir:
		return cleanName, true
	default:
		return cleanName, false
	}
}

func appendUniqueProjectBackupPath(paths *[]string, seen map[string]struct{}, value string) {
	if len(*paths) >= 25 {
		return
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		trimmed = "<empty>"
	}
	if _, ok := seen[trimmed]; ok {
		return
	}
	seen[trimmed] = struct{}{}
	*paths = append(*paths, trimmed)
}

func collectProjectBackupEntries(sourceDir string, maxProjectSize int64) ([]projectBackupEntry, []string, int64, error) {
	entries := make([]projectBackupEntry, 0)
	excludedPaths := make([]string, 0)
	var totalSize int64

	err := filepath.WalkDir(sourceDir, func(absPath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if absPath == sourceDir {
			return nil
		}
		relPath, err := filepath.Rel(sourceDir, absPath)
		if err != nil {
			return err
		}
		relPath = filepath.ToSlash(relPath)

		if entry.IsDir() {
			if _, excluded := projectBackupExcludedDirectoryNames[entry.Name()]; excluded {
				excludedPaths = append(excludedPaths, relPath)
				return filepath.SkipDir
			}
		}

		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			excludedPaths = append(excludedPaths, relPath)
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			excludedPaths = append(excludedPaths, relPath)
			return nil
		}
		if info.Mode().IsRegular() {
			totalSize += info.Size()
			if maxProjectSize > 0 && totalSize > maxProjectSize {
				return fmt.Errorf("project backup size exceeds configured limit: %d > %d", totalSize, maxProjectSize)
			}
		}

		entries = append(entries, projectBackupEntry{
			AbsPath: absPath,
			RelPath: relPath,
			Info:    info,
		})
		return nil
	})
	if err != nil {
		return nil, excludedPaths, totalSize, err
	}
	return entries, excludedPaths, totalSize, nil
}

func writeProjectBackupArchive(archivePath, sourceDir string, entries []projectBackupEntry) (int64, string, int, int, error) {
	tmpFile, err := os.CreateTemp(filepath.Dir(archivePath), ".project-backup-*.tar.gz")
	if err != nil {
		return 0, "", 0, 0, fmt.Errorf("create backup archive temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	renameArchive := false
	defer func() {
		if !renameArchive {
			_ = os.Remove(tmpPath)
		}
	}()

	hash := sha256.New()
	gzipWriter := gzip.NewWriter(io.MultiWriter(tmpFile, hash))
	tarWriter := tar.NewWriter(gzipWriter)

	fileCount := 0
	directoryCount := 0
	for _, entry := range entries {
		header, headerErr := tar.FileInfoHeader(entry.Info, "")
		if headerErr != nil {
			_ = tarWriter.Close()
			_ = gzipWriter.Close()
			_ = tmpFile.Close()
			return 0, "", 0, 0, fmt.Errorf("create tar header for %s: %w", entry.RelPath, headerErr)
		}
		header.Name = entry.RelPath
		if entry.Info.IsDir() && !strings.HasSuffix(header.Name, "/") {
			header.Name += "/"
		}
		if writeHeaderErr := tarWriter.WriteHeader(header); writeHeaderErr != nil {
			_ = tarWriter.Close()
			_ = gzipWriter.Close()
			_ = tmpFile.Close()
			return 0, "", 0, 0, fmt.Errorf("write tar header for %s: %w", entry.RelPath, writeHeaderErr)
		}
		if entry.Info.IsDir() {
			directoryCount++
			continue
		}
		fileCount++
		if copyErr := copyProjectBackupFile(tarWriter, sourceDir, entry); copyErr != nil {
			_ = tarWriter.Close()
			_ = gzipWriter.Close()
			_ = tmpFile.Close()
			return 0, "", 0, 0, copyErr
		}
	}

	if closeTarErr := tarWriter.Close(); closeTarErr != nil {
		_ = gzipWriter.Close()
		_ = tmpFile.Close()
		return 0, "", 0, 0, fmt.Errorf("close tar archive: %w", closeTarErr)
	}
	if closeGzipErr := gzipWriter.Close(); closeGzipErr != nil {
		_ = tmpFile.Close()
		return 0, "", 0, 0, fmt.Errorf("close gzip archive: %w", closeGzipErr)
	}
	if closeFileErr := tmpFile.Close(); closeFileErr != nil {
		return 0, "", 0, 0, fmt.Errorf("close backup archive temp file: %w", closeFileErr)
	}
	if renameErr := os.Rename(tmpPath, archivePath); renameErr != nil {
		return 0, "", 0, 0, fmt.Errorf("publish backup archive: %w", renameErr)
	}
	renameArchive = true

	info, err := os.Stat(archivePath)
	if err != nil {
		return 0, "", 0, 0, fmt.Errorf("stat backup archive: %w", err)
	}
	return info.Size(), hex.EncodeToString(hash.Sum(nil)), fileCount, directoryCount, nil
}

func copyProjectBackupFile(writer *tar.Writer, sourceDir string, entry projectBackupEntry) error {
	safePath, err := secureHostPathWithinProjectRoot(sourceDir, entry.AbsPath)
	if err != nil {
		return err
	}
	file, err := os.Open(safePath)
	if err != nil {
		return fmt.Errorf("open backup source file %s: %w", entry.RelPath, err)
	}
	defer file.Close()
	if _, err := io.Copy(writer, file); err != nil {
		return fmt.Errorf("copy backup source file %s: %w", entry.RelPath, err)
	}
	return nil
}

func writeProjectBackupManifest(manifestPath string, manifest projectBackupManifest) error {
	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal backup manifest: %w", err)
	}
	data = append(data, '\n')

	tmpFile, err := os.CreateTemp(filepath.Dir(manifestPath), ".project-backup-*.manifest.json")
	if err != nil {
		return fmt.Errorf("create backup manifest temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	renameManifest := false
	defer func() {
		if !renameManifest {
			_ = os.Remove(tmpPath)
		}
	}()
	if _, err := tmpFile.Write(data); err != nil {
		_ = tmpFile.Close()
		return fmt.Errorf("write backup manifest temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("close backup manifest temp file: %w", err)
	}
	if err := os.Rename(tmpPath, manifestPath); err != nil {
		return fmt.Errorf("publish backup manifest: %w", err)
	}
	renameManifest = true
	return nil
}

func writeProjectBackupRemoteDownloadedManifestTemp(backupRoot string, manifestBytes []byte) (string, error) {
	if len(manifestBytes) == 0 {
		return "", fmt.Errorf("remote backup manifest is empty")
	}
	tmpFile, err := os.CreateTemp(backupRoot, ".remote-backup-download-*.manifest.json")
	if err != nil {
		return "", fmt.Errorf("create remote backup manifest temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	keepTmp := false
	defer func() {
		if !keepTmp {
			_ = os.Remove(tmpPath)
		}
	}()
	if _, err := tmpFile.Write(manifestBytes); err != nil {
		_ = tmpFile.Close()
		return "", fmt.Errorf("write remote backup manifest temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return "", fmt.Errorf("close remote backup manifest temp file: %w", err)
	}
	keepTmp = true
	return tmpPath, nil
}
