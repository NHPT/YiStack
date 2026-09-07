-- Roll back migration checksum metadata without changing application data.

ALTER TABLE public.schema_migrations
    DROP COLUMN IF EXISTS checksum_sha256;
