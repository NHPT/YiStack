#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const requireText = (source, snippet, message) => {
  if (!source.includes(snippet)) throw new Error(message);
};

const packageJSON = JSON.parse(read('package.json'));
const suite = JSON.parse(read('evals/canonical-prompts.v1.json'));
const browserCore = read('scripts/lib/browser-acceptance.mjs');
const worker = read('scripts/browser-acceptance-worker.mjs');
const benchmark = read('scripts/run-generation-benchmark.mjs');
const service = read('backend/internal/service/browser_acceptance.go');
const applyService = read('backend/internal/service/generation_apply_service.go');
const projectValidation = read("backend/internal/service/project_validation.go") + "\n" + read("backend/internal/service/project_validation_vite_react.go");
const projectValidationTests = read('backend/internal/service/project_validation_test.go');
const contentStage = read('backend/internal/service/generator_content_stage.go');
const contentStageTests = read('backend/internal/service/generator_content_stage_test.go');
const previewRuntime = read('backend/internal/service/project_preview_runtime.go');
const previewRuntimeTests = read('backend/internal/service/project_preview_runtime_test.go');
const failureService = read('backend/internal/service/generation_failure.go');
const jobService = read('backend/internal/service/generation_job_service.go');
const initSQL = read('backend/init.sql');
const serviceTests = read('backend/internal/service/browser_acceptance_test.go');
const frontendWorkflow = read('src/lib/workspace/workflow-contract.ts');
const validationLayer = read('docs/engineering/VALIDATION_LAYER.md');

if (packageJSON.devDependencies?.['@playwright/test'] === undefined) throw new Error('EVAL-001 requires @playwright/test.');
for (const scriptName of ['browser:worker', 'browser:install', 'eval:canonical', 'eval:smoke']) {
  if (!packageJSON.scripts?.[scriptName]) throw new Error(`EVAL-001 package script is missing: ${scriptName}`);
}
if (suite.schema_version !== 'canonical_generation_suite.v1' || suite.prompt_version !== 'r5.1') {
  throw new Error('EVAL-001 canonical suite version is invalid.');
}
if (!Array.isArray(suite.samples) || suite.samples.length < 24) throw new Error('EVAL-001 requires at least 24 canonical prompts.');
const expectedCategories = ['static', 'react-vite', 'next', 'api', 'supabase-fullstack', 'iteration'];
const ids = new Set();
for (const category of expectedCategories) {
  const samples = suite.samples.filter((sample) => sample.category === category);
  if (samples.length < 4) throw new Error(`EVAL-001 category ${category} requires at least four prompts.`);
}
for (const sample of suite.samples) {
  if (!sample.id || ids.has(sample.id)) throw new Error(`EVAL-001 canonical sample id is invalid: ${sample.id}`);
  ids.add(sample.id);
  if (!sample.prompt || !sample.runtime_profile || !sample.acceptance) throw new Error(`EVAL-001 sample is incomplete: ${sample.id}`);
  if (sample.category === 'iteration' && !sample.seed_prompt) throw new Error(`EVAL-001 iteration sample requires seed_prompt: ${sample.id}`);
}

for (const snippet of [
  "browserAcceptanceSchemaVersion = 'browser_acceptance.v1'",
  "page.on('console'",
  "page.on('pageerror'",
  "page.on('response'",
  "page.on('requestfailed'",
  'waitForRequiredText(page, requiredText, timeoutMs)',
  "page.screenshot({ path: screenshotPath, fullPage: true })",
  "runtime/generation-evidence",
  "url hostname is not allowed",
]) requireText(browserCore, snippet, `EVAL-001 browser core is missing: ${snippet}`);
for (const snippet of ["const host = '127.0.0.1'", "request.url !== '/v1/accept'", 'maxConcurrency = 2']) {
  requireText(worker, snippet, `EVAL-001 controlled worker is missing: ${snippet}`);
}
for (const snippet of [
  'generation_benchmark_report.v1',
  'YISTACK_EVAL_TOKEN',
  'runtimeProviderID(provider, model)',
  'conversation_stage: "bootstrap_confirmed"',
  'result.foundation = await prepareFoundation',
  'const response = await requestRaw(baseURL + "/chat/generate"',
  'suite_hash',
  'generation_timeout_ms',
  'generation-timeout-minutes',
  "from 'node:http'",
  'export function requestRaw',
  'await requestRaw(`${baseURL}/chat/generate`',
  'schema_pass_rate',
  'first_pass_build_rate',
  'repair_success_count',
  'final_build_preview_browser_rate',
  'terminal_event_uniqueness_rate',
  'false_success_count',
  'command_failure_block_rate',
  'token_usage: null',
]) requireText(benchmark, snippet, `EVAL-001 benchmark runner is missing: ${snippet}`);

