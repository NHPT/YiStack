package service

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"yistack/internal/model"
	"yistack/pkg/utils"
)

const (
	projectRemoteDeletionStagingPrefix = ".yistack-remote-user-delete-"
	projectRemoteDeletionStagingSchema = "user_project_remote_backup_deletion_staging.v1"
	projectRemoteDeletionManifest      = "remote-manifest.json"
	projectRemoteDeletionKeySegment    = ".yistack-user-delete-staging"
)

type projectRemoteDeletionObject struct {
	SourceKey  string `json:"source_key"`
	StagingKey string `json:"staging_key"`
}

type projectBackupS3CopyResponse struct {
	XMLName xml.Name
	Code    string `xml:"Code"`
	Message string `xml:"Message"`
}

type projectRemoteDeletionStagingRecord struct {
	SchemaVersion string                        `json:"schema_version"`
	UserID        string                        `json:"user_id"`
	ProjectID     string                        `json:"project_id"`
	Provider      string                        `json:"provider"`
	Bucket        string                        `json:"bucket"`
	Endpoint      string                        `json:"endpoint"`
	Region        string                        `json:"region"`
	Objects       []projectRemoteDeletionObject `json:"objects"`
}

type stagedProjectRemoteBackup struct {
	controlRoot string
	record      projectRemoteDeletionStagingRecord
	remote      projectBackupS3RemoteConfig
	client      projectBackupRemoteHTTPClient
}

func (s *ProjectService) projectRemoteDeletionConfiguration(
	ctx context.Context,
) (string, projectBackupS3RemoteConfig, projectBackupRemoteHTTPClient, bool, error) {
	projectCfg := s.projectBackupConfig(ctx)
	secretCfg := s.projectSecretConfig()
	provider := strings.ToLower(strings.TrimSpace(projectCfg.RemoteBackupProvider))
	bucket := strings.TrimSpace(projectCfg.RemoteBackupBucket)
	accessKeyID := strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID)
	secretAccessKey := strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey)
	hasRemoteConfiguration := projectCfg.RemoteBackupEnabled ||
		projectCfg.RemoteBackupCredentials ||
		provider != "" ||
		bucket != "" ||
		accessKeyID != "" ||
		secretAccessKey != ""
	if !hasRemoteConfiguration {
		return "", projectBackupS3RemoteConfig{}, nil, false, nil
	}
	if provider != "s3" {
		return "", projectBackupS3RemoteConfig{}, nil, false,
			fmt.Errorf("remote backup provider is not supported for deletion: %s", provider)
	}
	if bucket == "" || accessKeyID == "" || secretAccessKey == "" {
		return "", projectBackupS3RemoteConfig{}, nil, false,
			fmt.Errorf("remote backup deletion requires bucket and credentials")
	}
	backupRoot := strings.TrimSpace(projectCfg.BackupDir)
	if backupRoot == "" {
		return "", projectBackupS3RemoteConfig{}, nil, false,
			fmt.Errorf("remote backup deletion requires a local staging directory")
	}
	client := s.backupRemoteHTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	return backupRoot, projectBackupS3RemoteConfig{
		Prefix:          strings.TrimSpace(projectCfg.RemoteBackupPrefix),
		Provider:        provider,
		Bucket:          bucket,
		Endpoint:        strings.TrimSpace(projectCfg.RemoteBackupEndpoint),
		Region:          strings.TrimSpace(projectCfg.RemoteBackupRegion),
		AccessKeyID:     accessKeyID,
		SecretAccessKey: secretAccessKey,
	}, client, true, nil
}

