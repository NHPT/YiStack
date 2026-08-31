package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"strings"

	"yistack/config"
	"yistack/pkg/database"
	"yistack/pkg/supabase"

	"gorm.io/gorm"
)

// initDatabase 初始化数据库
// Supabase 模式支持两种连接方式：
// 1. 直连模式（推荐）：配置 SUPABASE_DB_PASSWORD 后，通过 GORM 直连 PostgreSQL
// 2. REST API 模式：仅使用 Supabase REST API，功能受限
func initDatabase(cfg *config.Config) (database.Database, *supabase.Client, error) {
	dbType := cfg.Database.Type

	switch dbType {
	case "supabase":
		// 始终创建 Supabase REST API 客户端（用于认证等）
		if cfg.Database.SupabaseURL == "" || cfg.Database.SupabaseAnonKey == "" {
			return nil, nil, fmt.Errorf("supabase requires SUPABASE_URL and SUPABASE_ANON_KEY")
		}

		client, err := supabase.NewClient(&supabase.Config{
			URL:        cfg.Database.SupabaseURL,
			APIKey:     cfg.Database.SupabaseAnonKey,
			ServiceKey: cfg.Database.SupabaseServiceKey,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create Supabase client: %w", err)
		}

		// 优先尝试直连模式
		if cfg.Database.SupabaseDBPassword != "" {
			log.Println("Supabase: attempting direct PostgreSQL connection via GORM")
			db, err := connectSupabaseDirect(cfg)
			if err != nil {
				return nil, nil, fmt.Errorf("supabase direct database connection failed: %w", err)
			}
			log.Println("Supabase: connected via GORM (direct PostgreSQL mode)")
			return db, client, nil
		}

		log.Println("Supabase: using REST API mode without direct GORM database operations (set SUPABASE_DB_PASSWORD for full database support)")
		return &supabaseAdapter{}, client, nil

	case "postgres", "mysql", "oracle":
		db, err := database.NewDatabase(&cfg.Database, nil)
		if err != nil {
			return nil, nil, err
		}
		return db, nil, nil

	default:
		return nil, nil, fmt.Errorf("unsupported database type: %s", dbType)
	}
}

// connectSupabaseDirect 通过 GORM 直连 Supabase PostgreSQL
func connectSupabaseDirect(cfg *config.Config) (database.Database, error) {
	supabaseDBConfig, err := buildSupabaseDirectDatabaseConfig(cfg, true)
	if err != nil {
		return nil, err
	}

	db, err := database.NewDatabase(supabaseDBConfig, nil)
	if err != nil {
		// 如果 pooler 连接失败，尝试直连
		log.Printf("Supabase pooler connection failed, trying direct connection")
		supabaseDBConfig, err = buildSupabaseDirectDatabaseConfig(cfg, false)
		if err != nil {
			return nil, err
		}
		db, err = database.NewDatabase(supabaseDBConfig, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to Supabase PostgreSQL: %w", err)
		}
	}

	return db, nil
}

func buildSupabaseDirectDatabaseConfig(cfg *config.Config, usePooler bool) (*config.DatabaseConfig, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is required")
	}
	if strings.TrimSpace(cfg.Database.SupabaseDBPassword) == "" {
		return nil, fmt.Errorf("SUPABASE_DB_PASSWORD is required for Supabase direct database access")
	}

	projectRef, err := supabaseProjectRefFromURL(cfg.Database.SupabaseURL)
	if err != nil {
		return nil, err
	}

	region := strings.TrimSpace(cfg.Database.SupabaseDBRegion)
	if region == "" {
		// Supabase pooler hostname 需要明确 region；默认值保持稳定且日志可见，便于发现部署配置漂移。
		region = "ap-southeast-1"
		log.Printf("Supabase: region not configured, using default %s. Set SUPABASE_DB_REGION if different.", region)
	}

	host := fmt.Sprintf("aws-0-%s.pooler.supabase.com", region)
	port := 6543
	if !usePooler {
		host = fmt.Sprintf("db.%s.supabase.com", projectRef)
		port = 5432
	}

	return &config.DatabaseConfig{
		Type:         "postgres",
		Host:         host,
		Port:         port,
		User:         fmt.Sprintf("postgres.%s", projectRef),
		Password:     cfg.Database.SupabaseDBPassword,
		Database:     "postgres",
		SSLMode:      "require",
		MaxIdleConns: cfg.Database.MaxIdleConns,
		MaxOpenConns: cfg.Database.MaxOpenConns,
		ConnMaxLife:  cfg.Database.ConnMaxLife,
	}, nil
}

func supabaseProjectRefFromURL(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", fmt.Errorf("SUPABASE_URL is required for Supabase direct database access")
	}
	if !strings.Contains(trimmed, "://") {
		trimmed = "https://" + trimmed
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("invalid Supabase URL format: %w", err)
	}
	hostname := parsed.Hostname()
	if hostname == "" {
		host, _, splitErr := net.SplitHostPort(parsed.Host)
		if splitErr == nil {
			hostname = host
		}
	}
	hostname = strings.TrimSpace(strings.ToLower(hostname))
	if hostname == "" {
		return "", fmt.Errorf("invalid Supabase URL format: missing host")
	}

	parts := strings.Split(hostname, ".")
	if len(parts) != 3 || parts[1] != "supabase" || parts[2] != "co" || strings.TrimSpace(parts[0]) == "" {
		return "", fmt.Errorf("invalid Supabase URL host %q: expected <project-ref>.supabase.co", hostname)
	}
	return parts[0], nil
}

// supabaseAdapter Supabase REST API 适配器（功能受限降级方案）
type supabaseAdapter struct{}

func (a *supabaseAdapter) GetDB() *gorm.DB {
	return nil
}

func (a *supabaseAdapter) Create(ctx context.Context, model interface{}) error {
	return supabaseRESTOnlyDatabaseError()
}

func (a *supabaseAdapter) First(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error {
	return supabaseRESTOnlyDatabaseError()
}

func (a *supabaseAdapter) Find(ctx context.Context, models interface{}, where interface{}, args ...interface{}) error {
	return supabaseRESTOnlyDatabaseError()
}

func (a *supabaseAdapter) Update(ctx context.Context, model interface{}, updates interface{}) error {
	return supabaseRESTOnlyDatabaseError()
}

func (a *supabaseAdapter) Delete(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error {
	return supabaseRESTOnlyDatabaseError()
}

func (a *supabaseAdapter) Transaction(fn func(db *gorm.DB) error) error {
	return supabaseRESTOnlyDatabaseError()
}

func (a *supabaseAdapter) Close() error {
	return nil
}

func supabaseRESTOnlyDatabaseError() error {
	return fmt.Errorf("supabase REST API mode does not provide GORM database operations; set SUPABASE_DB_PASSWORD to enable direct PostgreSQL access")
}
