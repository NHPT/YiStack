package migration

import (
	"context"
	"database/sql"
	"fmt"
)

const AdvisoryLockKey int64 = 6433735705560535883

type AppliedMigration struct {
	Version     string
	Description string
	Checksum    string
}

type Status struct {
	State             string   `json:"state"`
	BaselineVersion   string   `json:"baseline_version"`
	CurrentVersion    string   `json:"current_version"`
	LatestVersion     string   `json:"latest_version"`
	PendingVersions   []string `json:"pending_versions"`
	ChecksumIntegrity bool     `json:"checksum_integrity"`
}

type ApplyResult struct {
	PreviousVersion string   `json:"previous_version"`
	CurrentVersion  string   `json:"current_version"`
	AppliedVersions []string `json:"applied_versions"`
}

type RollbackResult struct {
	RolledBackVersion string `json:"rolled_back_version"`
	CurrentVersion    string `json:"current_version"`
}

type Runner struct {
	database *sql.DB
	manifest *Manifest
}

type migrationQueryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func NewRunner(database *sql.DB, manifest *Manifest) (*Runner, error) {
	if database == nil {
		return nil, fmt.Errorf("migration database is required")
	}
	if manifest == nil {
		return nil, fmt.Errorf("migration manifest is required")
	}
	return &Runner{database: database, manifest: manifest}, nil
}

func (r *Runner) Status(ctx context.Context) (Status, error) {
	if err := r.manifest.ValidateFiles(); err != nil {
		return Status{}, err
	}
	return r.inspect(ctx, r.database)
}

func (r *Runner) VerifyCurrent(ctx context.Context) error {
	status, err := r.Status(ctx)
	if err != nil {
		return err
	}
	if status.CurrentVersion != status.LatestVersion || len(status.PendingVersions) != 0 {
		return fmt.Errorf(
			"database schema is at %s, expected %s; run yistackctl database migrate",
			status.CurrentVersion,
			status.LatestVersion,
		)
	}
	if !status.ChecksumIntegrity {
		return fmt.Errorf("database migration checksum integrity is not installed")
	}
	return nil
}

func (r *Runner) Apply(ctx context.Context) (ApplyResult, error) {
	if err := r.manifest.ValidateFiles(); err != nil {
		return ApplyResult{}, err
	}

	conn, unlock, err := r.lock(ctx)
	if err != nil {
		return ApplyResult{}, err
	}
	defer unlock()

	status, err := r.inspect(ctx, conn)
	if err != nil {
		return ApplyResult{}, err
	}
	result := ApplyResult{
		PreviousVersion: status.CurrentVersion,
		CurrentVersion:  status.CurrentVersion,
		AppliedVersions: []string{},
	}
	for _, version := range status.PendingVersions {
		index := r.manifest.Index(version)
		if index <= 0 {
			return ApplyResult{}, fmt.Errorf("invalid pending migration %s", version)
		}
		entry := r.manifest.Migrations[index]
		if entry.MinimumSourceVersion != result.CurrentVersion {
			return ApplyResult{}, fmt.Errorf(
				"migration %s requires source %s, current version is %s",
				entry.Version,
				entry.MinimumSourceVersion,
				result.CurrentVersion,
			)
		}
		source, err := r.manifest.ForwardSQL(entry)
		if err != nil {
			return ApplyResult{}, err
		}
		if err := applyMigration(ctx, conn, entry, source); err != nil {
			return ApplyResult{}, err
		}
		result.AppliedVersions = append(result.AppliedVersions, entry.Version)
		result.CurrentVersion = entry.Version
	}

	finalStatus, err := r.inspect(ctx, conn)
	if err != nil {
		return ApplyResult{}, fmt.Errorf("verify migrated database: %w", err)
	}
	if finalStatus.CurrentVersion != r.manifest.LatestVersion ||
		!finalStatus.ChecksumIntegrity {
		return ApplyResult{}, fmt.Errorf(
			"database migration verification failed at %s",
			finalStatus.CurrentVersion,
		)
	}
	return result, nil
}