func (s *ProjectService) stageUserProjectRemoteBackups(
	ctx context.Context,
	userID string,
	projects []model.Project,
) ([]stagedProjectRemoteBackup, error) {
	backupRoot, remote, client, configured, err := s.projectRemoteDeletionConfiguration(ctx)
	if err != nil || !configured {
		return nil, err
	}
	if err := os.MkdirAll(backupRoot, 0o750); err != nil {
		return nil, fmt.Errorf("create remote backup deletion staging root: %w", err)
	}

	staged := make([]stagedProjectRemoteBackup, 0, len(projects))
	for i := range projects {
		projectID := strings.TrimSpace(projects[i].ProjectID)
		if projectID == "" {
			return staged, fmt.Errorf("project id is required")
		}
		sourcePrefix := buildProjectBackupRemoteObjectKey(
			remote.Prefix,
			projectID,
			"",
			"",
		)
		if sourcePrefix == "" {
			return staged, fmt.Errorf("remote backup deletion prefix is empty")
		}
		sourcePrefix += "/"
		objects, listErr := listProjectBackupS3Objects(ctx, client, remote, sourcePrefix)
		if listErr != nil {
			return staged, fmt.Errorf("list project remote backup objects: %w", listErr)
		}
		if len(objects) == 0 {
			continue
		}

		controlRoot, createErr := os.MkdirTemp(backupRoot, projectRemoteDeletionStagingPrefix)
		if createErr != nil {
			return staged, fmt.Errorf("create remote backup deletion staging: %w", createErr)
		}
		stageToken := utils.GenerateUUID()
		record := projectRemoteDeletionStagingRecord{
			SchemaVersion: projectRemoteDeletionStagingSchema,
			UserID:        strings.TrimSpace(userID),
			ProjectID:     projectID,
			Provider:      remote.Provider,
			Bucket:        remote.Bucket,
			Endpoint:      remote.Endpoint,
			Region:        remote.Region,
			Objects:       make([]projectRemoteDeletionObject, 0, len(objects)),
		}
		for _, object := range objects {
			if !strings.HasPrefix(object.Key, sourcePrefix) {
				return staged, fmt.Errorf("refuse object outside project prefix: %s", object.Key)
			}
			relativeKey := strings.TrimPrefix(object.Key, sourcePrefix)
			if relativeKey == "" {
				return staged, fmt.Errorf("remote backup object has an empty relative key")
			}
			record.Objects = append(record.Objects, projectRemoteDeletionObject{
				SourceKey: object.Key,
				StagingKey: buildProjectBackupRemoteObjectKey(
					remote.Prefix,
					projectRemoteDeletionKeySegment,
					strings.TrimSpace(userID),
					projectID,
					stageToken,
					relativeKey,
				),
			})
		}
		stage := stagedProjectRemoteBackup{
			controlRoot: controlRoot,
			record:      record,
			remote:      remote,
			client:      client,
		}
		staged = append(staged, stage)
		if writeErr := writeProjectRemoteDeletionStagingRecord(controlRoot, record); writeErr != nil {
			return staged, writeErr
		}
		for _, object := range record.Objects {
			if copyErr := copyProjectBackupS3Object(
				ctx,
				client,
				remote,
				object.SourceKey,
				object.StagingKey,
			); copyErr != nil {
				return staged, fmt.Errorf("stage remote backup object %s: %w", object.SourceKey, copyErr)
			}
		}
		for _, object := range record.Objects {
			if deleteErr := deleteProjectBackupS3Object(ctx, client, remote, object.SourceKey); deleteErr != nil {
				return staged, fmt.Errorf("delete staged remote backup object %s: %w", object.SourceKey, deleteErr)
			}
		}
	}
	return staged, nil
}

func writeProjectRemoteDeletionStagingRecord(
	controlRoot string,
	record projectRemoteDeletionStagingRecord,
) error {
	encoded, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("encode remote backup deletion staging manifest: %w", err)
	}
	if err := os.WriteFile(
		filepath.Join(controlRoot, projectRemoteDeletionManifest),
		encoded,
		0o600,
	); err != nil {
		return fmt.Errorf("write remote backup deletion staging manifest: %w", err)
	}
	return nil
}

func readProjectRemoteDeletionStagingRecord(
	controlRoot string,
) (projectRemoteDeletionStagingRecord, error) {
	var record projectRemoteDeletionStagingRecord
	raw, err := os.ReadFile(filepath.Join(controlRoot, projectRemoteDeletionManifest))
	if err != nil {
		return record, err
	}
	if err := json.Unmarshal(raw, &record); err != nil {
		return record, err
	}
	if record.SchemaVersion != projectRemoteDeletionStagingSchema ||
		strings.TrimSpace(record.UserID) == "" ||
		strings.TrimSpace(record.ProjectID) == "" ||
		record.Provider != "s3" ||
		strings.TrimSpace(record.Bucket) == "" ||
		len(record.Objects) == 0 {
		return record, fmt.Errorf("invalid remote backup deletion staging manifest")
	}
	for _, object := range record.Objects {
		if strings.TrimSpace(object.SourceKey) == "" ||
			strings.TrimSpace(object.StagingKey) == "" {
			return record, fmt.Errorf("invalid remote backup deletion staging object")
		}
	}
	return record, nil
}

