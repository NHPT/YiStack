package service

import (
	"os/exec"
	"strings"
	"testing"
)

func TestInitializeProjectGitRepositoryCreatesMainBranch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not available")
	}
	projectDir := t.TempDir()

	if err := initializeProjectGitRepository(projectDir); err != nil {
		t.Fatalf("expected git repository to initialize, got %v", err)
	}

	inside := runProjectInitializerGitOutput(t, projectDir, "rev-parse", "--is-inside-work-tree")
	if strings.TrimSpace(inside) != "true" {
		t.Fatalf("expected project directory to be a git repository, got %q", inside)
	}
	branch := runProjectInitializerGitOutput(t, projectDir, "symbolic-ref", "--short", "HEAD")
	if strings.TrimSpace(branch) != "main" {
		t.Fatalf("expected main branch, got %q", branch)
	}
}

func runProjectInitializerGitOutput(t *testing.T, projectDir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = projectDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s failed: %v: %s", strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return string(output)
}
