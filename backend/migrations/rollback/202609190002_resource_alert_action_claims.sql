-- Remove cross-instance resource-alert action claims.

DROP FUNCTION IF EXISTS public.complete_project_resource_alert_action(
    text,
    bigint,
    text,
    text,
    timestamp with time zone
);
DROP FUNCTION IF EXISTS public.claim_project_resource_alert_action(
    text,
    bigint, text, uuid, timestamp with time zone,
    text, text, text, integer, text, text, text, text, text
);
DROP TABLE IF EXISTS public.project_resource_alert_action_claims;

INSERT INTO public.system_config (key, value, value_type, description)
VALUES ('app_version', '1.1.10', 'string', '应用版本')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    value_type = EXCLUDED.value_type,
    description = EXCLUDED.description,
    updated_at = now();
