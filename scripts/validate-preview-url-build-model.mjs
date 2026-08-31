#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function fail(message) {
  console.error(`[YES] Preview URL build model invalid: ${message}`);
  process.exit(1);
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    fail(`${message}: missing ${snippet}`);
  }
}

function assertNotIncludes(source, snippet, message) {
  if (source.includes(snippet)) {
    fail(`${message}: found forbidden ${snippet}`);
  }
}

const helpers = readProjectFile('src/app/workspace/workspace-page-helpers.ts');
const previewUrlBuildErrors = readProjectFile('src/lib/workspace/preview-url-build-errors.ts');
const previewUrlStatus = readProjectFile('src/app/workspace/workspace-preview-url-status.ts');
const runtimeResources = readProjectFile('src/app/workspace/use-workspace-runtime-resources.ts');
const projectBootstrap = readProjectFile('src/app/workspace/use-workspace-project-bootstrap.ts');
const foundation = readProjectFile('src/app/workspace/use-workspace-page-foundation.tsx');
const validationLayer = readProjectFile('docs/engineering/VALIDATION_LAYER.md');
const yesScript = readProjectFile('scripts/validate-yes.sh');

[
  'export type ProjectPreviewUrlBuildReasonCode = \'missing_project_id\' | \'missing_gateway_config\' | \'invalid_gateway_url\'',
  "import type { PreviewUrlBuildReasonSource } from '@/lib/workspace/preview-url-build-errors';",
  'export type ProjectPreviewUrlBuildReasonSource = PreviewUrlBuildReasonSource',
  'export type ProjectPreviewUrlBuildResult',
  'reasonCode: ProjectPreviewUrlBuildReasonCode',
  'reasonSource: ProjectPreviewUrlBuildReasonSource',
  'reasonDetails: string',
  'export function buildProjectPreviewUrlResult',
  '未配置 Preview Gateway URL 或端口',
  'Preview Gateway 配置无法解析',
  'same-origin /preview/ proxy fallback is unavailable',
  "return '/preview';",
  'function getWorkspacePreviewUrl(base: string): URL',
  'new URL(base, window.location.origin)',
  'function shouldAttachWorkspacePreviewProjectParam(url: URL): boolean',
  "normalizedPath !== '/preview'",
  "url.searchParams.get('project')",
  "url.searchParams.get('preview_token')",
  'function normalizeWorkspacePreviewExplicitUrlForProject(',
  'url.searchParams.set(\'project\', projectId)',
].forEach((snippet) => assertIncludes(
  helpers,
  snippet,
  'workspace preview URL builder should return structured failure reasons with source/details',
));

[
  'reasonCode: \'missing_project_id\' | \'missing_gateway_config\' | \'invalid_gateway_url\'',
  'reasonSource: \'workspace_project\' | \'preview_gateway_config\'',
].forEach((snippet) => {
  if (helpers.includes(snippet)) {
    fail(`workspace preview URL builder should not regress reason contract to inline union: ${snippet}`);
  }
});

[
  'export type PreviewUrlBuildReasonSource = \'workspace_project\' | \'preview_gateway_config\'',
  'formatUserVisibleApiError({',
  'source: result.reasonSource',
  'details: result.reasonDetails',
  'reasonSource: PreviewUrlBuildReasonSource',
  'export function formatPreviewUrlBuildFailure',
].forEach((snippet) => assertIncludes(
  previewUrlBuildErrors,
  snippet,
  'preview URL build errors should centralize reasonSource/reasonDetails visible formatting',
));

if (previewUrlBuildErrors.includes('reasonSource: \'workspace_project\' | \'preview_gateway_config\'')) {
  fail('preview URL build errors should not regress reasonSource to an inline union');
}

[
  'export function buildPreviewUrlBuildFailureStatus',
  "status: hasConfirmedUrl ? 'stale_after_build_failure' : 'empty'",
  "source: 'preview_url_build'",
  '当前 Preview 面板仍保留旧地址',
  '当前 Preview 面板没有可确认地址',
].forEach((snippet) => assertIncludes(
  previewUrlStatus,
  snippet,
  'preview URL source status should centralize build failure empty/stale semantics',
));

