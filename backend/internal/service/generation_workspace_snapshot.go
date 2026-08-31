package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	pathpkg "path"
	"sort"
	"strings"
	"unicode/utf8"

	"yistack/pkg/container"
)

const (
	generationSnapshotMaxFiles      = 80
	generationSnapshotMaxFileBytes  = 32 * 1024
	generationSnapshotMaxTotalBytes = 256 * 1024
)

type GenerationWorkspaceSnapshotFile struct {
	Path    string `json:"path"`
	SHA256  string `json:"sha256"`
	Content string `json:"content"`
}

type GenerationWorkspaceSnapshot struct {
	Files        []GenerationWorkspaceSnapshotFile `json:"files"`
	OmittedFiles int                               `json:"omitted_files"`
}

func loadGenerationWorkspaceSnapshot(
	ctx context.Context,
	manager *container.Manager,
	projectID string,
) (*GenerationWorkspaceSnapshot, error) {
	if manager == nil {
		return nil, errors.New("container manager not available")
	}
	result, err := manager.RunCommandArgs(ctx, projectID, []string{
		"find", "-P", "/workspace",
		"(", "-path", "/workspace/.git", "-o", "-path", "/workspace/.yistack",
		"-o", "-path", "/workspace/node_modules", "-o", "-path", "/workspace/.next",
		"-o", "-path", "/workspace/dist", "-o", "-path", "/workspace/build",
		"-o", "-path", "/workspace/__pycache__", ")", "-prune",
		"-o", "-type", "f", "-size", fmt.Sprintf("-%dc", generationSnapshotMaxFileBytes+1),
		"-printf", "%P\n",
	}, "/workspace", 120)
	if err != nil {
		return nil, fmt.Errorf("list generation workspace snapshot: %w", err)
	}
	if result == nil {
		return nil, errors.New("list generation workspace snapshot returned no result")
	}
	if result.ExitCode != 0 {
		return nil, fmt.Errorf("list generation workspace snapshot failed: %s", generatedCommandOutput(result))
	}

	paths := generationSnapshotPaths(result.Stdout)
	snapshot := &GenerationWorkspaceSnapshot{Files: []GenerationWorkspaceSnapshotFile{}}
	totalBytes := 0
	for index, filePath := range paths {
		if totalBytes >= generationSnapshotMaxTotalBytes {
			snapshot.OmittedFiles += len(paths) - index
			break
		}
		if len(snapshot.Files) >= generationSnapshotMaxFiles {
			snapshot.OmittedFiles++
			continue
		}
		content, readErr := readProjectFileInContainer(ctx, manager, projectID, filePath)
		if readErr != nil {
			return nil, fmt.Errorf("read generation workspace snapshot %s: %w", filePath, readErr)
		}
		if len(content) > generationSnapshotMaxFileBytes || totalBytes+len(content) > generationSnapshotMaxTotalBytes ||
			!utf8.ValidString(content) || strings.IndexByte(content, 0) >= 0 || containsPrivateKeyMaterial(content) {
			snapshot.OmittedFiles++
			continue
		}
		snapshot.Files = append(snapshot.Files, GenerationWorkspaceSnapshotFile{
			Path: filePath, SHA256: generationContentHash(content), Content: content,
		})
		totalBytes += len(content)
	}
	return snapshot, nil
}

func generationSnapshotPaths(output string) []string {
	seen := map[string]struct{}{}
	paths := make([]string, 0)
	for _, line := range strings.Split(output, "\n") {
		normalized, err := normalizeProjectRelativePath(line)
		if err != nil || isProtectedGenerationPath(normalized) || isExcludedGenerationSnapshotPath(normalized) {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		paths = append(paths, normalized)
	}
	sort.Strings(paths)
	return paths
}

func isExcludedGenerationSnapshotPath(filePath string) bool {
	base := strings.ToLower(pathpkg.Base(filePath))
	switch base {
	case "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb",
		"go.sum", "poetry.lock", "uv.lock", "cargo.lock":
		return true
	}
	return strings.HasSuffix(base, ".min.js") || strings.HasSuffix(base, ".min.css") ||
		strings.HasSuffix(base, ".map")
}

func renderGenerationWorkspaceSnapshot(snapshot *GenerationWorkspaceSnapshot) string {
	if snapshot == nil {
		return ""
	}
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return ""
	}
	return strings.Join([]string{
		"当前项目文件快照（生成开始时的只读真源）：",
		"replace/patch/delete 的 base_hash 必须逐字使用对应文件的 sha256；未列出的路径只能使用 create。",
		string(payload),
	}, "\n")
}