func restoreStagedProjectRemoteBackups(
	ctx context.Context,
	staged []stagedProjectRemoteBackup,
) error {
	var restoreErrors []string
	for i := range staged {
		stage := &staged[i]
		stageFailed := false
		for _, object := range stage.record.Objects {
			exists, err := projectBackupS3ObjectExists(
				ctx,
				stage.client,
				stage.remote,
				object.StagingKey,
			)
			if err != nil {
				restoreErrors = append(restoreErrors, fmt.Sprintf("inspect staged remote object %s: %v", object.StagingKey, err))
				stageFailed = true
				continue
			}
			if !exists {
				sourceExists, sourceErr := projectBackupS3ObjectExists(
					ctx,
					stage.client,
					stage.remote,
					object.SourceKey,
				)
				if sourceErr != nil || !sourceExists {
					restoreErrors = append(restoreErrors, fmt.Sprintf("remote backup staging copy is missing for %s", object.SourceKey))
					stageFailed = true
				}
				continue
			}
			if err := copyProjectBackupS3Object(
				ctx,
				stage.client,
				stage.remote,
				object.StagingKey,
				object.SourceKey,
			); err != nil {
				restoreErrors = append(restoreErrors, fmt.Sprintf("restore remote backup object %s: %v", object.SourceKey, err))
				stageFailed = true
			}
		}
		if stageFailed {
			continue
		}
		if err := discardStagedProjectRemoteBackup(ctx, *stage); err != nil {
			restoreErrors = append(restoreErrors, err.Error())
		}
	}
	if len(restoreErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(restoreErrors, " | "))
	}
	return nil
}

func markStagedProjectRemoteBackupsCommitted(staged []stagedProjectRemoteBackup) error {
	var markerErrors []string
	for _, stage := range staged {
		if err := os.WriteFile(
			filepath.Join(stage.controlRoot, projectDeletionCommittedMarker),
			[]byte("committed\n"),
			0o600,
		); err != nil {
			markerErrors = append(markerErrors, err.Error())
		}
	}
	if len(markerErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(markerErrors, " | "))
	}
	return nil
}

func discardStagedProjectRemoteBackups(
	ctx context.Context,
	staged []stagedProjectRemoteBackup,
) error {
	var cleanupErrors []string
	for _, stage := range staged {
		if err := discardStagedProjectRemoteBackup(ctx, stage); err != nil {
			cleanupErrors = append(cleanupErrors, err.Error())
		}
	}
	if len(cleanupErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(cleanupErrors, " | "))
	}
	return nil
}

func discardStagedProjectRemoteBackup(
	ctx context.Context,
	stage stagedProjectRemoteBackup,
) error {
	var cleanupErrors []string
	for _, object := range stage.record.Objects {
		if err := deleteProjectBackupS3Object(
			ctx,
			stage.client,
			stage.remote,
			object.StagingKey,
		); err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Sprintf("delete remote staging object %s: %v", object.StagingKey, err))
		}
	}
	if len(cleanupErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(cleanupErrors, " | "))
	}
	if err := os.RemoveAll(stage.controlRoot); err != nil {
		return fmt.Errorf("remove remote backup staging control directory: %w", err)
	}
	return nil
}

func retryDiscardStagedProjectRemoteBackups(staged []stagedProjectRemoteBackup) {
	if len(staged) == 0 {
		return
	}
	snapshot := append([]stagedProjectRemoteBackup(nil), staged...)
	go func() {
		var cleanupErr error
		for attempt := 0; attempt < 12; attempt++ {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			cleanupErr = discardStagedProjectRemoteBackups(cleanupCtx, snapshot)
			cancel()
			if cleanupErr == nil {
				return
			}
			time.Sleep(time.Duration(attempt+1) * time.Second)
		}
	}()
}

