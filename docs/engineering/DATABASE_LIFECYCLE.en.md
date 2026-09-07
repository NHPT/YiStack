# Database Lifecycle

[简体中文](DATABASE_LIFECYCLE.md) |
[**English**](DATABASE_LIFECYCLE.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.

## Scope

The Contributor Alpha database baseline is
`000000000000_contributor_alpha`. The `backend/init.sql` shipped by each
Release is the single source of truth for a clean installation of that
Release.

The latest version on the current main branch is
`202609070001_migration_integrity`.

The baseline marker does not claim that arbitrary historical databases are
upgradeable. Existing databases are supported only when their last recorded
schema version and source commit are known.

## Clean Installation

For a new Supabase project:

1. create an empty project;
2. apply `backend/init.sql` with `ON_ERROR_STOP`;
3. apply it a second time to verify idempotency;
4. verify that `public.schema_migrations` records the complete manifest chain and checksums;
5. replace seed credentials and configure at least one provider before
   exposing the service.

The repository check `bash scripts/verify-supabase-baseline.sh` performs this
flow against an isolated PostgreSQL container with Supabase-compatible auth
roles and functions.

Prebuilt production packages default to `DB_AUTO_MIGRATE=false`. At startup,
the backend reads the packaged `manifest.json` and requires the database to be
at that Release's latest version with matching recorded checksums. Startup
never runs migrations or lets GORM mutate the production schema implicitly.
Source-development environments may retain `DB_AUTO_MIGRATE=true`, but it is
not a substitute for a versioned migration.

## Migration Contract

Future upgrade migrations use:

```text
backend/migrations/<UTC timestamp>_<name>.sql
backend/migrations/rollback/<UTC timestamp>_<name>.sql
backend/migrations/manifest.json
```

Every forward migration must:

- omit `BEGIN`, `COMMIT`, and `ROLLBACK`; the runner owns each version transaction;
- run in manifest order under a global PostgreSQL advisory lock;
- be safe to retry or fail in the same transaction as its ledger entry;
- preserve data by default;
- let the runner insert exactly one SHA-256 ledger row after successful SQL;
- declare the immediately preceding version as its only accepted source;
- keep published forward and rollback files immutable with matching manifest checksums;
- include tests for clean install and supported upgrade paths.

`backend/init.sql` must be updated in the same change so a clean installation
arrives directly at the latest schema.

## Supported Upgrade Procedure

For the first upgrade from v1.0.0, run this command from the verified and
extracted new Release directory:

```bash
sudo ./upgrade.sh
```

Starting with the first upgrade-capable Release, later versions use:

```bash
sudo yistackctl upgrade <release-directory|release.tar.gz>
```

The archive entrypoint requires a matching `.sha256` file in the same
directory, validates archive paths and symlinks in a temporary directory, then
invokes the new Release's `upgrade.sh`. Upgrades allow only strictly forward
Semantic Versions; reinstalling the same version and downgrading both fail
closed. `flock` permits only one host upgrade at a time.

The one-command upgrade follows a fixed sequence:

1. verify the Release `MANIFEST.sha256` and preflight database compatibility
   with the new runner;
2. record application-service and ephemeral-trial timer state, then stop every
   database writer;
3. create a PostgreSQL custom-format backup of the YiStack-managed `public`
   schema, verify its SHA-256 and archive directory, and preserve the current
   configuration and systemd units;
4. switch the immutable Release, apply manifest migrations, and run `verify`;
5. restore the previous service and timer state, leaving previously stopped
   services stopped;
6. health-check a complete application stack that was previously running.

Backups default to `/var/lib/yistack/database-backups`. They exclude
Supabase-managed `auth`, `storage`, and every other non-`public` schema, so they
do not replace project-level Supabase disaster recovery. Supabase mode requires
`SUPABASE_DB_PASSWORD` for direct PostgreSQL access; REST-only mode cannot be
backed up or migrated.

If installation, migration, verification, service restoration, or health
checking fails, the command stops the new services and restores the old
configuration. After any attempted database mutation, it cleans and restores
the YiStack-managed `public` objects in one transaction. It then restores
the old Release pointer, old systemd units, and previous running state, followed
by another health check of the old application. If any recovery step fails, the
application and ephemeral-trial timers remain stopped and the command reports
the verified backup location.

The runner rejects tampered manifest files, database checksum mismatches,
history gaps, unknown versions, and versions newer than the current Release.
Production startup rejects the same states and instructs operators to run
`yistackctl database migrate` when the database is behind. These lower-level
database commands remain available for diagnostics and controlled maintenance,
but normal Release upgrades should use the one-command entrypoints above.

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

`yistackctl database rollback` rolls back only the latest version and only when
the manifest marks it reversible. After rollback, install an application
Release compatible with the target database version before restarting; do not
bypass version verification with a newer binary.

## Version Compatibility Matrix

| Application version | Required database version | Supported install/source | Rollback boundary |
| --- | --- | --- | --- |
| v1.0.0 | `000000000000_contributor_alpha` | Clean install only | Removes only the baseline marker; does not drop application tables |
| Unreleased (next upgrade-capable tag) | `202609070001_migration_integrity` | Clean install, or in-place upgrade from the v1.0.0 baseline | One-step rollback to the v1.0.0 baseline while preserving application data |

## Integrity and Release Gate

Current frozen checksums:

| Database version | Forward SHA-256 |
| --- | --- |
| `000000000000_contributor_alpha` | `a7dbe43d655163175bb51cb4c5eed1f87249a37a50e2e0585d794d4283d8e871` |
| `202609070001_migration_integrity` | `aa230dafac97ea8e3e1ddcd37c39ca962be8ad6f3beae88f007833728d46d113` |

The repository now provides a locking and checksum-validating runner,
upgrade/rollback tests for supported sources, a compatibility matrix, and
startup rejection for unknown or newer versions. Release packages must carry
the complete migration directory and run PostgreSQL 16 acceptance from every
declared source version to the target.

Only after a new immutable tag completes the Release workflow may
`Unreleased` in the table be replaced with the actual version and that tag
claim in-place upgrades from v1.0.0. Sources not listed in the matrix remain
unsupported.
