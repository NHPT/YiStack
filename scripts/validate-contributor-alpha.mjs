#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const requiredFiles = [
  'LICENSE',
  '.nvmrc',
  'README.en.md',
  'CONTRIBUTING.md',
  'CONTRIBUTING.en.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CODE_OF_CONDUCT.zh-CN.md',
  'GOVERNANCE.md',
  'MAINTAINERS.md',
  '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/release.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml',
  '.github/codeql/codeql-config.yml',
  '.github/workflows/canonical-eval.yml',
  'docs/CHANGELOG.md',
  'docs/CHANGELOG.en.md',
  'docs/DEVELOPER_GUIDE.en.md',
  'docs/ARCHITECTURE.en.md',
  'docs/PRODUCT.en.md',
  'docs/engineering/DATABASE_LIFECYCLE.md',
  'docs/engineering/DATABASE_LIFECYCLE.en.md',
  'docs/engineering/YES.en.md',
  'docs/engineering/PRINCIPLES.en.md',
  'docs/engineering/DEVELOPMENT_WORKFLOW.en.md',
  'docs/roadmap/ROADMAP.en.md',
  'docs/yistack_open_source_progress_and_competitor_matrix.html',
  'pnpm-workspace.yaml',
  'scripts/verify-repository-integrity.sh',
  'scripts/verify-clean-checkout.sh',
  'scripts/verify-supabase-baseline.sh',
  'backend/migrations/000000000000_contributor_alpha.sql',
  'backend/migrations/rollback/000000000000_contributor_alpha.sql',
];

for (const relativePath of requiredFiles) {
  const stat = fs.statSync(path.join(rootDir, relativePath));
  assert.equal(stat.isFile(), true, `${relativePath} must be a file`);
  assert.ok(stat.size > 0, `${relativePath} must not be empty`);
}

const license = read('LICENSE');
assert.match(license, /Apache License\s+Version 2\.0, January 2004/);

assert.equal(read('.nvmrc').trim(), '22');

const packageJSON = JSON.parse(read('package.json'));
assert.equal(packageJSON.version, '1.0.0');
assert.match(packageJSON.description, /开源 AI 工程工作台/);
assert.equal(packageJSON.repository.url, 'git+https://github.com/NHPT/YiStack.git');
assert.equal(packageJSON.bugs.url, 'https://github.com/NHPT/YiStack/issues');
assert.ok(packageJSON.keywords.includes('ai-code-generation'));
assert.equal(packageJSON.license, 'Apache-2.0');
assert.equal(packageJSON.packageManager, 'pnpm@11.5.2');
assert.equal(packageJSON.engines.node, '>=22 <23');
assert.equal(packageJSON.engines.pnpm, '11.5.2');
assert.equal(packageJSON.dependencies['embla-carousel'], '8.6.0');
assert.equal(packageJSON.dependencies['embla-carousel-react'], '8.6.0');
assert.equal(
  fs.existsSync(path.join(rootDir, 'package-lock.json')),
  false,
  'package-lock.json must not coexist with the pnpm lockfile',
);
for (const script of [
  'contributor:validate',
  'checkout:verify',
  'db:verify',
  'eval:smoke:ci',
]) {
  assert.equal(typeof packageJSON.scripts[script], 'string', `missing package script ${script}`);
}

