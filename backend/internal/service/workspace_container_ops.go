package service

import (
	"archive/tar"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	pathpkg "path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"yistack/pkg/container"
	"yistack/pkg/file"
)

var validProjectRelativePathPattern = regexp.MustCompile(`^[^\x00-\x1F\x7F\\]+$`)

func normalizeProjectRelativePath(filePath string) (string, error) {
	normalized := strings.TrimSpace(filePath)
	if normalized == "" {
		return "", errors.New("file path is required")
	}
	if !utf8.ValidString(normalized) || strings.ContainsRune(normalized, utf8.RuneError) {
		return "", errors.New("invalid file path")
	}
	if !validProjectRelativePathPattern.MatchString(normalized) {
		return "", errors.New("invalid file path")
	}

	normalized = pathpkg.Clean(strings.ReplaceAll(normalized, "\\", "/"))
	switch normalized {
	case ".", "/":
		return "", errors.New("file path is required")
	}
	if strings.HasPrefix(normalized, "/") {
		return "", errors.New("absolute path is not allowed")
	}
	if normalized == ".." || strings.HasPrefix(normalized, "../") || strings.Contains(normalized, "/../") {
		return "", errors.New("path traversal is not allowed")
	}
	return normalized, nil
}

func buildWorkspacePath(filePath string) string {
	return pathpkg.Join("/workspace", filePath)
}

func isContainerArchiveNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "status 404") || strings.Contains(message, "No such file")
}

func ensureContainerPathExists(ctx context.Context, containerMgr *container.Manager, projectID, normalizedPath string) (bool, error) {
	result, err := containerMgr.RunCommandArgs(ctx, projectID, []string{"test", "-e", buildWorkspacePath(normalizedPath)}, "/workspace", 120)
	if err != nil {
		return false, fmt.Errorf("failed to stat path in container: %w", err)
	}
	if result.ExitCode == 0 {
		return true, nil
	}
	if result.ExitCode == 1 {
		return false, nil
	}
	return false, classifyWorkspacePathError(strings.TrimSpace(result.Stderr), normalizedPath, "stat path in container")
}

func ensureContainerPathNotSymlink(ctx context.Context, containerMgr *container.Manager, projectID, normalizedPath string) error {
	result, err := containerMgr.RunCommandArgs(ctx, projectID, []string{"test", "-L", buildWorkspacePath(normalizedPath)}, "/workspace", 120)
	if err != nil {
		return fmt.Errorf("failed to inspect symlink in container: %w", err)
	}
	if result.ExitCode == 0 {
		return fmt.Errorf("symlink path is not allowed: %s", normalizedPath)
	}
	if result.ExitCode == 1 {
		return nil
	}
	return classifyWorkspacePathError(strings.TrimSpace(result.Stderr), normalizedPath, "inspect symlink in container")
}

func writeArchiveDirectoryEntry(writer *tar.Writer, name string) error {
	return writer.WriteHeader(&tar.Header{
		Name:     name + "/",
		Typeflag: tar.TypeDir,
		Mode:     0o755,
	})
}

func buildWorkspaceArchiveWithParents(normalizedPath string, content []byte, isDir bool) ([]byte, error) {
	var buffer bytes.Buffer
	writer := tar.NewWriter(&buffer)

	parent := pathpkg.Dir(normalizedPath)
	if parent != "." {
		current := ""
		for _, segment := range strings.Split(parent, "/") {
			if segment == "" {
				continue
			}
			current = pathpkg.Join(current, segment)
			if err := writeArchiveDirectoryEntry(writer, current); err != nil {
				_ = writer.Close()
				return nil, err
			}
		}
	}

	if isDir {
		if err := writeArchiveDirectoryEntry(writer, normalizedPath); err != nil {
			_ = writer.Close()
			return nil, err
		}
		if err := writer.Close(); err != nil {
			return nil, err
		}
		return buffer.Bytes(), nil
	}

	if err := writer.WriteHeader(&tar.Header{
		Name:     normalizedPath,
		Typeflag: tar.TypeReg,
		Mode:     0o644,
		Size:     int64(len(content)),
	}); err != nil {
		_ = writer.Close()
		return nil, err
	}
	if _, err := writer.Write(content); err != nil {
		_ = writer.Close()
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}

func readFileFromWorkspaceArchive(archive []byte, normalizedPath string) (string, error) {
	reader := tar.NewReader(bytes.NewReader(archive))
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", fmt.Errorf("failed to read container archive: %w", err)
		}
		if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
			return "", fmt.Errorf("symlink path is not allowed: %s", normalizedPath)
		}
		if header.Typeflag == tar.TypeDir {
			continue
		}
		if header.Typeflag != tar.TypeReg && header.Typeflag != tar.TypeRegA {
			continue
		}
		content, err := io.ReadAll(reader)
		if err != nil {
			return "", fmt.Errorf("failed to read file from container archive: %w", err)
		}
		return string(content), nil
	}

	return "", fmt.Errorf("file does not exist: %s", normalizedPath)
}

func readProjectFileInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath string) (string, error) {
	if containerMgr == nil {
		return "", errors.New("container manager not available")
	}

	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return "", err
	}

	if err := ensureContainerPathNotSymlink(ctx, containerMgr, projectID, normalizedPath); err != nil {
		return "", err
	}

	archive, err := containerMgr.CopyFromContainer(ctx, projectID, buildWorkspacePath(normalizedPath))
	if err != nil {
		if isContainerArchiveNotFoundError(err) {
			return "", fmt.Errorf("file does not exist: %s", normalizedPath)
		}
		return "", fmt.Errorf("failed to read file in container: %w", err)
	}
	return readFileFromWorkspaceArchive(archive, normalizedPath)
}
func readOptionalProjectFileInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath string) (string, error) {
	content, err := readProjectFileInContainer(ctx, containerMgr, projectID, filePath)
	if err != nil {
		if strings.Contains(err.Error(), "file does not exist") {
			return "", nil
		}
		return "", err
	}
	return content, nil
}

func projectPathExistsInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath string) (bool, error) {
	if containerMgr == nil {
		return false, errors.New("container manager not available")
	}

	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return false, err
	}

	return ensureContainerPathExists(ctx, containerMgr, projectID, normalizedPath)
}
func writeFileInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath, content string) error {
	if containerMgr == nil {
		return errors.New("container manager not available")
	}

	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return err
	}

	if err := ensureContainerPathNotSymlink(ctx, containerMgr, projectID, normalizedPath); err != nil {
		return err
	}
	archive, err := buildWorkspaceArchiveWithParents(normalizedPath, []byte(content), false)
	if err != nil {
		return fmt.Errorf("failed to build file archive: %w", err)
	}
	if err := containerMgr.CopyToContainer(ctx, projectID, "/workspace", archive); err != nil {
		return fmt.Errorf("failed to write file in container: %w", err)
	}
	return nil
}
func createFileInContainer(ctx context.Context, containerMgr *container.Manager, projectID, filePath, content string) error {
	if containerMgr == nil {
		return errors.New("container manager not available")
	}

	normalizedPath, err := normalizeProjectRelativePath(filePath)
	if err != nil {
		return err
	}

	exists, err := ensureContainerPathExists(ctx, containerMgr, projectID, normalizedPath)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("path already exists: %s", normalizedPath)
	}
	return writeFileInContainer(ctx, containerMgr, projectID, normalizedPath, content)
}
func createDirectoryInContainer(ctx context.Context, containerMgr *container.Manager, projectID, dirPath string) error {
	if containerMgr == nil {
		return errors.New("container manager not available")
	}

	normalizedPath, err := normalizeProjectRelativePath(dirPath)
	if err != nil {
		return err
	}

	exists, err := ensureContainerPathExists(ctx, containerMgr, projectID, normalizedPath)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("path already exists: %s", normalizedPath)
	}

	archive, err := buildWorkspaceArchiveWithParents(normalizedPath, nil, true)
	if err != nil {
		return fmt.Errorf("failed to build directory archive: %w", err)
	}
	if err := containerMgr.CopyToContainer(ctx, projectID, "/workspace", archive); err != nil {
		return fmt.Errorf("failed to create directory in container: %w", err)
	}
	return nil
}
func renamePathInContainer(ctx context.Context, containerMgr *container.Manager, projectID, fromPath, toPath string) error {
	if containerMgr == nil {
		return errors.New("container manager not available")
	}

	normalizedFromPath, err := normalizeProjectRelativePath(fromPath)
	if err != nil {
		return err
	}
	normalizedToPath, err := normalizeProjectRelativePath(toPath)
	if err != nil {
		return err
	}

	sourceExists, err := ensureContainerPathExists(ctx, containerMgr, projectID, normalizedFromPath)
	if err != nil {
		return err
	}
	if !sourceExists {
		return fmt.Errorf("file does not exist: %s", normalizedFromPath)
	}
	if err := ensureContainerPathNotSymlink(ctx, containerMgr, projectID, normalizedFromPath); err != nil {
		return err
	}
	targetExists, err := ensureContainerPathExists(ctx, containerMgr, projectID, normalizedToPath)
	if err != nil {
		return err
	}
	if targetExists {
		return fmt.Errorf("path already exists: %s", normalizedToPath)
	}

	result, err := containerMgr.RunCommandArgs(ctx, projectID, []string{"mv", "--", buildWorkspacePath(normalizedFromPath), buildWorkspacePath(normalizedToPath)}, "/workspace", 300)
	if err != nil {
		return fmt.Errorf("failed to rename path in container: %w", err)
	}
	if result.ExitCode != 0 {
		return classifyWorkspacePathError(strings.TrimSpace(result.Stderr), normalizedFromPath, "rename path in container")
	}
	return nil
}
func deletePathInContainer(ctx context.Context, containerMgr *container.Manager, projectID, targetPath string) error {
	if containerMgr == nil {
		return errors.New("container manager not available")
	}

	normalizedPath, err := normalizeProjectRelativePath(targetPath)
	if err != nil {
		return err
	}

	exists, err := ensureContainerPathExists(ctx, containerMgr, projectID, normalizedPath)
	if err != nil {
		return err
	}
	if !exists {
		return fmt.Errorf("file does not exist: %s", normalizedPath)
	}
	if err := ensureContainerPathNotSymlink(ctx, containerMgr, projectID, normalizedPath); err != nil {
		return err
	}

	result, err := containerMgr.RunCommandArgs(ctx, projectID, []string{"rm", "-rf", "--", buildWorkspacePath(normalizedPath)}, "/workspace", 300)
	if err != nil {
		return fmt.Errorf("failed to delete path in container: %w", err)
	}
	if result.ExitCode != 0 {
		return classifyWorkspacePathError(strings.TrimSpace(result.Stderr), normalizedPath, "delete path in container")
	}
	return nil
}
func getProjectFileTreeFromContainer(ctx context.Context, containerMgr *container.Manager, projectID string) (*file.FileNode, error) {
	if containerMgr == nil {
		return nil, errors.New("container manager not available")
	}

	findArgs := []string{
		"find", "-P", "/workspace",
		"(", "-path", "/workspace/.git", "-o", "-path", "/workspace/node_modules", "-o", "-path", "/workspace/__pycache__", ")", "-prune",
		"-o", "-mindepth", "1", "(", "-type", "d", "-o", "-type", "f", ")", "-printf", "%P\t%y\n",
	}
	result, err := containerMgr.RunCommandArgs(ctx, projectID, findArgs, "/workspace", 120)
	if err != nil {
		return nil, err
	}
	if result.ExitCode != 0 {
		return nil, fmt.Errorf("failed to scan container workspace: %s", strings.TrimSpace(result.Stderr))
	}

	root := &file.FileNode{
		ID:       uuid.New().String(),
		Name:     ".",
		Path:     "",
		Type:     file.FileTypeDir,
		Children: []*file.FileNode{},
	}
	lines := strings.Split(result.Stdout, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		relPath := strings.TrimSpace(parts[0])
		kind := strings.TrimSpace(parts[1])
		if relPath == "" {
			continue
		}
		normalizedPath, normalizeErr := normalizeProjectRelativePath(relPath)
		if normalizeErr != nil {
			log.Printf("Warning: skipped invalid workspace file tree path for project %s: %q: %v", projectID, relPath, normalizeErr)
			continue
		}
		addRuntimeTreeNode(root, normalizedPath, kind == "d")
	}

	return root, nil
}

