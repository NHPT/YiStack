-- Roll back migration checksum and release metadata without changing user data.

INSERT INTO public.system_config (key, value, value_type, description)
VALUES ('app_version', '1.0.0', 'string', '应用版本')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    updated_at = now();

ALTER TABLE public.schema_migrations
    DROP COLUMN IF EXISTS checksum_sha256;
