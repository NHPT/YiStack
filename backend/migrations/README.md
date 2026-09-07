# YiStack Database Migrations

`backend/init.sql` is the clean-install schema. This directory contains only
ordered upgrades for databases with a known baseline.

- Forward files: `<UTC timestamp>_<name>.sql`
- Rollback files: `rollback/<UTC timestamp>_<name>.sql`
- Ordered metadata and SHA-256 values: `manifest.json`
- Recorded versions: `public.schema_migrations`

Do not edit an applied migration or its manifest checksum. Incremental SQL
must not contain transaction control because the runner owns one transaction
per migration. Update `backend/init.sql` in the same pull request as every new
migration so clean installs reach the latest version. The complete
compatibility, backup, and rollback contract is documented in
[`docs/engineering/DATABASE_LIFECYCLE.md`](../../docs/engineering/DATABASE_LIFECYCLE.md).
