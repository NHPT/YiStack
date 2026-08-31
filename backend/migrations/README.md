# YiStack Database Migrations

`backend/init.sql` is the clean-install schema. This directory contains only
ordered upgrades for databases with a known baseline.

- Forward files: `<UTC timestamp>_<name>.sql`
- Rollback files: `rollback/<UTC timestamp>_<name>.sql`
- Recorded versions: `public.schema_migrations`

Do not edit an applied migration. Update `backend/init.sql` in the same pull
request as every new migration. The complete compatibility, backup, and
rollback contract is documented in
[`docs/engineering/DATABASE_LIFECYCLE.md`](../../docs/engineering/DATABASE_LIFECYCLE.md).
