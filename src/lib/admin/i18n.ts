import type { AppLocale } from '@/contexts/ui-preferences-context';

export type AdminCopy = {
  appTitle: string;
  dashboard: string;
  llm: string;
  prompts: string;
  templates: string;
  config: string;
  audit: string;
  users: string;
  admins: string;
  roles: string;
  enterprise: string;
  logout: string;
  reloadProviders: string;
  reloadingProviders: string;
  reloadSucceeded: string;
  reloadFailed: string;
  loading: string;
  dashboardTitle: string;
  dashboardDescription: string;
  dashboardDiagnosticsTitle: string;
  dashboardDiagnosticsDescription: string;
  dashboardDiagnosticsReadOnly: string;
  dashboardDiagnosticsPriority: string;
  dashboardDiagnosticsPriorityDescription: string;
  dashboardDiagnosticsRuntime: string;
  dashboardDiagnosticsRuntimeDescription: string;
  dashboardDiagnosticsConfig: string;
  dashboardDiagnosticsConfigDescription: string;
  dashboardDiagnosticsAudit: string;
  dashboardDiagnosticsAuditDescription: string;
  dashboardHealthSummary: string;
  dashboardHealthBlockers: string;
  dashboardHealthWarnings: string;
  dashboardHealthPending: string;
  dashboardHealthAuditSignals: string;
  dashboardHealthFocusAreas: string;
  dashboardHealthFocusSignalCount: string;
  dashboardHealthPriorityIssuesTitle: string;
  dashboardHealthPriorityIssuesDescription: string;
  dashboardHealthRunbookTitle: string;
  dashboardHealthRunbookDescription: string;
  quickAccess: string;
  visibleModules: string;
  recentAudit: string;
  emptyAudit: string;
  auditDiagnosticsLogs: string;
  auditDiagnosticsActions: string;
  auditDiagnosticsTargets: string;
  auditDiagnosticsLatest: string;
  auditDiagnosticsTopActions: string;
  auditDiagnosticsTargetTypes: string;
  auditDiagnosticsReadOnlyBoundary: string;
  auditDiagnosticsAll: string;
  auditDiagnosticsActionFilter: string;
  auditDiagnosticsTargetTypeFilter: string;
  auditDiagnosticsFilterSummary: string;
  auditDiagnosticsFilteredEmpty: string;
  auditDiagnosticsClearFilters: string;
  auditDiagnosticsCopyDiagnosticLink: string;
  auditDiagnosticsDiagnosticLinkCopied: string;
  runtimeHealthDiagnostics: string;
  runtimeHealthProjects: string;
  runtimeHealthObserved: string;
  runtimeHealthReady: string;
  runtimeHealthRunning: string;
  runtimeHealthBlocked: string;
  runtimeHealthIdle: string;
  runtimeHealthUnknown: string;
  runtimeHealthEmpty: string;
  runtimeHealthPriorityProjects: string;
  runtimeHealthNextAction: string;
  runtimeHealthReadOnlyBoundary: string;
  runtimeHealthAll: string;
  runtimeHealthSeverityFilter: string;
  runtimeHealthStatusFilter: string;
  runtimeHealthFilterSummary: string;
  runtimeHealthFilteredEmpty: string;
  runtimeHealthClearFilters: string;
  runtimeHealthCopyDiagnosticLink: string;
  runtimeHealthDiagnosticLinkCopied: string;
  runtimeHealthProjectDrilldown: string;
  runtimeHealthProjectDrilldownAll: string;
  runtimeHealthProjectDrilldownMissing: string;
  runtimeHealthOpenProjectDrilldown: string;
  runtimeHealthClearProjectDrilldown: string;
  runtimeHealthUpdatedAt: string;
  providerHealthDiagnostics: string;
  providerHealthProviders: string;
  providerHealthEnabled: string;
  providerHealthLoaded: string;
  providerHealthDrift: string;
  providerHealthBlocked: string;
  providerHealthEmpty: string;
  providerHealthReadOnlyBoundary: string;
  providerHealthDefault: string;
  providerHealthActive: string;
  providerHealthReady: string;
  providerHealthIdle: string;
  providerHealthPriorityProviders: string;
  providerHealthDefaultBadge: string;
  providerHealthNotLoaded: string;
  providerHealthNextAction: string;
  providerHealthAll: string;
  providerHealthSeverityFilter: string;
  providerHealthRuntimeFilter: string;
  providerHealthFilterSummary: string;
  providerHealthFilteredEmpty: string;
  providerHealthClearFilters: string;
  providerHealthCopyDiagnosticLink: string;
  providerHealthDiagnosticLinkCopied: string;
  totalProviders: string;
  totalConfigs: string;
  totalUsers: string;
  totalAdmins: string;
  viewModule: string;
  capabilityPreflight: string;
  capabilityPreflightDescription: string;
  capabilityPreflightBlocked: string;
  capabilityPreflightReady: string;
  capabilityPreflightSkipped: string;
  capabilityPreflightUnavailable: string;
  capabilityPreflightSnapshot: string;
  capabilityPreflightDetails: string;
  capabilityPreflightMetadata: string;
  capabilityPreflightNextAction: string;
  capabilityPreflightSeverity: string;
  capabilityPreflightAll: string;
  capabilityPreflightStatusFilter: string;
  capabilityPreflightSeverityFilter: string;
  capabilityPreflightFilteredEmpty: string;
  capabilityPreflightPrioritySummary: string;
  capabilityPreflightPrimaryIssue: string;
  capabilityPreflightPriorityHealthy: string;
  capabilityPreflightProviderSummary: string;
  capabilityPreflightProviderSummaryHealthy: string;
  capabilityPreflightProviderSummaryEmpty: string;
  capabilityPreflightProviderRunnerModes: string;
  capabilityPreflightProviderReasonCodes: string;
  capabilityPreflightConfigKeys: string;
  capabilityPreflightConfigKeySummary: string;
  capabilityPreflightConfigKeyFilter: string;
  capabilityPreflightConfigKeyFocusSummary: string;
  capabilityPreflightBoundaryTitle: string;
  capabilityPreflightBoundaryDescription: string;
  capabilityPreflightSnapshotFreshness: string;
  capabilityPreflightSnapshotAge: string;
  capabilityPreflightSnapshotRefreshHint: string;
  capabilityPreflightReasonCodeRunbook: string;
  capabilityPreflightReasonCodeFilter: string;
  capabilityPreflightReasonCodeFocusSummary: string;
  capabilityPreflightRunbookProviders: string;
  capabilityPreflightRunbookConfigKeys: string;
  capabilityPreflightRunbookNextActions: string;
  capabilityPreflightFilterSummary: string;
  capabilityPreflightClearFilters: string;
  capabilityPreflightCopyDiagnosticLink: string;
  capabilityPreflightDiagnosticLinkCopied: string;
};

