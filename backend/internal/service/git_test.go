package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"yistack/internal/model"
)

type stubCommitRepo struct {
	commits []model.Commit
	err     error
}

func (r *stubCommitRepo) Create(_ context.Context, commit *model.Commit) error {
	if r.err != nil {
		return r.err
	}
	if commit != nil {
		r.commits = append(r.commits, *commit)
	}
	return nil
}

func (r *stubCommitRepo) DeleteByProjectID(_ context.Context, _ string) error {
	return nil
}

func TestPersistProjectGitCommitSnapshotRecordsDatabaseCommit(t *testing.T) {
	createdAt := time.Date(2026, 7, 15, 10, 30, 0, 0, time.UTC)
	repo := &stubCommitRepo{}

	err := persistProjectGitCommitSnapshot(context.Background(), repo, &model.Project{
		ProjectID: "project-1",
		UserID:    "user-1",
	}, &gitCommitSnapshot{
		Hash:       "abcdef1234567890",
		Message:    "Implement dashboard",
		ParentHash: "1234567890abcdef",
		CreatedAt:  createdAt,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(repo.commits) != 1 {
		t.Fatalf("expected one persisted commit, got %d", len(repo.commits))
	}
	commit := repo.commits[0]
	if commit.ProjectID != "project-1" || commit.UserID != "user-1" {
		t.Fatalf("expected project/user fields to be persisted, got %#v", commit)
	}
	if commit.Hash != "abcdef1234567890" || commit.ParentHash != "1234567890abcdef" {
		t.Fatalf("expected git hash fields to be persisted, got %#v", commit)
	}
	if commit.Message != "Implement dashboard" || !commit.CreatedAt.Equal(createdAt) {
		t.Fatalf("expected commit metadata to be persisted, got %#v", commit)
	}
}

func TestPersistProjectGitCommitSnapshotSkipsMissingFacts(t *testing.T) {
	repo := &stubCommitRepo{}

	if err := persistProjectGitCommitSnapshot(context.Background(), repo, nil, &gitCommitSnapshot{Hash: "abcdef1"}); err != nil {
		t.Fatalf("expected nil project to be skipped, got %v", err)
	}
	if err := persistProjectGitCommitSnapshot(context.Background(), repo, &model.Project{ProjectID: "project-1"}, nil); err != nil {
		t.Fatalf("expected nil snapshot to be skipped, got %v", err)
	}
	if err := persistProjectGitCommitSnapshot(context.Background(), repo, &model.Project{ProjectID: "project-1"}, &gitCommitSnapshot{}); err != nil {
		t.Fatalf("expected empty hash snapshot to be skipped, got %v", err)
	}
	if len(repo.commits) != 0 {
		t.Fatalf("expected no persisted commits, got %d", len(repo.commits))
	}
}

func TestPersistProjectGitCommitSnapshotReturnsRepositoryError(t *testing.T) {
	repo := &stubCommitRepo{err: errors.New("database unavailable")}

	err := persistProjectGitCommitSnapshot(context.Background(), repo, &model.Project{
		ProjectID: "project-1",
	}, &gitCommitSnapshot{
		Hash:      "abcdef1234567890",
		Message:   "Implement dashboard",
		CreatedAt: time.Now(),
	})
	if err == nil {
		t.Fatal("expected repository error")
	}
	if err.Error() != "database unavailable" {
		t.Fatalf("expected database error, got %v", err)
	}
}

func TestNormalizeGitCommitHashAcceptsShortAndFullHashes(t *testing.T) {
	for _, input := range []string{
		"abcdef1",
		"abcdef1234567890abcdef1234567890abcdef12",
		"ABCDEF1234567890ABCDEF1234567890ABCDEF12",
	} {
		if _, err := normalizeGitCommitHash(input); err != nil {
			t.Fatalf("expected %q to be accepted, got %v", input, err)
		}
	}
}

func TestNormalizeGitRemoteNameRejectsUnsafeValues(t *testing.T) {
	remote, err := normalizeGitRemoteName(" origin ")
	if err != nil {
		t.Fatalf("expected remote name to be accepted, got %v", err)
	}
	if remote != "origin" {
		t.Fatalf("expected remote name to be normalized, got %q", remote)
	}

	for _, input := range []string{
		"",
		"origin/main",
		"up stream",
		"-origin",
		".origin",
		"origin..backup",
		"origin.lock",
		"origin\nnext",
	} {
		if _, err := normalizeGitRemoteName(input); err == nil {
			t.Fatalf("expected %q to be rejected", input)
		}
	}
}

func TestNormalizeGitTagNameRejectsUnsafeValues(t *testing.T) {
	tagName, err := normalizeGitTagName(" v0.1.0 ")
	if err != nil {
		t.Fatalf("expected tag name to be accepted, got %v", err)
	}
	if tagName != "v0.1.0" {
		t.Fatalf("expected tag name to be normalized, got %q", tagName)
	}

	for _, input := range []string{
		"",
		"refs/tags/v1",
		"v1..0",
		"-v1",
		"v1.lock",
		"release @{0}",
		"release\nnext",
	} {
		if _, err := normalizeGitTagName(input); err == nil {
			t.Fatalf("expected unsafe tag name %q to be rejected", input)
		}
	}
}

func TestParseGitRemoteRecordsDeduplicatesRemoteNames(t *testing.T) {
	remotes := parseGitRemoteRecords("origin\nupstream\norigin\n\n")
	if len(remotes) != 2 {
		t.Fatalf("expected two remotes, got %#v", remotes)
	}
	if remotes[0].Name != "origin" || remotes[1].Name != "upstream" {
		t.Fatalf("expected stable remote names, got %#v", remotes)
	}
}

func TestNormalizeGitCommitHashRejectsUnsafeValues(t *testing.T) {
	for _, input := range []string{
		"",
		"abc",
		"abcdefg",
		"abcdef1 --hard",
		"../../abcdef1",
	} {
		if _, err := normalizeGitCommitHash(input); err == nil {
			t.Fatalf("expected %q to be rejected", input)
		}
	}
}

func TestShortHashNormalizesFullCommitHash(t *testing.T) {
	if actual := shortHash("ABCDEF1234567890"); actual != "abcdef1" {
		t.Fatalf("expected short hash abcdef1, got %q", actual)
	}
}

func TestParseGitBranchRecordsKeepsCurrentBranchAndShortCommit(t *testing.T) {
	branches := parseGitBranchRecords("main\x1f*\x1fabcdef1234567890\x1forigin/main\x1fahead 2, behind 1\nfeature/demo\x1f \x1f1234567890abcdef\x1f\x1f\n")
	if len(branches) != 2 {
		t.Fatalf("expected two branches, got %#v", branches)
	}
	if branches[0].Name != "main" || !branches[0].IsCurrent || branches[0].LastCommit != "abcdef1" {
		t.Fatalf("expected current main branch with short commit, got %#v", branches[0])
	}
	if branches[0].Upstream != "origin/main" || !branches[0].HasUpstream || branches[0].Ahead != 2 || branches[0].Behind != 1 || branches[0].TrackingStatus != "diverged" {
		t.Fatalf("expected current main tracking details, got %#v", branches[0])
	}
	if branches[1].Name != "feature/demo" || branches[1].IsCurrent || branches[1].LastCommit != "1234567" {
		t.Fatalf("expected non-current feature branch with short commit, got %#v", branches[1])
	}
	if branches[1].HasUpstream || branches[1].TrackingStatus != "none" {
		t.Fatalf("expected feature branch without upstream, got %#v", branches[1])
	}
}

func TestParseGitBranchRecordsSkipsInvalidRows(t *testing.T) {
	branches := parseGitBranchRecords("\ninvalid-row\n\x1f*\x1fabcdef1\nmain\x1f*\x1fabcdef1\n")
	if len(branches) != 1 {
		t.Fatalf("expected one valid branch, got %#v", branches)
	}
	if branches[0].Name != "main" {
		t.Fatalf("expected valid main branch, got %#v", branches[0])
	}
}

func TestParseGitBranchCompareCommitRecordsKeepsPreviewMetadata(t *testing.T) {
	commits := parseGitBranchCompareCommitRecords("ABCDEF1234567890\x1fAdd branch preview\x1fAda Lovelace\x1fada@example.com\x1f2026-07-16T10:30:00+00:00\ninvalid-row\n1234567890abcdef\x1fFix diff panel\x1fGrace Hopper\x1fgrace@example.com\x1f2026-07-16T10:31:00+00:00\n")
	if len(commits) != 2 {
		t.Fatalf("expected two branch compare commits, got %#v", commits)
	}
	if commits[0].Hash != "abcdef1" || commits[0].Message != "Add branch preview" || commits[0].Author != "Ada Lovelace" || commits[0].Email != "ada@example.com" {
		t.Fatalf("expected first commit metadata to be normalized, got %#v", commits[0])
	}
	if commits[1].Hash != "1234567" || commits[1].Message != "Fix diff panel" || commits[1].Time != "2026-07-16T10:31:00+00:00" {
		t.Fatalf("expected second commit metadata to be preserved, got %#v", commits[1])
	}
}

func TestParseGitBranchCompareFileRecordsKeepsTextAndBinaryRows(t *testing.T) {
	files := parseGitBranchCompareFileRecords("10\t2\tsrc/app.ts\n-\t-\tassets/logo.png\n3\t1\tdocs/spec.md\n5\t1\t../outside.ts\ninvalid-row\n")
	if len(files) != 3 {
		t.Fatalf("expected three branch compare files, got %#v", files)
	}
	if files[0].Path != "src/app.ts" || files[0].Additions != 10 || files[0].Deletions != 2 || files[0].IsBinary || files[0].Content != "" {
		t.Fatalf("expected text file stats, got %#v", files[0])
	}
	if files[1].Path != "assets/logo.png" || files[1].Additions != 0 || files[1].Deletions != 0 || !files[1].IsBinary {
		t.Fatalf("expected binary file stats, got %#v", files[1])
	}
	if files[2].Path != "docs/spec.md" || files[2].Additions != 3 || files[2].Deletions != 1 || files[2].IsBinary {
		t.Fatalf("expected docs file stats, got %#v", files[2])
	}
}

func TestSummarizeGitTrackingStatus(t *testing.T) {
	cases := []struct {
		upstream string
		track    string
		status   string
		ahead    int
		behind   int
	}{
		{upstream: "", track: "", status: "none"},
		{upstream: "origin/main", track: "", status: "up_to_date"},
		{upstream: "origin/main", track: "ahead 3", status: "ahead", ahead: 3},
		{upstream: "origin/main", track: "behind 2", status: "behind", behind: 2},
		{upstream: "origin/main", track: "ahead 3, behind 2", status: "diverged", ahead: 3, behind: 2},
		{upstream: "origin/main", track: "gone", status: "gone"},
	}

	for _, tc := range cases {
		if actual := summarizeGitTrackingStatus(tc.upstream, tc.track); actual != tc.status {
			t.Fatalf("expected %q for %#v, got %q", tc.status, tc, actual)
		}
		if actual := parseGitTrackingCount(tc.track, "ahead"); actual != tc.ahead {
			t.Fatalf("expected ahead %d for %#v, got %d", tc.ahead, tc, actual)
		}
		if actual := parseGitTrackingCount(tc.track, "behind"); actual != tc.behind {
			t.Fatalf("expected behind %d for %#v, got %d", tc.behind, tc, actual)
		}
	}
}

func TestParseGitRemoteBranchRecordsKeepsRemoteBranchAndShortCommit(t *testing.T) {
	branches := parseGitRemoteBranchRecords("origin/main\x1fABCDEF1234567890\nupstream/feature/demo\x1f1234567890abcdef\n")
	if len(branches) != 2 {
		t.Fatalf("expected two remote branches, got %#v", branches)
	}
	if branches[0].Name != "origin/main" || branches[0].Remote != "origin" || branches[0].Branch != "main" || branches[0].LastCommit != "abcdef1" {
		t.Fatalf("expected origin main with short commit, got %#v", branches[0])
	}
	if branches[1].Name != "upstream/feature/demo" || branches[1].Remote != "upstream" || branches[1].Branch != "feature/demo" || branches[1].LastCommit != "1234567" {
		t.Fatalf("expected upstream feature branch with short commit, got %#v", branches[1])
	}
}

func TestParseGitRemoteBranchRecordsSkipsInvalidAndHeadRows(t *testing.T) {
	branches := parseGitRemoteBranchRecords("\ninvalid-row\norigin/HEAD -> origin/main\x1fabcdef1\norigin/\x1fabcdef1\n/main\x1fabcdef1\norigin/main\x1fabcdef1234567890\n")
	if len(branches) != 1 {
		t.Fatalf("expected one valid remote branch, got %#v", branches)
	}
	if branches[0].Name != "origin/main" || branches[0].Remote != "origin" || branches[0].Branch != "main" {
		t.Fatalf("expected valid origin main remote branch, got %#v", branches[0])
	}
}

func TestParseGitTagRecordsKeepsNameAndMessage(t *testing.T) {
	tags := parseGitTagRecords("v1.0.0\x1frelease one\nnightly\x1f\n")
	if len(tags) != 2 {
		t.Fatalf("expected two tags, got %#v", tags)
	}
	if tags[0].Name != "v1.0.0" || tags[0].Message != "release one" {
		t.Fatalf("expected release tag with message, got %#v", tags[0])
	}
	if tags[1].Name != "nightly" || tags[1].Message != "" {
		t.Fatalf("expected lightweight tag without message, got %#v", tags[1])
	}
}

func TestParseGitTagRecordsSkipsInvalidRows(t *testing.T) {
	tags := parseGitTagRecords("\n\x1fmissing-name\nv2.0.0\x1frelease two\n")
	if len(tags) != 1 {
		t.Fatalf("expected one valid tag, got %#v", tags)
	}
	if tags[0].Name != "v2.0.0" {
		t.Fatalf("expected valid tag name, got %#v", tags[0])
	}
}

func TestParseGitStashRecordsKeepsRefCommitBranchAndMessage(t *testing.T) {
	stashes := parseGitStashRecords("stash@{0}\x1fABCDEF1234567890\x1fWIP on main: abc1234 update ui\nstash@{1}\x1f1234567890abcdef\x1fOn feature/demo: save draft\n")
	if len(stashes) != 2 {
		t.Fatalf("expected two stashes, got %#v", stashes)
	}
	if stashes[0].Ref != "stash@{0}" || stashes[0].TargetCommit != "abcdef1" || stashes[0].Branch != "main" {
		t.Fatalf("expected first stash ref, commit and branch, got %#v", stashes[0])
	}
	if stashes[0].Message != "WIP on main: abc1234 update ui" {
		t.Fatalf("expected first stash message, got %#v", stashes[0])
	}
	if stashes[1].Ref != "stash@{1}" || stashes[1].TargetCommit != "1234567" || stashes[1].Branch != "feature/demo" {
		t.Fatalf("expected second stash ref, commit and branch, got %#v", stashes[1])
	}
}

func TestParseGitStashRecordsSkipsInvalidRows(t *testing.T) {
	stashes := parseGitStashRecords("\ninvalid-row\n\x1fabcdef1\x1fmissing-ref\nstash@{0}\x1fabcdef1234567890\x1fcustom stash message\n")
	if len(stashes) != 1 {
		t.Fatalf("expected one valid stash, got %#v", stashes)
	}
	if stashes[0].Ref != "stash@{0}" || stashes[0].Branch != "" {
		t.Fatalf("expected valid stash without parsed branch, got %#v", stashes[0])
	}
}

func TestGitStashApplyGuardInputs(t *testing.T) {
	stashRef, err := normalizeGitStashRef(" stash@{12} ")
	if err != nil {
		t.Fatalf("expected stash ref to be accepted, got %v", err)
	}
	if stashRef != "stash@{12}" {
		t.Fatalf("expected normalized stash ref, got %q", stashRef)
	}
	for _, value := range []string{"", "stash", "stash@{main}", "stash@{-1}", "refs/stash", "stash@{0}; git reset --hard"} {
		if _, err := normalizeGitStashRef(value); err == nil {
			t.Fatalf("expected unsafe stash ref %q to be rejected", value)
		}
	}
	if dirtyFiles := countGitStatusPorcelainFiles(" M src/app.ts\n?? draft.md\n"); dirtyFiles != 2 {
		t.Fatalf("expected stash apply guard to see two dirty files, got %d", dirtyFiles)
	}
}

func TestGitStashCreateGuardInputs(t *testing.T) {
	message, err := normalizeGitStashMessage(" save current workspace ")
	if err != nil {
		t.Fatalf("expected stash message to be accepted, got %v", err)
	}
	if message != "save current workspace" {
		t.Fatalf("expected normalized stash message, got %q", message)
	}
	for _, value := range []string{"", " \t ", "line\nbreak", "line\rbreak", "null\x00byte"} {
		if _, err := normalizeGitStashMessage(value); err == nil {
			t.Fatalf("expected unsafe stash message %q to be rejected", value)
		}
	}
	if _, err := normalizeGitStashMessage(strings.Repeat("a", 201)); err == nil {
		t.Fatal("expected overlong stash message to be rejected")
	}
}

func TestParseGitNumStatTotalsAggregatesTextAndBinaryRows(t *testing.T) {
	filesChanged, additions, deletions := parseGitNumStatTotals("10\t2\tsrc/app.ts\n-\t-\tasset.png\n3\t1\tREADME.md\n")
	if filesChanged != 3 {
		t.Fatalf("expected three changed files, got %d", filesChanged)
	}
	if additions != 13 || deletions != 3 {
		t.Fatalf("expected additions/deletions to aggregate text rows only, got +%d -%d", additions, deletions)
	}
}

func TestCountGitStatusPorcelainFiles(t *testing.T) {
	if actual := countGitStatusPorcelainFiles(" M src/app.ts\n?? README.md\nA  docs/spec.md\n"); actual != 3 {
		t.Fatalf("expected three dirty files, got %d", actual)
	}
	if actual := countGitStatusPorcelainFiles("\n\n"); actual != 0 {
		t.Fatalf("expected empty status to have zero dirty files, got %d", actual)
	}
}

func TestBranchCompareFileApplyGuardInputs(t *testing.T) {
	baseBranch, err := normalizeGitBranchName(" main ")
	if err != nil {
		t.Fatalf("expected base branch to be accepted, got %v", err)
	}
	headBranch, err := normalizeGitBranchName(" feature/import-file ")
	if err != nil {
		t.Fatalf("expected head branch to be accepted, got %v", err)
	}
	filePath, err := normalizeProjectRelativePath(" src/app.ts ")
	if err != nil {
		t.Fatalf("expected project-relative path to be accepted, got %v", err)
	}
	if baseBranch != "main" || headBranch != "feature/import-file" || filePath != "src/app.ts" {
		t.Fatalf("expected normalized apply inputs, got base=%q head=%q path=%q", baseBranch, headBranch, filePath)
	}
	if _, err := normalizeGitBranchName("feature/../main"); err == nil {
		t.Fatal("expected unsafe head branch to be rejected before apply")
	}
	if _, err := normalizeProjectRelativePath("../outside.ts"); err == nil {
		t.Fatal("expected unsafe file path to be rejected before apply")
	}
	if dirtyFiles := countGitStatusPorcelainFiles(" M src/app.ts\n"); dirtyFiles != 1 {
		t.Fatalf("expected apply guard to see one dirty target file, got %d", dirtyFiles)
	}
}

func TestParseGitWorktreeFileRecords(t *testing.T) {
	files := parseGitWorktreeFileRecords(" M src/app.ts\n?? README.md\nR  old-name.ts -> new-name.ts\n D removed.go\n")
	if len(files) != 4 {
		t.Fatalf("expected four worktree files, got %#v", files)
	}
	if files[0].Path != "src/app.ts" || files[0].Status != "modified" || files[0].IndexStatus != " " || files[0].WorktreeStatus != "M" {
		t.Fatalf("expected modified worktree file, got %#v", files[0])
	}
	if files[1].Path != "README.md" || files[1].Status != "untracked" || files[1].IndexStatus != "?" || files[1].WorktreeStatus != "?" {
		t.Fatalf("expected untracked file, got %#v", files[1])
	}
	if files[2].Path != "new-name.ts" || files[2].OriginalPath != "old-name.ts" || files[2].Status != "renamed" {
		t.Fatalf("expected renamed file with original path, got %#v", files[2])
	}
	if files[3].Path != "removed.go" || files[3].Status != "deleted" {
		t.Fatalf("expected deleted file, got %#v", files[3])
	}
}

func TestBuildGitWorktreeStatusRecordReportsDirtyFiles(t *testing.T) {
	status := buildGitWorktreeStatusRecord(" feature/worktree \n", " M src/app.ts\n?? README.md\n", []GitCommitDiff{
		{Path: "src/app.ts", Additions: 4, Deletions: 1, Content: "diff --git a/src/app.ts b/src/app.ts"},
	})
	if status.CurrentBranch != "feature/worktree" {
		t.Fatalf("expected trimmed branch, got %#v", status)
	}
	if status.Status != "dirty" || status.DirtyFiles != 2 {
		t.Fatalf("expected dirty worktree with two files, got %#v", status)
	}
	if len(status.Files) != 2 || status.Files[0].Path != "src/app.ts" || status.Files[1].Path != "README.md" {
		t.Fatalf("expected dirty file details, got %#v", status)
	}
	if status.DiffFiles != 1 || status.Additions != 4 || status.Deletions != 1 || len(status.Diff) != 1 {
		t.Fatalf("expected worktree diff summary, got %#v", status)
	}
	if status.Message == "" || status.Recovery == "" {
		t.Fatalf("expected user-visible message and recovery, got %#v", status)
	}
}

func TestBuildGitWorktreeStatusRecordReportsCleanDetachedHead(t *testing.T) {
	status := buildGitWorktreeStatusRecord("", "\n", nil)
	if status.CurrentBranch != "HEAD" {
		t.Fatalf("expected detached branch fallback, got %#v", status)
	}
	if status.Status != "clean" || status.DirtyFiles != 0 {
		t.Fatalf("expected clean worktree, got %#v", status)
	}
	if len(status.Files) != 0 {
		t.Fatalf("expected no dirty file details, got %#v", status)
	}
	if status.DiffFiles != 0 || len(status.Diff) != 0 {
		t.Fatalf("expected no worktree diff details, got %#v", status)
	}
}

func TestMergeGitNumStatRowsAggregatesWorktreeDiffStats(t *testing.T) {
	stats := mergeGitNumStatRows("3\t1\tsrc/app.ts\n-\t-\tassets/logo.png\n", "2\t4\tsrc/app.ts\n5\t0\tdocs/spec.md\n")
	if stats["src/app.ts"].additions != 5 || stats["src/app.ts"].deletions != 5 {
		t.Fatalf("expected staged and unstaged stats to aggregate, got %#v", stats["src/app.ts"])
	}
	if stats["assets/logo.png"].additions != 0 || stats["assets/logo.png"].deletions != 0 {
		t.Fatalf("expected binary stats to stay zero, got %#v", stats["assets/logo.png"])
	}
	if stats["docs/spec.md"].additions != 5 || stats["docs/spec.md"].deletions != 0 {
		t.Fatalf("expected cached-only stats, got %#v", stats["docs/spec.md"])
	}
}

func TestNormalizeGitBranchNameRejectsUnsafeValues(t *testing.T) {
	for _, input := range []string{
		"",
		"feature/../main",
		"--help",
		"/main",
		"main/",
		"main.lock",
		"feature//demo",
		"feature@{1}",
		"feature demo",
		"feature~demo",
		"feature/demo.",
		"feature/.hidden",
		"main\nnext",
	} {
		if _, err := normalizeGitBranchName(input); err == nil {
			t.Fatalf("expected %q to be rejected", input)
		}
	}
}

func TestNormalizeGitBranchNameKeepsValidBranch(t *testing.T) {
	branch, err := normalizeGitBranchName(" feature/demo ")
	if err != nil {
		t.Fatalf("expected valid branch, got %v", err)
	}
	if branch != "feature/demo" {
		t.Fatalf("expected trimmed branch name, got %q", branch)
	}
}

func TestNormalizeGitRemoteBranchNameRequiresRemoteAndBranch(t *testing.T) {
	remoteBranch, err := normalizeGitRemoteBranchName(" origin/feature/demo ")
	if err != nil {
		t.Fatalf("expected remote branch to be accepted, got %v", err)
	}
	if remoteBranch != "origin/feature/demo" {
		t.Fatalf("expected remote branch to be normalized, got %q", remoteBranch)
	}

	for _, input := range []string{
		"main",
		"origin/",
		"/main",
		"origin/HEAD",
		"origin/HEAD -> origin/main",
		"origin/feature demo",
	} {
		if _, err := normalizeGitRemoteBranchName(input); err == nil {
			t.Fatalf("expected %q to be rejected", input)
		}
	}
}
