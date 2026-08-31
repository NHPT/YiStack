// Package database 数据库抽象层
// 支持 PostgreSQL、MySQL、Oracle、Supabase 等多种数据库
package database

import (
	"context"
	"fmt"
	"time"

	"yistack/config"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DBType 数据库类型
type DBType string

const (
	DBTypePostgres DBType = "postgres"
	DBTypeMySQL    DBType = "mysql"
	DBTypeOracle   DBType = "oracle"
)

// Database 数据库接口
type Database interface {
	// GetDB 获取底层 GORM DB 实例
	GetDB() *gorm.DB

	// Create 创建记录
	Create(ctx context.Context, model interface{}) error

	// First 查询单条记录
	First(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error

	// Find 查询多条记录
	Find(ctx context.Context, models interface{}, where interface{}, args ...interface{}) error

	// Update 更新记录
	Update(ctx context.Context, model interface{}, updates interface{}) error

	// Delete 删除记录
	Delete(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error

	// Transaction 事务
	Transaction(fn func(db *gorm.DB) error) error

	// Close 关闭连接
	Close() error
}

// postgresDB PostgreSQL 实现
type postgresDB struct {
	db *gorm.DB
}

// MySQLDB MySQL 实现
type mysqlDB struct {
	db *gorm.DB
}

// NewDatabase 创建数据库实例
func NewDatabase(cfg *config.DatabaseConfig, _ interface{}) (Database, error) {
	// 如果使用 Supabase REST API，不使用这个 Database 接口
	if cfg.Type == "supabase" {
		return nil, fmt.Errorf("use Supabase REST API instead")
	}

	switch DBType(cfg.Type) {
	case DBTypePostgres:
		return newPostgresDB(cfg)
	case DBTypeMySQL:
		return newMySQLDB(cfg)
	case DBTypeOracle:
		return newPostgresDB(cfg) // 暂时降级为 PostgreSQL
	default:
		return newPostgresDB(cfg)
	}
}

// newPostgresDB 创建 PostgreSQL 数据库实例
func newPostgresDB(cfg *config.DatabaseConfig) (*postgresDB, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%d sslmode=%s",
		cfg.Host, cfg.User, cfg.Password, cfg.Database, cfg.Port, cfg.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLife) * time.Second)

	return &postgresDB{db: db}, nil
}

// GetDB 获取 GORM DB 实例
func (p *postgresDB) GetDB() *gorm.DB {
	return p.db
}

func (p *postgresDB) Create(ctx context.Context, model interface{}) error {
	return p.db.WithContext(ctx).Create(model).Error
}

func (p *postgresDB) First(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error {
	if where != nil {
		return p.db.WithContext(ctx).Where(where, args...).First(model).Error
	}
	return p.db.WithContext(ctx).First(model).Error
}

func (p *postgresDB) Find(ctx context.Context, models interface{}, where interface{}, args ...interface{}) error {
	if where != nil {
		return p.db.WithContext(ctx).Where(where, args...).Find(models).Error
	}
	return p.db.WithContext(ctx).Find(models).Error
}

func (p *postgresDB) Update(ctx context.Context, model interface{}, updates interface{}) error {
	return p.db.WithContext(ctx).Model(model).Updates(updates).Error
}

func (p *postgresDB) Delete(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error {
	if where != nil {
		return p.db.WithContext(ctx).Where(where, args...).Delete(model).Error
	}
	return p.db.WithContext(ctx).Delete(model).Error
}

func (p *postgresDB) Transaction(fn func(db *gorm.DB) error) error {
	return p.db.Transaction(fn)
}

func (p *postgresDB) Close() error {
	sqlDB, err := p.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// newMySQLDB 创建 MySQL 数据库实例
func newMySQLDB(cfg *config.DatabaseConfig) (*mysqlDB, error) {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=True&loc=Local",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database, cfg.Charset,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to mysql: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLife) * time.Second)

	return &mysqlDB{db: db}, nil
}

// GetDB 获取 GORM DB 实例
func (m *mysqlDB) GetDB() *gorm.DB {
	return m.db
}

func (m *mysqlDB) Create(ctx context.Context, model interface{}) error {
	return m.db.WithContext(ctx).Create(model).Error
}

func (m *mysqlDB) First(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error {
	if where != nil {
		return m.db.WithContext(ctx).Where(where, args...).First(model).Error
	}
	return m.db.WithContext(ctx).First(model).Error
}

func (m *mysqlDB) Find(ctx context.Context, models interface{}, where interface{}, args ...interface{}) error {
	if where != nil {
		return m.db.WithContext(ctx).Where(where, args...).Find(models).Error
	}
	return m.db.WithContext(ctx).Find(models).Error
}

func (m *mysqlDB) Update(ctx context.Context, model interface{}, updates interface{}) error {
	return m.db.WithContext(ctx).Model(model).Updates(updates).Error
}

func (m *mysqlDB) Delete(ctx context.Context, model interface{}, where interface{}, args ...interface{}) error {
	if where != nil {
		return m.db.WithContext(ctx).Where(where, args...).Delete(model).Error
	}
	return m.db.WithContext(ctx).Delete(model).Error
}

func (m *mysqlDB) Transaction(fn func(db *gorm.DB) error) error {
	return m.db.Transaction(fn)
}

func (m *mysqlDB) Close() error {
	sqlDB, err := m.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// 注意: Oracle 数据库驱动需要单独配置，当前版本暂不支持
