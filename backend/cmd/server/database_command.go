package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"yistack/config"
	dbmigration "yistack/internal/migration"
	"yistack/pkg/database"
)

func runDatabaseCommand(ctx context.Context, cfg *config.Config, args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: yistack-server database {status|plan|migrate|verify|rollback}")
	}
	command := args[0]
	switch command {
	case "status", "plan", "migrate", "verify", "rollback":
	default:
		return fmt.Errorf("unsupported database command %q", command)
	}

	manifest, err := dbmigration.LoadManifest(resolveMigrationDirectory())
	if err != nil {
		return err
	}
	connected, err := connectMigrationDatabase(cfg)
	if err != nil {
		return err
	}
	defer connected.Close()
	gormDatabase := connected.GetDB()
	if gormDatabase == nil {
		return fmt.Errorf("database migration requires direct PostgreSQL access")
	}
	sqlDatabase, err := gormDatabase.DB()
	if err != nil {
		return fmt.Errorf("open migration database connection: %w", err)
	}
	runner, err := dbmigration.NewRunner(sqlDatabase, manifest)
	if err != nil {
		return err
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	switch command {
	case "status", "plan":
		status, err := runner.Status(ctx)
		if err != nil {
			return err
		}
		return encoder.Encode(status)
	case "migrate":
		result, err := runner.Apply(ctx)
		if err != nil {
			return err
		}
		return encoder.Encode(result)
	case "verify":
		if err := runner.VerifyCurrent(ctx); err != nil {
			return err
		}
		status, err := runner.Status(ctx)
		if err != nil {
			return err
		}
		return encoder.Encode(status)
	case "rollback":
		result, err := runner.Rollback(ctx)
		if err != nil {
			return err
		}
		return encoder.Encode(result)
	}
	return nil
}

func connectMigrationDatabase(cfg *config.Config) (database.Database, error) {
	if cfg == nil {
		return nil, fmt.Errorf("database configuration is required")
	}
	switch cfg.Database.Type {
	case "postgres":
		connected, err := database.NewDatabase(&cfg.Database, nil)
		if err != nil {
			return nil, fmt.Errorf("connect PostgreSQL migration database: %w", err)
		}
		return connected, nil
	case "supabase":
		directConfig, err := buildSupabaseDirectDatabaseConfig(cfg, false)
		if err != nil {
			return nil, err
		}
		connected, err := database.NewDatabase(directConfig, nil)
		if err != nil {
			return nil, fmt.Errorf("connect Supabase migration database: %w", err)
		}
		return connected, nil
	default:
		return nil, fmt.Errorf(
			"database migrations support only PostgreSQL and Supabase direct connections, got %q",
			cfg.Database.Type,
		)
	}
}

func resolveMigrationDirectory() string {
	if configured := os.Getenv("YISTACK_MIGRATIONS_DIR"); configured != "" {
		return configured
	}
	installDir := os.Getenv("YISTACK_INSTALL_DIR")
	if installDir == "" {
		installDir = "/opt/yistack/current"
	}
	releasePath := filepath.Join(installDir, "database", "migrations")
	if _, err := os.Stat(releasePath); err == nil {
		return releasePath
	}
	if _, err := os.Stat("migrations"); err == nil {
		return "migrations"
	}
	return filepath.Join("backend", "migrations")
}
