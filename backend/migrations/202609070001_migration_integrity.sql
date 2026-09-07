-- Add immutable migration checksums and v1.1.0 release metadata.
-- Minimum source version: 000000000000_contributor_alpha

ALTER TABLE public.schema_migrations
    ADD COLUMN IF NOT EXISTS checksum_sha256 character varying(64);

UPDATE public.schema_migrations
SET checksum_sha256 = 'a7dbe43d655163175bb51cb4c5eed1f87249a37a50e2e0585d794d4283d8e871'
WHERE version = '000000000000_contributor_alpha'
  AND COALESCE(checksum_sha256, '') = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.schema_migrations
        WHERE version = '000000000000_contributor_alpha'
    ) THEN
        RAISE EXCEPTION 'Contributor Alpha baseline is not installed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.schema_migrations
        WHERE checksum_sha256 IS NULL OR checksum_sha256 = ''
    ) THEN
        RAISE EXCEPTION 'schema migration checksum backfill is incomplete';
    END IF;
END
$$;

ALTER TABLE public.schema_migrations
    ALTER COLUMN checksum_sha256 SET NOT NULL;

INSERT INTO public.system_config (key, value, value_type, description)
VALUES ('app_version', '1.1.0', 'string', '应用版本')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    updated_at = now();
