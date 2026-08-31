package service

import (
	"strings"
	"testing"
)

func TestGenerationSnapshotPathsExcludeSecretsAndGeneratedArtifacts(t *testing.T) {
	paths := generationSnapshotPaths(strings.Join([]string{
		"src/app.ts", ".env.local", ".ssh/config", ".yistack/PROJECT_CONTEXT.md",
		"package-lock.json", "dist/app.js", "src/app.ts",
	}, "\n"))
	if len(paths) != 2 || paths[0] != "dist/app.js" || paths[1] != "src/app.ts" {
		t.Fatalf("unexpected filtered snapshot paths: %#v", paths)
	}
}

func TestRenderGenerationWorkspaceSnapshotIncludesHashContract(t *testing.T) {
	snapshot := &GenerationWorkspaceSnapshot{Files: []GenerationWorkspaceSnapshotFile{{
		Path: "app.ts", SHA256: generationContentHash("content"), Content: "content",
	}}}
	rendered := renderGenerationWorkspaceSnapshot(snapshot)
	if !strings.Contains(rendered, `"path":"app.ts"`) || !strings.Contains(rendered, `"sha256":"`+generationContentHash("content")+`"`) || !strings.Contains(rendered, "base_hash") {
		t.Fatalf("expected rendered hash contract, got %s", rendered)
	}
}