func (r *Runner) Rollback(ctx context.Context) (RollbackResult, error) {
	if err := r.manifest.ValidateFiles(); err != nil {
		return RollbackResult{}, err
	}

	conn, unlock, err := r.lock(ctx)
	if err != nil {
		return RollbackResult{}, err
	}
	defer unlock()

	status, err := r.inspect(ctx, conn)
	if err != nil {
		return RollbackResult{}, err
	}
	currentIndex := r.manifest.Index(status.CurrentVersion)
	if currentIndex <= 0 {
		return RollbackResult{}, fmt.Errorf("database is already at the minimum supported baseline")
	}
	entry := r.manifest.Migrations[currentIndex]
	source, err := r.manifest.RollbackSQL(entry)
	if err != nil {
		return RollbackResult{}, err
	}

	tx, err := conn.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return RollbackResult{}, fmt.Errorf("begin rollback %s: %w", entry.Version, err)
	}
	defer tx.Rollback()
	var currentVersion string
	if err := tx.QueryRowContext(
		ctx,
		"SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1",
	).Scan(&currentVersion); err != nil {
		return RollbackResult{}, fmt.Errorf("read current migration before rollback %s: %w", entry.Version, err)
	}
	if currentVersion != entry.Version {
		return RollbackResult{}, fmt.Errorf(
			"rollback %s cannot continue because current version changed to %s",
			entry.Version,
			currentVersion,
		)
	}
	deleteResult, err := tx.ExecContext(
		ctx,
		"DELETE FROM public.schema_migrations WHERE version = $1",
		entry.Version,
	)
	if err != nil {
		return RollbackResult{}, fmt.Errorf("remove migration ledger entry %s: %w", entry.Version, err)
	}
	deletedRows, err := deleteResult.RowsAffected()
	if err != nil || deletedRows != 1 {
		return RollbackResult{}, fmt.Errorf("remove migration ledger entry %s: expected one row", entry.Version)
	}
	if _, err := tx.ExecContext(ctx, source); err != nil {
		return RollbackResult{}, fmt.Errorf("execute rollback %s: %w", entry.Version, err)
	}
	if err := tx.Commit(); err != nil {
		return RollbackResult{}, fmt.Errorf("commit rollback %s: %w", entry.Version, err)
	}

	finalStatus, err := r.inspect(ctx, conn)
	if err != nil {
		return RollbackResult{}, fmt.Errorf("verify rollback %s: %w", entry.Version, err)
	}
	expectedCurrent := r.manifest.Migrations[currentIndex-1].Version
	if finalStatus.CurrentVersion != expectedCurrent {
		return RollbackResult{}, fmt.Errorf(
			"rollback %s ended at %s, expected %s",
			entry.Version,
			finalStatus.CurrentVersion,
			expectedCurrent,
		)
	}
	return RollbackResult{
		RolledBackVersion: entry.Version,
		CurrentVersion:    finalStatus.CurrentVersion,
	}, nil
}