for (const snippet of [
  'type BrowserAcceptanceRunner interface',
  'validateBrowserAcceptanceWorkerEndpoint',
  'browser acceptance worker endpoint must use loopback HTTP',
  'runGeneratedProjectBrowserAcceptance',
  'GenerationJobIDFromContext(ctx)',
]) requireText(service, snippet, `EVAL-001 backend runner is missing: ${snippet}`);
for (const snippet of [
  'buildBrowserAcceptancePromptSection(req.BrowserAcceptance)',
  '浏览器验收契约（实现必须满足）',
  '仅写入 document.title',
  '可见且可操作的真实控件',
]) requireText(contentStage, snippet, `EVAL-001 generation acceptance grounding is missing: ${snippet}`);
requireText(
  contentStageTests,
  'TestBuildGenerationUserPromptIncludesBrowserAcceptanceContract',
  'EVAL-001 generation acceptance grounding test is missing.',
);
for (const snippet of [
  'viteReactJSXRuntimeValidationScript',
  'buildViteReactRuntimeCheck()',
  'React is not defined at runtime',
]) requireText(projectValidation, snippet, "EVAL-001 Vite browser runtime validation is missing: " + snippet);
requireText(
  projectValidationTests,
  'TestProjectValidationRunnerRejectsMissingViteReactRuntime',
  'EVAL-001 Vite browser runtime regression test is missing.',
);
const previewIndex = applyService.indexOf('startGeneratedProjectPreview(ctx, project)');
const browserIndex = applyService.indexOf('runGeneratedProjectBrowserAcceptance(ctx, req.ProjectID');
const gitIndex = applyService.indexOf('createProjectGitCommitInContainer(ctx');
if (!(previewIndex >= 0 && browserIndex > previewIndex && gitIndex > browserIndex)) {
  throw new Error('EVAL-001 must execute preview -> browser acceptance -> Git commit.');
}
for (const snippet of [
  'if [ "${package_runner}" = "npm" ]; then',
  'run dev --host 0.0.0.0 --port',
  'run dev --hostname 0.0.0.0 --port',
]) requireText(previewRuntime, snippet, `EVAL-001 preview runner argument forwarding is missing: ${snippet}`);
requireText(
  previewRuntimeTests,
  'TestBuildProjectPreviewServerCommandCoversNodeAndStaticEntrypoints',
  'EVAL-001 preview runner regression test is missing.',
);
requireText(failureService, 'GenerationFailureCodeBrowserAcceptanceFailed', 'EVAL-001 blocking failure code is missing.');
requireText(frontendWorkflow, "'browser_acceptance_failed'", 'EVAL-001 frontend failure reason is missing.');
requireText(jobService, 'id == "preview-server" || id == "browser-acceptance"', 'EVAL-001 durable Job phase mapping is missing.');
requireText(initSQL, "'project.browser_acceptance_timeout_seconds', '45'", 'EVAL-001 runtime timeout seed is missing.');
requireText(validationLayer, 'EVAL-001 浏览器验收与生成质量 Benchmark 校验', 'EVAL-001 validation documentation is missing.');
requireText(
  validationLayer,
  '`canonical_full / passed`、22/24、完整链路率 0.9167',
  'EVAL-001 final canonical benchmark evidence is missing.',
);
requireText(
  validationLayer,
  'false-success 与成功样本 blocking browser error 均为 0',
  'EVAL-001 final false-success and browser-error evidence is missing.',
);
for (const testName of [
  'TestHTTPBrowserAcceptanceRunnerUsesStructuredLoopbackRequest',
  'TestHTTPBrowserAcceptanceRunnerRejectsNonLoopbackWorker',
  'TestGenerationBrowserAcceptanceFailureIsBlocking',
]) requireText(serviceTests, testName, `EVAL-001 backend test is missing: ${testName}`);

console.log('[YES] EVAL-001 browser acceptance and canonical benchmark contract passed.');
