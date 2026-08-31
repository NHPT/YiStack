export const PROFESSIONAL_EFFICIENCY_DOMAINS = [
  'git_deep_integration',
  'backup_recovery',
  'resource_monitoring',
  'prompt_management',
  'multi_model_strategy',
] as const;

export type ProfessionalEfficiencyDomain = typeof PROFESSIONAL_EFFICIENCY_DOMAINS[number];
export type ProfessionalEfficiencyDomainList = readonly ProfessionalEfficiencyDomain[];

export type ProfessionalEfficiencyDefinition = {
  domain: ProfessionalEfficiencyDomain;
  title: string;
  primarySurface: string;
  entrypoints: readonly string[];
  boundary: string;
  recovery: string;
  validationSource: string;
};

export type ProfessionalEfficiencyDefinitionList = readonly ProfessionalEfficiencyDefinition[];

export const PROFESSIONAL_EFFICIENCY_DEFINITIONS: ProfessionalEfficiencyDefinitionList = [
  {
    domain: 'git_deep_integration',
    title: 'Git 增强',
    primarySurface: 'Workspace Git panel',
    entrypoints: [
      'src/app/workspace/workspace-ide-desktop-git-panel.tsx',
      'src/app/workspace/workspace-ide-mobile-git-panel.tsx',
      'src/app/workspace/use-workspace-resource-operations.ts',
      'backend/internal/service/git.go',
    ],
    boundary: 'Git 写操作必须经过结构化确认、后置同步和恢复提示，不允许整仓破坏性 reset。',
    recovery: '操作失败时进入 Workspace Git / Debug 诊断，并保留 Explorer、worktree、commit 列表旧状态风险提示。',
    validationSource: 'Workspace resource consistency YES',
  },
  {
    domain: 'backup_recovery',
    title: '备份与恢复',
    primarySurface: 'Project List backup actions',
    entrypoints: [
      'backend/internal/service/project_backup_service.go',
      'backend/internal/handler/project_backup_handler.go',
      'src/app/projects/page.tsx',
      'src/app/api/project/[id]/backups',
    ],
    boundary: '备份、远端上传、远端下载和恢复必须保持 readiness / preflight / controlled action 分层。',
    recovery: '备份不可用、远端配置缺失、校验失败或恢复失败时返回结构化 status、message 和 recovery。',
    validationSource: 'Workspace resource consistency YES',
  },
  {
    domain: 'resource_monitoring',
    title: '资源监控与告警',
    primarySurface: 'Runtime Health and Project resource alerts',
    entrypoints: [
      'backend/internal/service/project_resource_monitoring_service.go',
      'src/lib/workspace/runtime-health-diagnostics.ts',
      'src/app/projects/page.tsx',
      'src/app/api/project/[id]/resource-alert-events',
    ],
    boundary: '资源监控只读评估和告警执行必须分离，enforcement 必须显式确认。',
    recovery: '资源快照、告警 readiness、通知发送和硬配额执行失败都必须给出下一步动作。',
    validationSource: 'Runtime health diagnostics and Workspace resource consistency YES',
  },
  {
    domain: 'prompt_management',
    title: 'Prompt 管理',
    primarySurface: 'Admin Prompt management',
    entrypoints: [
      'src/app/admin/prompts/page.tsx',
      'backend/init.sql',
      'backend/internal/service/project_prompt_context.go',
    ],
    boundary: 'Prompt 配置必须走 admin 权限和 system_config 真源，生成链路只能消费已加载配置和项目上下文。',
    recovery: 'Prompt 配置缺失、读取失败或上下文门禁失败时进入 Context Gate / Admin 诊断恢复路径。',
    validationSource: 'System config seed sync and Foundation artifact contract YES',
  },
  {
    domain: 'multi_model_strategy',
    title: '多模型策略',
    primarySurface: 'Admin LLM Providers',
    entrypoints: [
      'src/app/admin/llm/page.tsx',
      'src/app/admin/admin-provider-health-diagnostics-model.ts',
      'backend/internal/service/provider_manager_service.go',
      'backend/internal/service/llm_provider_admin_service.go',
    ],
    boundary: 'Provider 创建、启停、默认切换和 reload 必须保持 admin 权限、脱敏展示和运行态漂移诊断。',
    recovery: 'Provider 配置缺失、运行态未加载、默认 provider 漂移或 reload 失败时进入 Admin Provider Health 诊断。',
    validationSource: 'Admin provider health diagnostics and Workspace resource consistency YES',
  },
] as const;

export function getProfessionalEfficiencyDefinition(
  domain: ProfessionalEfficiencyDomain,
): ProfessionalEfficiencyDefinition {
  for (const definition of PROFESSIONAL_EFFICIENCY_DEFINITIONS) {
    if (definition.domain === domain) {
      return definition;
    }
  }

  throw new Error(`Unknown professional efficiency domain: ${domain}`);
}

export function getProfessionalEfficiencyDefinitionList(): ProfessionalEfficiencyDefinitionList {
  return PROFESSIONAL_EFFICIENCY_DEFINITIONS;
}