func applyMigration(
	ctx context.Context,
	conn *sql.Conn,
	entry Migration,
	source string,
) error {
	tx, err := conn.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin migration %s: %w", entry.Version, err)
	}
	defer tx.Rollback()

	var currentVersion string
	if err := tx.QueryRowContext(
		ctx,
		"SELECT version FROM public.schema_migrations ORDER BY version DESC LIMIT 1",
	).Scan(&currentVersion); err != nil {
		return fmt.Errorf("read current migration before %s: %w", entry.Version, err)
	}
	if currentVersion != entry.MinimumSourceVersion {
		return fmt.Errorf(
			"migration %s requires source %s, current version changed to %s",
			entry.Version,
			entry.MinimumSourceVersion,
			currentVersion,
		)
	}
	if _, err := tx.ExecContext(ctx, source); err != nil {
		return fmt.Errorf("execute migration %s: %w", entry.Version, err)
	}
	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO public.schema_migrations
			(version, description, checksum_sha256)
		 VALUES ($1, $2, $3)`,
		entry.Version,
		entry.Description,
		entry.SHA256,
	); err != nil {
		return fmt.Errorf("record migration %s: %w", entry.Version, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration %s: %w", entry.Version, err)
	}
	return nil
}

func (r *Runner) inspect(ctx context.Context, queryer migrationQueryer) (Status, error) {
	var checksumColumn bool
	if err := queryer.QueryRowContext(
		ctx,
		`SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = 'schema_migrations'
			  AND column_name = 'checksum_sha256'
		)`,
	).Scan(&checksumColumn); err != nil {
		return Status{}, fmt.Errorf("inspect schema migration ledger: %w", err)
	}

	query := `SELECT version, description, '' FROM public.schema_migrations ORDER BY version`
	if checksumColumn {
		query = `SELECT version, description, checksum_sha256
			FROM public.schema_migrations
			ORDER BY version`
	}
	rows, err := queryer.QueryContext(ctx, query)
	if err != nil {
		return Status{}, fmt.Errorf(
			"read schema migration ledger; install the Contributor Alpha baseline first: %w",
			err,
		)
	}
	defer rows.Close()

	applied := make([]AppliedMigration, 0, len(r.manifest.Migrations))
	for rows.Next() {
		var entry AppliedMigration
		if err := rows.Scan(&entry.Version, &entry.Description, &entry.Checksum); err != nil {
			return Status{}, fmt.Errorf("scan schema migration ledger: %w", err)
		}
		applied = append(applied, entry)
	}
	if err := rows.Err(); err != nil {
		return Status{}, fmt.Errorf("iterate schema migration ledger: %w", err)
	}
	if len(applied) == 0 {
		return Status{}, fmt.Errorf(
			"database baseline %s is not installed",
			r.manifest.BaselineVersion,
		)
	}
	if len(applied) > len(r.manifest.Migrations) {
		return Status{}, fmt.Errorf("database contains migrations newer than this release")
	}
	for index, appliedEntry := range applied {
		expected := r.manifest.Migrations[index]
		if appliedEntry.Version != expected.Version {
			if r.manifest.Index(appliedEntry.Version) < 0 {
				return Status{}, fmt.Errorf(
					"database contains unknown migration %s",
					appliedEntry.Version,
				)
			}
			return Status{}, fmt.Errorf(
				"database migration history has a gap before %s",
				appliedEntry.Version,
			)
		}
		if checksumColumn && appliedEntry.Checksum != expected.SHA256 {
			return Status{}, fmt.Errorf(
				"database checksum mismatch for migration %s",
				appliedEntry.Version,
			)
		}
	}
	if !checksumColumn && len(applied) != 1 {
		return Status{}, fmt.Errorf("database migration checksum integrity is missing")
	}

	currentVersion := applied[len(applied)-1].Version
	pending := make([]string, 0, len(r.manifest.Migrations)-len(applied))
	for _, entry := range r.manifest.Migrations[len(applied):] {
		pending = append(pending, entry.Version)
	}
	state := "current"
	if len(pending) > 0 {
		state = "pending"
	}
	return Status{
		State:             state,
		BaselineVersion:   r.manifest.BaselineVersion,
		CurrentVersion:    currentVersion,
		LatestVersion:     r.manifest.LatestVersion,
		PendingVersions:   pending,
		ChecksumIntegrity: checksumColumn,
	}, nil
}

func (r *Runner) lock(ctx context.Context) (*sql.Conn, func(), error) {
	conn, err := r.database.Conn(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("reserve migration database connection: %w", err)
	}
	var locked bool
	if err := conn.QueryRowContext(
		ctx,
		"SELECT pg_try_advisory_lock($1)",
		AdvisoryLockKey,
	).Scan(&locked); err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("acquire migration advisory lock: %w", err)
	}
	if !locked {
		conn.Close()
		return nil, nil, fmt.Errorf("another database migration operation is running")
	}

	unlock := func() {
		var released bool
		_ = conn.QueryRowContext(
			context.Background(),
			"SELECT pg_advisory_unlock($1)",
			AdvisoryLockKey,
		).Scan(&released)
		_ = conn.Close()
	}
	return conn, unlock, nil
}
