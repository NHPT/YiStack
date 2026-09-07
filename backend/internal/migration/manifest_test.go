package migration

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadRepositoryManifest(t *testing.T) {
	manifest, err := LoadManifest(filepath.Join("..", "..", "migrations"))
	if err != nil {
		t.Fatalf("LoadManifest() error = %v", err)
	}
	if manifest.BaselineVersion != "000000000000_contributor_alpha" {
		t.Fatalf("baseline = %q", manifest.BaselineVersion)
	}
	if manifest.LatestVersion != "202609070001_migration_integrity" {
		t.Fatalf("latest = %q", manifest.LatestVersion)
	}
	if len(manifest.Migrations) != 2 {
		t.Fatalf("migration count = %d, want 2", len(manifest.Migrations))
	}
}

func TestLoadManifestRejectsTamperedMigration(t *testing.T) {
	root := writeTestManifest(t, "SELECT 1;\n", "SELECT 2;\n")
	if _, err := LoadManifest(root); err != nil {
		t.Fatalf("LoadManifest() initial error = %v", err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "202609070001_test.sql"),
		[]byte("SELECT 3;\n"),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadManifest(root); err == nil ||
		!strings.Contains(err.Error(), "checksum mismatch") {
		t.Fatalf("LoadManifest() tamper error = %v", err)
	}
}

func TestLoadManifestRejectsRunnerTransactionStatements(t *testing.T) {
	root := writeTestManifest(t, "BEGIN;\nSELECT 1;\nCOMMIT;\n", "SELECT 2;\n")
	if _, err := LoadManifest(root); err == nil ||
		!strings.Contains(err.Error(), "runner own its transaction") {
		t.Fatalf("LoadManifest() transaction error = %v", err)
	}
}

func TestManifestRejectsVersionGap(t *testing.T) {
	manifest := Manifest{
		Schema:          ManifestSchema,
		BaselineVersion: "000000000000_baseline",
		LatestVersion:   "202609070002_second",
		Migrations: []Migration{
			{
				Version:        "000000000000_baseline",
				Description:    "baseline",
				File:           "000000000000_baseline.sql",
				SHA256:         strings.Repeat("a", 64),
				Reversible:     true,
				RollbackFile:   "rollback/000000000000_baseline.sql",
				RollbackSHA256: strings.Repeat("b", 64),
			},
			{
				Version:              "202609070002_second",
				Description:          "second",
				File:                 "202609070002_second.sql",
				SHA256:               strings.Repeat("c", 64),
				MinimumSourceVersion: "202609070001_missing",
				Reversible:           true,
				RollbackFile:         "rollback/202609070002_second.sql",
				RollbackSHA256:       strings.Repeat("d", 64),
			},
		},
	}
	if err := manifest.validate(); err == nil ||
		!strings.Contains(err.Error(), "must declare previous version") {
		t.Fatalf("validate() error = %v", err)
	}
}

func TestManifestRejectsUnexpectedMigrationPath(t *testing.T) {
	manifest := Manifest{
		Schema:          ManifestSchema,
		BaselineVersion: "000000000000_baseline",
		LatestVersion:   "000000000000_baseline",
		Migrations: []Migration{{
			Version:        "000000000000_baseline",
			Description:    "baseline",
			File:           "renamed.sql",
			SHA256:         strings.Repeat("a", 64),
			Reversible:     true,
			RollbackFile:   "rollback/000000000000_baseline.sql",
			RollbackSHA256: strings.Repeat("b", 64),
		}},
	}
	err := manifest.validate()
	if err == nil || !strings.Contains(err.Error(), "must use forward file") {
		t.Fatalf("validate() error = %v", err)
	}
}

func writeTestManifest(t *testing.T, forward, rollback string) string {
	t.Helper()
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "rollback"), 0o700); err != nil {
		t.Fatal(err)
	}
	baselineForward := []byte("BEGIN;\nSELECT 1;\nCOMMIT;\n")
	baselineRollback := []byte("BEGIN;\nSELECT 1;\nCOMMIT;\n")
	forwardSource := []byte(forward)
	rollbackSource := []byte(rollback)
	files := map[string][]byte{
		"000000000000_baseline.sql":          baselineForward,
		"rollback/000000000000_baseline.sql": baselineRollback,
		"202609070001_test.sql":              forwardSource,
		"rollback/202609070001_test.sql":     rollbackSource,
	}
	for name, source := range files {
		if err := os.WriteFile(filepath.Join(root, name), source, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	manifest := Manifest{
		Schema:          ManifestSchema,
		BaselineVersion: "000000000000_baseline",
		LatestVersion:   "202609070001_test",
		Migrations: []Migration{
			{
				Version:        "000000000000_baseline",
				Description:    "baseline",
				File:           "000000000000_baseline.sql",
				SHA256:         checksum(baselineForward),
				Reversible:     true,
				RollbackFile:   "rollback/000000000000_baseline.sql",
				RollbackSHA256: checksum(baselineRollback),
			},
			{
				Version:              "202609070001_test",
				Description:          "test migration",
				File:                 "202609070001_test.sql",
				SHA256:               checksum(forwardSource),
				MinimumSourceVersion: "000000000000_baseline",
				Reversible:           true,
				RollbackFile:         "rollback/202609070001_test.sql",
				RollbackSHA256:       checksum(rollbackSource),
			},
		},
	}
	encoded, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	encoded = append(encoded, '\n')
	if err := os.WriteFile(filepath.Join(root, "manifest.json"), encoded, 0o600); err != nil {
		t.Fatal(err)
	}
	return root
}

func checksum(source []byte) string {
	sum := sha256.Sum256(source)
	return hex.EncodeToString(sum[:])
}
