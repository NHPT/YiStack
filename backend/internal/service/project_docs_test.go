package service

import (
	"encoding/json"
	"testing"
	"time"

	"yistack/internal/model"
)

func TestBuildProjectDocsManifestContentCreatesVersionedManifest(t *testing.T) {
	project := &model.Project{
		ProjectID: "proj_docs",
		Name:      "Docs Project",
		AppType:   "web",
		PlanID:    "plan-1",
	}
	now := time.Date(2026, 7, 15, 12, 0, 0, 0, time.UTC)
	docs := []FileToGenerate{
		{Path: projectRunbookPath, Content: "# Runbook"},
		{Path: projectRequirementsPath, Content: "# Requirements"},
		{Path: projectDesignPath, Content: "# Design"},
	}

	content := buildProjectDocsManifestContent(project, "build a web app", docs, []FileToGenerate{
		{Path: "src/App.tsx"},
		{Path: "src/App.tsx"},
		{Path: "package.json"},
	}, []string{"pnpm install", "pnpm test"}, "", now)

	var manifest projectDocsManifest
	if err := json.Unmarshal([]byte(content), &manifest); err != nil {
		t.Fatalf("manifest should be valid JSON: %v\n%s", err, content)
	}
	if manifest.SchemaVersion != "v1" || manifest.ProjectID != "proj_docs" || manifest.Revision != 1 {
		t.Fatalf("unexpected manifest identity: %#v", manifest)
	}
	if manifest.UpdatedAt != "2026-07-15T12:00:00Z" {
		t.Fatalf("unexpected updated_at: %q", manifest.UpdatedAt)
	}
	if len(manifest.Documents) != 3 {
		t.Fatalf("expected three supporting docs, got %#v", manifest.Documents)
	}
	if manifest.Documents[0].Path != projectDesignPath || manifest.Documents[1].Path != projectRequirementsPath || manifest.Documents[2].Path != projectRunbookPath {
		t.Fatalf("expected docs sorted by path, got %#v", manifest.Documents)
	}
	if len(manifest.GeneratedFiles) != 2 || manifest.GeneratedFiles[0] != "package.json" || manifest.GeneratedFiles[1] != "src/App.tsx" {
		t.Fatalf("expected generated files sorted and deduplicated, got %#v", manifest.GeneratedFiles)
	}
	if manifest.PromptDigest == "" || manifest.PromptSummary != "build a web app" {
		t.Fatalf("expected prompt metadata, got digest=%q summary=%q", manifest.PromptDigest, manifest.PromptSummary)
	}
}

func TestBuildProjectDocsManifestContentTracksDocumentRevisions(t *testing.T) {
	project := &model.Project{ProjectID: "proj_docs", Name: "Docs Project", AppType: "web"}
	now := time.Date(2026, 7, 15, 12, 0, 0, 0, time.UTC)
	initial := buildProjectDocsManifestContent(project, "first", []FileToGenerate{
		{Path: projectRequirementsPath, Content: "# Requirements"},
		{Path: projectDesignPath, Content: "# Design"},
	}, nil, nil, "", now)

	next := buildProjectDocsManifestContent(project, "second", []FileToGenerate{
		{Path: projectRequirementsPath, Content: "# Requirements"},
		{Path: projectDesignPath, Content: "# Design updated"},
	}, nil, nil, initial, now.Add(time.Hour))

	var manifest projectDocsManifest
	if err := json.Unmarshal([]byte(next), &manifest); err != nil {
		t.Fatalf("manifest should be valid JSON: %v", err)
	}
	if manifest.Revision != 2 {
		t.Fatalf("expected manifest revision 2, got %d", manifest.Revision)
	}

	revisions := map[string]int{}
	for _, doc := range manifest.Documents {
		revisions[doc.Path] = doc.Revision
	}
	if revisions[projectRequirementsPath] != 1 {
		t.Fatalf("unchanged requirements doc should keep revision 1, got %d", revisions[projectRequirementsPath])
	}
	if revisions[projectDesignPath] != 2 {
		t.Fatalf("changed design doc should advance to revision 2, got %d", revisions[projectDesignPath])
	}
}

func TestProjectDocsPromptSummaryCompactsAndTruncates(t *testing.T) {
	summary := projectDocsPromptSummary(" first\n\nsecond\tthird ")
	if summary != "first second third" {
		t.Fatalf("expected compact summary, got %q", summary)
	}

	longPrompt := ""
	for i := 0; i < 300; i++ {
		longPrompt += "x"
	}
	if got := projectDocsPromptSummary(longPrompt); len(got) != 240 {
		t.Fatalf("expected prompt summary to be truncated to 240 chars, got %d", len(got))
	}

	chinesePrompt := ""
	for i := 0; i < 300; i++ {
		chinesePrompt += "中"
	}
	if got := projectDocsPromptSummary(chinesePrompt); len([]rune(got)) != 240 {
		t.Fatalf("expected unicode prompt summary to be truncated to 240 runes, got %d", len([]rune(got)))
	}
}
