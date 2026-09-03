# Database Lifecycle

[简体中文](DATABASE_LIFECYCLE.md) |
[**English**](DATABASE_LIFECYCLE.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.

## Scope

YiStack v1.0.0 uses `backend/init.sql` as the single source of truth for a
clean Supabase database. The baseline version is
`000000000000_contributor_alpha`.

The baseline marker does not claim that arbitrary historical databases are
upgradeable. Existing databases are supported only when their last recorded
schema version and source commit are known.

## Clean Installation

For a new Supabase project:

1. create an empty project;
2. apply `backend/init.sql` with `ON_ERROR_STOP`;
3. apply it a second time to verify idempotency;
4. verify the baseline row in `public.schema_migrations`;
5. replace seed credentials and configure at least one provider before
   exposing the service.

The repository check `bash scripts/verify-supabase-baseline.sh` performs this
flow against an isolated PostgreSQL container with Supabase-compatible auth
roles and functions.

Prebuilt production packages default to `DB_AUTO_MIGRATE=false`. At startup, the backend verifies that the baseline above exists instead of allowing GORM to mutate the production schema implicitly. Source-development environments may retain `DB_AUTO_MIGRATE=true`, but it is not a substitute for a versioned migration.

## Migration Contract

Future upgrade migrations use:

```text
backend/migrations/<UTC timestamp>_<name>.sql
backend/migrations/rollback/<UTC timestamp>_<name>.sql
```

Every forward migration must:

- run in a transaction unless PostgreSQL forbids it;
- be safe to retry or fail before recording its version;
- lock or use compare-and-set semantics for conflicting state changes;
- preserve data by default;
- insert exactly one matching `public.schema_migrations` row;
- state the oldest source version it accepts;
- include tests for clean install and supported upgrade paths.

`backend/init.sql` must be updated in the same change so a clean installation
arrives directly at the latest schema.

## Rollback Contract

Every migration must provide one of:

- a tested rollback SQL file; or
- an explicit `IRREVERSIBLE` header with backup/restore recovery steps.

Rollback is never automatic in application startup. Before applying a
destructive or irreversible migration, operators must take and verify a
database backup. Application rollback is allowed only when the target binary
is compatible with the current database version.

The baseline rollback only removes the baseline marker when no later
migration exists. It does not drop application tables or user data. Full
baseline rollback requires restoring the pre-install database snapshot.

## Release Gate

Before the first tag that supports upgrading an existing installation:

- freeze the baseline checksum in release notes;
- add a migration runner with locking and checksum validation;
- test upgrade and rollback from every declared supported source version;
- publish the application/database compatibility matrix;
- reject startup on unknown or newer database versions.

Until that gate is complete, YiStack supports clean installation only and
must not claim in-place upgrade compatibility.