[
  'const lastPreviewUrlBuildFailureNoticeAtRef = useRef<Map<string, number>>(new Map())',
  'appendPreviewUrlBuildFailureMessage',
  'formatPreviewUrlBuildFailure(result)',
  'buildPreviewUrlBuildFailureStatus({',
  'failurePrefix: `Preview URL 构建失败（${sourceLabel}）`',
  'Preview URL 构建失败（${sourceLabel}）',
  '当前 Preview 面板可能保持空白或旧地址',
  'buildProjectPreviewUrlResult(projectId, explicitPreviewUrl)',
  'function hasProjectDetailPreviewSourceUrl(value: string | null | undefined): value is string',
  'const hasValue = value.length > 0',
  'const shouldSyncProjectDetailPreviewUrl = useCallback',
  'const hasExplicitPreviewUrl = hasProjectDetailPreviewSourceUrl(explicitPreviewUrl)',
  'const needsRuntime = appTypeNeedsRuntime(appType)',
  'return hasExplicitPreviewUrl === true || needsRuntime === true',
  'const shouldSyncPreviewUrl = shouldSyncProjectDetailPreviewUrl({',
  'explicitPreviewUrl: project.preview_url',
  'buildProjectPreviewUrlResult(projectId, project.preview_url)',
].forEach((snippet) => assertIncludes(
  runtimeResources,
  snippet,
  'runtime resources should surface Preview URL build failures',
));
[
  'const shouldSyncPreviewUrl = Boolean(project?.preview_url)',
  'buildProjectPreviewUrlResult(projectId, project?.preview_url)',
  'NEXT_PUBLIC_PREVIEW_GATEWAY_PORT',
].forEach((snippet) => assertNotIncludes(
  helpers + runtimeResources,
  snippet,
  'runtime resources should not regress Preview URL sync gate to Boolean optional access or public preview port fallback',
));

[
  'appendInitialPreviewUrlBuildFailureMessage',
  'initial-preview-url-build-failed-${projectId}',
  'formatPreviewUrlBuildFailure(result)',
  'buildPreviewUrlBuildFailureStatus({',
  "failurePrefix: '初始 Preview URL 构建失败'",
  '初始 Preview URL 构建失败',
  'function hasWorkspaceBootstrapPreviewSourceUrl(value: string | null | undefined): value is string',
  'function getWorkspaceBootstrapRuntimePreviewUrl(runtimeStatus: ProjectRuntimeStatus | undefined): string | undefined',
  'function getWorkspaceBootstrapPreviewSourceUrl({',
  'function shouldSyncWorkspaceBootstrapPreviewUrl({',
  'const runtimePreviewUrl = getWorkspaceBootstrapRuntimePreviewUrl(data.runtimeStatus)',
  'const previewSourceUrl = getWorkspaceBootstrapPreviewSourceUrl({',
  'const shouldSyncPreviewUrl = shouldSyncWorkspaceBootstrapPreviewUrl({',
  'if (shouldSyncPreviewUrl === true)',
  'buildProjectPreviewUrlResult(data.projectId, previewSourceUrl)',
].forEach((snippet) => assertIncludes(
  projectBootstrap,
  snippet,
  'project bootstrap should surface initial Preview URL build failures',
));
[
  'const previewSourceUrl = data.previewUrl || data.runtimeStatus?.previewUrl',
  'const shouldSyncPreviewUrl = Boolean(previewSourceUrl) || appTypeNeedsRuntime(data.appType)',
].forEach((snippet) => assertNotIncludes(
  projectBootstrap,
  snippet,
  'project bootstrap should not regress initial Preview URL sync gate to OR fallback or Boolean coercion',
));

assertIncludes(
  foundation,
  'buildProjectPreviewUrlResult',
  'workspace foundation should pass the structured Preview URL builder to runtime/bootstrap hooks',
);
assertIncludes(
  validationLayer,
  'Preview URL 构建失败必须用户可见',
  'Validation Layer should document Preview URL build visibility',
);
assertIncludes(
  validationLayer,
  'buildPreviewUrlBuildFailureStatus',
  'Validation Layer should document shared Preview URL build failure status helper',
);
assertIncludes(
  yesScript,
  'validate-preview-url-build-model.mjs',
  'YES validation should execute Preview URL build visibility checks',
);

console.log('[YES] Preview URL build model validation passed.');
