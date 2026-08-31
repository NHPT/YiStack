package service

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type ProjectRuntimeStatus struct {
	ProjectID                       string `json:"projectId,omitempty"`
	TaskID                          string `json:"taskId,omitempty"`
	Status                          string `json:"status"`
	ContainerStatus                 string `json:"containerStatus,omitempty"`
	InternalPort                    int    `json:"internalPort,omitempty"`
	PreviewURL                      string `json:"previewUrl,omitempty"`
	Phase                           string `json:"phase,omitempty"`
	Message                         string `json:"message,omitempty"`
	Error                           string `json:"error,omitempty"`
	SpecHash                        string `json:"specHash,omitempty"`
	ContainerStatusPersistence      string `json:"containerStatusPersistence,omitempty"`
	ContainerStatusPersistenceError string `json:"containerStatusPersistenceError,omitempty"`
	PersistenceStatus               string `json:"persistenceStatus,omitempty"`
	PersistenceError                string `json:"persistenceError,omitempty"`
	StartedAt                       string `json:"startedAt,omitempty"`
	UpdatedAt                       string `json:"updatedAt,omitempty"`
	CompletedAt                     string `json:"completedAt,omitempty"`
}

type ProjectRuntimeActivityStatus struct {
	ProjectID       string `json:"projectId,omitempty"`
	ActivityStatus  string `json:"activityStatus"`
	ContainerStatus string `json:"containerStatus,omitempty"`
	Source          string `json:"source,omitempty"`
	Message         string `json:"message,omitempty"`
	Error           string `json:"error,omitempty"`
	UpdatedAt       string `json:"updatedAt,omitempty"`
}

type runtimePreparationTask struct {
	TaskID    string
	ProjectID string
}

var runtimePreparationTasks sync.Map

func newRuntimeTask(projectID string) *runtimePreparationTask {
	return &runtimePreparationTask{
		TaskID:    fmt.Sprintf("rt_%d", time.Now().UnixNano()),
		ProjectID: projectID,
	}
}

func runtimeStatusNow() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func runtimeStateDir(projectDir string) string {
	safeProjectDir, err := secureHostPathWithinProjectRoot(currentProjectRootDir(), projectDir)
	if err != nil {
		return ""
	}
	return filepath.Join(safeProjectDir, ".yistack")
}

func runtimeEnvironmentStatePath(projectDir string) string {
	return filepath.Join(runtimeStateDir(projectDir), "environment.json")
}

func runtimeStatusPath(projectDir string) string {
	return filepath.Join(runtimeStateDir(projectDir), "runtime-status.json")
}

func readRuntimeEnvironmentState(projectDir string) (*runtimeEnvironmentState, error) {
	if strings.TrimSpace(projectDir) == "" {
		return nil, nil
	}
	path := runtimeEnvironmentStatePath(projectDir)
	if path == "" {
		return nil, fmt.Errorf("unsafe runtime environment state path")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var state runtimeEnvironmentState
	if err := json.Unmarshal(data, &state); err != nil {
		log.Printf("Warning: invalid runtime environment state at %s: %v", path, err)
		archiveBrokenRuntimeStateFile(path)
		return nil, nil
	}
	return &state, nil
}

func runtimeEnvironmentReady(projectDir string, spec runtimeEnvironmentSpec) bool {
	state, err := readRuntimeEnvironmentState(projectDir)
	if err != nil || state == nil {
		return false
	}
	return strings.TrimSpace(state.SpecHash) != "" && state.SpecHash == runtimeSpecHash(spec)
}

func readProjectRuntimeStatus(projectDir string) (*ProjectRuntimeStatus, error) {
	if strings.TrimSpace(projectDir) == "" {
		return nil, nil
	}
	path := runtimeStatusPath(projectDir)
	if path == "" {
		return nil, fmt.Errorf("unsafe runtime status path")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var status ProjectRuntimeStatus
	if err := json.Unmarshal(data, &status); err != nil {
		log.Printf("Warning: invalid runtime status at %s: %v", path, err)
		archiveBrokenRuntimeStateFile(path)
		return nil, fmt.Errorf("invalid runtime status snapshot: %w", err)
	}
	return &status, nil
}

func writeProjectRuntimeStatus(projectDir string, status *ProjectRuntimeStatus) error {
	if strings.TrimSpace(projectDir) == "" || status == nil {
		return nil
	}
	safeProjectDir, err := secureHostPathWithinProjectRoot(currentProjectRootDir(), projectDir)
	if err != nil {
		markProjectRuntimeStatusPersistenceFailure(status, err)
		return err
	}
	status.UpdatedAt = runtimeStatusNow()
	status.PersistenceStatus = "persisted"
	status.PersistenceError = ""
	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		markProjectRuntimeStatusPersistenceFailure(status, err)
		return err
	}
	dir := runtimeStateDir(safeProjectDir)
	if dir == "" {
		err := fmt.Errorf("unsafe runtime status directory")
		markProjectRuntimeStatusPersistenceFailure(status, err)
		return err
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		markProjectRuntimeStatusPersistenceFailure(status, err)
		return err
	}
	if err := writeRuntimeStateFileAtomically(runtimeStatusPath(safeProjectDir), data, 0644); err != nil {
		markProjectRuntimeStatusPersistenceFailure(status, err)
		return err
	}
	return nil
}

func setProjectRuntimeStatus(projectDir string, status ProjectRuntimeStatus) ProjectRuntimeStatus {
	if status.StartedAt == "" {
		status.StartedAt = runtimeStatusNow()
	}
	_ = writeProjectRuntimeStatus(projectDir, &status)
	return status
}

func setProjectRuntimeFailure(projectDir, projectID, taskID, containerStatus, phase string, err error) ProjectRuntimeStatus {
	status := ProjectRuntimeStatus{
		ProjectID:       projectID,
		TaskID:          taskID,
		Status:          "failed",
		ContainerStatus: containerStatus,
		Phase:           phase,
		Message:         "运行时环境准备失败",
		StartedAt:       runtimeStatusNow(),
		CompletedAt:     runtimeStatusNow(),
	}
	if err != nil {
		status.Error = err.Error()
	}
	_ = writeProjectRuntimeStatus(projectDir, &status)
	return status
}

func markProjectRuntimeStatusPersistenceFailure(status *ProjectRuntimeStatus, err error) {
	if status == nil || err == nil {
		return
	}
	status.PersistenceStatus = "failed"
	status.PersistenceError = err.Error()
	status.UpdatedAt = runtimeStatusNow()
	log.Printf("Warning: failed to persist runtime status for project %s: %v", status.ProjectID, err)
}

func writeRuntimeStateFileAtomically(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	success := false
	defer func() {
		_ = tmp.Close()
		if !success {
			_ = os.Remove(tmpPath)
		}
	}()

	if err := tmp.Chmod(perm); err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	success = true
	return nil
}

func archiveBrokenRuntimeStateFile(path string) {
	if strings.TrimSpace(path) == "" {
		return
	}
	brokenPath := fmt.Sprintf("%s.corrupt-%d", path, time.Now().UnixNano())
	if err := os.Rename(path, brokenPath); err != nil && !os.IsNotExist(err) {
		log.Printf("Warning: failed to archive broken runtime state file %s: %v", path, err)
	}
}
