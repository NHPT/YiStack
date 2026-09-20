-- Remove transactional administrator user hard deletion.

DROP FUNCTION IF EXISTS public.admin_delete_user_with_audit(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_delete_user(uuid);

UPDATE public.project_members
SET invited_by_user_id = user_id
WHERE invited_by_user_id IS NULL;
ALTER TABLE public.project_members
    DROP CONSTRAINT IF EXISTS project_members_invited_by_user_id_fkey;
ALTER TABLE public.project_members
    ALTER COLUMN invited_by_user_id SET NOT NULL;
ALTER TABLE public.project_members
    ADD CONSTRAINT project_members_invited_by_user_id_fkey
    FOREIGN KEY (invited_by_user_id)
    REFERENCES public.users(id)
    ON DELETE RESTRICT;

INSERT INTO public.system_config (key, value, value_type, description)
VALUES ('app_version', '1.1.0', 'string', '应用版本')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    updated_at = now();
