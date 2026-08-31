import type {
  AdminLLMProvidersResponse,
  AdminProject,
  AuditLog,
  CapabilityProviderPreflightResponse,
} from '../src/lib/admin/api';
import { deriveAdminDashboardHealthSummary } from '../src/app/admin/admin-dashboard-health-summary-model';

function fail(message: string): never {
  throw new Error(`[YES] Admin dashboard health summary fixture validation failed: ${message}`);
}

function assertEquals(actual: string | undefined, expected: string, label: string): void {
  if (actual !== expected) {
    fail(`${label} expected ${expected}, got ${actual ?? 'undefined'}`);
  }
}

const providerSnapshot: AdminLLMProvidersResponse = {
  default_id: 1,
  default_name: 'openai',
  providers: [
    {
      id: 1,
      name: 'openai',
      display_name: 'OpenAI',
      type: 'cloud',
      has_api_key: false,
      base_url: '',
      model: 'gpt-4o',
      enabled: true,
      is_default: true,
      priority: 1,
      sort_order: 1,
      extra_config: '{}',
      use_count: 0,
      runtime_loaded: false,
      runtime_active: false,
      created_at: '2026-07-14T00:00:00Z',
      updated_at: '2026-07-14T00:00:00Z',
    },
  ],
};

const runtimeProjects: AdminProject[] = [
  {
    id: 'admin-project-1',
    project_id: 'proj-runtime-1',
    user_id: 'user-1',
    name: 'Runtime Failed Project',
    app_type: 'nextjs',
    runtime_status: {
      projectId: 'proj-runtime-1',
      status: 'failed',
      phase: 'container_start',
      message: 'Container failed to start',
      updatedAt: '2026-07-14T00:00:00Z',
    },
  },
];

const providerPreflight: CapabilityProviderPreflightResponse = {
  generated_at: '2026-07-14T00:00:00Z',
  source_note: 'fixture',
  items: [
    {
      provider: 'openai',
      runner_mode: 'chat',
      status: 'blocked',
      severity: 'critical',
      reason_code: 'missing_api_key',
      source_note: 'fixture',
      next_action: 'Configure API key.',
      metadata: {
        config_keys: ['OPENAI_API_KEY'],
      },
    },
  ],
  status_counts: {
    blocked: 1,
  },
};

const auditLogs: AuditLog[] = [
  {
    id: 1,
    admin_id: 'admin-1',
    action: 'llm_provider.update',
    target_type: 'llm_provider',
    target_id: '1',
    detail: '{}',
    ip_address: '127.0.0.1',
    created_at: '2026-07-14T00:00:00Z',
  },
];

const summary = deriveAdminDashboardHealthSummary({
  providerSnapshot,
  runtimeProjects,
  providerPreflight,
  auditLogs,
});

const issueById = new Map(summary.priorityIssues.map((issue) => [issue.id, issue]));
const runbookById = new Map(summary.runbookItems.map((item) => [item.id, item]));

assertEquals(
  issueById.get('provider-1')?.href,
  '?provider_health=blocked#admin-dashboard-diagnostics-priority',
  'provider issue href',
);
assertEquals(
  issueById.get('runtime-proj-runtime-1')?.href,
  '?runtime_severity=blocked&runtime_status=failed&runtime_project=proj-runtime-1#admin-dashboard-diagnostics-runtime',
  'runtime issue href',
);
assertEquals(
  issueById.get('preflight-openai-missing_api_key-critical')?.href,
  '?severity=critical&reason_code=missing_api_key#admin-dashboard-diagnostics-config',
  'preflight issue href',
);
assertEquals(
  issueById.get('audit-latest-action')?.href,
  '?audit_action=llm_provider.update&audit_target_type=llm_provider#admin-dashboard-diagnostics-audit',
  'audit issue href',
);
assertEquals(
  runbookById.get('provider-blockers')?.href,
  '?provider_health=blocked#admin-dashboard-diagnostics-priority',
  'provider blockers runbook href',
);
assertEquals(
  runbookById.get('preflight-critical')?.href,
  '?severity=critical#admin-dashboard-diagnostics-config',
  'preflight critical runbook href',
);
assertEquals(
  runbookById.get('runtime-blockers')?.href,
  '?runtime_severity=blocked&runtime_status=failed#admin-dashboard-diagnostics-runtime',
  'runtime blockers runbook href',
);
assertEquals(
  runbookById.get('audit-context')?.href,
  '?audit_action=llm_provider.update#admin-dashboard-diagnostics-audit',
  'audit context runbook href',
);

const runtimeFollowupSummary = deriveAdminDashboardHealthSummary({
  providerSnapshot: null,
  runtimeProjects: [
    {
      id: 'admin-project-2',
      project_id: 'proj-runtime-2',
      user_id: 'user-1',
      name: 'Runtime Preparing Project',
      app_type: 'nextjs',
      runtime_status: {
        projectId: 'proj-runtime-2',
        status: 'preparing',
        phase: 'installing',
        message: 'Installing dependencies',
        updatedAt: '2026-07-14T00:00:00Z',
      },
    },
  ],
  providerPreflight: null,
  auditLogs: [],
});
const runtimeFollowupRunbookById = new Map(runtimeFollowupSummary.runbookItems.map((item) => [item.id, item]));
assertEquals(
  runtimeFollowupRunbookById.get('runtime-followup')?.href,
  '?runtime_severity=running&runtime_status=preparing#admin-dashboard-diagnostics-runtime',
  'runtime followup runbook href',
);

console.log('[YES] Admin dashboard health summary fixture validation passed.');
