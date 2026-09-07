package migration

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const ManifestSchema = "yistack.database-migrations.v1"

var (
	versionPattern     = regexp.MustCompile(`^[0-9]{12}_[a-z0-9][a-z0-9_]*$`)
	checksumPattern    = regexp.MustCompile(`^[0-9a-f]{64}$`)
	transactionPattern = regexp.MustCompile(`(?im)^[[:space:]]*(begin|commit|rollback)[[:space:]]*;`)
)

type Manifest struct {
	Schema          string      `json:"schema"`
	BaselineVersion string      `json:"baseline_version"`
	LatestVersion   string      `json:"latest_version"`
	Migrations      []Migration `json:"migrations"`
	root            string
}

type Migration struct {
	Version              string `json:"version"`
	Description          string `json:"description"`
	File                 string `json:"file"`
	SHA256               string `json:"sha256"`
	MinimumSourceVersion string `json:"minimum_source_version"`
	Reversible           bool   `json:"reversible"`
	RollbackFile         string `json:"rollback_file"`
	RollbackSHA256       string `json:"rollback_sha256"`
	IrreversibleRecovery string `json:"irreversible_recovery"`
}

func LoadManifest(root string) (*Manifest, error) {
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return nil, fmt.Errorf("resolve migration directory: %w", err)
	}
	resolvedRoot, err = filepath.Abs(resolvedRoot)
	if err != nil {
		return nil, fmt.Errorf("make migration directory absolute: %w", err)
	}

	manifestPath := filepath.Join(resolvedRoot, "manifest.json")
	manifestInfo, err := os.Lstat(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read migration manifest metadata: %w", err)
	}
	if !manifestInfo.Mode().IsRegular() {
		return nil, fmt.Errorf("migration manifest must be a regular file: %s", manifestPath)
	}
	source, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read migration manifest: %w", err)
	}

	var manifest Manifest
	decoder := json.NewDecoder(strings.NewReader(string(source)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&manifest); err != nil {
		return nil, fmt.Errorf("decode migration manifest: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		return nil, fmt.Errorf("migration manifest contains trailing JSON values")
	}
	manifest.root = resolvedRoot
	if err := manifest.validate(); err != nil {
		return nil, err
	}
	if err := manifest.ValidateFiles(); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func (m *Manifest) validate() error {
	if m.Schema != ManifestSchema {
		return fmt.Errorf("unsupported migration manifest schema %q", m.Schema)
	}
	if len(m.Migrations) == 0 {
		return fmt.Errorf("migration manifest must contain at least the baseline")
	}
	if m.BaselineVersion != m.Migrations[0].Version {
		return fmt.Errorf("baseline version must be the first migration")
	}
	if m.LatestVersion != m.Migrations[len(m.Migrations)-1].Version {
		return fmt.Errorf("latest version must be the final migration")
	}

	seen := make(map[string]struct{}, len(m.Migrations))
	previous := ""
	for index, entry := range m.Migrations {
		if !versionPattern.MatchString(entry.Version) {
			return fmt.Errorf("invalid migration version %q", entry.Version)
		}
		if _, exists := seen[entry.Version]; exists {
			return fmt.Errorf("duplicate migration version %q", entry.Version)
		}
		seen[entry.Version] = struct{}{}
		if previous != "" && entry.Version <= previous {
			return fmt.Errorf("migration versions must be strictly ordered")
		}
		if strings.TrimSpace(entry.Description) == "" {
			return fmt.Errorf("migration %s has no description", entry.Version)
		}
		expectedForward := entry.Version + ".sql"
		if filepath.ToSlash(filepath.Clean(entry.File)) != expectedForward {
			return fmt.Errorf(
				"migration %s must use forward file %s",
				entry.Version,
				expectedForward,
			)
		}
		if !checksumPattern.MatchString(entry.SHA256) {
			return fmt.Errorf("migration %s has an invalid checksum", entry.Version)
		}
		if index == 0 {
			if entry.MinimumSourceVersion != "" {
				return fmt.Errorf("baseline migration must not declare a minimum source version")
			}
		} else if entry.MinimumSourceVersion != previous {
			return fmt.Errorf(
				"migration %s must declare previous version %s as its minimum source",
				entry.Version,
				previous,
			)
		}
		if entry.Reversible {
			expectedRollback := filepath.ToSlash(filepath.Join("rollback", expectedForward))
			if filepath.ToSlash(filepath.Clean(entry.RollbackFile)) != expectedRollback {
				return fmt.Errorf(
					"migration %s must use rollback file %s",
					entry.Version,
					expectedRollback,
				)
			}
			if strings.TrimSpace(entry.RollbackFile) == "" ||
				!checksumPattern.MatchString(entry.RollbackSHA256) {
				return fmt.Errorf("reversible migration %s must declare a rollback checksum", entry.Version)
			}
			if entry.IrreversibleRecovery != "" {
				return fmt.Errorf("reversible migration %s must not declare irreversible recovery", entry.Version)
			}
		} else {
			if entry.RollbackFile != "" || entry.RollbackSHA256 != "" {
				return fmt.Errorf("irreversible migration %s must not declare rollback files", entry.Version)
			}
			if strings.TrimSpace(entry.IrreversibleRecovery) == "" {
				return fmt.Errorf("irreversible migration %s must declare recovery steps", entry.Version)
			}
		}
		previous = entry.Version
	}
	return nil
}

func (m *Manifest) ValidateFiles() error {
	declared := make(map[string]struct{}, len(m.Migrations)*2)
	for index, entry := range m.Migrations {
		forward, err := m.readVerifiedFile(entry.File, entry.SHA256)
		if err != nil {
			return fmt.Errorf("migration %s: %w", entry.Version, err)
		}
		declared[filepath.Clean(entry.File)] = struct{}{}
		if index > 0 && transactionPattern.Match(forward) {
			return fmt.Errorf("migration %s must let the runner own its transaction", entry.Version)
		}

		if entry.Reversible {
			rollback, err := m.readVerifiedFile(entry.RollbackFile, entry.RollbackSHA256)
			if err != nil {
				return fmt.Errorf("rollback %s: %w", entry.Version, err)
			}
			declared[filepath.Clean(entry.RollbackFile)] = struct{}{}
			if index > 0 && transactionPattern.Match(rollback) {
				return fmt.Errorf("rollback %s must let the runner own its transaction", entry.Version)
			}
		}
	}

	var undeclared []string
	err := filepath.WalkDir(m.root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("migration directory contains a symbolic link: %s", path)
		}
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			return nil
		}
		relative, err := filepath.Rel(m.root, path)
		if err != nil {
			return err
		}
		if _, exists := declared[filepath.Clean(relative)]; !exists {
			undeclared = append(undeclared, filepath.ToSlash(relative))
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("scan migration directory: %w", err)
	}
	if len(undeclared) > 0 {
		sort.Strings(undeclared)
		return fmt.Errorf("undeclared migration SQL files: %s", strings.Join(undeclared, ", "))
	}
	return nil
}

func (m *Manifest) ForwardSQL(entry Migration) (string, error) {
	source, err := m.readVerifiedFile(entry.File, entry.SHA256)
	return string(source), err
}

func (m *Manifest) RollbackSQL(entry Migration) (string, error) {
	if !entry.Reversible {
		return "", fmt.Errorf(
			"migration %s is irreversible: %s",
			entry.Version,
			entry.IrreversibleRecovery,
		)
	}
	source, err := m.readVerifiedFile(entry.RollbackFile, entry.RollbackSHA256)
	return string(source), err
}

func (m *Manifest) Index(version string) int {
	for index, entry := range m.Migrations {
		if entry.Version == version {
			return index
		}
	}
	return -1
}

func (m *Manifest) readVerifiedFile(relativePath, expectedChecksum string) ([]byte, error) {
	cleanPath := filepath.Clean(relativePath)
	if relativePath == "" || filepath.IsAbs(relativePath) ||
		cleanPath == "." || cleanPath == ".." ||
		strings.HasPrefix(cleanPath, ".."+string(filepath.Separator)) {
		return nil, fmt.Errorf("unsafe migration path %q", relativePath)
	}
	fullPath := filepath.Join(m.root, cleanPath)
	relativeToRoot, err := filepath.Rel(m.root, fullPath)
	if err != nil || relativeToRoot != cleanPath {
		return nil, fmt.Errorf("migration path escapes its root: %q", relativePath)
	}
	info, err := os.Lstat(fullPath)
	if err != nil {
		return nil, fmt.Errorf("read migration file metadata %s: %w", relativePath, err)
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("migration file must be regular: %s", relativePath)
	}
	source, err := os.ReadFile(fullPath)
	if err != nil {
		return nil, fmt.Errorf("read migration file %s: %w", relativePath, err)
	}
	actual := sha256.Sum256(source)
	actualChecksum := hex.EncodeToString(actual[:])
	if actualChecksum != expectedChecksum {
		return nil, fmt.Errorf(
			"checksum mismatch for %s: expected %s, got %s",
			relativePath,
			expectedChecksum,
			actualChecksum,
		)
	}
	return source, nil
}
