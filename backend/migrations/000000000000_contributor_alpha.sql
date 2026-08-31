-- YiStack database baseline stamp for existing Contributor Alpha installations.
-- Apply only after verifying that backend/init.sql already describes the database.
BEGIN;

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version character varying(80) PRIMARY KEY,
    description text NOT NULL,
    applied_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on schema_migrations" ON public.schema_migrations;
CREATE POLICY "Service role full access on schema_migrations" ON public.schema_migrations
    FOR ALL USING (auth.role() = 'service_role');

INSERT INTO public.schema_migrations (version, description)
VALUES ('000000000000_contributor_alpha', 'YiStack Contributor Alpha baseline')
ON CONFLICT (version) DO NOTHING;

COMMIT;
