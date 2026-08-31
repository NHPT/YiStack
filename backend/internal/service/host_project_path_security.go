package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"yistack/config"
)

var (
	configuredProjectRootDir   string
	configuredProjectRootDirMu sync.RWMutex
)

func configureProjectRootDir(containerCfg *config.ContainerConfig) {
	root := ""
	if containerCfg != nil {
		root = strings.TrimSpace(containerCfg.ProjectDir)
	}

	configuredProjectRootDirMu.Lock()
	configuredProjectRootDir = root
	configuredProjectRootDirMu.Unlock()
}

func currentProjectRootDir() string {
	configuredProjectRootDirMu.RLock()
	defer configuredProjectRootDirMu.RUnlock()
	return configuredProjectRootDir
}

func secureProjectHostDirectory(baseDir, projectID, projectDir string) (string, error) {
	baseDir = strings.TrimSpace(baseDir)
	projectID = strings.TrimSpace(projectID)
	projectDir = strings.TrimSpace(projectDir)

	if baseDir == "" {
		return "", fmt.Errorf("project root directory is not configured")
	}
	if projectID == "" {
		return "", fmt.Errorf("project id is required")
	}
	if projectDir == "" {
		return "", fmt.Errorf("project directory is required")
	}

	cleanBase, err := secureHostPathWithinProjectRoot(baseDir, projectDir)
	if err != nil {
		return "", err
	}

	expectedDir, err := canonicalHostPath(filepath.Join(filepath.Clean(baseDir), projectID))
	if err != nil {
		return "", err
	}
	if cleanBase != expectedDir {
		return "", fmt.Errorf("unexpected project directory: %s", projectDir)
	}
	return cleanBase, nil
}

func secureHostPathWithinProjectRoot(baseDir, targetPath string) (string, error) {
	baseDir = strings.TrimSpace(baseDir)
	targetPath = strings.TrimSpace(targetPath)

	if baseDir == "" {
		return "", fmt.Errorf("project root directory is not configured")
	}
	if targetPath == "" {
		return "", fmt.Errorf("target path is required")
	}

	cleanBase, err := canonicalHostPath(filepath.Clean(baseDir))
	if err != nil {
		return "", err
	}
	cleanTarget, err := canonicalHostPath(filepath.Clean(targetPath))
	if err != nil {
		return "", err
	}
	if cleanTarget == "/" || cleanTarget == "." || cleanTarget == cleanBase {
		return "", fmt.Errorf("refuse to use unsafe path: %s", targetPath)
	}

	rel, err := filepath.Rel(cleanBase, cleanTarget)
	if err != nil {
		return "", fmt.Errorf("resolve path relation: %w", err)
	}
	if rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes project root: %s", targetPath)
	}

	if err := rejectSymlinkPathComponents(cleanBase, cleanTarget); err != nil {
		return "", err
	}

	return cleanTarget, nil
}

func canonicalHostPath(path string) (string, error) {
	path = filepath.Clean(path)
	if resolved, err := filepath.EvalSymlinks(path); err == nil {
		return filepath.Clean(resolved), nil
	}

	parent := filepath.Dir(path)
	if resolvedParent, err := filepath.EvalSymlinks(parent); err == nil {
		return filepath.Join(filepath.Clean(resolvedParent), filepath.Base(path)), nil
	}

	return path, nil
}

func rejectSymlinkPathComponents(baseDir, targetPath string) error {
	current := filepath.Clean(targetPath)
	baseDir = filepath.Clean(baseDir)

	for {
		info, err := os.Lstat(current)
		if err == nil {
			if info.Mode()&os.ModeSymlink != 0 {
				return fmt.Errorf("symlink path is not allowed: %s", current)
			}
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("inspect path %s: %w", current, err)
		}

		if current == baseDir {
			break
		}
		next := filepath.Dir(current)
		if next == current {
			break
		}
		current = next
	}

	return nil
}
