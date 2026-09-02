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

const projectDocsSource = readText('backend/internal/service/project_docs.go');
const projectPromptContextSource = readText('backend/internal/service/project_prompt_context.go');
const bootstrapOrchestratorSource = readText('backend/internal/orchestration/workspace_bootstrap_orchestrator.go');
const planOrchestratorSource = readText('backend/internal/orchestration/workspace_plan_orchestrator.go');
const foundationGateSource = readText('backend/internal/orchestration/workspace_foundation_gate.go');
const engineeringStateSource = readText('backend/internal/orchestration/workspace_engineering_state.go');
const planServiceSource = readText('backend/internal/service/plan_service.go');
const planPromptSource = readText('backend/internal/prompt/plan.go');
const planUserTemplate = readText('backend/internal/prompt/templates/plan_user.tmpl');
const planAnalysisUserTemplate = readText('backend/internal/prompt/templates/plan_analysis_user.tmpl');
const planLineUserTemplate = readText('backend/internal/prompt/templates/plan_lines_user.tmpl');
const validationLayerSource = readText('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(
  projectDocsSource,
  'ProjectBootstrapStatePath = projectBootstrapStatePath',
  'Foundation bootstrap state path should be exported from project docs service contract',
);
assertIncludes(
  projectDocsSource,
  'func ProjectFoundationArtifactPaths() []string',
  'Foundation artifact target list should be exposed through a service contract function',
);
for (const artifactPath of [
  '.yistack/foundation/foundation-brief.md',
  '.yistack/foundation/engineering-policy.md',
  '.yistack/foundation/architecture-lifecycle-spec.md',
  '.yistack/foundation/deferred-decisions.md',
]) {
  assertIncludes(
    projectDocsSource,
    artifactPath,
    `Foundation artifact path should remain registered: ${artifactPath}`,
  );
}

assertIncludes(
  engineeringStateSource,
  'ProjectBootstrapStateSchemaVersion = "v1"',
  'Foundation bootstrap state schema version should be a named orchestration contract',
);
assertIncludes(
  engineeringStateSource,
  'type BootstrapDesignReadiness struct',
  'Foundation bootstrap state should expose a named design readiness contract',
);
for (const readinessField of [
  'TechStackReady',
  'ArchitectureReady',
  'DirectoryStructureReady',
  'InterfaceContractReady',
  'DataModelReady',
  'MissingItems',
]) {
  assertIncludes(
    engineeringStateSource,
    readinessField,
    `Foundation design readiness should include ${readinessField}`,
  );
}
assertIncludes(
  engineeringStateSource,
  '"schema_version":        firstNonEmpty(state.SchemaVersion, ProjectBootstrapStateSchemaVersion)',
  'Engineering state bootstrap payload should consume the named schema version contract',
);
assertIncludes(
  engineeringStateSource,
  '"design_readiness"',
  'Engineering state bootstrap payload should serialize design readiness facts',
);
assertIncludes(
  bootstrapOrchestratorSource,
  'state = &BootstrapState{SchemaVersion: ProjectBootstrapStateSchemaVersion}',
  'Bootstrap state envelope fallback should consume the named schema version contract',
);
assertIncludes(
  bootstrapOrchestratorSource,
  '"schema_version": firstNonEmpty(state.SchemaVersion, ProjectBootstrapStateSchemaVersion)',
  'Bootstrap state envelope should serialize the named schema version contract',
);
assertIncludes(
  bootstrapOrchestratorSource,
  'service.ProjectFoundationArtifactPaths()',
  'Bootstrap workflow steps should consume the service-level Foundation artifact path contract',
);
for (const decisionId of [
  'tech_stack.runtime_profile',
  'architecture.boundary',
  'project.directory_structure',
  'api.interface_contract',
  'data.model_strategy',
]) {
  assertIncludes(
    bootstrapOrchestratorSource,
    decisionId,
    `Foundation scaffold should include LT-04 pre-generation design decision ${decisionId}`,
  );
}
assertIncludes(
  bootstrapOrchestratorSource,
  'func buildBootstrapDesignReadiness(requiredDecisions []BootstrapDecisionItem) *BootstrapDesignReadiness',
  'Bootstrap orchestrator should derive design readiness from required decisions',
);
assertIncludes(
  bootstrapOrchestratorSource,
  'state.DesignReadiness = buildBootstrapDesignReadiness(state.RequiredDecisions)',
  'Bootstrap state enrichment should attach design readiness facts',
);
assert.ok(
  bootstrapOrchestratorSource.includes('foundationArtifactTargets') === false,
  'Bootstrap orchestrator should not keep a local Foundation artifact target list',
);