const copyMap: Record<AppLocale, AdminCopy> = {
  'zh-CN': {
    appTitle: 'YiStack 管理后台',
    dashboard: 'Dashboard',
    llm: 'LLM 模型',
    prompts: 'Prompt 管理',
    templates: 'Template 管理',
    config: '系统配置',
    audit: '审计日志',
    users: '用户管理',
    admins: '管理员',
    roles: '角色权限',
    enterprise: '企业治理',
    logout: '退出登录',
    reloadProviders: '重载 LLM 提供商',
    reloadingProviders: '重载中...',
    reloadSucceeded: '已重载',
    reloadFailed: '失败',
    loading: '正在加载后台...',
    dashboardTitle: 'Dashboard',
    dashboardDescription: '从这里快速进入后台核心模块，查看当前系统状态与最近操作。',
    dashboardDiagnosticsTitle: '运维观测诊断区',
    dashboardDiagnosticsDescription: '按优先处理、运行态、配置态和审计线索组织诊断卡片，便于先处理阻断项再追踪上下文。',
    dashboardDiagnosticsReadOnly: '只读诊断',
    dashboardDiagnosticsPriority: '优先处理',
    dashboardDiagnosticsPriorityDescription: '聚焦当前最可能影响能力调用的 Provider 运行态漂移和阻断项。',
    dashboardDiagnosticsRuntime: '运行态',
    dashboardDiagnosticsRuntimeDescription: '查看项目 runtime 健康分布、筛选结果和项目级 drilldown。',
    dashboardDiagnosticsConfig: '配置态',
    dashboardDiagnosticsConfigDescription: '核对 Provider 启动前置条件、配置键和原因码定位。',
    dashboardDiagnosticsAudit: '审计线索',
    dashboardDiagnosticsAuditDescription: '查看最近管理操作和 action/target 分布，辅助追踪变更来源。',
    dashboardHealthSummary: '总体健康摘要',
    dashboardHealthBlockers: '阻断项',
    dashboardHealthWarnings: '告警',
    dashboardHealthPending: '待处理',
    dashboardHealthAuditSignals: '审计线索',
    dashboardHealthFocusAreas: '建议下钻',
    dashboardHealthFocusSignalCount: '{count} 个信号',
    dashboardHealthPriorityIssuesTitle: '优先问题',
    dashboardHealthPriorityIssuesDescription: '跨 Provider、Runtime、Preflight 与 Audit 汇总当前最值得先看的问题。',
    dashboardHealthRunbookTitle: '处理顺序',
    dashboardHealthRunbookDescription: '按阻断优先、运行态恢复、配置收敛和审计追踪组织建议动作。',
    quickAccess: '快捷入口',
    visibleModules: '当前可见模块',
    recentAudit: '最近审计日志',
    emptyAudit: '暂无最近审计日志',
    auditDiagnosticsLogs: '日志',
    auditDiagnosticsActions: '动作',
    auditDiagnosticsTargets: '对象类型',
    auditDiagnosticsLatest: '最近操作',
    auditDiagnosticsTopActions: '动作分布',
    auditDiagnosticsTargetTypes: '对象类型分布',
    auditDiagnosticsReadOnlyBoundary: '该卡片只消费已加载的最近审计日志，不扩大审计查询范围，不改变审计写入或查询权限。',
    auditDiagnosticsAll: '全部',
    auditDiagnosticsActionFilter: '动作',
    auditDiagnosticsTargetTypeFilter: '对象类型',
    auditDiagnosticsFilterSummary: '筛选结果',
    auditDiagnosticsFilteredEmpty: '当前 Audit 筛选条件下没有审计日志',
    auditDiagnosticsClearFilters: '清除筛选',
    auditDiagnosticsCopyDiagnosticLink: '复制诊断链接',
    auditDiagnosticsDiagnosticLinkCopied: '已复制',
    runtimeHealthDiagnostics: 'Runtime Health 诊断',
    runtimeHealthProjects: '项目',
    runtimeHealthObserved: '已读取快照',
    runtimeHealthReady: '就绪',
    runtimeHealthRunning: '准备中',
    runtimeHealthBlocked: '阻断',
    runtimeHealthIdle: '未启动',
    runtimeHealthUnknown: '未知',
    runtimeHealthEmpty: '暂无项目 runtime 数据',
    runtimeHealthPriorityProjects: '优先关注项目',
    runtimeHealthNextAction: '下一步',
    runtimeHealthReadOnlyBoundary: '该卡片只消费 Admin 项目列表返回的已有 runtime-status 快照，不启动/停止 runtime，不探测容器，也不写入状态。',
    runtimeHealthAll: '全部',
    runtimeHealthSeverityFilter: '健康分组',
    runtimeHealthStatusFilter: 'Runtime 状态',
    runtimeHealthFilterSummary: '筛选结果',
    runtimeHealthFilteredEmpty: '当前 Runtime Health 筛选条件下没有项目',
    runtimeHealthClearFilters: '清除筛选',
    runtimeHealthCopyDiagnosticLink: '复制诊断链接',
    runtimeHealthDiagnosticLinkCopied: '已复制',
    runtimeHealthProjectDrilldown: '项目 Drilldown',
    runtimeHealthProjectDrilldownAll: '不聚焦具体项目',
    runtimeHealthProjectDrilldownMissing: '当前链接中的项目聚焦目标不存在或已不在项目列表中',
    runtimeHealthOpenProjectDrilldown: '查看项目详情',
    runtimeHealthClearProjectDrilldown: '清除项目聚焦',
    runtimeHealthUpdatedAt: '更新时间',
    providerHealthDiagnostics: 'Provider Health 诊断',
    providerHealthProviders: 'Provider',
    providerHealthEnabled: '已启用',
    providerHealthLoaded: '已加载',
    providerHealthDrift: '运行态漂移',
    providerHealthBlocked: '阻断',
    providerHealthEmpty: '暂无 LLM Provider 配置',
    providerHealthReadOnlyBoundary: '该卡片只消费 Admin LLM Provider 列表返回的脱敏配置态与运行态快照，不读取密钥值，不触发 reload、测试连接或外部 endpoint 调用。',
    providerHealthDefault: '默认',
    providerHealthActive: '当前运行',
    providerHealthReady: '一致',
    providerHealthIdle: '禁用',
    providerHealthPriorityProviders: '优先关注 Provider',
    providerHealthDefaultBadge: '默认',
    providerHealthNotLoaded: '未加载',
    providerHealthNextAction: '下一步',
    providerHealthAll: '全部',
    providerHealthSeverityFilter: '健康分组',
    providerHealthRuntimeFilter: '运行态',
    providerHealthFilterSummary: '筛选结果',
    providerHealthFilteredEmpty: '当前 Provider Health 筛选条件下没有 Provider',
    providerHealthClearFilters: '清除筛选',
    providerHealthCopyDiagnosticLink: '复制诊断链接',
    providerHealthDiagnosticLinkCopied: '已复制',
    totalProviders: 'LLM 提供商',
    totalConfigs: '系统配置',
    totalUsers: '普通用户',
    totalAdmins: '管理员账号',
    viewModule: '进入模块',
    capabilityPreflight: 'Capability 预检',
    capabilityPreflightDescription: 'Skill / MCP endpoint 配置诊断，只读展示，不触发真实调用。',
    capabilityPreflightBlocked: '阻断',
    capabilityPreflightReady: '就绪',
    capabilityPreflightSkipped: '跳过',
    capabilityPreflightUnavailable: '暂无 Capability 预检数据',
    capabilityPreflightSnapshot: '启动快照',
    capabilityPreflightDetails: '预检明细',
    capabilityPreflightMetadata: '诊断元数据',
    capabilityPreflightNextAction: '下一步',
    capabilityPreflightSeverity: '风险',
    capabilityPreflightAll: '全部',
    capabilityPreflightStatusFilter: '状态',
    capabilityPreflightSeverityFilter: '风险',
    capabilityPreflightFilteredEmpty: '当前筛选条件下没有预检项',
    capabilityPreflightPrioritySummary: '优先摘要',
    capabilityPreflightPrimaryIssue: '优先处理',
    capabilityPreflightPriorityHealthy: '当前没有 critical 或 warning 预检项。',
    capabilityPreflightProviderSummary: 'Provider 诊断总览',
    capabilityPreflightProviderSummaryHealthy: '当前所有 provider 均处于就绪状态。',
    capabilityPreflightProviderSummaryEmpty: '暂无 provider 诊断摘要。',
    capabilityPreflightProviderRunnerModes: 'Runner 模式',
    capabilityPreflightProviderReasonCodes: '原因码',
    capabilityPreflightConfigKeys: '配置项',
    capabilityPreflightConfigKeySummary: '配置定位摘要',
    capabilityPreflightConfigKeyFilter: '配置聚焦',
    capabilityPreflightConfigKeyFocusSummary: '聚焦结果',
    capabilityPreflightBoundaryTitle: '只读诊断边界',
    capabilityPreflightBoundaryDescription: '此预检来自后端启动快照，用于解释配置与 runner 策略状态；不会重新预检、不会执行 runner、不会探测 endpoint，也不会读取或写入配置值。',
    capabilityPreflightSnapshotFreshness: '快照新鲜度',
    capabilityPreflightSnapshotAge: '快照年龄',
    capabilityPreflightSnapshotRefreshHint: '如果配置在该时间之后发生变更，请按既定流程重启服务或刷新后端快照后再查看。',
    capabilityPreflightReasonCodeRunbook: 'Reason Code 排障小抄',
    capabilityPreflightReasonCodeFilter: '原因聚焦',
    capabilityPreflightReasonCodeFocusSummary: '原因聚焦结果',
    capabilityPreflightRunbookProviders: '关联 provider',
    capabilityPreflightRunbookConfigKeys: '检查配置项',
    capabilityPreflightRunbookNextActions: '建议动作',
    capabilityPreflightFilterSummary: '筛选摘要',
    capabilityPreflightClearFilters: '清除全部筛选',
    capabilityPreflightCopyDiagnosticLink: '复制诊断链接',
    capabilityPreflightDiagnosticLinkCopied: '已复制',
  },
  'en-US': {
    appTitle: 'YiStack Admin',
    dashboard: 'Dashboard',
    llm: 'LLM Models',
    prompts: 'Prompt Management',
    templates: 'Template Management',
    config: 'System Config',
    audit: 'Audit Logs',
    users: 'Users',
    admins: 'Admins',
    roles: 'Roles',
    enterprise: 'Enterprise Governance',
    logout: 'Sign Out',
    reloadProviders: 'Reload LLM Providers',
    reloadingProviders: 'Reloading...',
    reloadSucceeded: 'Reloaded',
    reloadFailed: 'Failed',
    loading: 'Loading admin console...',
    dashboardTitle: 'Dashboard',
    dashboardDescription: 'Jump into core admin modules and review the latest system activity from one place.',
    dashboardDiagnosticsTitle: 'Operations diagnostics',
    dashboardDiagnosticsDescription: 'Diagnostics are grouped by priority, runtime, config, and audit signals so blockers can be handled before context tracing.',
    dashboardDiagnosticsReadOnly: 'Read-only diagnostics',
    dashboardDiagnosticsPriority: 'Priority',
    dashboardDiagnosticsPriorityDescription: 'Focuses on provider runtime drift and blockers that can affect capability execution.',
    dashboardDiagnosticsRuntime: 'Runtime',
    dashboardDiagnosticsRuntimeDescription: 'Review project runtime health distribution, filters, and project drilldown.',
    dashboardDiagnosticsConfig: 'Config',
    dashboardDiagnosticsConfigDescription: 'Check provider preflight prerequisites, config keys, and reason-code localization.',
    dashboardDiagnosticsAudit: 'Audit',
    dashboardDiagnosticsAuditDescription: 'Review recent admin operations and action/target distributions for change tracing.',
    dashboardHealthSummary: 'Overall health summary',
    dashboardHealthBlockers: 'Blockers',
    dashboardHealthWarnings: 'Warnings',
    dashboardHealthPending: 'Pending',
    dashboardHealthAuditSignals: 'Audit signals',
    dashboardHealthFocusAreas: 'Suggested drilldown',
    dashboardHealthFocusSignalCount: '{count} signals',
    dashboardHealthPriorityIssuesTitle: 'Priority issues',
    dashboardHealthPriorityIssuesDescription: 'Highlights the most relevant issues across Provider, Runtime, Preflight, and Audit.',
    dashboardHealthRunbookTitle: 'Triage order',
    dashboardHealthRunbookDescription: 'Suggested actions are ordered by blockers, runtime recovery, config cleanup, and audit tracing.',
    quickAccess: 'Quick Access',
    visibleModules: 'Visible Modules',
    recentAudit: 'Recent Audit Logs',
    emptyAudit: 'No recent audit logs',
    auditDiagnosticsLogs: 'Logs',
    auditDiagnosticsActions: 'Actions',
    auditDiagnosticsTargets: 'Targets',
    auditDiagnosticsLatest: 'Latest action',
    auditDiagnosticsTopActions: 'Action distribution',
    auditDiagnosticsTargetTypes: 'Target type distribution',
    auditDiagnosticsReadOnlyBoundary: 'This card only consumes the loaded recent audit logs. It does not expand audit queries or change audit write/read permissions.',
    auditDiagnosticsAll: 'All',
    auditDiagnosticsActionFilter: 'Action',
    auditDiagnosticsTargetTypeFilter: 'Target type',
    auditDiagnosticsFilterSummary: 'Filter result',
    auditDiagnosticsFilteredEmpty: 'No audit logs match the current Audit filters',
    auditDiagnosticsClearFilters: 'Clear filters',
    auditDiagnosticsCopyDiagnosticLink: 'Copy diagnostic link',
    auditDiagnosticsDiagnosticLinkCopied: 'Copied',
    runtimeHealthDiagnostics: 'Runtime Health Diagnostics',
    runtimeHealthProjects: 'Projects',
    runtimeHealthObserved: 'Observed snapshots',
    runtimeHealthReady: 'Ready',
    runtimeHealthRunning: 'Preparing',
    runtimeHealthBlocked: 'Blocked',
    runtimeHealthIdle: 'Idle',
    runtimeHealthUnknown: 'Unknown',
    runtimeHealthEmpty: 'No project runtime data yet',
    runtimeHealthPriorityProjects: 'Priority projects',
    runtimeHealthNextAction: 'Next action',
    runtimeHealthReadOnlyBoundary: 'This card only consumes existing runtime-status snapshots returned by the Admin project list. It does not start/stop runtime, inspect containers, or write status.',
    runtimeHealthAll: 'All',
    runtimeHealthSeverityFilter: 'Health group',
    runtimeHealthStatusFilter: 'Runtime status',
    runtimeHealthFilterSummary: 'Filter result',
    runtimeHealthFilteredEmpty: 'No projects match the current Runtime Health filters',
    runtimeHealthClearFilters: 'Clear filters',
    runtimeHealthCopyDiagnosticLink: 'Copy diagnostic link',
    runtimeHealthDiagnosticLinkCopied: 'Copied',
    runtimeHealthProjectDrilldown: 'Project drilldown',
    runtimeHealthProjectDrilldownAll: 'No focused project',
    runtimeHealthProjectDrilldownMissing: 'The focused project in the current link is missing or no longer in the project list',
    runtimeHealthOpenProjectDrilldown: 'View project details',
    runtimeHealthClearProjectDrilldown: 'Clear project focus',
    runtimeHealthUpdatedAt: 'Updated at',
    providerHealthDiagnostics: 'Provider Health Diagnostics',
    providerHealthProviders: 'Providers',
    providerHealthEnabled: 'Enabled',
    providerHealthLoaded: 'Loaded',
    providerHealthDrift: 'Runtime drift',
    providerHealthBlocked: 'Blocked',
    providerHealthEmpty: 'No LLM providers configured',
    providerHealthReadOnlyBoundary: 'This card only consumes sanitized config/runtime snapshots returned by the Admin LLM Provider list. It does not read secret values, reload providers, test connections, or call external endpoints.',
    providerHealthDefault: 'Default',
    providerHealthActive: 'Active',
    providerHealthReady: 'Aligned',
    providerHealthIdle: 'Disabled',
    providerHealthPriorityProviders: 'Priority providers',
    providerHealthDefaultBadge: 'Default',
    providerHealthNotLoaded: 'Not loaded',
    providerHealthNextAction: 'Next action',
    providerHealthAll: 'All',
    providerHealthSeverityFilter: 'Health group',
    providerHealthRuntimeFilter: 'Runtime',
    providerHealthFilterSummary: 'Filter result',
    providerHealthFilteredEmpty: 'No providers match the current Provider Health filters',
    providerHealthClearFilters: 'Clear filters',
    providerHealthCopyDiagnosticLink: 'Copy diagnostic link',
    providerHealthDiagnosticLinkCopied: 'Copied',
    totalProviders: 'LLM Providers',
    totalConfigs: 'System Configs',
    totalUsers: 'Users',
    totalAdmins: 'Admin Accounts',
    viewModule: 'Open',
    capabilityPreflight: 'Capability Preflight',
    capabilityPreflightDescription: 'Read-only Skill / MCP endpoint diagnostics without triggering real calls.',
    capabilityPreflightBlocked: 'Blocked',
    capabilityPreflightReady: 'Ready',
    capabilityPreflightSkipped: 'Skipped',
    capabilityPreflightUnavailable: 'No capability preflight data',
    capabilityPreflightSnapshot: 'Startup snapshot',
    capabilityPreflightDetails: 'Preflight details',
    capabilityPreflightMetadata: 'Diagnostic metadata',
    capabilityPreflightNextAction: 'Next action',
    capabilityPreflightSeverity: 'Severity',
    capabilityPreflightAll: 'All',
    capabilityPreflightStatusFilter: 'Status',
    capabilityPreflightSeverityFilter: 'Severity',
    capabilityPreflightFilteredEmpty: 'No preflight items match the current filters',
    capabilityPreflightPrioritySummary: 'Priority summary',
    capabilityPreflightPrimaryIssue: 'Primary issue',
    capabilityPreflightPriorityHealthy: 'No critical or warning preflight items right now.',
    capabilityPreflightProviderSummary: 'Provider diagnostic overview',
    capabilityPreflightProviderSummaryHealthy: 'All providers are ready right now.',
    capabilityPreflightProviderSummaryEmpty: 'No provider diagnostic summary yet.',
    capabilityPreflightProviderRunnerModes: 'Runner modes',
    capabilityPreflightProviderReasonCodes: 'Reason codes',
    capabilityPreflightConfigKeys: 'Config keys',
    capabilityPreflightConfigKeySummary: 'Config key summary',
    capabilityPreflightConfigKeyFilter: 'Config focus',
    capabilityPreflightConfigKeyFocusSummary: 'Focus result',
    capabilityPreflightBoundaryTitle: 'Read-only diagnostic boundary',
    capabilityPreflightBoundaryDescription: 'This preflight is derived from the backend startup snapshot to explain configuration and runner policy state; it does not rerun preflight checks, execute runners, probe endpoints, or read/write config values.',
    capabilityPreflightSnapshotFreshness: 'Snapshot freshness',
    capabilityPreflightSnapshotAge: 'Snapshot age',
    capabilityPreflightSnapshotRefreshHint: 'If configuration changed after this time, restart the service or refresh the backend snapshot through the established process before checking again.',
    capabilityPreflightReasonCodeRunbook: 'Reason code runbook',
    capabilityPreflightReasonCodeFilter: 'Reason focus',
    capabilityPreflightReasonCodeFocusSummary: 'Reason focus result',
    capabilityPreflightRunbookProviders: 'Related providers',
    capabilityPreflightRunbookConfigKeys: 'Config keys to check',
    capabilityPreflightRunbookNextActions: 'Suggested actions',
    capabilityPreflightFilterSummary: 'Filter summary',
    capabilityPreflightClearFilters: 'Clear all filters',
    capabilityPreflightCopyDiagnosticLink: 'Copy diagnostic link',
    capabilityPreflightDiagnosticLinkCopied: 'Copied',
  },
  'ja-JP': {
    appTitle: 'YiStack 管理コンソール',
    dashboard: 'ダッシュボード',
    llm: 'LLM モデル',
    prompts: 'Prompt 管理',
    templates: 'Template 管理',
    config: 'システム設定',
    audit: '監査ログ',
    users: 'ユーザー管理',
    admins: '管理者',
    roles: 'ロール権限',
    enterprise: 'Enterprise Governance',
    logout: 'ログアウト',
    reloadProviders: 'LLM プロバイダを再読込',
    reloadingProviders: '再読込中...',
    reloadSucceeded: '再読込完了',
    reloadFailed: '失敗',
    loading: '管理画面を読み込み中...',
    dashboardTitle: 'ダッシュボード',
    dashboardDescription: 'ここから主要な管理モジュールにすばやく入り、最新のシステム状況を確認できます。',
    dashboardDiagnosticsTitle: '運用診断エリア',
    dashboardDiagnosticsDescription: '診断カードを優先対応、runtime、設定、監査の観点で整理し、ブロック要因から順に追跡できます。',
    dashboardDiagnosticsReadOnly: '読み取り専用診断',
    dashboardDiagnosticsPriority: '優先対応',
    dashboardDiagnosticsPriorityDescription: '能力実行に影響しやすい Provider runtime 差分とブロック要因に集中します。',
    dashboardDiagnosticsRuntime: 'Runtime',
    dashboardDiagnosticsRuntimeDescription: 'プロジェクト runtime ヘルス分布、フィルター、プロジェクト drilldown を確認します。',
    dashboardDiagnosticsConfig: '設定',
    dashboardDiagnosticsConfigDescription: 'Provider preflight の前提条件、設定キー、reason code の位置づけを確認します。',
    dashboardDiagnosticsAudit: '監査',
    dashboardDiagnosticsAuditDescription: '直近の管理操作と action/target 分布を確認し、変更元を追跡します。',
    dashboardHealthSummary: '全体ヘルス概要',
    dashboardHealthBlockers: 'ブロック',
    dashboardHealthWarnings: '警告',
    dashboardHealthPending: '未対応',
    dashboardHealthAuditSignals: '監査シグナル',
    dashboardHealthFocusAreas: '推奨 drilldown',
    dashboardHealthFocusSignalCount: '{count} 件',
    dashboardHealthPriorityIssuesTitle: '優先課題',
    dashboardHealthPriorityIssuesDescription: 'Provider、Runtime、Preflight、Audit を横断して先に確認すべき課題をまとめます。',
    dashboardHealthRunbookTitle: '対応順序',
    dashboardHealthRunbookDescription: 'ブロック要因、runtime 復旧、設定収束、監査追跡の順で推奨アクションを整理します。',
    quickAccess: 'クイックアクセス',
    visibleModules: '表示可能なモジュール',
    recentAudit: '最近の監査ログ',
    emptyAudit: '最近の監査ログはありません',
    auditDiagnosticsLogs: 'ログ',
    auditDiagnosticsActions: '操作',
    auditDiagnosticsTargets: '対象タイプ',
    auditDiagnosticsLatest: '最新操作',
    auditDiagnosticsTopActions: '操作分布',
    auditDiagnosticsTargetTypes: '対象タイプ分布',
    auditDiagnosticsReadOnlyBoundary: 'このカードは読み込み済みの最近の監査ログのみを使用します。監査クエリ範囲、書き込み権限、読み取り権限は変更しません。',
    auditDiagnosticsAll: 'すべて',
    auditDiagnosticsActionFilter: '操作',
    auditDiagnosticsTargetTypeFilter: '対象タイプ',
    auditDiagnosticsFilterSummary: 'フィルター結果',
    auditDiagnosticsFilteredEmpty: '現在の Audit フィルターに一致する監査ログはありません',
    auditDiagnosticsClearFilters: 'フィルターを解除',
    auditDiagnosticsCopyDiagnosticLink: '診断リンクをコピー',
    auditDiagnosticsDiagnosticLinkCopied: 'コピー済み',
    runtimeHealthDiagnostics: 'Runtime Health 診断',
    runtimeHealthProjects: 'プロジェクト',
    runtimeHealthObserved: '取得済みスナップショット',
    runtimeHealthReady: '準備完了',
    runtimeHealthRunning: '準備中',
    runtimeHealthBlocked: 'ブロック',
    runtimeHealthIdle: '未起動',
    runtimeHealthUnknown: '不明',
    runtimeHealthEmpty: 'プロジェクト runtime データはまだありません',
    runtimeHealthPriorityProjects: '優先確認プロジェクト',
    runtimeHealthNextAction: '次のアクション',
    runtimeHealthReadOnlyBoundary: 'このカードは Admin プロジェクト一覧が返す既存 runtime-status スナップショットのみを使用します。runtime の開始/停止、コンテナ検査、状態書き込みは行いません。',
    runtimeHealthAll: 'すべて',
    runtimeHealthSeverityFilter: 'ヘルス分類',
    runtimeHealthStatusFilter: 'Runtime 状態',
    runtimeHealthFilterSummary: 'フィルター結果',
    runtimeHealthFilteredEmpty: '現在の Runtime Health フィルターに一致するプロジェクトはありません',
    runtimeHealthClearFilters: 'フィルターを解除',
    runtimeHealthCopyDiagnosticLink: '診断リンクをコピー',
    runtimeHealthDiagnosticLinkCopied: 'コピー済み',
    runtimeHealthProjectDrilldown: 'プロジェクト Drilldown',
    runtimeHealthProjectDrilldownAll: 'プロジェクトを指定しない',
    runtimeHealthProjectDrilldownMissing: '現在のリンクで指定されたプロジェクトは存在しないか、一覧にありません',
    runtimeHealthOpenProjectDrilldown: 'プロジェクト詳細を見る',
    runtimeHealthClearProjectDrilldown: 'プロジェクト指定を解除',
    runtimeHealthUpdatedAt: '更新日時',
    providerHealthDiagnostics: 'Provider Health 診断',
    providerHealthProviders: 'Provider',
    providerHealthEnabled: '有効',
    providerHealthLoaded: 'ロード済み',
    providerHealthDrift: 'Runtime 差分',
    providerHealthBlocked: 'ブロック',
    providerHealthEmpty: 'LLM Provider 設定はまだありません',
    providerHealthReadOnlyBoundary: 'このカードは Admin LLM Provider 一覧が返すサニタイズ済み設定状態と runtime スナップショットのみを使用します。シークレット値の読み取り、reload、接続テスト、外部 endpoint 呼び出しは行いません。',
    providerHealthDefault: 'デフォルト',
    providerHealthActive: '現在実行中',
    providerHealthReady: '一致',
    providerHealthIdle: '無効',
    providerHealthPriorityProviders: '優先確認 Provider',
    providerHealthDefaultBadge: 'デフォルト',
    providerHealthNotLoaded: '未ロード',
    providerHealthNextAction: '次のアクション',
    providerHealthAll: 'すべて',
    providerHealthSeverityFilter: 'ヘルス分類',
    providerHealthRuntimeFilter: 'Runtime',
    providerHealthFilterSummary: 'フィルター結果',
    providerHealthFilteredEmpty: '現在の Provider Health フィルターに一致する Provider はありません',
    providerHealthClearFilters: 'フィルターを解除',
    providerHealthCopyDiagnosticLink: '診断リンクをコピー',
    providerHealthDiagnosticLinkCopied: 'コピー済み',
    totalProviders: 'LLM プロバイダ',
    totalConfigs: 'システム設定',
    totalUsers: '一般ユーザー',
    totalAdmins: '管理者アカウント',
    viewModule: '開く',
    capabilityPreflight: 'Capability 事前確認',
    capabilityPreflightDescription: 'Skill / MCP endpoint 設定の読み取り専用診断。実際の呼び出しは行いません。',
    capabilityPreflightBlocked: 'ブロック',
    capabilityPreflightReady: '準備完了',
    capabilityPreflightSkipped: 'スキップ',
    capabilityPreflightUnavailable: 'Capability 事前確認データはありません',
    capabilityPreflightSnapshot: '起動時スナップショット',
    capabilityPreflightDetails: '事前確認の詳細',
    capabilityPreflightMetadata: '診断メタデータ',
    capabilityPreflightNextAction: '次のアクション',
    capabilityPreflightSeverity: '重要度',
    capabilityPreflightAll: 'すべて',
    capabilityPreflightStatusFilter: 'ステータス',
    capabilityPreflightSeverityFilter: '重要度',
    capabilityPreflightFilteredEmpty: '現在のフィルターに一致する事前確認項目はありません',
    capabilityPreflightPrioritySummary: '優先サマリー',
    capabilityPreflightPrimaryIssue: '優先対応',
    capabilityPreflightPriorityHealthy: '現在 critical または warning の事前確認項目はありません。',
    capabilityPreflightProviderSummary: 'Provider 診断概要',
    capabilityPreflightProviderSummaryHealthy: '現在すべての provider は準備完了です。',
    capabilityPreflightProviderSummaryEmpty: 'Provider 診断概要はまだありません。',
    capabilityPreflightProviderRunnerModes: 'Runner モード',
    capabilityPreflightProviderReasonCodes: '原因コード',
    capabilityPreflightConfigKeys: '設定項目',
    capabilityPreflightConfigKeySummary: '設定項目サマリー',
    capabilityPreflightConfigKeyFilter: '設定フォーカス',
    capabilityPreflightConfigKeyFocusSummary: 'フォーカス結果',
    capabilityPreflightBoundaryTitle: '読み取り専用の診断境界',
    capabilityPreflightBoundaryDescription: 'この事前確認はバックエンド起動時スナップショットに基づき、設定と runner ポリシー状態を説明します。再確認、runner 実行、endpoint 探査、設定値の読み書きは行いません。',
    capabilityPreflightSnapshotFreshness: 'スナップショット鮮度',
    capabilityPreflightSnapshotAge: 'スナップショット経過',
    capabilityPreflightSnapshotRefreshHint: 'この時刻以降に設定を変更した場合は、既定の手順でサービス再起動またはバックエンドスナップショット更新を行ってから再確認してください。',
    capabilityPreflightReasonCodeRunbook: 'Reason code 対応メモ',
    capabilityPreflightReasonCodeFilter: '原因フォーカス',
    capabilityPreflightReasonCodeFocusSummary: '原因フォーカス結果',
    capabilityPreflightRunbookProviders: '関連 provider',
    capabilityPreflightRunbookConfigKeys: '確認する設定項目',
    capabilityPreflightRunbookNextActions: '推奨アクション',
    capabilityPreflightFilterSummary: 'フィルター概要',
    capabilityPreflightClearFilters: 'すべてのフィルターを解除',
    capabilityPreflightCopyDiagnosticLink: '診断リンクをコピー',
    capabilityPreflightDiagnosticLinkCopied: 'コピー済み',
  },
};

export function getAdminCopy(locale: AppLocale): AdminCopy {
  return copyMap[locale] || copyMap['zh-CN'];
}
