-- Add transactional hard deletion for administrator-managed regular users.
-- Minimum source version: 202609070001_migration_integrity

ALTER TABLE public.project_members
    ALTER COLUMN invited_by_user_id DROP NOT NULL;
ALTER TABLE public.project_members
    DROP CONSTRAINT IF EXISTS project_members_invited_by_user_id_fkey;
ALTER TABLE public.project_members
    ADD CONSTRAINT project_members_invited_by_user_id_fkey
    FOREIGN KEY (invited_by_user_id)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM 1
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.project_collaboration_events
    WHERE actor_user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_collaboration_sessions
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_collaboration_audits
    WHERE actor_user_id = p_user_id
       OR target_user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_members
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);

    DELETE FROM public.enterprise_project_ownerships
    WHERE project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.enterprise_members WHERE user_id = p_user_id;

    DELETE FROM public.project_deployment_operations
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_deployment_domains
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_deployment_releases
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_deployment_bindings
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);

    DELETE FROM public.github_webhook_deliveries
    WHERE project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.github_sync_operations
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.github_project_bindings
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.github_oauth_states WHERE user_id = p_user_id;
    DELETE FROM public.github_connections WHERE user_id = p_user_id;

    DELETE FROM public.generation_events
    WHERE project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id)
       OR job_id IN (
           SELECT id
           FROM public.generation_jobs
           WHERE user_id = p_user_id
              OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id)
       );
    DELETE FROM public.generation_attempts
    WHERE job_id IN (
        SELECT id
        FROM public.generation_jobs
        WHERE user_id = p_user_id
           OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id)
    );
    DELETE FROM public.generation_jobs
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);

    DELETE FROM public.project_resource_alert_events
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_capability_execution_audits
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_engineering_states
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.commits
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.chat_messages
    WHERE user_id = p_user_id
       OR project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);
    DELETE FROM public.project_files
    WHERE project_id IN (SELECT project_id FROM public.projects WHERE user_id = p_user_id);

    DELETE FROM public.projects WHERE user_id = p_user_id;
    DELETE FROM public.users WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_with_audit(
    p_user_id uuid,
    p_admin_id uuid,
    p_detail text,
    p_ip_address text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.admin_delete_user(p_user_id);
    INSERT INTO public.admin_audit_log (
        admin_id, action, target_type, target_id, detail, ip_address
    ) VALUES (
        p_admin_id, 'delete_user', 'user', p_user_id::text,
        COALESCE(p_detail, ''), COALESCE(p_ip_address, '')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user_with_audit(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_with_audit(uuid, uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO service_role;

INSERT INTO public.system_config (key, value, value_type, description)
VALUES ('app_version', '1.1.10', 'string', '应用版本')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    updated_at = now();