const readme = read('README.md');
const readmeEnglish = read('README.en.md');
const contributing = read('CONTRIBUTING.md');
const contributingEnglish = read('CONTRIBUTING.en.md');
const codeOfConduct = read('CODE_OF_CONDUCT.md');
const codeOfConductChinese = read('CODE_OF_CONDUCT.zh-CN.md');
const product = read('docs/PRODUCT.md');
const productEnglish = read('docs/PRODUCT.en.md');
const changelog = read('docs/CHANGELOG.md');
const changelogEnglish = read('docs/CHANGELOG.en.md');
for (const [name, source] of [
  ['README.md', readme],
  ['README.en.md', readmeEnglish],
  ['docs/PRODUCT.md', product],
  ['docs/PRODUCT.en.md', productEnglish],
]) {
  assert.match(source, /Apache-2\.0|Apache License 2\.0/, `${name} must name Apache-2.0`);
  assert.doesNotMatch(source, /MIT License/, `${name} must not claim MIT`);
}
assert.match(readme, /当前版本：\*\*v1\.0\.0\*\*/);
assert.match(readmeEnglish, /Current release: \*\*v1\.0\.0\*\*/);
assert.match(changelog, /## \[1\.0\.0\] - 2026-09-01/);
assert.match(changelogEnglish, /## \[1\.0\.0\] - 2026-09-01/);
assert.doesNotMatch(readme, /高级 AI 模型、50\+ 模板|^- \*\*插件系统\*\*：/m);
assert.match(product, /规划不等于已实现/);
assert.match(readme, /\[English\]\(README\.en\.md\)/);
assert.match(readmeEnglish, /\[简体中文\]\(README\.md\)/);
assert.match(readme, /\[贡献指南\]\(CONTRIBUTING\.md\)/);
assert.doesNotMatch(readme, /\(CONTRIBUTING\.en\.md\)/);
assert.match(readmeEnglish, /\[Contributing Guide\]\(CONTRIBUTING\.en\.md\)/);
assert.doesNotMatch(readmeEnglish, /\(CONTRIBUTING\.md\)/);
assert.match(readme, /\[行为准则\]\(CODE_OF_CONDUCT\.zh-CN\.md\)/);
assert.doesNotMatch(readme, /\(CODE_OF_CONDUCT\.md\)/);
assert.match(readmeEnglish, /\[Code of Conduct\]\(CODE_OF_CONDUCT\.md\)/);
assert.doesNotMatch(readmeEnglish, /\(CODE_OF_CONDUCT\.zh-CN\.md\)/);
assert.match(contributing, /\[English\]\(CONTRIBUTING\.en\.md\)/);
assert.match(contributingEnglish, /\[简体中文\]\(CONTRIBUTING\.md\)/);
assert.match(codeOfConduct, /\[简体中文\]\(CODE_OF_CONDUCT\.zh-CN\.md\)/);
assert.match(codeOfConductChinese, /\[English \(canonical\)\]\(CODE_OF_CONDUCT\.md\)/);
assert.match(contributing, /`main` 分支/);
assert.match(contributingEnglish, /the `main` branch/);
assert.match(readme, /一句话生成完整应用/);
assert.match(readme, /\[YES 工程体系\]\(docs\/engineering\/YES\.md\)/);
assert.match(readme, /已实现，待云端验收/);
assert.match(readme, /请勿通过公开 Issue 或其他公开渠道提交/);
assert.doesNotMatch(readme, /合同已实现|不能公开提交/);
assert.match(readmeEnglish, /One prompt to a complete application/);
assert.match(readmeEnglish, /Implemented; live acceptance pending/);
assert.doesNotMatch(readmeEnglish, /Contract implemented/);
assert.match(
  readmeEnglish,
  /\[YES Engineering System\]\(docs\/engineering\/YES\.en\.md\)/,
);
assert.match(product, /已实现，待云端验收/);
assert.doesNotMatch(product, /合同已实现/);
assert.match(productEnglish, /Implemented; live acceptance pending/);
assert.doesNotMatch(productEnglish, /Contract implemented/);

const capabilityReport = read(
  'docs/yistack_open_source_progress_and_competitor_matrix.html',
);
assert.match(capabilityReport, /VIS-001 与 COLLAB-001 差异化闭环已完成/);
assert.match(capabilityReport, /visual_context\.v1/);
assert.match(capabilityReport, /Presence\/SSE\/CAS/);
assert.match(capabilityReport, /Figma\/画布\/直接可视化编辑/);
assert.match(capabilityReport, /适配器完成，待验收/);
assert.doesNotMatch(capabilityReport, /视觉输入仍是后续产品缺口/);

const bilingualDocumentPairs = [
  ['docs/DEVELOPER_GUIDE.md', 'docs/DEVELOPER_GUIDE.en.md'],
  ['docs/ARCHITECTURE.md', 'docs/ARCHITECTURE.en.md'],
  ['docs/PRODUCT.md', 'docs/PRODUCT.en.md'],
  ['docs/engineering/YES.md', 'docs/engineering/YES.en.md'],
  ['docs/engineering/PRINCIPLES.md', 'docs/engineering/PRINCIPLES.en.md'],
  ['docs/engineering/DEVELOPMENT_WORKFLOW.md', 'docs/engineering/DEVELOPMENT_WORKFLOW.en.md'],
  ['docs/engineering/DATABASE_LIFECYCLE.md', 'docs/engineering/DATABASE_LIFECYCLE.en.md'],
  ['docs/roadmap/ROADMAP.md', 'docs/roadmap/ROADMAP.en.md'],
  ['docs/CHANGELOG.md', 'docs/CHANGELOG.en.md'],
];
for (const [chinesePath, englishPath] of bilingualDocumentPairs) {
  const chinese = read(chinesePath);
  const english = read(englishPath);
  assert.ok(
    chinese.includes(path.basename(englishPath)),
    `${chinesePath} must link to ${englishPath}`,
  );
  assert.ok(
    english.includes(path.basename(chinesePath)),
    `${englishPath} must link to ${chinesePath}`,
  );
  assert.match(
    english,
    /version is authoritative/,
    `${englishPath} must identify the authoritative Chinese version`,
  );
  assert.ok(readme.includes(`(${chinesePath})`), `README.md must link to ${chinesePath}`);
  assert.ok(!readme.includes(`(${englishPath})`), `README.md must not link to ${englishPath}`);
  assert.ok(
    readmeEnglish.includes(`(${englishPath})`),
    `README.en.md must link to ${englishPath}`,
  );
  assert.ok(
    !readmeEnglish.includes(`(${chinesePath})`),
    `README.en.md must not link to ${chinesePath}`,
  );
}

for (const invalidWorkflowPath of [
  '.github/workflows/CODEOWNERS',
  '.github/workflows/PULL_REQUEST_TEMPLATE.md',
  '.github/workflows/ISSUE_TEMPLATE',
  '.github/workflows/workflows',
]) {
  assert.equal(
    fs.existsSync(path.join(rootDir, invalidWorkflowPath)),
    false,
    `${invalidWorkflowPath} must not exist; repository metadata belongs directly under .github`,
  );
}

for (const relativePath of [
  'README.md',
  'README.en.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'CODE_OF_CONDUCT.zh-CN.md',
  '.github/ISSUE_TEMPLATE/config.yml',
  'docs/DEVELOPER_GUIDE.md',
  ...bilingualDocumentPairs.map(([, englishPath]) => englishPath),
]) {
  assert.doesNotMatch(
    read(relativePath),
    /github\.com\/yistack\/yistack/i,
    `${relativePath} must not reference the retired repository path`,
  );
}

for (const relativePath of [
  'README.md',
  'README.en.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/PRODUCT.md',
  'docs/engineering/YES.md',
  'docs/roadmap/ROADMAP.md',
  ...bilingualDocumentPairs.map(([, englishPath]) => englishPath),
]) {
  assert.doesNotMatch(
    read(relativePath),
    /docs\/internal\//,
    `${relativePath} must not link to private development documents`,
  );
}

const workflow = read('.github/workflows/ci.yml');
assert.match(workflow, /^  pull_request:\s*$/m);
assert.match(workflow, /^  workflow_dispatch:\s*$/m);
assert.doesNotMatch(
  workflow,
  /^  push:\s*$/m,
  'CI must not rerun the complete required gate after a PR is merged',
);
for (const command of [
  'bash scripts/verify-repository-integrity.sh',
  'pnpm install --frozen-lockfile',
  'pnpm audit --audit-level high',
  'pnpm exec playwright install --with-deps chromium',
  'pnpm lint',
  'pnpm build',
  'pnpm yes:validate',
  'bash scripts/verify-clean-checkout.sh',
]) {
  assert.ok(workflow.includes(command), `CI must run: ${command}`);
}
assert.match(workflow, /^\s+change_scope:\s*$/m);
assert.match(workflow, /docs_only:\s*\$\{\{\s*steps\.classify\.outputs\.docs_only\s*\}\}/);
assert.match(workflow, /git diff --name-only --no-renames "\$BASE_SHA" "\$HEAD_SHA"/);
assert.match(workflow, /\*\.md\|docs\/\*/);
assert.match(
  workflow,
  /name: Documentation contract[\s\S]*needs\.change_scope\.outputs\.docs_only == 'true'[\s\S]*node scripts\/validate-contributor-alpha\.mjs/,
);
assert.match(
  workflow,
  /name: Install dependencies[\s\S]*needs\.change_scope\.outputs\.docs_only != 'true'[\s\S]*pnpm install --frozen-lockfile/,
);
assert.match(
  workflow,
  /name: Verify clean checkout[\s\S]*needs\.change_scope\.outputs\.docs_only != 'true'[\s\S]*bash scripts\/verify-clean-checkout\.sh/,
);
for (const duplicateStep of [
  'name: Go tests',
  'name: Canonical eval smoke subset',
  'name: Contributor Alpha contract',
]) {
  assert.ok(
    !workflow.includes(duplicateStep),
    `CI must delegate the duplicate step to the YES engineering gate: ${duplicateStep}`,
  );
}

const yesValidation = read('scripts/validate-yes.sh');
for (const delegatedCommand of [
  'node "$ROOT_DIR/scripts/validate-generation-benchmark-model.mjs"',
  'node "$ROOT_DIR/scripts/validate-contributor-alpha.mjs"',
  'go test ./... -count=1',
]) {
  assert.ok(
    yesValidation.includes(delegatedCommand),
    `YES engineering gate must run: ${delegatedCommand}`,
  );
}
assert.match(
  workflow,
  /name: Set up Go[\s\S]*go-version:\s+1\.26\.6[\s\S]*cache-dependency-path:\s+backend\/go\.sum[\s\S]*name: Install Gitleaks[\s\S]*go install github\.com\/zricethezav\/gitleaks\/v8@v8\.30\.1/,
  'CI must use the Go 1.26.6 project baseline to build Gitleaks and YiStack',
);

for (const action of [
  'actions/checkout@v6',
  'pnpm/action-setup@v6',
  'actions/setup-node@v6',
  'actions/setup-go@v7',
]) {
  assert.ok(workflow.includes(action), `CI must use: ${action}`);
}

const codeqlWorkflow = read('.github/workflows/codeql.yml');
assert.match(codeqlWorkflow, /^  pull_request:\s*$/m);
assert.match(codeqlWorkflow, /^  schedule:\s*$/m);
assert.match(codeqlWorkflow, /^  workflow_dispatch:\s*$/m);
assert.doesNotMatch(
  codeqlWorkflow,
  /^  push:\s*$/m,
  'CodeQL must not repeat the complete PR analysis after every merge',
);
for (const language of ['javascript-typescript', 'go', 'actions']) {
  assert.ok(codeqlWorkflow.includes(`language: ${language}`), `CodeQL must analyze: ${language}`);
}
for (const action of [
  'actions/checkout@v6',
  'actions/setup-go@v7',
  'github/codeql-action/init@v4',
  'github/codeql-action/autobuild@v4',
  'github/codeql-action/analyze@v4',
]) {
  assert.ok(codeqlWorkflow.includes(action), `CodeQL must use: ${action}`);
}
assert.match(codeqlWorkflow, /config-file:\s+\.\/\.github\/codeql\/codeql-config\.yml/);
assert.match(codeqlWorkflow, /language:\s+javascript-typescript\s+build-mode:\s+none/);
assert.match(codeqlWorkflow, /language:\s+go\s+build-mode:\s+autobuild/);

const codeqlConfig = read('.github/codeql/codeql-config.yml');
for (const excludedModel of [
  'scripts/validate-workspace-resource-consistency-model.ts',
  'scripts/validate-workspace-message-restore-model.ts',
]) {
  assert.ok(
    codeqlConfig.includes(`- ${excludedModel}`),
    `CodeQL must exclude the non-runtime validation model: ${excludedModel}`,
  );
}
assert.doesNotMatch(
  codeqlConfig,
  /^\s*-\s+(src|scripts|backend)\/\*\*/m,
  'CodeQL exclusions must not hide a complete source tree',
);

const cleanCheckoutScript = read('scripts/verify-clean-checkout.sh');
assert.ok(
  cleanCheckoutScript.includes('bash "$ROOT_DIR/scripts/verify-repository-integrity.sh"'),
  'clean checkout must reject unresolved merge conflicts before installing dependencies',
);

const liveEvalWorkflow = read('.github/workflows/canonical-eval.yml');
assert.ok(liveEvalWorkflow.includes('pnpm eval:smoke'));
assert.ok(liveEvalWorkflow.includes('YISTACK_EVAL_TOKEN'));
for (const action of [
  'actions/checkout@v6',
  'pnpm/action-setup@v6',
  'actions/setup-node@v6',
]) {
  assert.ok(liveEvalWorkflow.includes(action), `canonical eval must use: ${action}`);
}

const workspace = read('pnpm-workspace.yaml');
assert.match(workspace, /minimumReleaseAge:\s+1440/);

const lockfile = read('pnpm-lock.yaml');
assert.doesNotMatch(lockfile, /^(<<<<<<< |>>>>>>> )/m);

const releaseConfig = read('.github/release.yml');
assert.match(releaseConfig, /changelog:/);
assert.match(releaseConfig, /Security/);
assert.match(releaseConfig, /Dependencies/);

const supabaseBaseline = read('scripts/verify-supabase-baseline.sh');
assert.match(
  supabaseBaseline,
  /psql -At -v ON_ERROR_STOP=1[\s\S]*-d yistack[\s\S]*-c "SELECT 1;"/,
);
assert.doesNotMatch(
  supabaseBaseline,
  /pg_isready[\s\S]*-d yistack/,
  'database readiness must execute a query instead of accepting an early pg_isready result',
);

const eslintConfig = read('eslint.config.mjs');
for (const ignoredPath of [
  'runtime/projects/**',
  'runtime/generation-evidence/**',
  'runtime/evals/**',
  'evals/**/node_modules/**',
]) {
  assert.ok(eslintConfig.includes(ignoredPath), `ESLint must ignore ${ignoredPath}`);
}

const initSQL = read('backend/init.sql');
const forwardBaseline = read('backend/migrations/000000000000_contributor_alpha.sql');
const rollbackBaseline = read('backend/migrations/rollback/000000000000_contributor_alpha.sql');
for (const source of [initSQL, forwardBaseline]) {
  assert.ok(source.includes('public.schema_migrations'));
  assert.ok(source.includes('000000000000_contributor_alpha'));
}
assert.ok(rollbackBaseline.includes('cannot remove baseline while later migrations are recorded'));
assert.ok(rollbackBaseline.includes('DELETE FROM public.schema_migrations'));

const envExample = read('.env.example');
for (const key of [
  'SUPABASE_URL=',
  'SUPABASE_ANON_KEY=',
  'SUPABASE_SERVICE_ROLE_KEY=',
  'GITHUB_OAUTH_CLIENT_SECRET=',
  'JWT_SECRET=',
  'VERCEL_ACCESS_TOKEN=',
]) {
  assert.ok(envExample.includes(key), `.env.example must document ${key}`);
}

console.log(`[R7] v1.0.0 public release repository contract valid (${requiredFiles.length} required files).`);