assertIncludes(
  foundationGateSource,
  'SchemaVersion:    ProjectBootstrapStateSchemaVersion',
  'Foundation Gate blocked state should consume the named schema version contract',
);
assertIncludes(
  foundationGateSource,
  'firstNonEmpty(raw.SchemaVersion, envelope.SchemaVersion, ProjectBootstrapStateSchemaVersion)',
  'Foundation Gate persisted state reader should consume the named schema version fallback',
);
assertIncludes(
  foundationGateSource,
  'service.ProjectBootstrapStatePath',
  'Foundation Gate should read the canonical bootstrap state artifact path',
);
assertIncludes(
  foundationGateSource,
  'designReadiness := buildBootstrapDesignReadiness(state.RequiredDecisions)',
  'Foundation Gate should re-derive design readiness from persisted required decisions',
);
assertIncludes(
  foundationGateSource,
  '生成前设计 readiness 未完成：',
  'Foundation Gate should block when pre-generation design readiness is incomplete',
);

assert.match(
  projectPromptContextSource,
  /\{Title: "Foundation 结构化状态", Priority: 1, Path: projectBootstrapStatePath, Required: true\}[\s\S]*\{Title: "Foundation Brief", Priority: 2, Path: projectFoundationBriefPath\}[\s\S]*\{Title: "Engineering Policy", Priority: 3, Path: projectFoundationEngineeringPath\}[\s\S]*\{Title: "Architecture \/ Lifecycle Spec", Priority: 4, Path: projectFoundationArchitecturePath\}[\s\S]*\{Title: "Deferred Decisions", Priority: 5, Path: projectFoundationDeferredDecisions\}/,
  'Prompt Context should consume Foundation bootstrap state first and optional Foundation docs in stable priority order',
);
assertIncludes(
  projectPromptContextSource,
  'func buildProjectPromptContextSourceContent(spec projectPromptContextSpec, content string) string',
  'Prompt Context should route Foundation source content through a named source content builder',
);
assertIncludes(
  projectPromptContextSource,
  'func BuildFoundationDesignReadinessPromptSummary(content string) string',
  'Prompt Context should expose Foundation design readiness as a readable prompt summary',
);
assertIncludes(
  projectPromptContextSource,
  '生成前设计 readiness 摘要：',
  'Foundation design readiness prompt summary should use a stable visible heading',
);
assertIncludes(
  projectPromptContextSource,
  'readinessFactLabel(boolValue(designReadiness["tech_stack_ready"]))',
  'Foundation design readiness prompt summary should expose tech stack readiness',
);
assertIncludes(
  planOrchestratorSource,
  'foundationContext := buildPlanFoundationContext(ctx, command, o.artifactLoader)',
  'Plan orchestrator should derive Foundation context after Foundation Gate passes',
);
assertIncludes(
  planOrchestratorSource,
  'service.BuildFoundationDesignReadinessPromptSummary(content)',
  'Plan orchestrator should reuse the Foundation design readiness prompt summary',
);
assert.match(
  planServiceSource,
  /FoundationContext\s+string\s+`json:"foundation_context"`/,
  'Plan service request should carry Foundation context explicitly',
);
assertIncludes(
  planServiceSource,
  'req.FoundationContext',
  'Plan service should pass Foundation context into Plan prompt builders',
);
assertIncludes(
  planPromptSource,
  '"FoundationContext":  strings.TrimSpace(foundationContext)',
  'Plan prompt data should include FoundationContext as a named template field',
);
for (const template of [planUserTemplate, planAnalysisUserTemplate, planLineUserTemplate]) {
  assertIncludes(
    template,
    'Project Foundation 生成前设计真源：',
    'Plan user templates should expose a stable Foundation context heading',
  );
  assertIncludes(
    template,
    '{{.FoundationContext}}',
    'Plan user templates should render FoundationContext',
  );
}

assertIncludes(
  validationLayerSource,
  'Project Foundation artifact contract 校验',
  'Validation Layer should document the LT-04 Foundation artifact contract gate',
);
console.log('[YES] Foundation artifact contract validation passed.');
