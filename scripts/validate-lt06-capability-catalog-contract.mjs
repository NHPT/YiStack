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

const capabilityContextSource = readText('backend/internal/orchestration/workspace_capability_context.go');
const capabilityAuditSource = readText('backend/internal/orchestration/workspace_capability_execution_audit.go');
const capabilityProviderRegistrySource = readText('backend/internal/orchestration/workspace_capability_provider_registry.go');
const capabilityProviderExecutorSource = readText('backend/internal/orchestration/workspace_capability_provider_executor.go');
const capabilityHTTPRunnerSource = readText('backend/internal/orchestration/workspace_capability_mcp_http_runner.go');
const capabilityStageSource = readText('backend/internal/orchestration/workspace_capability_stage.go');
const generateHandlerSource = readText('backend/internal/handler/generate.go');
const requestCommandBuilderSource = readText('backend/internal/handler/request_command_builder.go');
const workspaceImplementationGenerationSource = readText('src/app/workspace/workspace-implementation-generation.ts');
const frontendApiSource = readText('src/lib/api/index.ts');
const workspaceCapabilityAuditPanelSource = readText('src/app/workspace/workspace-capability-audit-panel.tsx');
const orchestratorTestSource = readText('backend/internal/orchestration/workspace_orchestrator_test.go');
const validationLayerSource = readText('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(
  capabilityContextSource,
  'type CapabilityCatalogDefinition struct',
  'LT-06 should define a named capability catalog definition contract',
);
for (const field of [
  'ID',
  'Name',
  'Provider',
  'Purpose',
  'Version',
  'Required',
  'WorkflowModes',
  'Profiles',
  'OnlineOnly',
  'SourceNote',
]) {
  assertIncludes(
    capabilityContextSource,
    field,
    `CapabilityCatalogDefinition should include ${field}`,
  );
}
assertIncludes(
  capabilityContextSource,
  'func CapabilityCatalogDefinitions() []CapabilityCatalogDefinition',
  'Capability catalog should expose a canonical definition list',
);
for (const capability of [
  'CapabilityOrchestrationContext',
  'CapabilityEngineeringStateSnapshot',
  'CapabilityFoundationDecisionSynthesis',
  'CapabilityPlanOptionSynthesis',
  'CapabilityGenerationContentStream',
  'CapabilityValidationBeforePreview',
  'CapabilityDiscussionResponse',
  'CapabilitySkillContractDryRun',
  'CapabilityMCPContractDryRun',
  'CapabilityOnlineContextSearchCrawl',
]) {
  assertIncludes(
    capabilityContextSource,
    capability,
    `Capability catalog should include ${capability}`,
  );
}
assertIncludes(
  capabilityContextSource,
  'capabilities := capabilityDescriptorsForCatalog(stage, mode, profile, false)',
  'ResolveCapabilityContext should consume capability catalog descriptors',
);
assertIncludes(
  capabilityContextSource,
  'func capabilityDescriptorByID(id string) (CapabilityDescriptor, bool)',
  'Online capability should be resolved from catalog by ID',
);
assertIncludes(
  capabilityContextSource,
  'func matchesCapabilityCatalogDefinition',
  'Capability catalog selection should use a named matcher',
);
assertIncludes(
  capabilityContextSource,
  'func capabilityDescriptorFromCatalogDefinition',
  'Capability descriptor materialization should come from catalog definitions',
);
assert.ok(
  capabilityContextSource.includes('func externalCapabilitiesForProfile') === false,
  'Capability profile selection should not regress to externalCapabilitiesForProfile switch',
);
assert.ok(
  capabilityContextSource.includes('externalCapability(') === false,
  'Capability descriptors should not regress to scattered externalCapability constructor calls',
);
assert.ok(
  capabilityContextSource.includes('internalCapability(') === false,
  'Capability descriptors should not regress to scattered internalCapability constructor calls',
);
assertIncludes(
  capabilityProviderRegistrySource,
  'CapabilityProviderRegistry',
  'Capability provider registry should remain the provider availability boundary',
);
for (const auditField of [
  'CapabilityVersion',
  'CapabilityCatalogSource',
  'ProviderResolutionStatus',
]) {
  assertIncludes(
    capabilityAuditSource,
    auditField,
    `Capability execution audit item should include ${auditField}`,
  );
}
for (const auditPayloadField of [
  '"capability_version"',
  '"capability_catalog_source"',
  '"provider_resolution_status"',
]) {
  assertIncludes(
    capabilityAuditSource,
    auditPayloadField,
    `Capability execution audit meta should include ${auditPayloadField}`,
  );
}
assertIncludes(
  capabilityAuditSource,
  'external_provider_ready_for_execution',
  'Resolved external providers should be marked ready for execution instead of treated as not connected',
);
assertIncludes(
  capabilityProviderExecutorSource,
  'CapabilityExecutionPolicy',
  'Capability executor should keep execution policy separated from provider catalog',
);
assertIncludes(
  capabilityProviderExecutorSource,
  'CapabilityRunnerBoundary',
  'Capability executor should keep runner boundary separated from provider catalog',
);
assertIncludes(
  capabilityProviderExecutorSource,
  'capabilityExecutionResultMetadata',
  'Capability execution result should use one metadata helper for audit and runner results',
);
assertIncludes(
  capabilityProviderExecutorSource,
  'capabilityExecutionResultMetadata(auditItem, runResult.Metadata, "capability_runner")',
  'Runner execution results should carry capability catalog evidence and source=capability_runner',
);
for (const metadataField of [
  'metadata["source"]',
  'metadata["capability_version"]',
  'metadata["capability_catalog_source"]',
  'metadata["provider_resolution_status"]',
]) {
  assertIncludes(
    capabilityProviderExecutorSource,
    metadataField,
    `Capability runner metadata should include ${metadataField}`,
  );
}
assertIncludes(
  capabilityHTTPRunnerSource,
  'type capabilityProviderHTTPRequest struct',
  'HTTP provider runner should define a structured request contract',
);
assertIncludes(
  capabilityHTTPRunnerSource,
  'func capabilityProviderHTTPRequestFromContext',
  'HTTP provider runner should build requests from orchestration and capability execution context',
);
for (const requestField of [
  'CapabilityVersion',
  'CapabilityCatalogSource',
  'ProviderResolutionStatus',
  'Required',
  'WorkflowStage',
  'WorkflowMode',
  'CapabilityProfile',
  'ProjectID',
  'UserID',
]) {
  assertIncludes(
    capabilityHTTPRunnerSource,
    requestField,
    `HTTP provider runner request should include ${requestField}`,
  );
}
assertIncludes(
  capabilityStageSource,
  'BuildCapabilityExecutionAudit(resolution)',
  'Capability stage should continue producing execution audit from provider resolution',
);
assertIncludes(
  capabilityStageSource,
  'withOptionalOnlineContextCapability(capabilityContext)',
  'Online context capability should remain optional and selected explicitly',
);
assertIncludes(
  generateHandlerSource,
  'CapabilityProfile string',
  'Generate HTTP request should expose a controlled capability_profile entrypoint',
);
assertIncludes(
  requestCommandBuilderSource,
  'CapabilityProfile: strings.TrimSpace(r.CapabilityProfile)',
  'Generate command builder should carry capability_profile into OrchestrationContext',
);
assertIncludes(
  workspaceImplementationGenerationSource,
  'capabilityProfile?: string;',
  'Workspace GenerateOptions should expose an optional controlled capability profile',
);
assertIncludes(
  workspaceImplementationGenerationSource,
  'capability_profile: request.capabilityProfile',
  'Workspace generate payload should pass capability_profile to the backend when explicitly provided',
);
assertIncludes(
  frontendApiSource,
  'capability_profile?: string;',
  'Frontend ChatGenerateRequest should model capability_profile',
);
assertIncludes(
  workspaceCapabilityAuditPanelSource,
  'type CapabilityAuditPanelCatalogEvidence',
  'Workspace Capability Audit panel should expose a catalog evidence model',
);
assertIncludes(
  workspaceCapabilityAuditPanelSource,
  'getCapabilityAuditPanelCatalogEvidence',
  'Workspace Capability Audit panel should read catalog evidence from execution audit payload',
);
assertIncludes(
  workspaceCapabilityAuditPanelSource,
  'capability_catalog_source',
  'Workspace Capability Audit panel should display catalog source evidence',
);
assertIncludes(
  workspaceCapabilityAuditPanelSource,
  'provider_resolution_status',
  'Workspace Capability Audit panel should display provider resolution evidence',
);
assertIncludes(
  workspaceCapabilityAuditPanelSource,
  'CatalogVersion:',
  'Workspace Capability Audit panel should render capability catalog version',
);
assertIncludes(
  orchestratorTestSource,
  'func TestCapabilityCatalogDefinitionsCoverCoreCapabilities',
  'Backend tests should cover capability catalog completeness',
);
for (const testEvidence of [
  'ProviderResolutionStatus: CapabilityResolutionStatusResolved',
  'withOrchestrationContext(ctx, OrchestrationContext',
  'withCapabilityContext(ctx, CapabilityContext',
  'withCapabilityExecutionRequest(ctx, CapabilityExecutionRequest',
  'captured.WorkflowStage != WorkflowStageImplement',
  'captured.WorkflowMode != WorkflowModeImplement',
  'captured.CapabilityProfile',
  'captured.ProjectID',
  'captured.UserID',
  'result.Items[0].Metadata["source"] != "capability_runner"',
  'func TestGenerateOrchestratorExecutesSkillHTTPCapabilityProfile',
  'SkillHTTPCapabilityProviderRunner',
  'captured.CapabilityProfile != CapabilityProfileImplementationSkillDryRun',
  'metadata["source"] == "capability_runner"',
  'metadata["runner_mode"] == "skill-http"',
]) {
  assertIncludes(
    orchestratorTestSource,
    testEvidence,
    `Backend tests should lock LT-06 real runner evidence: ${testEvidence}`,
  );
}
assertIncludes(
  validationLayerSource,
  'LT-06 capability catalog contract 校验',
  'Validation Layer should document the LT-06 capability catalog gate',
);
console.log('[YES] LT-06 capability catalog contract validation passed.');
