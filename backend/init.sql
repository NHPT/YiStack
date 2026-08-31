-- ============================================================
-- YiStack（一栈）完整数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================

-- 1. 用户表（仅存用户端用户）
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email character varying(255) NOT NULL UNIQUE,
    username character varying(100),
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user',
    status character varying(20) DEFAULT 'active',
    plan character varying(50) DEFAULT 'free',
    email_verified boolean DEFAULT false,
    avatar_url text,
    llm_model character varying(200),
    llm_temperature character varying(10),
    llm_max_tokens integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. 管理员表（独立于用户表，仅存管理员）
CREATE TABLE IF NOT EXISTS public.admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email character varying(255) NOT NULL UNIQUE,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    status character varying(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password boolean NOT NULL DEFAULT false,
    auth_version integer NOT NULL DEFAULT 1 CHECK (auth_version > 0),
    avatar_url text,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admins
    ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.admins
    ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 1;

-- 3. 项目表
-- 3.1 管理员角色表（RBAC）
CREATE TABLE IF NOT EXISTS public.admin_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name character varying(100) NOT NULL UNIQUE,
    display_name character varying(100) NOT NULL,
    description character varying(255) DEFAULT '',
    is_system boolean DEFAULT false,
    status character varying(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.2 管理员权限点表（RBAC）
CREATE TABLE IF NOT EXISTS public.admin_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code character varying(120) NOT NULL UNIQUE,
    name character varying(100) NOT NULL,
    description character varying(255) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 3.3 管理员角色-权限关联表
CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
    id bigserial PRIMARY KEY,
    role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_role_permissions_unique UNIQUE (role_id, permission_id)
);

-- 3.4 管理员-角色关联表
CREATE TABLE IF NOT EXISTS public.admin_user_roles (
    id bigserial PRIMARY KEY,
    admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_user_roles_unique UNIQUE (admin_id, role_id)
);

-- 4. 项目表
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id character varying(64) NOT NULL UNIQUE,
    name character varying(255) NOT NULL,
    description text,
    app_type character varying(50),
    tech_stack text,
    visibility character varying(20) DEFAULT 'private',
    preview_share_enabled boolean NOT NULL DEFAULT false,
    preview_share_id character varying(96),
    container_id character varying(100),
    container_name character varying(100),
    container_port integer,
    container_image character varying(255),
    container_status character varying(20) DEFAULT 'stopped',
    directory_path character varying(512),
    plan_id character varying(64),
    plan_data text,
    git_repo_url character varying(512),
    git_branch character varying(100),
    stars integer DEFAULT 0,
    forks integer DEFAULT 0,
    file_tree text,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS preview_share_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS preview_share_id character varying(96);

DROP INDEX IF EXISTS public.projects_preview_share_id_unique;
CREATE UNIQUE INDEX projects_preview_share_id_unique
    ON public.projects(preview_share_id)
    WHERE preview_share_id IS NOT NULL AND preview_share_id <> '';

-- 5. 项目文件表
CREATE TABLE IF NOT EXISTS public.project_files (
    id bigserial PRIMARY KEY,
    project_id character varying(64) NOT NULL,
    path character varying(512) NOT NULL,
    content text DEFAULT '',
    content_hash character varying(64) DEFAULT '',
    file_type character varying(50) DEFAULT 'file',
    size integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 6. 聊天消息表
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id bigserial PRIMARY KEY,
    project_id character varying(64) NOT NULL,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    role character varying(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text,
    model character varying(100),
    tokens integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- 6.1 项目 Git 提交快照记录
CREATE TABLE IF NOT EXISTS public.commits (
    id bigserial PRIMARY KEY,
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    message character varying(500) DEFAULT '',
    hash character varying(64) NOT NULL,
    parent_hash character varying(64) DEFAULT '',
    created_at timestamp with time zone DEFAULT now()
);

-- 7. 项目工程状态、能力审计与资源告警事件
CREATE TABLE IF NOT EXISTS public.project_engineering_states (
    id bigserial PRIMARY KEY,
    project_id character varying(64) NOT NULL UNIQUE,
    user_id uuid,
    workflow_stage character varying(64) DEFAULT '',
    workflow_mode character varying(64) DEFAULT '',
    workflow_status character varying(32) DEFAULT '',
    state text NOT NULL,
    content text DEFAULT '',
    model character varying(64) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_capability_execution_audits (
    id bigserial PRIMARY KEY,
    project_id character varying(64) DEFAULT '',
    user_id uuid,
    workflow_stage character varying(64) DEFAULT '',
    workflow_mode character varying(64) DEFAULT '',
    capability_profile character varying(128) DEFAULT '',
    status character varying(32) DEFAULT '',
    provider_resolution text NOT NULL,
    execution_audit text NOT NULL,
    execution_result text NOT NULL,
    source_note text DEFAULT '',
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_resource_alert_events (
    id bigserial PRIMARY KEY,
    project_id character varying(64) NOT NULL,
    user_id uuid,
    status character varying(32) NOT NULL,
    evaluation_id character varying(128) NOT NULL,
    readiness_status character varying(32) DEFAULT '',
    triggered_count integer DEFAULT 0,
    triggered_thresholds text NOT NULL,
    thresholds text NOT NULL,
    evaluation_preview text NOT NULL,
    message text DEFAULT '',
    recovery text DEFAULT '',
    created_at timestamp with time zone DEFAULT now()
);

-- 8. 持久 Generation Job、attempt 与 SSE event 真源
CREATE TABLE IF NOT EXISTS public.generation_jobs (
    id uuid PRIMARY KEY,
    project_id character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    idempotency_key character varying(128) NOT NULL,
    status character varying(32) NOT NULL CHECK (status IN ('queued', 'running', 'repairing', 'validating', 'previewing', 'succeeded', 'failed', 'cancelled', 'interrupted')),
    workflow_stage character varying(64) DEFAULT '',
    workflow_mode character varying(64) DEFAULT '',
    provider character varying(128) DEFAULT '',
    model character varying(255) DEFAULT '',
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code character varying(64) DEFAULT '',
    error_message text DEFAULT '',
    stop_reason character varying(128) DEFAULT '',
    current_attempt integer NOT NULL DEFAULT 0,
    event_sequence bigint NOT NULL DEFAULT 0,
    worker_id character varying(128) DEFAULT '',
    lease_version bigint NOT NULL DEFAULT 0,
    lease_expires_at timestamp with time zone,
    heartbeat_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT generation_jobs_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.generation_attempts (
    id uuid PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
    attempt_number integer NOT NULL,
    kind character varying(32) NOT NULL CHECK (kind IN ('initial', 'repair')),
    status character varying(32) NOT NULL,
    provider character varying(128) DEFAULT '',
    model character varying(255) DEFAULT '',
    input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_code character varying(64) DEFAULT '',
    error_message text DEFAULT '',
    failure_hash character varying(64) DEFAULT '',
    started_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT generation_attempts_job_number_kind_unique UNIQUE (job_id, attempt_number, kind)
);

CREATE TABLE IF NOT EXISTS public.generation_events (
    id bigserial PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
    project_id character varying(64) NOT NULL,
    sequence bigint NOT NULL,
    event_key character varying(255) NOT NULL,
    event_type character varying(32) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT generation_events_job_sequence_unique UNIQUE (job_id, sequence),
    CONSTRAINT generation_events_job_event_key_unique UNIQUE (job_id, event_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_one_active_per_project
    ON public.generation_jobs(project_id)
    WHERE status IN ('queued', 'running', 'repairing', 'validating', 'previewing');

CREATE OR REPLACE FUNCTION public.append_generation_event(
    p_job_id uuid,
    p_event_key text,
    p_event_type text,
    p_payload jsonb,
    p_created_at timestamp with time zone
)
RETURNS TABLE(
    id bigint,
    job_id uuid,
    project_id character varying(64),
    sequence bigint,
    event_key character varying(255),
    event_type character varying(32),
    payload jsonb,
    created_at timestamp with time zone,
    created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event public.generation_events%ROWTYPE;
    v_project_id character varying(64);
    v_status character varying(32);
    v_next_sequence bigint;
BEGIN
    SELECT e.* INTO v_event
    FROM public.generation_events AS e
    WHERE e.job_id = p_job_id AND e.event_key = p_event_key;
    IF FOUND THEN
        RETURN QUERY SELECT v_event.id, v_event.job_id, v_event.project_id, v_event.sequence,
            v_event.event_key, v_event.event_type, v_event.payload, v_event.created_at, false;
        RETURN;
    END IF;

    SELECT j.project_id, j.status, j.event_sequence + 1
    INTO v_project_id, v_status, v_next_sequence
    FROM public.generation_jobs AS j
    WHERE j.id = p_job_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'generation job % not found', p_job_id USING ERRCODE = 'P0002';
    END IF;

    SELECT e.* INTO v_event
    FROM public.generation_events AS e
    WHERE e.job_id = p_job_id AND e.event_key = p_event_key;
    IF FOUND THEN
        RETURN QUERY SELECT v_event.id, v_event.job_id, v_event.project_id, v_event.sequence,
            v_event.event_key, v_event.event_type, v_event.payload, v_event.created_at, false;
        RETURN;
    END IF;
    IF v_status NOT IN ('queued', 'running', 'repairing', 'validating', 'previewing') THEN
        RAISE EXCEPTION 'generation job % is terminal', p_job_id USING ERRCODE = '55000';
    END IF;

    INSERT INTO public.generation_events (
        job_id, project_id, sequence, event_key, event_type, payload, created_at
    ) VALUES (
        p_job_id, v_project_id, v_next_sequence, p_event_key, p_event_type, p_payload, p_created_at
    ) RETURNING * INTO v_event;

    UPDATE public.generation_jobs AS j
    SET event_sequence = v_next_sequence, updated_at = p_created_at
    WHERE j.id = p_job_id;

    RETURN QUERY SELECT v_event.id, v_event.job_id, v_event.project_id, v_event.sequence,
        v_event.event_key, v_event.event_type, v_event.payload, v_event.created_at, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_generation_attempt(
    p_id uuid,
    p_job_id uuid,
    p_attempt_number integer,
    p_kind text,
    p_status text,
    p_provider text,
    p_model text,
    p_input_snapshot jsonb,
    p_result_summary jsonb,
    p_started_at timestamp with time zone,
    p_created_at timestamp with time zone,
    p_updated_at timestamp with time zone
)
RETURNS SETOF public.generation_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt public.generation_attempts%ROWTYPE;
BEGIN
    INSERT INTO public.generation_attempts (
        id, job_id, attempt_number, kind, status, provider, model,
        input_snapshot, result_summary, started_at, created_at, updated_at
    ) VALUES (
        p_id, p_job_id, p_attempt_number, p_kind, p_status, p_provider, p_model,
        p_input_snapshot, p_result_summary, p_started_at, p_created_at, p_updated_at
    ) RETURNING * INTO v_attempt;

    UPDATE public.generation_jobs
    SET current_attempt = GREATEST(current_attempt, p_attempt_number),
        updated_at = p_updated_at
    WHERE id = p_job_id;

    RETURN NEXT v_attempt;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_generation_job_lease(
    p_job_id uuid,
    p_worker_id text,
    p_lease_until timestamp with time zone,
    p_heartbeat_at timestamp with time zone
)
RETURNS TABLE(applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_applied boolean := false;
BEGIN
    UPDATE public.generation_jobs
    SET lease_version = lease_version + 1,
        lease_expires_at = GREATEST(lease_expires_at, p_lease_until),
        heartbeat_at = p_heartbeat_at,
        updated_at = p_heartbeat_at
    WHERE id = p_job_id
      AND worker_id = p_worker_id
      AND status IN ('running', 'repairing', 'validating', 'previewing')
      AND lease_expires_at > clock_timestamp()
    RETURNING true INTO v_applied;

    RETURN QUERY SELECT COALESCE(v_applied, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_generation_job_terminal(
    p_job_id uuid,
    p_worker_id text,
    p_status text,
    p_error_code text,
    p_error_message text,
    p_stop_reason text,
    p_result_summary jsonb,
    p_event_type text,
    p_event_payload jsonb,
    p_completed_at timestamp with time zone
)
RETURNS TABLE(applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job public.generation_jobs%ROWTYPE;
    v_next_sequence bigint;
BEGIN
    SELECT * INTO v_job
    FROM public.generation_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_job.status NOT IN ('queued', 'running', 'repairing', 'validating', 'previewing')
       OR (NULLIF(p_worker_id, '') IS NOT NULL AND v_job.worker_id <> p_worker_id) THEN
        RETURN QUERY SELECT false;
        RETURN;
    END IF;
    IF p_status NOT IN ('succeeded', 'failed', 'cancelled', 'interrupted') THEN
        RAISE EXCEPTION 'invalid generation terminal status %', p_status USING ERRCODE = '22023';
    END IF;

    v_next_sequence := v_job.event_sequence + 1;
    INSERT INTO public.generation_events (
        job_id, project_id, sequence, event_key, event_type, payload, created_at
    ) VALUES (
        p_job_id, v_job.project_id, v_next_sequence, 'terminal', p_event_type, p_event_payload, p_completed_at
    );

    UPDATE public.generation_jobs
    SET status = p_status,
        error_code = COALESCE(p_error_code, ''),
        error_message = COALESCE(p_error_message, ''),
        stop_reason = COALESCE(p_stop_reason, ''),
        result_summary = COALESCE(p_result_summary, '{}'::jsonb),
        event_sequence = v_next_sequence,
        completed_at = p_completed_at,
        cancelled_at = CASE WHEN p_status = 'cancelled' THEN p_completed_at ELSE cancelled_at END,
        lease_expires_at = NULL,
        updated_at = p_completed_at
    WHERE id = p_job_id;

    UPDATE public.generation_attempts
    SET status = p_status,
        error_code = COALESCE(p_error_code, ''),
        error_message = COALESCE(p_error_message, ''),
        result_summary = COALESCE(p_result_summary, '{}'::jsonb),
        completed_at = p_completed_at,
        updated_at = p_completed_at
    WHERE job_id = p_job_id AND status = 'running';

    RETURN QUERY SELECT true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_generation_attempt(uuid, uuid, integer, text, text, text, text, jsonb, jsonb, timestamp with time zone, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_generation_attempt(uuid, uuid, integer, text, text, text, text, jsonb, jsonb, timestamp with time zone, timestamp with time zone, timestamp with time zone) TO service_role;
CREATE OR REPLACE FUNCTION public.interrupt_stale_generation_job(
    p_job_id uuid,
    p_expected_lease_version bigint,
    p_stale_queue_before timestamp with time zone,
    p_now timestamp with time zone
)
RETURNS TABLE(applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job public.generation_jobs%ROWTYPE;
BEGIN
    SELECT * INTO v_job
    FROM public.generation_jobs
    WHERE id = p_job_id
      AND lease_version = p_expected_lease_version
      AND status IN ('queued', 'running', 'repairing', 'validating', 'previewing')
      AND (
          (status = 'queued' AND updated_at <= p_stale_queue_before)
          OR
          (status <> 'queued' AND (lease_expires_at IS NULL OR lease_expires_at <= p_now))
      )
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT terminal.applied
    FROM public.transition_generation_job_terminal(
        p_job_id,
        '',
        'interrupted',
        'generation_job_lease_lost',
        'generation worker lease expired before safe completion',
        'generation_worker_interrupted',
        '{}'::jsonb,
        'error',
        jsonb_build_object(
            'code', 'generation_job_lease_lost', 'blocking', true,
            'message', '生成任务因 worker 中断而停止', 'details', '生成任务因 worker 中断而停止',
            'job_id', p_job_id
        ),
        p_now
    ) AS terminal;
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_generation_job_lease(uuid, text, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.interrupt_stale_generation_job(uuid, bigint, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_generation_event(uuid, text, text, jsonb, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_generation_job_lease(uuid, text, timestamp with time zone, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.interrupt_stale_generation_job(uuid, bigint, timestamp with time zone, timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.transition_generation_job_terminal(uuid, text, text, text, text, text, jsonb, text, jsonb, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_generation_event(uuid, text, text, jsonb, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_generation_job_terminal(uuid, text, text, text, text, text, jsonb, text, jsonb, timestamp with time zone) TO service_role;

-- GitHub OAuth、项目绑定、同步幂等与 webhook replay 真源
CREATE TABLE IF NOT EXISTS public.github_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    account_id bigint NOT NULL,
    account_login character varying(255) NOT NULL,
    account_name character varying(255) DEFAULT '',
    avatar_url character varying(1000) DEFAULT '',
    scopes text DEFAULT '',
    token_ciphertext text NOT NULL,
    token_nonce character varying(255) NOT NULL,
    token_key_version character varying(32) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.github_oauth_states (
    state_hash character varying(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    code_verifier text NOT NULL,
    return_path character varying(1000) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.github_project_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id character varying(64) NOT NULL UNIQUE REFERENCES public.projects(project_id) ON DELETE CASCADE,
    webhook_id bigint NOT NULL DEFAULT 0,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    repository_id bigint NOT NULL,
    repository_name character varying(500) NOT NULL,
    repository_url character varying(1000) NOT NULL,
    default_branch character varying(255) NOT NULL,
    remote_name character varying(64) NOT NULL DEFAULT 'origin',
    permission_push boolean NOT NULL DEFAULT false,
    remote_head_sha character varying(64) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.github_sync_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    idempotency_key character varying(255) NOT NULL,
    kind character varying(32) NOT NULL CHECK (kind IN ('import', 'pull', 'push')),
    request_hash character varying(64) NOT NULL,
    status character varying(32) NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    result text DEFAULT '',
    error_code character varying(128) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT github_sync_operations_user_key_unique UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.github_webhook_deliveries (
    delivery_id character varying(255) PRIMARY KEY,
    event character varying(100) NOT NULL,
    repository_name character varying(500) DEFAULT '',
    project_id character varying(64) DEFAULT '',
    ref character varying(500) DEFAULT '',
    after_sha character varying(64) DEFAULT '',
    status character varying(32) NOT NULL CHECK (status IN ('recorded', 'ignored')),
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_oauth_states_user_expires ON public.github_oauth_states(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_github_project_bindings_repository_name ON public.github_project_bindings(repository_name);
CREATE INDEX IF NOT EXISTS idx_github_project_bindings_user_id ON public.github_project_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_github_sync_operations_project_id ON public.github_sync_operations(project_id);
CREATE INDEX IF NOT EXISTS idx_github_webhook_deliveries_repository_name ON public.github_webhook_deliveries(repository_name);

-- Vercel deployment bindings, immutable release evidence, domains and mutation idempotency
CREATE TABLE IF NOT EXISTS public.project_deployment_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id character varying(64) NOT NULL UNIQUE REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider character varying(32) NOT NULL CHECK (provider IN ('vercel')),
    provider_project_id character varying(255) NOT NULL,
    provider_project_name character varying(255) NOT NULL,
    team_id character varying(255) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_deployment_releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider character varying(32) NOT NULL CHECK (provider IN ('vercel')),
    provider_deployment_id character varying(255) NOT NULL,
    provider_project_id character varying(255) NOT NULL,
    kind character varying(32) NOT NULL CHECK (kind IN ('deploy', 'rollback')),
    target character varying(32) NOT NULL CHECK (target IN ('preview', 'production')),
    status character varying(32) NOT NULL CHECK (status IN ('queued', 'initializing', 'building', 'ready', 'error', 'canceled')),
    url character varying(1000) DEFAULT '',
    source_commit_sha character varying(64) NOT NULL,
    artifact_sha256 character varying(64) NOT NULL,
    artifact_file_count integer NOT NULL DEFAULT 0,
    artifact_size bigint NOT NULL DEFAULT 0,
    previous_provider_deployment_id character varying(255) DEFAULT '',
    environment_keys text NOT NULL DEFAULT '[]',
    secret_ciphertext text DEFAULT '',
    secret_nonce character varying(255) DEFAULT '',
    secret_key_version character varying(32) DEFAULT '',
    error_code character varying(128) DEFAULT '',
    error_message text DEFAULT '',
    ready_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_deployment_domains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider character varying(32) NOT NULL CHECK (provider IN ('vercel')),
    domain character varying(255) NOT NULL,
    status character varying(32) NOT NULL CHECK (status IN ('pending', 'verified', 'error')),
    verified boolean NOT NULL DEFAULT false,
    verification_type character varying(32) DEFAULT '',
    verification_domain character varying(255) DEFAULT '',
    verification_value character varying(1000) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_deployment_domains_project_domain_unique UNIQUE (project_id, domain)
);

CREATE TABLE IF NOT EXISTS public.project_deployment_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    idempotency_key character varying(255) NOT NULL,
    kind character varying(32) NOT NULL CHECK (kind IN ('deploy', 'rollback', 'domain_add', 'domain_verify', 'domain_remove')),
    request_hash character varying(64) NOT NULL,
    status character varying(32) NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    result text DEFAULT '',
    error_code character varying(128) DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_deployment_operations_user_key_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_project_deployment_releases_project_created ON public.project_deployment_releases(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_deployment_domains_project_id ON public.project_deployment_domains(project_id);
CREATE INDEX IF NOT EXISTS idx_project_deployment_operations_project_id ON public.project_deployment_operations(project_id);

-- 9. LLM 提供商配置表
CREATE TABLE IF NOT EXISTS public.llm_providers (
    id bigserial PRIMARY KEY,
    name character varying(50) NOT NULL UNIQUE,
    display_name character varying(100) DEFAULT '',
    type character varying(20) DEFAULT 'cloud' CHECK (type IN ('cloud', 'local')),
    api_key character varying(500) DEFAULT '',
    base_url character varying(500) DEFAULT '',
    model character varying(200) DEFAULT '',
    enabled boolean DEFAULT false,
    is_default boolean DEFAULT false,
    priority integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    extra_config text DEFAULT '',
    use_count bigint DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.llm_provider_models (
    id bigserial PRIMARY KEY,
    provider_id bigint NOT NULL REFERENCES public.llm_providers(id) ON DELETE CASCADE,
    model_id character varying(200) NOT NULL,
    display_name character varying(200) DEFAULT '',
    enabled boolean NOT NULL DEFAULT true,
    is_default boolean NOT NULL DEFAULT false,
    capability_tags text DEFAULT '',
    context_window integer DEFAULT 0,
    default_for character varying(120) DEFAULT '',
    priority integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    extra_config text DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT llm_provider_models_provider_model_unique UNIQUE (provider_id, model_id)
);

ALTER TABLE public.llm_provider_models
    ADD COLUMN IF NOT EXISTS display_name character varying(200) DEFAULT '',
    ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS capability_tags text DEFAULT '',
    ADD COLUMN IF NOT EXISTS context_window integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS default_for character varying(120) DEFAULT '',
    ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS extra_config text DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_llm_provider_models_provider_id
    ON public.llm_provider_models(provider_id);

CREATE INDEX IF NOT EXISTS idx_llm_provider_models_enabled
    ON public.llm_provider_models(provider_id, enabled, priority DESC, sort_order ASC);

INSERT INTO public.llm_provider_models (
    provider_id,
    model_id,
    display_name,
    enabled,
    is_default,
    capability_tags,
    default_for,
    priority,
    sort_order,
    extra_config
)
SELECT
    provider.id,
    provider.model,
    provider.model,
    true,
    true,
    'chat,reasoning,coding',
    'chat,foundation,plan,implement,repair',
    provider.priority,
    provider.sort_order,
    provider.extra_config
FROM public.llm_providers provider
WHERE COALESCE(provider.model, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.llm_provider_models model
    WHERE model.provider_id = provider.id
      AND model.model_id = provider.model
  );

-- 9. 系统配置表
CREATE TABLE IF NOT EXISTS public.system_config (
    id bigserial PRIMARY KEY,
    key character varying(100) NOT NULL UNIQUE,
    value text DEFAULT '',
    value_type character varying(20) DEFAULT 'string',
    description character varying(255) DEFAULT '',
    updated_at timestamp with time zone DEFAULT now()
);

-- 10. 管理员设置表（分类配置，仅管理员可操作）
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id bigserial PRIMARY KEY,
    category character varying(50) NOT NULL DEFAULT 'general',
    key character varying(100) NOT NULL UNIQUE,
    value text DEFAULT '',
    value_type character varying(20) DEFAULT 'string',
    description character varying(255) DEFAULT '',
    is_public boolean DEFAULT false,
    updated_by uuid REFERENCES public.admins(id),
    updated_at timestamp with time zone DEFAULT now()
);

-- 11. 管理员审计日志表
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id bigserial PRIMARY KEY,
    admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    action character varying(100) NOT NULL,
    target_type character varying(50) DEFAULT '',
    target_id character varying(100) DEFAULT '',
    detail text DEFAULT '',
    ip_address character varying(50) DEFAULT '',
    created_at timestamp with time zone DEFAULT now()
);

-- 12. 企业组织治理表（Phase 6 readiness 真源，不直接改变认证或租户隔离）
CREATE TABLE IF NOT EXISTS public.enterprise_organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug character varying(100) NOT NULL UNIQUE,
    display_name character varying(120) NOT NULL DEFAULT '',
    status character varying(32) NOT NULL DEFAULT 'active',
    source character varying(32) NOT NULL DEFAULT 'manual',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.enterprise_organizations(id) ON DELETE CASCADE,
    slug character varying(100) NOT NULL,
    display_name character varying(120) NOT NULL DEFAULT '',
    status character varying(32) NOT NULL DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enterprise_teams_org_slug_unique UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.enterprise_members (
    id bigserial PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.enterprise_organizations(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.enterprise_teams(id) ON DELETE SET NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role character varying(32) NOT NULL DEFAULT 'member',
    status character varying(32) NOT NULL DEFAULT 'active',
    source character varying(32) NOT NULL DEFAULT 'manual',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enterprise_members_org_user_team_unique UNIQUE (organization_id, user_id, team_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_id_unique ON public.projects(project_id);

CREATE TABLE IF NOT EXISTS public.enterprise_project_ownerships (
    id bigserial PRIMARY KEY,
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.enterprise_organizations(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.enterprise_teams(id) ON DELETE SET NULL,
    status character varying(32) NOT NULL DEFAULT 'active',
    source character varying(32) NOT NULL DEFAULT 'migration_readiness',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enterprise_project_ownerships_project_unique UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS public.enterprise_project_access_guard_activation_audits (
    id bigserial PRIMARY KEY,
    event_type character varying(64) NOT NULL,
    status character varying(32) NOT NULL DEFAULT 'planned',
    actor_admin_id uuid REFERENCES public.admins(id) ON DELETE SET NULL,
    readiness_status character varying(64) NOT NULL DEFAULT '',
    current_mode character varying(32) NOT NULL DEFAULT 'legacy_user_owned',
    target_mode character varying(32) NOT NULL DEFAULT 'enterprise_owned',
    readiness_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    blocker_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    review_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    audit_plan_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
    rollback_reference text NOT NULL DEFAULT '',
    source character varying(64) NOT NULL DEFAULT 'activation_audit_schema_readiness',
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_audit_export_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key character varying(128) NOT NULL UNIQUE,
    requested_by_admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
    status character varying(32) NOT NULL DEFAULT 'queued',
    format character varying(16) NOT NULL DEFAULT 'jsonl',
    reason text NOT NULL DEFAULT '',
    filters_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    time_range_start timestamp with time zone NOT NULL,
    time_range_end timestamp with time zone NOT NULL,
    request_schema_version character varying(80) NOT NULL DEFAULT '',
    file_schema_version character varying(80) NOT NULL DEFAULT '',
    output_path text NOT NULL DEFAULT '',
    checksum_sha256 character varying(64) NOT NULL DEFAULT '',
    row_count bigint NOT NULL DEFAULT 0,
    error_message text NOT NULL DEFAULT '',
    source character varying(64) NOT NULL DEFAULT 'audit_export_task_persistence_readiness',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_audit_export_delivery_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key character varying(128) NOT NULL UNIQUE,
    requested_by_admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
    reason text NOT NULL DEFAULT '',
    report_format character varying(32) NOT NULL DEFAULT 'markdown',
    report_content text NOT NULL DEFAULT '',
    report_content_byte_count bigint NOT NULL DEFAULT 0,
    generated_at timestamp with time zone NOT NULL DEFAULT now(),
    checksum_sha256 character varying(64) NOT NULL DEFAULT '',
    storage_path text NOT NULL DEFAULT '',
    storage_schema_version character varying(80) NOT NULL DEFAULT '',
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    source character varying(64) NOT NULL DEFAULT 'audit_export_delivery_report_storage_write',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enterprise_audit_export_worker_execution_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key character varying(128) NOT NULL UNIQUE,
    task_id uuid NOT NULL REFERENCES public.enterprise_audit_export_tasks(id) ON DELETE RESTRICT,
    requested_by_admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
    status character varying(32) NOT NULL DEFAULT 'requested',
    reason text NOT NULL DEFAULT '',
    batch_limit integer NOT NULL DEFAULT 10,
    request_schema_version character varying(80) NOT NULL DEFAULT '',
    worker_readiness_status character varying(80) NOT NULL DEFAULT '',
    status_transition_readiness_status character varying(80) NOT NULL DEFAULT '',
    task_readback_status character varying(80) NOT NULL DEFAULT '',
    queued_task_count integer NOT NULL DEFAULT 0,
    request_payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    readiness_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    execution_result jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_path text NOT NULL DEFAULT '',
    checksum_sha256 character varying(64) NOT NULL DEFAULT '',
    row_count bigint NOT NULL DEFAULT 0,
    error_message text NOT NULL DEFAULT '',
    source character varying(64) NOT NULL DEFAULT 'audit_export_worker_execution_request_persistence_readiness',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

CREATE INDEX IF NOT EXISTS idx_admins_email ON public.admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_role ON public.admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_status ON public.admins(status);

CREATE INDEX IF NOT EXISTS idx_admin_roles_name ON public.admin_roles(name);
CREATE INDEX IF NOT EXISTS idx_admin_roles_status ON public.admin_roles(status);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_code ON public.admin_permissions(code);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role_id ON public.admin_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_permission_id ON public.admin_role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_admin_id ON public.admin_user_roles(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role_id ON public.admin_user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_id ON public.projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON public.project_files(project_id, path);

CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON public.chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_commits_project_id ON public.commits(project_id);
CREATE INDEX IF NOT EXISTS idx_commits_user_id ON public.commits(user_id);
CREATE INDEX IF NOT EXISTS idx_commits_hash ON public.commits(hash);
CREATE INDEX IF NOT EXISTS idx_commits_created_at ON public.commits(created_at);

CREATE INDEX IF NOT EXISTS idx_project_engineering_states_user_id ON public.project_engineering_states(user_id);
CREATE INDEX IF NOT EXISTS idx_project_engineering_states_workflow_stage ON public.project_engineering_states(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_project_engineering_states_workflow_status ON public.project_engineering_states(workflow_status);

CREATE INDEX IF NOT EXISTS idx_project_capability_execution_audits_project_id ON public.project_capability_execution_audits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_capability_execution_audits_user_id ON public.project_capability_execution_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_project_capability_execution_audits_workflow_stage ON public.project_capability_execution_audits(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_project_capability_execution_audits_capability_profile ON public.project_capability_execution_audits(capability_profile);
CREATE INDEX IF NOT EXISTS idx_project_capability_execution_audits_status ON public.project_capability_execution_audits(status);

CREATE INDEX IF NOT EXISTS idx_project_resource_alert_events_project_id ON public.project_resource_alert_events(project_id);
CREATE INDEX IF NOT EXISTS idx_project_resource_alert_events_user_id ON public.project_resource_alert_events(user_id);
CREATE INDEX IF NOT EXISTS idx_project_resource_alert_events_status ON public.project_resource_alert_events(status);
CREATE INDEX IF NOT EXISTS idx_project_resource_alert_events_evaluation_id ON public.project_resource_alert_events(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_project_resource_alert_events_readiness_status ON public.project_resource_alert_events(readiness_status);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_project_id ON public.generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_lease_expires_at ON public.generation_jobs(lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON public.generation_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_attempts_job_id ON public.generation_attempts(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_attempts_status ON public.generation_attempts(status);
CREATE INDEX IF NOT EXISTS idx_generation_events_job_sequence ON public.generation_events(job_id, sequence);
CREATE INDEX IF NOT EXISTS idx_generation_events_project_id ON public.generation_events(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_events_event_type ON public.generation_events(event_type);

CREATE INDEX IF NOT EXISTS idx_llm_providers_enabled ON public.llm_providers(enabled);
CREATE INDEX IF NOT EXISTS idx_llm_providers_is_default ON public.llm_providers(is_default);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(key);

CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON public.admin_settings(category);
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON public.admin_settings(key);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_enterprise_organizations_status ON public.enterprise_organizations(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_teams_organization_id ON public.enterprise_teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_teams_status ON public.enterprise_teams(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_organization_id ON public.enterprise_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_team_id ON public.enterprise_members(team_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_user_id ON public.enterprise_members(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_members_status ON public.enterprise_members(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_project_ownerships_organization_id ON public.enterprise_project_ownerships(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_project_ownerships_team_id ON public.enterprise_project_ownerships(team_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_project_ownerships_status ON public.enterprise_project_ownerships(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_project_access_guard_activation_audits_event_type ON public.enterprise_project_access_guard_activation_audits(event_type);
CREATE INDEX IF NOT EXISTS idx_enterprise_project_access_guard_activation_audits_status ON public.enterprise_project_access_guard_activation_audits(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_project_access_guard_activation_audits_created_at ON public.enterprise_project_access_guard_activation_audits(created_at);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_tasks_requested_by_admin_id ON public.enterprise_audit_export_tasks(requested_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_tasks_status ON public.enterprise_audit_export_tasks(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_tasks_time_range_start ON public.enterprise_audit_export_tasks(time_range_start);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_tasks_time_range_end ON public.enterprise_audit_export_tasks(time_range_end);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_tasks_created_at ON public.enterprise_audit_export_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_delivery_reports_requested_by_admin_id ON public.enterprise_audit_export_delivery_reports(requested_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_delivery_reports_checksum_sha256 ON public.enterprise_audit_export_delivery_reports(checksum_sha256);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_delivery_reports_storage_path ON public.enterprise_audit_export_delivery_reports(storage_path);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_delivery_reports_generated_at ON public.enterprise_audit_export_delivery_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_delivery_reports_created_at ON public.enterprise_audit_export_delivery_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_worker_execution_requests_task_id ON public.enterprise_audit_export_worker_execution_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_worker_execution_requests_requested_by_admin_id ON public.enterprise_audit_export_worker_execution_requests(requested_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_worker_execution_requests_status ON public.enterprise_audit_export_worker_execution_requests(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_export_worker_execution_requests_created_at ON public.enterprise_audit_export_worker_execution_requests(created_at);

-- ============================================================
-- RLS（行级安全）策略
-- ============================================================

-- 启用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_engineering_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_capability_execution_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_resource_alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_project_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deployment_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deployment_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deployment_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deployment_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_project_ownerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_project_access_guard_activation_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_export_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_export_delivery_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_export_worker_execution_requests ENABLE ROW LEVEL SECURITY;

-- PostgreSQL 不支持 CREATE POLICY IF NOT EXISTS；重建可保证本基线重复执行。
-- users: 用户只能读写自己的记录
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Service role full access on users" ON public.users;
CREATE POLICY "Service role full access on users" ON public.users FOR ALL USING (auth.role() = 'service_role');

-- admins: 仅 service_role 可操作
DROP POLICY IF EXISTS "Service role full access on admins" ON public.admins;
CREATE POLICY "Service role full access on admins" ON public.admins FOR ALL USING (auth.role() = 'service_role');

-- admin RBAC: 仅 service_role 可操作
DROP POLICY IF EXISTS "Service role full access on admin_roles" ON public.admin_roles;
CREATE POLICY "Service role full access on admin_roles" ON public.admin_roles FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on admin_permissions" ON public.admin_permissions;
CREATE POLICY "Service role full access on admin_permissions" ON public.admin_permissions FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on admin_role_permissions" ON public.admin_role_permissions;
CREATE POLICY "Service role full access on admin_role_permissions" ON public.admin_role_permissions FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on admin_user_roles" ON public.admin_user_roles;
CREATE POLICY "Service role full access on admin_user_roles" ON public.admin_user_roles FOR ALL USING (auth.role() = 'service_role');

-- projects: 用户可操作自己的项目
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access on projects" ON public.projects;
CREATE POLICY "Service role full access on projects" ON public.projects FOR ALL USING (auth.role() = 'service_role');

-- project_files: 通过项目关联控制
DROP POLICY IF EXISTS "Service role full access on project_files" ON public.project_files;
CREATE POLICY "Service role full access on project_files" ON public.project_files FOR ALL USING (auth.role() = 'service_role');

-- chat_messages: 用户可查看自己项目的消息
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT USING (
    project_id IN (SELECT project_id FROM public.projects WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Service role full access on chat_messages" ON public.chat_messages;
CREATE POLICY "Service role full access on chat_messages" ON public.chat_messages FOR ALL USING (auth.role() = 'service_role');

-- commits: Git 快照记录仅由后端 service_role 同步
DROP POLICY IF EXISTS "Service role full access on commits" ON public.commits;
CREATE POLICY "Service role full access on commits" ON public.commits FOR ALL USING (auth.role() = 'service_role');

-- project governance state/audit/events: 仅 service_role 可操作
DROP POLICY IF EXISTS "Service role full access on project_engineering_states" ON public.project_engineering_states;
CREATE POLICY "Service role full access on project_engineering_states" ON public.project_engineering_states FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_capability_execution_audits" ON public.project_capability_execution_audits;
CREATE POLICY "Service role full access on project_capability_execution_audits" ON public.project_capability_execution_audits FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_resource_alert_events" ON public.project_resource_alert_events;
CREATE POLICY "Service role full access on project_resource_alert_events" ON public.project_resource_alert_events FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on generation_jobs" ON public.generation_jobs;
CREATE POLICY "Service role full access on generation_jobs" ON public.generation_jobs FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on generation_attempts" ON public.generation_attempts;
CREATE POLICY "Service role full access on generation_attempts" ON public.generation_attempts FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on generation_events" ON public.generation_events;
CREATE POLICY "Service role full access on generation_events" ON public.generation_events FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on github_connections" ON public.github_connections;
CREATE POLICY "Service role full access on github_connections" ON public.github_connections FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on github_oauth_states" ON public.github_oauth_states;
CREATE POLICY "Service role full access on github_oauth_states" ON public.github_oauth_states FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on github_project_bindings" ON public.github_project_bindings;
CREATE POLICY "Service role full access on github_project_bindings" ON public.github_project_bindings FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on github_sync_operations" ON public.github_sync_operations;
CREATE POLICY "Service role full access on github_sync_operations" ON public.github_sync_operations FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on github_webhook_deliveries" ON public.github_webhook_deliveries;
CREATE POLICY "Service role full access on github_webhook_deliveries" ON public.github_webhook_deliveries FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_deployment_bindings" ON public.project_deployment_bindings;
CREATE POLICY "Service role full access on project_deployment_bindings" ON public.project_deployment_bindings FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_deployment_releases" ON public.project_deployment_releases;
CREATE POLICY "Service role full access on project_deployment_releases" ON public.project_deployment_releases FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_deployment_domains" ON public.project_deployment_domains;
CREATE POLICY "Service role full access on project_deployment_domains" ON public.project_deployment_domains FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_deployment_operations" ON public.project_deployment_operations;
CREATE POLICY "Service role full access on project_deployment_operations" ON public.project_deployment_operations FOR ALL USING (auth.role() = 'service_role');

-- llm_providers: 仅管理员/service_role 可操作
DROP POLICY IF EXISTS "Anyone can view enabled providers" ON public.llm_providers;
CREATE POLICY "Anyone can view enabled providers" ON public.llm_providers FOR SELECT USING (enabled = true);
DROP POLICY IF EXISTS "Service role full access on llm_providers" ON public.llm_providers;
CREATE POLICY "Service role full access on llm_providers" ON public.llm_providers FOR ALL USING (auth.role() = 'service_role');

-- system_config: 公开可读，仅 service_role 可写
DROP POLICY IF EXISTS "Public read on system_config" ON public.system_config;
CREATE POLICY "Public read on system_config" ON public.system_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access on system_config" ON public.system_config;
CREATE POLICY "Service role full access on system_config" ON public.system_config FOR ALL USING (auth.role() = 'service_role');

-- admin_settings: 仅 service_role 可操作
DROP POLICY IF EXISTS "Service role full access on admin_settings" ON public.admin_settings;
CREATE POLICY "Service role full access on admin_settings" ON public.admin_settings FOR ALL USING (auth.role() = 'service_role');

-- admin_audit_log: 仅 service_role 可操作
DROP POLICY IF EXISTS "Service role full access on admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "Service role full access on admin_audit_log" ON public.admin_audit_log FOR ALL USING (auth.role() = 'service_role');

-- enterprise governance: 当前仅 service_role 可操作，Admin API 通过后端只读聚合暴露 readiness
DROP POLICY IF EXISTS "Service role full access on enterprise_organizations" ON public.enterprise_organizations;
CREATE POLICY "Service role full access on enterprise_organizations" ON public.enterprise_organizations FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_teams" ON public.enterprise_teams;
CREATE POLICY "Service role full access on enterprise_teams" ON public.enterprise_teams FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_members" ON public.enterprise_members;
CREATE POLICY "Service role full access on enterprise_members" ON public.enterprise_members FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_project_ownerships" ON public.enterprise_project_ownerships;
CREATE POLICY "Service role full access on enterprise_project_ownerships" ON public.enterprise_project_ownerships FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_project_access_guard_activation_audits" ON public.enterprise_project_access_guard_activation_audits;
CREATE POLICY "Service role full access on enterprise_project_access_guard_activation_audits" ON public.enterprise_project_access_guard_activation_audits FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_audit_export_tasks" ON public.enterprise_audit_export_tasks;
CREATE POLICY "Service role full access on enterprise_audit_export_tasks" ON public.enterprise_audit_export_tasks FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_audit_export_delivery_reports" ON public.enterprise_audit_export_delivery_reports;
CREATE POLICY "Service role full access on enterprise_audit_export_delivery_reports" ON public.enterprise_audit_export_delivery_reports FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on enterprise_audit_export_worker_execution_requests" ON public.enterprise_audit_export_worker_execution_requests;
CREATE POLICY "Service role full access on enterprise_audit_export_worker_execution_requests" ON public.enterprise_audit_export_worker_execution_requests FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 默认数据
-- ============================================================

-- 默认超级管理员（初始密码: admin123；首次登录后必须修改）
INSERT INTO public.admins (
    id,
    email,
    username,
    password_hash,
    role,
    status,
    must_change_password,
    auth_version
)
VALUES (
    gen_random_uuid(),
    'admin@yistack.com',
    'superadmin',
    '$2a$10$UVTX/AjhsgI3Lk63RYMrs.hCZBs4G4adjfrwtOtUzqTe4CFE2ZGw2',
    'super_admin',
    'active',
    true,
    1
) ON CONFLICT (email) DO NOTHING;

UPDATE public.admins
SET must_change_password = true
WHERE email = 'admin@yistack.com'
  AND password_hash = '$2a$10$UVTX/AjhsgI3Lk63RYMrs.hCZBs4G4adjfrwtOtUzqTe4CFE2ZGw2';

-- 默认管理员权限点
INSERT INTO public.admin_permissions (code, name, description) VALUES
    ('system.config.read', '读取系统配置', '查看系统配置'),
    ('system.config.update', '更新系统配置', '修改系统配置'),
    ('system.container_config.read', '读取容器配置', '查看容器运行时配置'),
    ('system.container_config.update', '更新容器配置', '修改容器运行时配置'),
    ('user.read', '查看用户', '查看用户列表与详情'),
    ('user.update', '更新用户', '修改用户状态与角色'),
    ('user.delete', '删除用户', '删除或禁用用户'),
    ('audit.read', '查看审计日志', '查看管理员操作日志'),
    ('llm.provider.manage', '管理 LLM Provider', '创建、修改、删除与重载 LLM Provider')
ON CONFLICT (code) DO NOTHING;

-- 默认管理员角色（兼容现有 admin 账号）
INSERT INTO public.admin_roles (name, display_name, description, is_system, status)
VALUES (
    'default_admin',
    '默认管理员',
    '内置管理员角色，覆盖当前后台管理功能',
    true,
    'active'
) ON CONFLICT (name) DO NOTHING;

-- 默认管理员角色绑定权限
INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.admin_roles r
JOIN public.admin_permissions p ON p.code IN (
    'system.config.read',
    'system.config.update',
    'system.container_config.read',
    'system.container_config.update',
    'user.read',
    'user.update',
    'user.delete',
    'audit.read',
    'llm.provider.manage'
)
WHERE r.name = 'default_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 将现有 admin 系统角色管理员绑定到默认管理员角色
INSERT INTO public.admin_user_roles (admin_id, role_id)
SELECT a.id, r.id
FROM public.admins a
JOIN public.admin_roles r ON r.name = 'default_admin'
WHERE a.role = 'admin'
ON CONFLICT (admin_id, role_id) DO NOTHING;

-- 默认 LLM 提供商
INSERT INTO public.llm_providers (name, display_name, type, base_url, model, enabled, is_default, priority, sort_order) VALUES
    ('doubao', '豆包 (Doubao)', 'cloud', 'https://ark.cn-beijing.volces.com/api/v3', 'doubao-pro-32k', false, false, 10, 1),
    ('openai', 'OpenAI', 'cloud', 'https://api.openai.com/v1', 'gpt-4o', false, false, 20, 2),
    ('qwen', '通义千问 (Qwen)', 'cloud', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-max', false, false, 15, 3),
    ('deepseek', 'DeepSeek', 'cloud', 'https://api.deepseek.com/v1', 'deepseek-chat', false, false, 25, 4),
    ('kimi', 'Kimi (Moonshot)', 'cloud', 'https://api.moonshot.cn/v1', 'moonshot-v1-8k', false, false, 30, 5),
    ('ollama', 'Ollama (本地)', 'local', 'http://localhost:11434', 'qwen2.5:7b', false, false, 5, 6),
    ('ollama-cloud', 'Ollama (云端部署)', 'cloud', 'https://ollama.com', 'llama3.2', false, false, 5, 7)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.llm_provider_models (
    provider_id,
    model_id,
    display_name,
    enabled,
    is_default,
    capability_tags,
    default_for,
    priority,
    sort_order,
    extra_config
)
SELECT
    provider.id,
    provider.model,
    provider.model,
    true,
    true,
    'chat,reasoning,coding',
    'chat,foundation,plan,implement,repair',
    provider.priority,
    provider.sort_order,
    provider.extra_config
FROM public.llm_providers provider
WHERE COALESCE(provider.model, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.llm_provider_models model
    WHERE model.provider_id = provider.id
      AND model.model_id = provider.model
  );

-- 默认系统配置
INSERT INTO public.system_config (key, value, value_type, description) VALUES
    ('app_name', 'YiStack', 'string', '应用名称'),
    ('app_version', '1.0.0', 'string', '应用版本'),
    ('max_projects_per_user', '10', 'number', '每用户最大项目数'),
    ('max_file_size_mb', '50', 'number', '单文件最大大小(MB)'),
    ('container_idle_timeout_min', '30', 'number', '容器空闲超时(分钟)'),
    ('default_llm_provider', 'doubao', 'string', '默认LLM提供商'),
    ('enable_registration', 'true', 'boolean', '是否允许注册'),
    ('enterprise.sso.enabled', 'false', 'boolean', '企业 SSO 配置开关；仅表示配置 readiness，不启用登录回调'),
    ('enterprise.sso.provider_type', 'oidc', 'string', '企业 SSO provider 类型，当前仅作为 readiness 配置保留'),
    ('enterprise.sso.issuer_url', '', 'string', '企业 SSO OIDC issuer URL，留空表示未配置'),
    ('enterprise.sso.client_id', '', 'string', '企业 SSO OIDC client_id，留空表示未配置'),
    ('enterprise.sso.redirect_uri', '', 'string', '企业 SSO 登录回调地址，留空表示未配置'),
    ('enterprise.sso.allowed_domains', '[]', 'json', '允许使用企业 SSO 的邮箱域名列表(JSON)，空数组表示未限制'),
    ('enterprise.audit.retention_days', '180', 'number', '企业审计日志保留天数；仅用于 readiness，不执行自动删除'),
    ('enterprise.project_access_guard.mode', 'legacy_user_owned', 'string', 'Project Access Guard 授权模式：legacy_user_owned 或 enterprise_owned；默认保持用户归属授权'),
    ('system.maintenance_mode', 'false', 'boolean', '维护模式'),
    ('system.registration_mode', 'open', 'string', '注册模式: open/invite/closed'),
    ('system.max_upload_size', '10485760', 'number', '最大上传大小（字节），运行期后台配置'),
    ('project.max_size', '2147483648', 'number', '项目目录最大大小（字节），后台运行期配置'),
    ('project.max_file_size', '10485760', 'number', '项目单文件最大大小（字节），后台运行期配置'),
    ('project.allowed_extensions', '.go,.py,.js,.ts,.tsx,.jsx,.html,.css,.json,.yaml,.yml,.md,.txt,.sql,.sh', 'string', '允许写入/备份治理的项目文件扩展名列表，逗号分隔'),
    ('project.auto_backup', 'true', 'boolean', '是否启用项目自动备份策略'),
    ('project.backup_dir', '', 'string', '项目备份根目录；留空时使用启动配置或默认 runtime/backups'),
    ('project.auto_backup_interval_seconds', '3600', 'number', '项目自动备份调度间隔（秒），<=0 表示禁用后台调度'),
    ('project.backup_remote_enabled', 'false', 'boolean', '是否启用项目远端备份存储'),
    ('project.backup_remote_provider', '', 'string', '项目远端备份存储 provider，例如 s3'),
    ('project.backup_remote_bucket', '', 'string', '项目远端备份存储 bucket'),
    ('project.backup_remote_prefix', 'yistack/project-backups', 'string', '项目远端备份对象前缀'),
    ('project.backup_remote_endpoint', '', 'string', '项目远端备份 S3-compatible endpoint'),
    ('project.backup_remote_region', '', 'string', '项目远端备份区域'),
    ('project.generation_repair_max_attempts', '2', 'number', '生成项目 Validation 失败后的自动修复轮数，硬上限为 3'),
    ('project.generation_repair_timeout_seconds', '90', 'number', '单轮生成项目自动修复 LLM 请求超时秒数'),
    ('project.generation_repair_max_output_units', '4096', 'number', '单轮生成项目自动修复最大输出 token 数'),
    ('project.browser_acceptance_timeout_seconds', '45', 'number', '生成项目 Playwright 浏览器验收超时秒数，硬上限为 120'),
    ('project.resource_alert_enabled', 'false', 'boolean', '是否启用项目资源告警策略 readiness'),
    ('project.resource_alert_cpu_percent', '0', 'number', '项目 CPU 使用率告警阈值百分比，<=0 表示未配置'),
    ('project.resource_alert_memory_percent', '0', 'number', '项目内存使用率告警阈值百分比，<=0 表示未配置'),
    ('project.resource_alert_disk_bytes', '0', 'number', '项目磁盘使用告警阈值（字节），<=0 表示未配置'),
    ('project.resource_alert_notification_enabled', 'false', 'boolean', '是否启用项目资源告警通知通道 readiness'),
    ('project.resource_alert_notification_provider', '', 'string', '项目资源告警通知 provider，例如 webhook；webhook URL 需走受控 secret storage'),
    ('project.resource_alert_enforcement_enabled', 'false', 'boolean', '是否启用项目资源告警硬配额执行 readiness'),
    ('project.resource_alert_enforcement_mode', '', 'string', '项目资源告警硬配额执行模式，例如 stop_container'),
    ('capability.enable_skill_provider', 'false', 'boolean', '是否允许 Skill provider 被解析为可用'),
    ('capability.enable_mcp_provider', 'false', 'boolean', '是否允许 MCP provider 被解析为可用'),
    ('capability.enable_skill_execution', 'false', 'boolean', '是否允许真实调用 Skill runner'),
    ('capability.enable_mcp_execution', 'false', 'boolean', '是否允许真实调用 MCP runner'),
    ('capability.skill_runner_mode', '', 'string', 'Skill runner 模式：空值、dry-run、contract、skill-http'),
    ('capability.mcp_runner_mode', '', 'string', 'MCP runner 模式：空值、dry-run、contract、mcp-http'),
    ('capability.skill_runner_manifest', '', 'string', 'Skill contract runner manifest 路径'),
    ('capability.mcp_runner_manifest', '', 'string', 'MCP contract runner manifest 路径'),
    ('capability.skill_runner_endpoint', '', 'string', 'Skill HTTP runner endpoint'),
    ('capability.mcp_runner_endpoint', '', 'string', 'MCP HTTP runner endpoint'),
    ('capability.runner_timeout_seconds', '30', 'number', '外部 capability runner 统一超时时间（秒）'),
    ('capability.runner_network_enabled', 'false', 'boolean', '是否允许真实 capability runner 发起网络调用'),
    ('capability.runner_network_allowlist', '', 'string', '允许真实 capability runner 访问的网络目标，逗号分隔'),
    ('capability.execution_policy_note', '后台配置未启用外部 Skill / MCP 执行；默认保持能力调用禁用。', 'string', 'Capability 执行策略来源说明'),
    ('template.project_docs.agents_md', '', 'string', '项目 AGENTS.md 模板覆盖，留空使用内置模板'),
    ('template.project_docs.requirements_md', '', 'string', '项目 REQUIREMENTS.md 模板覆盖，留空使用内置模板'),
    ('template.project_docs.design_md', '', 'string', '项目 DESIGN.md 模板覆盖，留空使用内置模板'),
    ('template.project_docs.runbook_md', '', 'string', '项目 RUNBOOK.md 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.default.readme_md', '', 'string', '默认脚手架 README.md 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.go_gin.dockerfile', '', 'string', 'Go Gin 脚手架 Dockerfile 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.go_gin.go_mod', '', 'string', 'Go Gin 脚手架 go.mod 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.go_gin.main_go', '', 'string', 'Go Gin 脚手架 main.go 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.node_nextjs.gitignore', '', 'string', 'Node Next.js 脚手架 .gitignore 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.node_nextjs.package_json', '', 'string', 'Node Next.js 脚手架 package.json 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.node_nextjs.src.app.layout_tsx', '', 'string', 'Node Next.js 脚手架 app layout 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.node_nextjs.src.app.page_tsx', '', 'string', 'Node Next.js 脚手架 app page 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.node_nextjs.tsconfig_json', '', 'string', 'Node Next.js 脚手架 tsconfig.json 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.python_fastapi.dockerfile', '', 'string', 'Python FastAPI 脚手架 Dockerfile 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.python_fastapi.main_py', '', 'string', 'Python FastAPI 脚手架 main.py 模板覆盖，留空使用内置模板'),
    ('template.project_scaffolds.python_fastapi.requirements_txt', '', 'string', 'Python FastAPI 脚手架 requirements.txt 模板覆盖，留空使用内置模板'),
    ('container.enabled', 'true', 'boolean', '是否启用项目容器运行时'),
    ('container.runtime', 'podman', 'string', '容器运行时: podman/docker'),
    ('container.socket_path', '', 'string', '容器运行时 Socket 路径（留空时自动使用当前用户 Podman socket）'),
    ('container.project_dir', '', 'string', '项目代码宿主机根目录（留空时使用环境变量或默认 runtime/projects）'),
    ('container.template_dir', '', 'string', '项目模板根目录（留空时使用环境变量或默认 runtime/templates）'),
    ('container.data_dir', '', 'string', '容器相关数据目录（留空时使用环境变量或默认 runtime/container-data）'),
    ('container.port_range_start', '30000', 'number', '容器映射端口起始值'),
    ('container.port_range_end', '40000', 'number', '容器映射端口结束值'),
    ('container.default_cpu', '1', 'string', '默认 CPU 配额'),
    ('container.default_memory', '1g', 'string', '默认内存配额'),
    ('container.default_disk', '2g', 'string', '默认磁盘配额'),
    ('container.idle_timeout_min', '15', 'number', '工作台容器空闲自动停止时间(分钟)'),
    ('container.apt_mirror', 'https://mirrors.tuna.tsinghua.edu.cn', 'string', '容器内 apt 镜像源基地址，例如 https://mirrors.tuna.tsinghua.edu.cn'),
    ('container.apt_mirror_candidates', '[{"url":"https://mirrors.tuna.tsinghua.edu.cn","priority":1,"enabled":true},{"url":"https://mirrors.ustc.edu.cn","priority":2,"enabled":true},{"url":"https://mirrors.aliyun.com","priority":3,"enabled":true},{"url":"https://mirrors.cloud.tencent.com","priority":4,"enabled":true}]', 'json', '容器内 apt 候选镜像源列表(JSON)，支持字符串数组或带 url/priority/enabled 的对象数组'),
    ('container.images', '[{"type":"node-nextjs","name":"Node Devbox","image":"localhost/devbox:bookworm","port":3000,"priority":10,"description":"Next.js/Node 项目默认开发镜像"},{"type":"node-react","name":"Node Devbox","image":"localhost/devbox:bookworm","port":5173,"priority":20,"description":"React/Vite 项目默认开发镜像"},{"type":"node-vue","name":"Node Devbox","image":"localhost/devbox:bookworm","port":5173,"priority":30,"description":"Vue 项目默认开发镜像"},{"type":"node-express","name":"Node Devbox","image":"localhost/devbox:bookworm","port":3000,"priority":40,"description":"Node 服务项目默认开发镜像"},{"type":"static-html","name":"Node Devbox","image":"localhost/devbox:bookworm","port":3000,"priority":50,"description":"静态站点项目默认开发镜像"},{"type":"default","name":"Default Runtime Image","image":"localhost/devbox:bookworm","port":3000,"priority":1000,"description":"未命中专用 profile 时使用的默认运行时镜像"}]', 'json', '可用容器镜像列表(JSON)，支持按 runtime profile 选择镜像，并在未命中时回退到 default 默认镜像'),
    ('prompt.project_plans.system', '你是一个应用架构师。用户描述需求，你需要生成 2-3 个技术方案供用户选择。\n\n每个方案必须严格以 JSON 格式输出，包含以下字段：\n- id: 方案唯一标识，格式 plan_xxx\n- name: 方案名称（简短）\n- description: 方案描述（1-2句话）\n- tech_stack: 结构化技术栈对象，必须包含 runtime.profile、runtime.languages 和 summary。runtime.profile 从以下选择：node-nextjs, node-react, node-vue, node-express, python-fastapi, python-django, python-flask, go-gin, go-fiber, static-html。需要 MySQL/Redis 时必须在 services 中声明。示例：{"runtime":{"profile":"python-django","needs_container":true,"package_manager":"pip","languages":[{"name":"python","version":"3.11"},{"name":"node","version":"20"}]},"frontend":{"language":"TypeScript","framework":"React","ui":"Tailwind CSS"},"backend":{"language":"Python","framework":"Django"},"database":{"type":"MySQL"},"services":[{"type":"mysql"},{"type":"redis"}],"summary":["TypeScript","React","Python","Django","MySQL","Redis"]}\n- architecture: 架构说明\n- complexity: 复杂度评估 simple/medium/complex\n- est_files: 预估文件数量\n- features: 包含的核心功能列表\n- reasoning: 为什么推荐这个方案\n\n请以 JSON 数组格式输出所有方案，不要输出其他内容。', 'string', '项目方案生成的系统提示词'),
    ('prompt.chat.discuss.system', $$你是 YiStack 的企业级项目技术顾问。

你的当前任务是“探讨”，不是“直接实现”。

要求：
1. 只做分析、澄清、方案权衡、实现建议与风险提示。
2. 不要声称已经修改文件、执行命令、启动容器或完成提交。
3. 如果用户的问题涉及当前项目，优先结合项目上下文回答。
4. 回答要直接、结构清晰，优先给出下一步建议。$$, 'string', '探讨模式的系统提示词'),
    ('prompt.chat.implement.system', $$你是一个应用生成助手。用户描述需求，你需要生成相应的代码文件。

生成结果必须遵循系统追加的“生成结果协议（强制）”，不得输出协议外内容。
确保生成的代码完整、可运行。$$, 'string', '实现模式的系统提示词')
ON CONFLICT (key) DO NOTHING;

-- 默认管理员设置
INSERT INTO public.admin_settings (category, key, value, value_type, description, is_public) VALUES
    ('llm', 'default_provider', 'doubao', 'string', '默认LLM提供商', true),
    ('llm', 'default_model', 'doubao-pro-32k', 'string', '默认模型', true),
    ('llm', 'max_tokens', '4096', 'number', '最大token数', true),
    ('llm', 'temperature', '0.7', 'number', '默认温度', true),
    ('llm', 'stream_enabled', 'true', 'boolean', '启用流式输出', true),
    ('container', 'default_image_base', 'localhost/devbox:bookworm', 'string', '动态开发基础镜像', false),
    ('container', 'port_range_start', '30000', 'number', '容器端口范围起始', false),
    ('container', 'port_range_end', '40000', 'number', '容器端口范围结束', false),
    ('security', 'jwt_expiry_hours', '24', 'number', 'JWT过期时间(小时)', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 更新触发器（自动更新 updated_at）
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PostgreSQL 不支持 CREATE TRIGGER IF NOT EXISTS；重建可保证本基线重复执行。
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_admins_updated_at ON public.admins;
CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_admin_roles_updated_at ON public.admin_roles;
CREATE TRIGGER update_admin_roles_updated_at BEFORE UPDATE ON public.admin_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_admin_permissions_updated_at ON public.admin_permissions;
CREATE TRIGGER update_admin_permissions_updated_at BEFORE UPDATE ON public.admin_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_project_files_updated_at ON public.project_files;
CREATE TRIGGER update_project_files_updated_at BEFORE UPDATE ON public.project_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_project_engineering_states_updated_at ON public.project_engineering_states;
CREATE TRIGGER update_project_engineering_states_updated_at BEFORE UPDATE ON public.project_engineering_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_generation_jobs_updated_at ON public.generation_jobs;
CREATE TRIGGER update_generation_jobs_updated_at BEFORE UPDATE ON public.generation_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_generation_attempts_updated_at ON public.generation_attempts;
CREATE TRIGGER update_generation_attempts_updated_at BEFORE UPDATE ON public.generation_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_llm_providers_updated_at ON public.llm_providers;
CREATE TRIGGER update_llm_providers_updated_at BEFORE UPDATE ON public.llm_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_system_config_updated_at ON public.system_config;
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings;
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_organizations_updated_at ON public.enterprise_organizations;
CREATE TRIGGER update_enterprise_organizations_updated_at BEFORE UPDATE ON public.enterprise_organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_teams_updated_at ON public.enterprise_teams;
CREATE TRIGGER update_enterprise_teams_updated_at BEFORE UPDATE ON public.enterprise_teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_members_updated_at ON public.enterprise_members;
CREATE TRIGGER update_enterprise_members_updated_at BEFORE UPDATE ON public.enterprise_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_project_ownerships_updated_at ON public.enterprise_project_ownerships;
CREATE TRIGGER update_enterprise_project_ownerships_updated_at BEFORE UPDATE ON public.enterprise_project_ownerships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_audit_export_tasks_updated_at ON public.enterprise_audit_export_tasks;
CREATE TRIGGER update_enterprise_audit_export_tasks_updated_at BEFORE UPDATE ON public.enterprise_audit_export_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_audit_export_delivery_reports_updated_at ON public.enterprise_audit_export_delivery_reports;
CREATE TRIGGER update_enterprise_audit_export_delivery_reports_updated_at BEFORE UPDATE ON public.enterprise_audit_export_delivery_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_enterprise_audit_export_worker_execution_requests_updated_at ON public.enterprise_audit_export_worker_execution_requests;
CREATE TRIGGER update_enterprise_audit_export_worker_execution_requests_updated_at BEFORE UPDATE ON public.enterprise_audit_export_worker_execution_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- R6.4 collaboration and official templates
CREATE TABLE IF NOT EXISTS public.project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role character varying(32) NOT NULL CHECK (role IN ('viewer', 'editor')),
    status character varying(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    invited_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT project_members_project_user_unique UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.project_collaboration_audits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id character varying(64) NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    action character varying(32) NOT NULL CHECK (action IN ('member_added', 'member_role_updated', 'member_removed')),
    previous_role character varying(32) DEFAULT '',
    next_role character varying(32) DEFAULT '',
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_project_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug character varying(100) NOT NULL UNIQUE,
    name character varying(255) NOT NULL,
    description text DEFAULT '',
    app_type character varying(50) NOT NULL,
    status character varying(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    current_version_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_project_template_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.official_project_templates(id) ON DELETE CASCADE,
    version integer NOT NULL CHECK (version > 0),
    status character varying(32) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'superseded')),
    manifest_json jsonb NOT NULL,
    files_json jsonb NOT NULL,
    checksum_sha256 character varying(64) NOT NULL,
    created_by character varying(64) NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT official_project_template_versions_unique UNIQUE (template_id, version)
);

DO $$ BEGIN
    ALTER TABLE public.official_project_templates
        ADD CONSTRAINT official_project_templates_current_version_fk
        FOREIGN KEY (current_version_id) REFERENCES public.official_project_template_versions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.official_project_template_audits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.official_project_templates(id) ON DELETE CASCADE,
    actor_id character varying(64) NOT NULL,
    action character varying(32) NOT NULL CHECK (action IN ('published', 'rolled_back')),
    previous_version_id uuid REFERENCES public.official_project_template_versions(id) ON DELETE SET NULL,
    next_version_id uuid REFERENCES public.official_project_template_versions(id) ON DELETE SET NULL,
    expected_current_version_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaboration_audits_project_id ON public.project_collaboration_audits(project_id);
CREATE INDEX IF NOT EXISTS idx_official_project_template_versions_template_id ON public.official_project_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_official_project_template_audits_template_id ON public.official_project_template_audits(template_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaboration_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_project_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_project_template_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on project_members" ON public.project_members;
CREATE POLICY "Service role full access on project_members" ON public.project_members FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on project_collaboration_audits" ON public.project_collaboration_audits;
CREATE POLICY "Service role full access on project_collaboration_audits" ON public.project_collaboration_audits FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on official_project_templates" ON public.official_project_templates;
CREATE POLICY "Service role full access on official_project_templates" ON public.official_project_templates FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on official_project_template_versions" ON public.official_project_template_versions;
CREATE POLICY "Service role full access on official_project_template_versions" ON public.official_project_template_versions FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access on official_project_template_audits" ON public.official_project_template_audits;
CREATE POLICY "Service role full access on official_project_template_audits" ON public.official_project_template_audits FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.mutate_project_member(
    p_action text, p_member_id uuid, p_audit_id uuid, p_project_id text,
    p_actor_user_id uuid, p_target_user_id uuid, p_role text,
    p_previous_role text, p_now timestamp with time zone
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_action IN ('member_added', 'member_role_updated') THEN
        IF p_role NOT IN ('viewer', 'editor') THEN RAISE EXCEPTION 'invalid project member role'; END IF;
        INSERT INTO public.project_members (id, project_id, user_id, role, status, invited_by_user_id, created_at, updated_at)
        VALUES (p_member_id, p_project_id, p_target_user_id, p_role, 'active', p_actor_user_id, p_now, p_now)
        ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', invited_by_user_id = EXCLUDED.invited_by_user_id, updated_at = EXCLUDED.updated_at;
    ELSIF p_action = 'member_removed' THEN
        DELETE FROM public.project_members WHERE project_id = p_project_id AND user_id = p_target_user_id;
    ELSE
        RAISE EXCEPTION 'invalid project member action';
    END IF;
    INSERT INTO public.project_collaboration_audits (id, project_id, actor_user_id, target_user_id, action, previous_role, next_role, metadata_json, created_at)
    VALUES (p_audit_id, p_project_id, p_actor_user_id, p_target_user_id, p_action, COALESCE(p_previous_role, ''), COALESCE(p_role, ''), '{}'::jsonb, p_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_official_project_template_version(
    p_template_id uuid, p_slug text, p_name text, p_description text, p_app_type text,
    p_version_id uuid, p_version integer, p_manifest jsonb, p_files jsonb,
    p_checksum text, p_expected_current_version_id uuid, p_actor_id text, p_audit_id uuid, p_now timestamp with time zone
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_template_id uuid; v_previous uuid;
BEGIN
    INSERT INTO public.official_project_templates (id, slug, name, description, app_type, status, created_at, updated_at)
    VALUES (p_template_id, p_slug, p_name, p_description, p_app_type, 'active', p_now, p_now)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, app_type = EXCLUDED.app_type, status = 'active', updated_at = EXCLUDED.updated_at
    RETURNING id, current_version_id INTO v_template_id, v_previous;
    IF v_previous IS DISTINCT FROM p_expected_current_version_id THEN RAISE EXCEPTION 'template current version conflict'; END IF;
    INSERT INTO public.official_project_template_versions (id, template_id, version, status, manifest_json, files_json, checksum_sha256, created_by, created_at)
    VALUES (p_version_id, v_template_id, p_version, 'published', p_manifest, p_files, p_checksum, p_actor_id, p_now);
    UPDATE public.official_project_templates SET current_version_id = p_version_id, updated_at = p_now WHERE id = v_template_id;
    INSERT INTO public.official_project_template_audits (id, template_id, actor_id, action, previous_version_id, next_version_id, expected_current_version_id, created_at)
    VALUES (p_audit_id, v_template_id, p_actor_id, 'published', v_previous, p_version_id, v_previous, p_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_official_project_template_version(
    p_template_id uuid, p_expected_current_version_id uuid, p_target_version_id uuid,
    p_actor_id text, p_audit_id uuid, p_now timestamp with time zone
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.official_project_template_versions WHERE id = p_target_version_id AND template_id = p_template_id) THEN
        RAISE EXCEPTION 'target template version not found';
    END IF;
    UPDATE public.official_project_templates SET current_version_id = p_target_version_id, updated_at = p_now
    WHERE id = p_template_id AND current_version_id = p_expected_current_version_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN RAISE EXCEPTION 'template current version conflict'; END IF;
    INSERT INTO public.official_project_template_audits (id, template_id, actor_id, action, previous_version_id, next_version_id, expected_current_version_id, created_at)
    VALUES (p_audit_id, p_template_id, p_actor_id, 'rolled_back', p_expected_current_version_id, p_target_version_id, p_expected_current_version_id, p_now);
END;
$$;

REVOKE ALL ON FUNCTION public.mutate_project_member(text, uuid, uuid, text, uuid, uuid, text, text, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_project_member(text, uuid, uuid, text, uuid, uuid, text, text, timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.publish_official_project_template_version(uuid, text, text, text, text, uuid, integer, jsonb, jsonb, text, uuid, text, uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_official_project_template_version(uuid, text, text, text, text, uuid, integer, jsonb, jsonb, text, uuid, text, uuid, timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.rollback_official_project_template_version(uuid, uuid, uuid, text, uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_official_project_template_version(uuid, uuid, uuid, text, uuid, timestamp with time zone) TO service_role;
-- Contributor Alpha schema baseline. Future upgrades are recorded here.
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
