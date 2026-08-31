#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertIncludes(content, expected, message) {
  assert.ok(content.includes(expected), message);
}

function assertPathExists(relativePath, message) {
  assert.ok(fs.existsSync(path.join(rootDir, relativePath)), message);
}

const enterpriseGovernanceSource = readText('src/lib/admin/enterprise-governance-contract.ts');
const enterprisePageSource = readText('src/app/admin/enterprise/page.tsx');
const backendServerSource = readText('backend/cmd/server/main.go');
const backendEnterpriseHandlerSource = readText('backend/internal/handler/admin_enterprise_handler.go');
const backendEnterpriseServiceSource = readText('backend/internal/service/admin_console_enterprise_service.go');
const backendProjectAccessGuardSource = readText('backend/internal/service/project_access_guard.go');
const backendInitSqlSource = readText('backend/init.sql');
const backendModelSource = readText('backend/internal/model/models.go');
const adminApiSource = readText('src/lib/admin/api.ts');
const nextSsoDiscoveryProxySource = readText('src/app/api/admin/enterprise/sso-discovery-readiness/route.ts');
const nextPrivateDeploymentProxySource = readText('src/app/api/admin/enterprise/private-deployment-readiness/route.ts');
const nextCommercialReadinessProxySource = readText('src/app/api/admin/enterprise/commercial-readiness/route.ts');
const nextProjectAccessGuardActivationProxySource = readText('src/app/api/admin/enterprise/project-access-guard-activation/activate/route.ts');
const validationLayerSource = readText('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(
  enterpriseGovernanceSource,
  'export const ENTERPRISE_GOVERNANCE_DOMAINS',
  'LT-08 should expose a named enterprise governance domain list',
);
assertIncludes(
  enterpriseGovernanceSource,
  'export type EnterpriseGovernanceDefinition = {',
  'LT-08 should expose a named enterprise governance definition contract',
);
for (const field of [
  'domain',
  'title',
  'primarySurface',
  'readinessSource',
  'entrypoints',
  'controlledMutationBoundary',
  'auditEvidence',
  'recovery',
]) {
  assertIncludes(
    enterpriseGovernanceSource,
    field,
    `EnterpriseGovernanceDefinition should include ${field}`,
  );
}

for (const domain of [
  'identity_sso',
  'rbac_access',
  'project_ownership',
  'audit_compliance',
  'private_deployment',
  'commercial_readiness',
]) {
  assertIncludes(
    enterpriseGovernanceSource,
    domain,
    `Enterprise governance catalog should include ${domain}`,
  );
}

for (const entrypoint of [
  'src/app/admin/enterprise/page.tsx',
  'src/app/admin/enterprise/admin-enterprise-governance-page-snapshot.tsx',
  'backend/init.sql',
  'backend/internal/service/project_access_guard.go',
  'backend/internal/orchestration/workspace_project_access.go',
  'backend/internal/service/admin_console_enterprise_service.go',
  'backend/internal/handler/admin_enterprise_handler.go',
  'src/app/api/admin/enterprise/project-ownership-migrations/route.ts',
  'src/app/api/admin/enterprise/audit-export-delivery-report-readiness/route.ts',
  'src/app/api/admin/enterprise/project-access-guard-activation/activate/route.ts',
  'src/app/api/admin/enterprise/private-deployment-readiness/route.ts',
  'src/app/api/admin/enterprise/commercial-readiness/route.ts',
  'scripts/validate-config-env-sync.mjs',
  'src/lib/workspace/runtime-health-diagnostics.ts',
  'docs/roadmap/ROADMAP.md',
  'docs/PRODUCT.md',
]) {
  assertIncludes(
    enterpriseGovernanceSource,
    entrypoint,
    `Enterprise governance catalog should reference ${entrypoint}`,
  );
  assertPathExists(entrypoint, `Enterprise governance entrypoint should exist: ${entrypoint}`);
}