type ProjectFileTreeSyncResult struct {
	Status       string
	StatusLabel  string
	Error        string
	ErrorSource  string
	ErrorDetails string
}

func successfulProjectFileTreeSyncResult() ProjectFileTreeSyncResult {
	return ProjectFileTreeSyncResult{
		Status:      "updated",
		StatusLabel: "Project file tree cache updated",
	}
}

func failedProjectFileTreeSyncResult(err error) ProjectFileTreeSyncResult {
	message := "project file tree cache update failed"
	if err != nil {
		message = err.Error()
	}
	return ProjectFileTreeSyncResult{
		Status:       "failed",
		StatusLabel:  "Project file tree cache update failed",
		Error:        message,
		ErrorSource:  "project_file_tree_cache",
		ErrorDetails: message,
	}
}

func refreshProjectFileTree(ctx context.Context, projectID string, containerMgr *container.Manager, projectRepo ProjectRepo) ProjectFileTreeSyncResult {
	if containerMgr == nil || projectRepo == nil || strings.TrimSpace(projectID) == "" {
		return failedProjectFileTreeSyncResult(errors.New("project file tree cache update unavailable"))
	}
	tree, err := getProjectFileTreeFromContainer(ctx, containerMgr, projectID)
	if err != nil {
		log.Printf("Warning: failed to refresh project file tree from container: %v", err)
		return failedProjectFileTreeSyncResult(err)
	}
	treeJSON, marshalErr := json.Marshal(tree)
	if marshalErr != nil {
		log.Printf("Warning: failed to marshal refreshed project file tree: %v", marshalErr)
		return failedProjectFileTreeSyncResult(marshalErr)
	}
	if err := projectRepo.UpdateFileTree(ctx, projectID, string(treeJSON)); err != nil {
		log.Printf("Warning: failed to update file tree after file save: %v", err)
		return failedProjectFileTreeSyncResult(err)
	}
	return successfulProjectFileTreeSyncResult()
}

