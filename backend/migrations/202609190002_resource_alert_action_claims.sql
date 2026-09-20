-- Add cross-instance claims for externally visible resource-alert actions.
-- Minimum source version: 202609190001_admin_user_hard_delete

CREATE TABLE IF NOT EXISTS public.project_resource_alert_action_claims (
    project_id character varying(64) NOT NULL,
    source_event_id bigint NOT NULL,
    action character varying(32) NOT NULL,
    status character varying(32) NOT NULL,
    actor_user_id uuid,
    claimed_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    PRIMARY KEY (project_id, source_event_id, action),
    FOREIGN KEY (source_event_id)
        REFERENCES public.project_resource_alert_events(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id)
        REFERENCES public.users(id) ON DELETE SET NULL,
    CHECK (action IN ('notification', 'enforcement')),
    CHECK (status IN ('pending', 'failed', 'succeeded'))
);

CREATE INDEX IF NOT EXISTS idx_project_resource_alert_action_claims_status
    ON public.project_resource_alert_action_claims(status);
CREATE INDEX IF NOT EXISTS idx_project_resource_alert_action_claims_actor_user_id
    ON public.project_resource_alert_action_claims(actor_user_id);

ALTER TABLE public.project_resource_alert_action_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on project_resource_alert_action_claims"
    ON public.project_resource_alert_action_claims;
CREATE POLICY "Service role full access on project_resource_alert_action_claims"
    ON public.project_resource_alert_action_claims
    FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.claim_project_resource_alert_action(
    p_project_id text,
    p_source_event_id bigint,
    p_action text,
    p_actor_user_id uuid,
    p_claimed_at timestamp with time zone,
    p_pending_status text,
    p_evaluation_id text,
    p_readiness_status text,
    p_triggered_count integer,
    p_triggered_thresholds text,
    p_thresholds text,
    p_evaluation_preview text,
    p_message text,
    p_recovery text
)
RETURNS TABLE(
    acquired boolean,
    status character varying,
    event_id bigint,
    event_created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_rows integer;
BEGIN
    IF p_action NOT IN ('notification', 'enforcement') THEN
        RAISE EXCEPTION 'unsupported resource alert action';
    END IF;
    IF p_pending_status <> p_action || '_pending' THEN
        RAISE EXCEPTION 'pending event status does not match action';
    END IF;

    INSERT INTO public.project_resource_alert_action_claims (
        project_id, source_event_id, action, status,
        actor_user_id, claimed_at, updated_at
    ) VALUES (
        p_project_id, p_source_event_id, p_action, 'pending',
        p_actor_user_id, p_claimed_at, p_claimed_at
    )
    ON CONFLICT (project_id, source_event_id, action) DO NOTHING;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows = 0 THEN
        UPDATE public.project_resource_alert_action_claims AS claims
        SET status = 'pending',
            actor_user_id = p_actor_user_id,
            claimed_at = p_claimed_at,
            updated_at = p_claimed_at
        WHERE claims.project_id = p_project_id
          AND claims.source_event_id = p_source_event_id
          AND claims.action = p_action
          AND claims.status = 'failed';
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
    END IF;

    IF affected_rows = 1 THEN
        INSERT INTO public.project_resource_alert_events (
            project_id,
            user_id,
            status,
            evaluation_id,
            readiness_status,
            triggered_count,
            triggered_thresholds,
            thresholds,
            evaluation_preview,
            message,
            recovery,
            created_at
        ) VALUES (
            p_project_id,
            p_actor_user_id,
            p_pending_status,
            p_evaluation_id,
            p_readiness_status,
            p_triggered_count,
            p_triggered_thresholds,
            p_thresholds,
            p_evaluation_preview,
            p_message,
            p_recovery,
            p_claimed_at
        )
        RETURNING id, created_at INTO event_id, event_created_at;
        RETURN QUERY
        SELECT true, 'pending'::character varying, event_id, event_created_at;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT false, claims.status, NULL::bigint, NULL::timestamp with time zone
    FROM public.project_resource_alert_action_claims AS claims
    WHERE claims.project_id = p_project_id
      AND claims.source_event_id = p_source_event_id
      AND claims.action = p_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project_resource_alert_action(
    p_project_id text,
    p_source_event_id bigint,
    p_action text,
    p_status text,
    p_updated_at timestamp with time zone
)
RETURNS TABLE(applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_rows integer;
BEGIN
    IF p_status NOT IN ('failed', 'succeeded') THEN
        RAISE EXCEPTION 'unsupported resource alert action completion status';
    END IF;

    UPDATE public.project_resource_alert_action_claims AS claims
    SET status = p_status,
        updated_at = p_updated_at
    WHERE claims.project_id = p_project_id
      AND claims.source_event_id = p_source_event_id
      AND claims.action = p_action
      AND claims.status = 'pending';
    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RETURN QUERY
    SELECT affected_rows = 1 OR EXISTS (
        SELECT 1
        FROM public.project_resource_alert_action_claims AS claims
        WHERE claims.project_id = p_project_id
          AND claims.source_event_id = p_source_event_id
          AND claims.action = p_action
          AND claims.status = p_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_project_resource_alert_action(
    text, bigint, text, uuid, timestamp with time zone,
    text, text, text, integer, text, text, text, text, text
)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_project_resource_alert_action(
    text, bigint, text, uuid, timestamp with time zone,
    text, text, text, integer, text, text, text, text, text
)
    TO service_role;
REVOKE ALL ON FUNCTION public.complete_project_resource_alert_action(text, bigint, text, text, timestamp with time zone)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project_resource_alert_action(text, bigint, text, text, timestamp with time zone)
    TO service_role;

INSERT INTO public.system_config (key, value, value_type, description)
VALUES ('app_version', '1.1.10', 'string', '应用版本')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    updated_at = now();