assertIncludes(
  enterpriseGovernanceSource,
  'getEnterpriseGovernanceDefinition',
  'Enterprise governance catalog should expose a definition reader',
);
assertIncludes(
  enterpriseGovernanceSource,
  'getEnterpriseGovernanceDefinitionList',
  'Enterprise governance catalog should expose a definition list reader',
);
assertIncludes(
  enterprisePageSource,
  'getEnterpriseGovernanceDefinitionList',
  'Admin Enterprise page should consume the enterprise governance catalog',
);
assertIncludes(
  enterprisePageSource,
  'materializeEnterpriseGovernanceCoverageNodes',
  'Admin Enterprise page should materialize enterprise governance coverage nodes',
);
assertIncludes(
  enterprisePageSource,
  'data-testid="admin-enterprise-governance-coverage"',
  'Admin Enterprise page should expose a stable enterprise governance coverage UI target',
);
for (const [source, expected, message] of [
  [backendServerSource, 'admin.GET("/enterprise/sso-discovery-readiness", adminHandler.GetEnterpriseSsoDiscoveryReadiness)', 'Backend routes should expose enterprise SSO discovery readiness'],
  [backendEnterpriseHandlerSource, 'func (h *AdminHandler) GetEnterpriseSsoDiscoveryReadiness', 'Backend handler should expose enterprise SSO discovery readiness'],
  [backendEnterpriseServiceSource, 'func (s *AdminConsoleService) GetEnterpriseSsoDiscoveryReadiness', 'Enterprise service should implement SSO discovery readiness'],
  [backendEnterpriseServiceSource, 'func (s *AdminConsoleService) getEnterpriseSsoDiscoveryReadinessWithClient', 'Enterprise service should allow deterministic SSO discovery tests'],
  [backendEnterpriseServiceSource, 'EnterpriseSsoDiscoveryReady', 'Enterprise service should model successful SSO discovery readiness'],
  [backendEnterpriseServiceSource, 'EnterpriseSsoDiscoveryMissingConfig', 'Enterprise service should block SSO discovery when required config is missing'],
  [backendEnterpriseServiceSource, 'EnterpriseSsoDiscoveryFailed', 'Enterprise service should surface failed SSO discovery'],
  [backendEnterpriseServiceSource, 'LoginCallbackEnabled:        false', 'Enterprise SSO discovery should not enable login callback'],
  [backendEnterpriseServiceSource, 'SessionNormalizationEnabled: false', 'Enterprise SSO discovery should not enable session normalization'],
  [backendEnterpriseServiceSource, 'AdminAuditWriteEnabled:      false', 'Enterprise SSO discovery should not write admin audit'],
  [nextSsoDiscoveryProxySource, "backendPath: '/api/admin/enterprise/sso-discovery-readiness'", 'Next proxy should expose admin enterprise SSO discovery readiness'],
  [adminApiSource, 'export type AdminEnterpriseSsoDiscoveryReadinessStatus', 'Admin API should model SSO discovery readiness status'],
  [adminApiSource, 'export interface AdminEnterpriseSsoDiscoveryReadinessResponse', 'Admin API should model SSO discovery readiness response'],
  [adminApiSource, 'getSsoDiscoveryReadiness: async (): Promise<AdminEnterpriseSsoDiscoveryReadinessResponse>', 'Admin API should expose SSO discovery readiness client'],
  [enterprisePageSource, 'adminEnterpriseApi.getSsoDiscoveryReadiness()', 'Admin Enterprise page should load SSO discovery readiness'],
  [enterprisePageSource, 'data-testid="admin-enterprise-sso-discovery-readiness"', 'Admin Enterprise page should expose SSO discovery readiness evidence'],
  [enterprisePageSource, '不创建 SSO provider、不写 session、不启用登录回调、不写 admin audit', 'Admin Enterprise page should disclose SSO discovery no-side-effect boundary'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendServerSource, 'admin.GET("/enterprise/private-deployment-readiness", adminHandler.GetEnterprisePrivateDeploymentReadiness)', 'Backend routes should expose enterprise private deployment readiness'],
  [backendEnterpriseHandlerSource, 'func (h *AdminHandler) GetEnterprisePrivateDeploymentReadiness', 'Backend handler should expose enterprise private deployment readiness'],
  [backendEnterpriseServiceSource, 'type EnterprisePrivateDeploymentReadiness struct', 'Enterprise service should model private deployment readiness response'],
  [backendEnterpriseServiceSource, 'func (s *AdminConsoleService) GetEnterprisePrivateDeploymentReadiness', 'Enterprise service should implement private deployment readiness'],
  [backendEnterpriseServiceSource, 'EnterprisePrivateDeploymentReady', 'Enterprise service should model private deployment ready status'],
  [backendEnterpriseServiceSource, 'enterprisePrivateDeploymentRequiredRuntimeConfigKeys', 'Enterprise service should require DB-backed runtime config keys for private deployment'],
  [backendEnterpriseServiceSource, 'countEnterprisePrivateDeploymentRuntimeConfigKeys(configItems)', 'Private deployment readiness should count required runtime config keys from system_config'],
  [backendEnterpriseServiceSource, 'countEnterprisePrivateDeploymentSchemaChecks(ctx)', 'Private deployment readiness should verify enterprise migration schema via readback counts'],
  [backendEnterpriseServiceSource, 'EnvironmentVariableWriteEnabled: false', 'Private deployment readiness should not write env'],
  [backendEnterpriseServiceSource, 'DatabaseMigrationWriteEnabled:   false', 'Private deployment readiness should not execute migrations'],
  [backendEnterpriseServiceSource, 'ContainerMutationEnabled:        false', 'Private deployment readiness should not mutate containers'],
  [backendEnterpriseServiceSource, 'ExternalNetworkProbeEnabled:     false', 'Private deployment readiness should not probe external networks'],
  [nextPrivateDeploymentProxySource, "backendPath: '/api/admin/enterprise/private-deployment-readiness'", 'Next proxy should expose admin enterprise private deployment readiness'],
  [adminApiSource, 'export type AdminEnterprisePrivateDeploymentReadinessStatus', 'Admin API should model private deployment readiness status'],
  [adminApiSource, 'export interface AdminEnterprisePrivateDeploymentReadinessResponse', 'Admin API should model private deployment readiness response'],
  [adminApiSource, 'getPrivateDeploymentReadiness: async (): Promise<AdminEnterprisePrivateDeploymentReadinessResponse>', 'Admin API should expose private deployment readiness client'],
  [enterprisePageSource, 'adminEnterpriseApi.getPrivateDeploymentReadiness()', 'Admin Enterprise page should load private deployment readiness'],
  [enterprisePageSource, 'data-testid="admin-enterprise-private-deployment-readiness"', 'Admin Enterprise page should expose private deployment readiness evidence'],
  [enterprisePageSource, '不写 env、不执行 migration、不启动容器、不访问外部网络、不写 admin audit', 'Admin Enterprise page should disclose private deployment no-side-effect boundary'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendServerSource, 'admin.GET("/enterprise/commercial-readiness", adminHandler.GetEnterpriseCommercialReadiness)', 'Backend routes should expose enterprise commercial readiness'],
  [backendEnterpriseHandlerSource, 'func (h *AdminHandler) GetEnterpriseCommercialReadiness', 'Backend handler should expose enterprise commercial readiness'],
  [backendEnterpriseServiceSource, 'type EnterpriseCommercialReadiness struct', 'Enterprise service should model commercial readiness response'],
  [backendEnterpriseServiceSource, 'func (s *AdminConsoleService) GetEnterpriseCommercialReadiness', 'Enterprise service should implement commercial readiness'],
  [backendEnterpriseServiceSource, 'EnterpriseCommercialReadinessContractMissing', 'Commercial readiness should block when billing/contract schema is absent'],
  [backendEnterpriseServiceSource, 's.GetEnterpriseProjectAccessGuardActivationReadiness(ctx)', 'Commercial readiness should consume Project Ownership activation readiness'],
  [backendEnterpriseServiceSource, 's.GetEnterpriseAuditExportDeliveryReportStoredReadiness(ctx)', 'Commercial readiness should consume stored audit compliance evidence'],
  [backendEnterpriseServiceSource, 's.GetEnterprisePrivateDeploymentReadiness(ctx)', 'Commercial readiness should consume private deployment readiness'],
  [backendEnterpriseServiceSource, 'BillingProviderConfigured:     false', 'Commercial readiness should not configure billing providers'],
  [backendEnterpriseServiceSource, 'SubscriptionWriteEnabled:      false', 'Commercial readiness should not write subscriptions'],
  [backendEnterpriseServiceSource, 'ContractWriteEnabled:          false', 'Commercial readiness should not write contracts'],
  [backendEnterpriseServiceSource, 'PaymentCollectionEnabled:      false', 'Commercial readiness should not collect payments'],
  [nextCommercialReadinessProxySource, "backendPath: '/api/admin/enterprise/commercial-readiness'", 'Next proxy should expose admin enterprise commercial readiness'],
  [adminApiSource, 'export type AdminEnterpriseCommercialReadinessStatus', 'Admin API should model commercial readiness status'],
  [adminApiSource, 'export interface AdminEnterpriseCommercialReadinessResponse', 'Admin API should model commercial readiness response'],
  [adminApiSource, 'getCommercialReadiness: async (): Promise<AdminEnterpriseCommercialReadinessResponse>', 'Admin API should expose commercial readiness client'],
  [enterprisePageSource, 'adminEnterpriseApi.getCommercialReadiness()', 'Admin Enterprise page should load commercial readiness'],
  [enterprisePageSource, 'data-testid="admin-enterprise-commercial-readiness"', 'Admin Enterprise page should expose commercial readiness evidence'],
  [enterprisePageSource, '不接入计费 provider、不写订阅、不生成合同、不收款、不写 admin audit', 'Admin Enterprise page should disclose commercial readiness no-side-effect boundary'],
]) {
  assertIncludes(source, expected, message);
}
for (const [source, expected, message] of [
  [backendInitSqlSource, "('enterprise.project_access_guard.mode', 'legacy_user_owned'", 'Fresh init SQL should seed default Project Access Guard mode'],
  [backendModelSource, '{Key: "enterprise.project_access_guard.mode", Value: "legacy_user_owned"', 'Go defaults should seed legacy Project Access Guard mode'],
  [backendProjectAccessGuardSource, 'const projectAccessGuardModeSystemConfigKey = "enterprise.project_access_guard.mode"', 'Project Access Guard should use a named mode config key'],
  [backendProjectAccessGuardSource, 'func (s *ProjectService) resolveProjectAccessGuardMode', 'Project Access Guard should resolve authorization mode from system_config'],
  [backendProjectAccessGuardSource, 'func (s *ProjectService) authorizeEnterpriseOwnedProjectAccess', 'Project Access Guard should authorize from enterprise ownership and members after activation'],
  [backendProjectAccessGuardSource, 'decision.Mode == ProjectAccessGuardModeEnterpriseOwned', 'AuthorizeProjectAccess should branch on enterprise-owned mode'],
  [backendProjectAccessGuardSource, 'readiness.CanSwitchToEnterpriseOwned = !readiness.EnterpriseAuthorizationActive', 'Switch readiness should not expose switch gate after activation'],
  [backendEnterpriseServiceSource, 'type EnterpriseProjectAccessGuardAuthorizationActivationInput struct', 'Enterprise service should model authorization activation input'],
  [backendEnterpriseServiceSource, 'func (s *AdminConsoleService) ActivateEnterpriseProjectAccessGuardAuthorization', 'Enterprise service should implement controlled authorization activation'],
  [backendEnterpriseServiceSource, 'ConfirmEnterpriseAuthorizationActivation', 'Activation should require an explicit confirmation field'],
  [backendEnterpriseServiceSource, 'hasAdminConsoleEnterpriseProjectAccessGuardRollbackEvidenceAuditPlanEvidence', 'Activation should require rollback evidence before switching'],
  [backendEnterpriseServiceSource, 's.systemConfigService.SetConfig(ctx, projectAccessGuardModeSystemConfigKey, string(ProjectAccessGuardModeEnterpriseOwned))', 'Activation should persist enterprise-owned mode through system_config'],
  [backendEnterpriseServiceSource, 'confirmedMode, err := s.systemConfigService.GetConfig(ctx, projectAccessGuardModeSystemConfigKey)', 'Activation should verify the persisted authorization mode'],
  [backendEnterpriseServiceSource, '_ = s.systemConfigService.SetConfig(ctx, projectAccessGuardModeSystemConfigKey, string(previousMode))', 'Activation should attempt rollback when post-write validation or audit fails'],
  [backendEnterpriseServiceSource, '"authorization_switch_executed":', 'Activation audit should record whether the authorization switch executed'],
  [backendEnterpriseServiceSource, '"enterprise_authorization_enabled":', 'Activation audit should record enterprise authorization state'],
  [backendEnterpriseServiceSource, '"projects_written":', 'Activation should disclose whether projects are written'],
  [backendEnterpriseServiceSource, '"tenant_isolation_enabled":', 'Activation should not claim tenant isolation'],
  [backendEnterpriseServiceSource, '"organization_rbac_enabled":', 'Activation should not claim organization RBAC'],
  [backendEnterpriseHandlerSource, 'func (h *AdminHandler) ActivateEnterpriseProjectAccessGuardAuthorization', 'Backend handler should expose controlled authorization activation'],
  [backendServerSource, 'admin.POST("/enterprise/project-access-guard-activation/activate", adminHandler.ActivateEnterpriseProjectAccessGuardAuthorization)', 'Backend routes should expose controlled authorization activation'],
  [nextProjectAccessGuardActivationProxySource, "backendPath: '/api/admin/enterprise/project-access-guard-activation/activate'", 'Next proxy should expose controlled authorization activation'],
  [adminApiSource, 'export interface AdminEnterpriseProjectAccessGuardAuthorizationActivationInput', 'Admin API should model authorization activation input'],
  [adminApiSource, 'export interface AdminEnterpriseProjectAccessGuardAuthorizationActivationResult', 'Admin API should model authorization activation result'],
  [adminApiSource, 'activateProjectAccessGuardAuthorization: async (', 'Admin API should expose authorization activation client'],
  [enterprisePageSource, 'data-testid="admin-enterprise-project-access-guard-authorization-activation"', 'Admin Enterprise page should expose authorization activation UI evidence'],
  [enterprisePageSource, 'adminEnterpriseApi.activateProjectAccessGuardAuthorization(input)', 'Admin Enterprise page should call authorization activation client'],
  [enterprisePageSource, 'hasAdminEnterpriseProjectAccessGuardRollbackEvidence(projectAccessGuardActivationReadiness) === true', 'Admin Enterprise page should gate activation on rollback evidence'],
  [enterprisePageSource, 'enterprise.project_access_guard.mode 写为 enterprise_owned', 'Admin Enterprise page should disclose the exact activation write'],
  [enterprisePageSource, '不写 projects、不启用租户隔离或组织级 RBAC', 'Admin Enterprise page should disclose non-goal boundaries'],
]) {
  assertIncludes(source, expected, message);
}
assertIncludes(
  validationLayerSource,
  'LT-08 enterprise governance catalog contract 校验',
  'Validation Layer should document the LT-08 enterprise governance catalog gate',
);
console.log('[YES] LT-08 enterprise governance contract validation passed.');