func addRuntimeTreeNode(root *file.FileNode, relPath string, isDir bool) {
	if root == nil {
		return
	}
	segments := strings.Split(filepath.ToSlash(relPath), "/")
	current := root
	currentPath := ""

	for index, segment := range segments {
		if segment = strings.TrimSpace(segment); segment == "" {
			continue
		}
		currentPath = pathpkg.Join(currentPath, segment)
		isLeaf := index == len(segments)-1
		childIndex := -1
		for i, child := range current.Children {
			if child.Path == currentPath {
				childIndex = i
				break
			}
		}

		nodeIsDir := !isLeaf || isDir
		if childIndex == -1 {
			nextNode := &file.FileNode{
				ID:   uuid.New().String(),
				Name: segment,
				Path: currentPath,
				Type: file.FileTypeFile,
			}
			if nodeIsDir {
				nextNode.Type = file.FileTypeDir
				nextNode.Children = []*file.FileNode{}
			}
			current.Children = append(current.Children, nextNode)
			sort.Slice(current.Children, func(i, j int) bool {
				leftDir := current.Children[i].Type == file.FileTypeDir
				rightDir := current.Children[j].Type == file.FileTypeDir
				if leftDir != rightDir {
					return leftDir
				}
				return current.Children[i].Name < current.Children[j].Name
			})
			for i, child := range current.Children {
				if child.Path == currentPath {
					childIndex = i
					break
				}
			}
		}

		current = current.Children[childIndex]
		if nodeIsDir && current.Children == nil {
			current.Type = file.FileTypeDir
			current.Children = []*file.FileNode{}
		}
	}
}

func classifyWorkspacePathError(stderr, normalizedPath, operation string) error {
	switch {
	case strings.Contains(stderr, "__YISTACK_FILE_NOT_FOUND__"):
		return fmt.Errorf("file does not exist: %s", normalizedPath)
	case strings.Contains(stderr, "__YISTACK_PATH_ESCAPE__"):
		return fmt.Errorf("path escapes workspace: %s", normalizedPath)
	case strings.Contains(stderr, "__YISTACK_SYMLINK_NOT_ALLOWED__"):
		return fmt.Errorf("symlink path is not allowed: %s", normalizedPath)
	case strings.Contains(stderr, "__YISTACK_PARENT_NOT_FOUND__"):
		return fmt.Errorf("parent directory does not exist: %s", normalizedPath)
	case strings.Contains(stderr, "__YISTACK_PATH_EXISTS__"):
		return fmt.Errorf("path already exists: %s", normalizedPath)
	default:
		return fmt.Errorf("failed to %s: %s", operation, stderr)
	}
}