func (s *ProjectService) recoverProjectRemoteDeletionStaging(
	ctx context.Context,
	backupRoot string,
) error {
	backupRoot = strings.TrimSpace(backupRoot)
	if backupRoot == "" {
		return nil
	}
	entries, err := os.ReadDir(backupRoot)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read remote backup staging root: %w", err)
	}
	deletionRepo, supportsDeletionLookup := s.projectRepo.(userProjectDeletionRepository)
	secretCfg := s.projectSecretConfig()
	client := s.backupRemoteHTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	projectIDsByUser := make(map[string]map[string]struct{})
	var recoveryErrors []string
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), projectRemoteDeletionStagingPrefix) {
			continue
		}
		if !supportsDeletionLookup {
			recoveryErrors = append(recoveryErrors, "project deletion recovery lookup is unavailable")
			continue
		}
		controlRoot := filepath.Join(backupRoot, entry.Name())
		record, readErr := readProjectRemoteDeletionStagingRecord(controlRoot)
		if readErr != nil {
			recoveryErrors = append(recoveryErrors, fmt.Sprintf("read remote backup staging %s: %v", controlRoot, readErr))
			continue
		}
		projectsForUser, loaded := projectIDsByUser[record.UserID]
		if !loaded {
			projects, listErr := deletionRepo.ListByUserIDIncludingDeleted(ctx, record.UserID)
			if listErr != nil {
				recoveryErrors = append(recoveryErrors, fmt.Sprintf("list projects for remote staging %s: %v", controlRoot, listErr))
				continue
			}
			projectsForUser = make(map[string]struct{}, len(projects))
			for i := range projects {
				projectsForUser[projects[i].ProjectID] = struct{}{}
			}
			projectIDsByUser[record.UserID] = projectsForUser
		}
		stage := stagedProjectRemoteBackup{
			controlRoot: controlRoot,
			record:      record,
			remote: projectBackupS3RemoteConfig{
				Provider:        record.Provider,
				Bucket:          record.Bucket,
				Endpoint:        record.Endpoint,
				Region:          record.Region,
				AccessKeyID:     strings.TrimSpace(secretCfg.RemoteBackupAccessKeyID),
				SecretAccessKey: strings.TrimSpace(secretCfg.RemoteBackupSecretAccessKey),
			},
			client: client,
		}
		if stage.remote.AccessKeyID == "" || stage.remote.SecretAccessKey == "" {
			recoveryErrors = append(recoveryErrors, fmt.Sprintf("remote backup credentials are unavailable for staging %s", controlRoot))
			continue
		}
		_, projectExists := projectsForUser[record.ProjectID]
		markerInfo, markerErr := os.Lstat(filepath.Join(controlRoot, projectDeletionCommittedMarker))
		committed := markerErr == nil && markerInfo.Mode().IsRegular()
		if markerErr != nil && !os.IsNotExist(markerErr) {
			recoveryErrors = append(recoveryErrors, fmt.Sprintf("inspect remote staging marker %s: %v", controlRoot, markerErr))
			continue
		}
		if markerErr == nil && !committed {
			recoveryErrors = append(recoveryErrors, fmt.Sprintf("remote staging marker is not a regular file: %s", controlRoot))
			continue
		}
		if !projectExists || committed {
			if discardErr := discardStagedProjectRemoteBackup(ctx, stage); discardErr != nil {
				recoveryErrors = append(recoveryErrors, discardErr.Error())
			}
			continue
		}
		if restoreErr := restoreStagedProjectRemoteBackups(ctx, []stagedProjectRemoteBackup{stage}); restoreErr != nil {
			recoveryErrors = append(recoveryErrors, restoreErr.Error())
		}
	}
	if len(recoveryErrors) > 0 {
		return fmt.Errorf("%s", strings.Join(recoveryErrors, " | "))
	}
	return nil
}

func copyProjectBackupS3Object(
	ctx context.Context,
	client projectBackupRemoteHTTPClient,
	remote projectBackupS3RemoteConfig,
	sourceKey string,
	targetKey string,
) error {
	endpoint, err := buildProjectBackupS3ObjectURL(remote, targetKey)
	if err != nil {
		return err
	}
	payloadHash := emptyProjectBackupS3PayloadHash()
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, nil)
	if err != nil {
		return fmt.Errorf("build remote copy request: %w", err)
	}
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	req.Header.Set(
		"X-Amz-Copy-Source",
		"/"+url.PathEscape(remote.Bucket)+"/"+escapeProjectBackupS3ObjectKey(sourceKey),
	)
	signProjectBackupS3Request(req, remote, payloadHash, time.Now().UTC())
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("remote copy request failed: %w", err)
	}
	defer resp.Body.Close()
	bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if readErr != nil {
		return fmt.Errorf("read remote copy response: %w", readErr)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf(
			"remote copy returned status %d: %s",
			resp.StatusCode,
			strings.TrimSpace(string(bodyBytes)),
		)
	}
	var copyResponse projectBackupS3CopyResponse
	if err := xml.Unmarshal(bodyBytes, &copyResponse); err != nil {
		return fmt.Errorf("decode remote copy response: %w", err)
	}
	switch copyResponse.XMLName.Local {
	case "Error":
		return fmt.Errorf(
			"remote copy returned embedded error %s: %s",
			strings.TrimSpace(copyResponse.Code),
			strings.TrimSpace(copyResponse.Message),
		)
	case "CopyObjectResult":
	default:
		return fmt.Errorf(
			"remote copy returned unexpected response root %q",
			copyResponse.XMLName.Local,
		)
	}
	exists, err := projectBackupS3ObjectExists(ctx, client, remote, targetKey)
	if err != nil {
		return fmt.Errorf("confirm remote copy target: %w", err)
	}
	if !exists {
		return fmt.Errorf("remote copy target is missing after successful response")
	}
	return nil
}

func projectBackupS3ObjectExists(
	ctx context.Context,
	client projectBackupRemoteHTTPClient,
	remote projectBackupS3RemoteConfig,
	objectKey string,
) (bool, error) {
	endpoint, err := buildProjectBackupS3ObjectURL(remote, objectKey)
	if err != nil {
		return false, err
	}
	payloadHash := emptyProjectBackupS3PayloadHash()
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, endpoint, nil)
	if err != nil {
		return false, fmt.Errorf("build remote object head request: %w", err)
	}
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	signProjectBackupS3Request(req, remote, payloadHash, time.Now().UTC())
	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("remote object head request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return false, fmt.Errorf("remote object head returned status %d", resp.StatusCode)
	}
	return true, nil
}
