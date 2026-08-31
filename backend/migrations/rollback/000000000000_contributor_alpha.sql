-- This rollback removes only the baseline stamp. It never drops application data.
BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.schema_migrations
        WHERE version <> '000000000000_contributor_alpha'
    ) THEN
        RAISE EXCEPTION 'cannot remove baseline while later migrations are recorded';
    END IF;
END
$$;

DELETE FROM public.schema_migrations
WHERE version = '000000000000_contributor_alpha';

COMMIT;
