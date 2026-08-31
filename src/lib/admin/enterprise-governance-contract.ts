export const ENTERPRISE_GOVERNANCE_DOMAINS = [
  'identity_sso',
  'rbac_access',
  'project_ownership',
  'audit_compliance',
  'private_deployment',
  'commercial_readiness',
] as const;

export type EnterpriseGovernanceDomain = typeof ENTERPRISE_GOVERNANCE_DOMAINS[number];
export type EnterpriseGovernanceDomainList = readonly EnterpriseGovernanceDomain[];

export type EnterpriseGovernanceDefinition = {
  domain: EnterpriseGovernanceDomain;
  title: string;
  primarySurface: string;
  readinessSource: string;
  entrypoints: readonly string[];
  controlledMutationBoundary: string;
  auditEvidence: string;
  recovery: string;
};

export type EnterpriseGovernanceDefinitionList = readonly EnterpriseGovernanceDefinition[];

export const ENTERPRISE_GOVERNANCE_DEFINITIONS: EnterpriseGovernanceDefinitionList = [
  {
    domain: 'identity_sso',
    title: '身份与 SSO',
    primarySurface: 'Admin Enterprise SSO readiness',
    readinessSource: 'enterprise.sso.* system_config + organization readiness',
    entrypoints: [
      'src/app/admin/enterprise/page.tsx',
      'src/app/admin/enterprise/admin-enterprise-governance-page-snapshot.tsx',
      'backend/init.sql',
    ],
    controlledMutationBoundary: 'SSO 配置 readiness 不等于真实登录启用；组织、团队、成员写入必须走受控确认。',
    auditEvidence: 'Admin Enterprise readiness snapshot + admin audit log',
    recovery: '配置缺失时先补齐 enterprise.sso.* 和组织真源；真实 SSO provider、登录回调和会话归一化必须单独验收。',
  },
  {
    domain: 'rbac_access',
    title: 'RBAC 与访问控制',
    primarySurface: 'Admin RBAC and Project Access Guard',
    readinessSource: 'admin roles / permissions / Project Access Guard readiness',
    entrypoints: [
      'backend/init.sql',
      'backend/internal/service/project_access_guard.go',
      'backend/internal/orchestration/workspace_project_access.go',
      'src/app/api/admin/enterprise/project-access-guard-activation/activate/route.ts',
      'src/app/admin/enterprise/page.tsx',
    ],
    controlledMutationBoundary: 'Project Access Guard activation 必须经过 switch readiness、authorization dry-run、manual approval、execution、post validation 和 rollback evidence。',
    auditEvidence: 'enterprise_project_access_guard_activation_audits + admin_audit_log',
    recovery: '授权漂移或 owner guard 阻断时先处理 project ownership mapping，再执行 activation 或 rollback evidence。',
  },
  {
    domain: 'project_ownership',
    title: '项目归属治理',
    primarySurface: 'Admin Enterprise project ownership',
    readinessSource: 'enterprise_project_ownerships readback + ownership preflight',
    entrypoints: [
      'backend/init.sql',
      'backend/internal/service/admin_console_enterprise_service.go',
      'backend/internal/handler/admin_enterprise_handler.go',
      'src/app/api/admin/enterprise/project-ownership-migrations/route.ts',
    ],
    controlledMutationBoundary: '项目归属迁移必须通过 preflight、owner guard readiness 和受控 confirmation，不直接修改普通项目主链路语义。',
    auditEvidence: 'project ownership mappings + admin audit evidence',
    recovery: '存在 unmigrated、missing project 或 extra ownership 时先修复映射，再考虑访问守卫切换。',
  },
  {
    domain: 'audit_compliance',
    title: '审计与合规导出',
    primarySurface: 'Admin Enterprise audit export',
    readinessSource: 'admin_audit_log + enterprise audit export tasks / reports',
    entrypoints: [
      'backend/init.sql',
      'src/app/api/admin/enterprise/audit-export-delivery-report-readiness/route.ts',
    ],
    controlledMutationBoundary: '审计导出必须保持 readiness -> request -> dry-run/artifact/output/task/report controlled action，不得隐式启动 worker 或落文件。',
    auditEvidence: 'enterprise_audit_export_* tables + admin audit evidence + delivery report storage evidence',
    recovery: '导出链路阻断时按 readiness source count、completed task evidence、worker execution source 逐级补齐。',
  },
  {
    domain: 'private_deployment',
    title: '私有部署与运维边界',
    primarySurface: 'Admin Enterprise private deployment readiness',
    readinessSource: 'bootstrap config + system_config runtime keys + migration schema readback + container/Preview boundary',
    entrypoints: [
      'src/app/api/admin/enterprise/private-deployment-readiness/route.ts',
      'backend/internal/service/admin_console_enterprise_service.go',
      'backend/internal/handler/admin_enterprise_handler.go',
      'src/app/admin/enterprise/page.tsx',
      'scripts/validate-config-env-sync.mjs',
      'src/lib/workspace/runtime-health-diagnostics.ts',
    ],
    controlledMutationBoundary: '私有部署 readiness 只读聚合配置、迁移 schema、容器和 Preview 边界，不写 env、不执行 migration、不启动容器、不访问外部网络。',
    auditEvidence: 'Admin Enterprise private deployment readiness + YES validation output + runtime/admin diagnostics snapshots',
    recovery: '部署配置、运行期后台配置、migration schema 或容器/Preview 边界异常时先修复对应 readiness，再进入受控运维动作。',
  },
  {
    domain: 'commercial_readiness',
    title: '商业化 Readiness',
    primarySurface: 'Admin Enterprise commercial readiness',
    readinessSource: 'Project Ownership activation readiness + Audit Compliance stored report evidence + Private Deployment readiness',
    entrypoints: [
      'src/app/api/admin/enterprise/commercial-readiness/route.ts',
      'backend/internal/service/admin_console_enterprise_service.go',
      'backend/internal/handler/admin_enterprise_handler.go',
      'src/app/admin/enterprise/page.tsx',
      'docs/roadmap/ROADMAP.md',
      'docs/PRODUCT.md',
    ],
    controlledMutationBoundary: '商业化 readiness 只读聚合企业治理、审计合规和私有部署证据，不接入计费 provider、不写订阅、不生成合同、不收款。',
    auditEvidence: 'Admin Enterprise commercial readiness + roadmap Production Gate evidence + upstream governance evidence',
    recovery: '商业化前必须先完成企业治理、审计合规、私有部署和权限边界验收，再进入计费/合同系统设计。',
  },
] as const;

export function getEnterpriseGovernanceDefinition(
  domain: EnterpriseGovernanceDomain,
): EnterpriseGovernanceDefinition {
  for (const definition of ENTERPRISE_GOVERNANCE_DEFINITIONS) {
    if (definition.domain === domain) {
      return definition;
    }
  }

  throw new Error(`Unknown enterprise governance domain: ${domain}`);
}

export function getEnterpriseGovernanceDefinitionList(): EnterpriseGovernanceDefinitionList {
  return ENTERPRISE_GOVERNANCE_DEFINITIONS;
}
