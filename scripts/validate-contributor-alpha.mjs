#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
  '.github/workflows/release.yml',
  'deploy/bin/yistack-database-backup',
  'deploy/bin/yistack-uninstall',
  'deploy/bin/yistack-ephemeral-maintenance',
  'deploy/bin/yistack-frontend',
  'deploy/bin/yistack-postgres',
  'deploy/bin/yistack-service-user-exec',
  'deploy/bin/yistackctl',
  'deploy/config/postgres.env.example',
  'deploy/config/yistack-ephemeral-maintenance.env.example',
  'deploy/config/yistack.env.example',
  'deploy/database/postgres-auth-compat.sql',
  'deploy/install.sh',
  'deploy/upgrade.sh',
  'deploy/systemd/yistack-backend.service',
  'deploy/systemd/yistack-browser-worker.service',
  'deploy/systemd/yistack-ephemeral-cleanup.service',
  'deploy/systemd/yistack-ephemeral-cleanup.timer',
  'deploy/systemd/yistack-ephemeral-reset.service',
  'deploy/systemd/yistack-ephemeral-reset.timer',
  'deploy/systemd/yistack-frontend.service',
  'deploy/systemd/yistack-postgres.service',
  'deploy/systemd/yistack.target',
  'scripts/build-release-package.sh',
  'scripts/capture-readme-screenshots.mjs',
  'scripts/validate-release-package.sh',
  'scripts/validate-release-control.sh',
  'scripts/validate-release-postgres-runtime.sh',
  'scripts/validate-release-upgrade.sh',
  'scripts/validate-release-uninstall.sh',
  'scripts/validate-service-user-cwd.sh',
  'scripts/validate-database-migrations.sh',
  'scripts/validate-ephemeral-maintenance.sh',
  '.github/workflows/codeql.yml',
  '.github/codeql/codeql-config.yml',
  '.github/workflows/canonical-eval.yml',
  'docs/CHANGELOG.md',
  'docs/CHANGELOG.en.md',
  'docs/assets/screenshots/mobile-preview.png',
  'docs/assets/screenshots/terminal-session.png',
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
  'backend/migrations/202609070001_migration_integrity.sql',
  'backend/migrations/manifest.json',
  'backend/migrations/rollback/202609070001_migration_integrity.sql',
  'backend/internal/migration/runner.go',
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
assert.equal(packageJSON.version, '1.1.6');
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
  'build:release',
  'checkout:verify',
  'db:verify',
  'docs:screenshots',
  'validate:database:migrations',
  'validate:release:ephemeral',
  'eval:smoke:ci',
  'validate:release',
  'validate:release:postgres',
  'validate:release:upgrade',
  'validate:release:uninstall',
  'validate:release:service-user-cwd',
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
assert.match(readme, /当前版本：\*\*v1\.1\.6\*\*/);
assert.match(readmeEnglish, /Current release: \*\*v1\.1\.6\*\*/);
assert.match(changelog, /## \[1\.1\.5\] - 2026-09-10/);
assert.match(changelogEnglish, /## \[1\.1\.5\] - 2026-09-10/);
assert.match(changelog, /## \[1\.1\.4\] - 2026-09-09/);
assert.match(changelogEnglish, /## \[1\.1\.4\] - 2026-09-09/);
assert.match(changelog, /## \[1\.1\.3\] - 2026-09-09/);
assert.match(changelogEnglish, /## \[1\.1\.3\] - 2026-09-09/);
assert.match(changelog, /## \[1\.1\.2\] - 2026-09-09/);
assert.match(changelogEnglish, /## \[1\.1\.2\] - 2026-09-09/);
assert.match(changelog, /## \[1\.1\.1\] - 2026-09-09/);
assert.match(changelogEnglish, /## \[1\.1\.1\] - 2026-09-09/);
assert.match(changelog, /## \[1\.1\.0\] - 2026-09-07/);
assert.match(changelogEnglish, /## \[1\.1\.0\] - 2026-09-07/);
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
assert.doesNotMatch(readme, /sudo \.\/upgrade\.sh/);
assert.match(readme, /sudo yistackctl upgrade \.\/yistack-vX\.Y\.Z-linux-amd64\.tar\.gz/);
assert.match(readme, /\/var\/lib\/yistack\/database-backups/);
assert.doesNotMatch(readmeEnglish, /sudo \.\/upgrade\.sh/);
assert.match(readmeEnglish, /sudo yistackctl upgrade \.\/yistack-vX\.Y\.Z-linux-amd64\.tar\.gz/);
assert.match(readmeEnglish, /\/var\/lib\/yistack\/database-backups/);
assert.doesNotMatch(product, /`upgrade\.sh`/);
assert.doesNotMatch(productEnglish, /`upgrade\.sh`/);
assert.match(product, /已实现，待云端验收/);
assert.doesNotMatch(product, /合同已实现/);
assert.match(productEnglish, /Implemented; live acceptance pending/);
assert.doesNotMatch(productEnglish, /Contract implemented/);
assert.match(readme, /Web 使用界面可通过现代浏览器跨平台访问/);
assert.match(readme, /官方预编译服务端部署包提供 Linux `amd64` 和 `arm64` 构建/);
assert.match(readme, /无痕体验模式（每日自动还原）/);
assert.doesNotMatch(readme, /面向公众开放试用时/);
assert.match(readme, /docs\/assets\/screenshots\/terminal-session\.png/);
assert.match(readme, /docs\/assets\/screenshots\/mobile-preview\.png/);
assert.match(readmeEnglish, /web interface is accessible from modern browsers across platforms/);
assert.match(readmeEnglish, /official prebuilt server packages provide Linux `amd64` and `arm64` builds/);
assert.match(readmeEnglish, /Ephemeral Experience Mode \(Daily Reset\)/);
assert.doesNotMatch(readmeEnglish, /A public trial instance/);
assert.match(readmeEnglish, /docs\/assets\/screenshots\/terminal-session\.png/);
assert.match(readmeEnglish, /docs\/assets\/screenshots\/mobile-preview\.png/);

const capabilityReport = read(
  'docs/yistack_open_source_progress_and_competitor_matrix.html',
);
assert.match(capabilityReport, /VIS-001 与 COLLAB-001 差异化闭环已完成/);
assert.match(capabilityReport, /visual_context\.v1/);
assert.match(capabilityReport, /Presence\/SSE\/CAS/);
assert.match(capabilityReport, /Figma 与 Canvas 深度集成/);
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
  'pnpm audit --audit-level high --ignore-registry-errors',
  'pnpm exec playwright install --with-deps chromium',
  'pnpm validate:database:migrations',
  'pnpm lint',
  'scripts/validate-release-upgrade.sh',
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
  /repository_contract:[\s\S]*name: Repository contract[\s\S]*bash scripts\/verify-repository-integrity\.sh[\s\S]*node scripts\/validate-contributor-alpha\.mjs/,
);
assert.match(workflow, /name: Quality gate[\s\S]*needs: \[change_scope, repository_contract\]/);
assert.equal(
  (workflow.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length,
  2,
  'Both required downstream checks must run even when a prerequisite fails.',
);
assert.equal(
  (workflow.match(/name: Enforce prerequisite jobs/g) ?? []).length,
  2,
  'Both required downstream checks must propagate prerequisite failures.',
);
for (const result of ['needs.change_scope.result', 'needs.repository_contract.result']) {
  assert.ok(workflow.includes(result), `CI must enforce prerequisite result: ${result}`);
}
assert.match(
  workflow,
  /name: Deployment package acceptance[\s\S]*pnpm validate:database:migrations[\s\S]*pnpm build:release[\s\S]*scripts\/validate-release-package\.sh[\s\S]*scripts\/validate-service-user-cwd\.sh[\s\S]*scripts\/validate-release-control\.sh[\s\S]*scripts\/validate-release-postgres-runtime\.sh[\s\S]*scripts\/validate-release-upgrade\.sh[\s\S]*scripts\/validate-release-uninstall\.sh/,
);
assert.match(
  workflow,
  /name: Install dependencies[\s\S]*needs\.change_scope\.outputs\.docs_only != 'true'[\s\S]*pnpm install --frozen-lockfile/,
);
assert.match(
  workflow,
  /name: Dependency audit[\s\S]*pnpm audit --audit-level high --ignore-registry-errors/,
  'dependency audit must fail on high-severity advisories without failing on registry transport errors',
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

const releaseWorkflow = read('.github/workflows/release.yml');
assert.match(releaseWorkflow, /^  push:[\s\S]*tags:[\s\S]*"v\*\.\*\.\*"/m);
assert.match(
  releaseWorkflow,
  /name: Verify release metadata[\s\S]*package\.json[\s\S]*docs\/CHANGELOG\.md[\s\S]*docs\/CHANGELOG\.en\.md/,
  'Release tags must match package and changelog version metadata',
);
assert.match(releaseWorkflow, /runner: ubuntu-24\.04-arm/);
assert.match(releaseWorkflow, /pnpm build:release/);
assert.match(releaseWorkflow, /scripts\/validate-release-package\.sh/);
assert.match(releaseWorkflow, /scripts\/validate-release-postgres-runtime\.sh/);
assert.match(releaseWorkflow, /format: spdx-json/);
assert.match(releaseWorkflow, /scripts\/validate-release-upgrade\.sh/);
assert.match(releaseWorkflow, /scripts\/validate-release-uninstall\.sh/);
assert.match(releaseWorkflow, /scripts\/validate-service-user-cwd\.sh/);
assert.match(releaseWorkflow, /scripts\/validate-release-control\.sh/);
assert.match(releaseWorkflow, /actions\/attest-build-provenance@v3/);
assert.match(releaseWorkflow, /gh release (create|upload)/);

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

const postgresLauncher = read('deploy/bin/yistack-postgres');
assert.doesNotMatch(
  postgresLauncher,
  /< <\(podman logs/,
  'database readiness must not block on Podman log streaming',
);
assert.match(
  postgresLauncher,
  /psql --quiet -At -v ON_ERROR_STOP=1[\s\S]*-h 127\.0\.0\.1[\s\S]*-c 'SELECT 1;'/,
  'PostgreSQL readiness must use TCP so the temporary Unix-socket server cannot satisfy it',
);

const postgresRuntimeValidation = read('scripts/validate-release-postgres-runtime.sh');
assert.match(
  postgresRuntimeValidation,
  /UPDATE public\.system_config SET value = 'false' WHERE key = 'container\.enabled'/,
  'release validation must disable the database-backed application container runtime',
);
assert.match(
  postgresRuntimeValidation,
  /CONTAINER_ENABLED=false[\s\S]*CONTAINER_PREVIEW_PORT=0/,
  'release validation must isolate application container and preview listeners',
);
assert.match(
  postgresRuntimeValidation,
  /print_backend_log\(\)[\s\S]*tail -n 220 "\$backend_log"/,
  'release validation must retain the final backend startup error',
);
assert.match(
  postgresRuntimeValidation,
  /snapshot[\s\S]*INSERT INTO public\.users[\s\S]*run_ephemeral_maintenance reset[\s\S]*SELECT count\(\*\) FROM public\.users[\s\S]*SELECT count\(\*\) FROM public\.projects/,
  'release validation must prove that the clean baseline removes user and project data',
);
assert.match(
  postgresRuntimeValidation,
  /podman image inspect[\s\S]*postgres_image_id_after[\s\S]*postgres_image_id_before/,
  'release validation must prove that reusable PostgreSQL images survive a reset',
);

const ephemeralMaintenance = read('deploy/bin/yistack-ephemeral-maintenance');
const ephemeralMaintenanceConfig = read('deploy/config/yistack-ephemeral-maintenance.env.example');
assert.match(
  postgresRuntimeValidation,
  /yistack-database-backup[\s\S]*create release-runtime[\s\S]*verify release-runtime[\s\S]*restore release-runtime/,
  'release validation must prove that upgrade backups can be created, verified, and restored',
);
assert.match(
  postgresRuntimeValidation,
  /corrupt\.dump[\s\S]*Database backup verification accepted a corrupted archive/,
  'release validation must reject corrupted database backups',
);
assert.match(
  ephemeralMaintenance,
  /schema=ephemeral-experience-baseline\.v1[\s\S]*user_data_policy=empty/,
  'ephemeral experience baselines must declare the empty user-data policy',
);
assert.match(
  ephemeralMaintenance,
  /list_user_data_rows\(\)[\s\S]*public\.users[\s\S]*public\.projects[\s\S]*public\.project_collaboration_events/,
  'ephemeral experience snapshots must inspect all user and project data domains',
);
assert.match(
  ephemeralMaintenance,
  /reset_to_baseline\(\)[\s\S]*remove_all_project_resources[\s\S]*restore_database[\s\S]*restore_workspaces[\s\S]*clear_directory_contents "\$LOG_DIR"/,
  'daily restoration must clear project resources, user state, caches, evidence, and managed logs',
);
assert.match(
  ephemeralMaintenance,
  /validate_timer_setting\(\)[\s\S]*systemd-analyze/,
  'ephemeral experience timer values must be validated by systemd',
);
assert.match(
  ephemeralMaintenance,
  /apply_timer_schedule\(\)[\s\S]*validate_timer_setting[\s\S]*write_timer_override[\s\S]*systemctl daemon-reload/,
  'ephemeral experience timer schedules must be validated and applied through systemd drop-ins',
);
assert.doesNotMatch(
  ephemeralMaintenance,
  /podman_cmd (?:image rm|rmi)|podman system prune/,
  'ephemeral experience reset must retain reusable Podman images',
);
for (const scheduleKey of [
  'EPHEMERAL_RESET_ON_CALENDAR',
  'EPHEMERAL_RESET_RANDOMIZED_DELAY_SEC',
  'EPHEMERAL_CLEANUP_ON_CALENDAR',
  'EPHEMERAL_CLEANUP_RANDOMIZED_DELAY_SEC',
]) {
  assert.ok(
    ephemeralMaintenanceConfig.includes(scheduleKey),
    `ephemeral experience configuration must expose ${scheduleKey}`,
  );
}

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
assert.match(
  workspace,
  /minimumReleaseAgeExclude:[\s\S]*js-yaml@4\.3\.2[\s\S]*overrides:[\s\S]*js-yaml:\s+4\.3\.2/,
  'the patched js-yaml security override must bypass only the dependency maturity delay',
);

const lockfile = read('pnpm-lock.yaml');
assert.match(lockfile, /js-yaml@4\.3\.2:/, 'the lockfile must resolve patched js-yaml 4.3.2');
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

const migrationManifest = JSON.parse(read('backend/migrations/manifest.json'));
assert.equal(migrationManifest.schema, 'yistack.database-migrations.v1');
assert.equal(migrationManifest.baseline_version, '000000000000_contributor_alpha');
assert.equal(migrationManifest.latest_version, '202609070001_migration_integrity');
assert.deepEqual(
  migrationManifest.migrations.map((entry) => entry.version),
  [
    '000000000000_contributor_alpha',
    '202609070001_migration_integrity',
  ],
);
for (const entry of migrationManifest.migrations) {
  const forwardSource = fs.readFileSync(path.join(rootDir, 'backend/migrations', entry.file));
  assert.equal(
    crypto.createHash('sha256').update(forwardSource).digest('hex'),
    entry.sha256,
    `forward migration checksum mismatch: ${entry.version}`,
  );
  if (entry.reversible) {
    const rollbackSource = fs.readFileSync(
      path.join(rootDir, 'backend/migrations', entry.rollback_file),
    );
    assert.equal(
      crypto.createHash('sha256').update(rollbackSource).digest('hex'),
      entry.rollback_sha256,
      `rollback migration checksum mismatch: ${entry.version}`,
    );
  } else {
    assert.ok(entry.irreversible_recovery, `missing recovery steps: ${entry.version}`);
  }
}

const migrationRunner = read('backend/internal/migration/runner.go');
const databaseCommand = read('backend/cmd/server/database_command.go');
const databaseBackup = read('deploy/bin/yistack-database-backup');
const serverMain = read('backend/cmd/server/main.go');
const releaseBuilder = read('scripts/build-release-package.sh');
const releaseValidation = read('scripts/validate-release-package.sh');
const yistackctl = read('deploy/bin/yistackctl');
const migrationValidation = read('scripts/validate-database-migrations.sh');
assert.match(migrationRunner, /pg_try_advisory_lock[\s\S]*pg_advisory_unlock/, 'migration writes must hold a PostgreSQL advisory lock');
assert.match(releaseValidation, /bin\/yistack-database-backup[\s\S]*bin\/yistack-uninstall[\s\S]*bin\/yistack-service-user-exec[\s\S]*upgrade\.sh/, 'Release validation must require the lifecycle entrypoints');
const upgradeValidation = read('scripts/validate-release-upgrade.sh');
const uninstallValidation = read('scripts/validate-release-uninstall.sh');
const serviceUserCwdValidation = read('scripts/validate-service-user-cwd.sh');
const controlValidation = read('scripts/validate-release-control.sh');
const upgradeScript = read('deploy/upgrade.sh');
const uninstallScript = read('deploy/bin/yistack-uninstall');
const serviceUserExec = read('deploy/bin/yistack-service-user-exec');
const installer = read('deploy/install.sh');
const sourceInstaller = read('scripts/install.sh');
const backendSystemdUnit = read('deploy/systemd/yistack-backend.service');
const ephemeralCleanupSystemdUnit = read('deploy/systemd/yistack-ephemeral-cleanup.service');
const ephemeralResetSystemdUnit = read('deploy/systemd/yistack-ephemeral-reset.service');
const postgresSystemdUnit = read('deploy/systemd/yistack-postgres.service');
assert.match(migrationRunner, /checksum_sha256[\s\S]*database checksum mismatch/, 'migration history must verify recorded checksums');
assert.match(databaseBackup, /SCHEMA - public[\s\S]*--single-transaction[\s\S]*--use-list/, 'database recovery must use a filtered custom-archive TOC in one transaction');
assert.doesNotMatch(databaseBackup, /DROP SCHEMA[^\n]*public/i, 'database recovery must not cascade-drop the public schema');
assert.doesNotMatch(
  yistackctl,
  /\.sha256|checksum_line|actual_checksum/,
  'archive upgrades must not require an unauthenticated checksum sidecar',
);
assert.match(upgradeScript, /file inventory does not match MANIFEST\.sha256/, 'upgrades must reject incomplete Release manifests');
assert.match(databaseCommand, /status\|plan\|migrate\|verify\|rollback/, 'database CLI must expose lifecycle commands');
assert.match(databaseCommand, /case "supabase"[\s\S]*buildSupabaseDirectDatabaseConfig/, 'Supabase migrations must use direct PostgreSQL access');
assert.match(serverMain, /if !autoMigrate \{[\s\S]*runner\.VerifyCurrent/, 'production startup must verify the latest manifest version');
assert.match(releaseBuilder, /cp -a "\$ROOT_DIR\/backend\/migrations"/, 'Release packages must include migrations');
assert.match(releaseBuilder, /docs\/assets\/screenshots/, 'Release packages must include README screenshots');
assert.match(releaseValidation, /docs\/assets\/screenshots\/mobile-preview\.png[\s\S]*docs\/assets\/screenshots\/workspace-overview\.png/, 'Release validation must require README screenshots');
assert.match(yistackctl, /upgrade\)[\s\S]*run_release_upgrade/, 'yistackctl must dispatch one-command upgrades');
assert.match(yistackctl, /run_uninstall\(\)[\s\S]*mktemp[\s\S]*yistack-uninstall[\s\S]*uninstall\)[\s\S]*run_uninstall/, 'yistackctl must dispatch uninstalls through a staged helper');
assert.match(serviceUserExec, /cd "\$DATA_DIR"[\s\S]*exec "\$RUNUSER_BIN" -u "\$SERVICE_USER"[\s\S]*DBUS_SESSION_BUS_ADDRESS="unix:path=\$runtime_dir\/bus"/, 'service-user execution must set a safe cwd and the service-user D-Bus address before runuser');
for (const [name, script] of [
  ['installer', installer],
  ['yistackctl', yistackctl],
  ['upgrade', upgradeScript],
  ['uninstall', uninstallScript],
  ['ephemeral maintenance', read('deploy/bin/yistack-ephemeral-maintenance')],
  ['source installer', sourceInstaller],
]) {
  assert.doesNotMatch(script, /runuser -u/, `${name} must delegate user switching to yistack-service-user-exec`);
}
assert.match(installer, /run_as_service_user systemctl --user[\s\S]*run_as_service_user env[\s\S]*PLAYWRIGHT_BROWSERS_PATH[\s\S]*run_as_service_user "\$RELEASE_DIR\/bin\/yistack-postgres" init/, 'installer service-user commands must use the cwd-safe executor');
assert.match(sourceInstaller, /run_as_service_user mkdir -p[\s\S]*run_as_service_user bash -c[\s\S]*run_as_service_user systemctl --user[\s\S]*run_as_service_user env/, 'source installer service-user commands must use the cwd-safe executor');
assert.match(serviceUserCwdValidation, /chmod 0700 "\$root_only_dir"[\s\S]*EXPECTED_SERVICE_CWD[\s\S]*bus=unix:path=\/run\/user\/\$service_uid\/bus/, 'Release acceptance must verify cwd and D-Bus isolation from a root-only caller directory');
assert.match(controlValidation, /MOCK_HEALTH_FAILURES=2[\s\S]*Health check: passed[\s\S]*runtime images[\s\S]*MOCK_HEALTH_FAILURES=3/, 'control acceptance must cover health retries, runtime inspection, and failed restart reporting');
assert.match(
  yistackctl,
  /print_bash_completion\(\)[\s\S]*completion\)[\s\S]*print_bash_completion/,
  'yistackctl must expose Bash completion',
);
assert.match(
  yistackctl,
  /ephemeral\)[\s\S]*yistack-ephemeral-maintenance/,
  'yistackctl must expose the ephemeral experience command',
);
assert.doesNotMatch(
  yistackctl,
  /(?:^|\s)demo\)/m,
  'yistackctl must not retain the deprecated demo command',
);
assert.match(upgradeScript, /flock -n[\s\S]*run_backup_command create[\s\S]*run_database_command "\$INSTALL_ROOT\/current" migrate[\s\S]*run_database_command "\$INSTALL_ROOT\/current" verify/, 'one-command upgrades must lock, back up, migrate, and verify');
assert.match(upgradeScript, /recover_failed_upgrade[\s\S]*run_backup_command restore[\s\S]*restore_previous_release_files/, 'failed upgrades must restore the database and previous Release');
assert.match(
  upgradeScript,
  /stage_backup_helper\(\)[\s\S]*install -m 0700 -o "\$SERVICE_USER"[\s\S]*"\$PACKAGE_ROOT\/bin\/yistack-database-backup" "\$backup_helper_path"/,
  'upgrades must stage the backup helper outside an inaccessible Release extraction parent',
);
assert.match(
  upgradeScript,
  /run_backup_command\(\)[\s\S]*"\$backup_helper_path" "\$command" "\$backup_name"/,
  'database backup and recovery must execute the staged helper',
);
assert.match(upgradeValidation, /Successful upgrade acceptance[\s\S]*MOCK_NEW_HEALTH_FAIL=true[\s\S]*Previous Release v1\.0\.0 restored/, 'Release acceptance must cover successful upgrade and failed-health recovery');
assert.match(upgradeScript, /trap - EXIT[\s\S]*cleanup_historical_releases/, 'historical Releases must be removed only after rollback is disabled');
assert.match(upgradeValidation, /success_root[\s\S]*releases\/v1\.0\.0[\s\S]*failure_root[\s\S]*releases\/v1\.0\.0/, 'upgrade acceptance must remove old Releases on success and retain them on failure');
assert.match(uninstallScript, /uninstall \[--purge\][\s\S]*External databases are[\s\S]*never deleted/, 'uninstall must expose preserve and explicit purge modes');
assert.match(uninstallScript, /label=yistack\.project_id[\s\S]*POSTGRES_CONTAINER_NAME[\s\S]*validate_managed_directory/, 'purge must target only managed runtime resources and guarded directories');
assert.match(uninstallValidation, /preserve_root[\s\S]*purge_root[\s\S]*cleanup_failure_root[\s\S]*refusing unsafe INSTALL_ROOT/, 'uninstall acceptance must cover preservation, purge, cleanup failure, and unsafe path rejection');
assert.match(releaseValidation, /database\/migrations\/manifest\.json[\s\S]*rollback\/202609070001_migration_integrity\.sql/, 'Release validation must require the complete migration set');
assert.match(yistackctl, /database\)[\s\S]*migrate \| rollback\)[\s\S]*systemctl is-active --quiet yistack\.target[\s\S]*systemctl is-active --quiet yistack-backend\.service[\s\S]*yistack-server" database/, 'database schema writes must require stopped application services');
assert.match(migrationValidation, /advisory lock contention[\s\S]*tampered and unknown histories[\s\S]*Rolling back one version/, 'PostgreSQL acceptance must cover locking, integrity boundaries, and rollback');
assert.match(installer, /flock -n[\s\S]*systemctl is-active --quiet yistack\.target[\s\S]*Stop YiStack before installing or upgrading/, 'Release installation must lock and reject a running application stack');
assert.match(installer, /Starting YiStack services and waiting for health checks[\s\S]*YISTACK_HEALTH_ATTEMPTS[\s\S]*yistackctl" restart[\s\S]*Health check: passed/, 'Release installation with --start must wait for health before reporting success');
assert.match(yistackctl, /runtime\)[\s\S]*podman info[\s\S]*podman images[\s\S]*podman ps --all/, 'yistackctl must expose the service-user Podman runtime');
assert.match(postgresSystemdUnit, /WorkingDirectory=\/var\/lib\/yistack[\s\S]*yistack-service-user-exec[\s\S]*yistack-postgres start/, 'PostgreSQL systemd execution must use the normalized service-user environment');
assert.match(
  installer,
  /--postgres-image IMAGE[\s\S]*POSTGRES_IMAGE_OVERRIDE[\s\S]*set_env_value "\$CONFIG_DIR\/postgres\.env"[\s\S]*POSTGRES_IMAGE/,
  'Release installation must support a PostgreSQL mirror before first startup',
);
for (const unit of [backendSystemdUnit, postgresSystemdUnit]) {
  assert.doesNotMatch(
    unit,
    /XDG_RUNTIME_DIR=\/run\/user\/%U/,
    'system units must not resolve rootless Podman runtime paths through the system manager UID',
  );
}
for (const unit of [backendSystemdUnit, ephemeralCleanupSystemdUnit, ephemeralResetSystemdUnit]) {
  assert.match(
    unit,
    /ProtectHome=read-only/,
    'services that use rootless Podman must retain access to its socket under /run/user',
  );
}
assert.match(
  readme,
  /Docker Hub 不可达或受限网络[\s\S]*--postgres-image[\s\S]*registries\.conf\.d/,
  'README must document trusted PostgreSQL mirrors for restricted networks',
);
assert.match(
  readmeEnglish,
  /Restricted or Unavailable Docker Hub Access[\s\S]*--postgres-image[\s\S]*registries\.conf\.d/,
  'English README must document trusted PostgreSQL mirrors for restricted networks',
);
assert.match(
  readme,
  /gh attestation verify[\s\S]*--repo NHPT\/YiStack[\s\S]*不需要在同一目录[\s\S]*\.sha256/,
  'README must separate provenance verification from optional transfer checksums',
);
assert.match(
  readmeEnglish,
  /gh attestation verify[\s\S]*--repo NHPT\/YiStack[\s\S]*colocated `\.sha256` file is not required/,
  'English README must separate provenance verification from optional transfer checksums',
);
assert.match(
  readme,
  /v1\.1\.0 或 v1\.1\.1[\s\S]*tar -xzf yistack-v1\.1\.6-linux-amd64\.tar\.gz[\s\S]*sudo yistackctl upgrade \.\/yistack-v1\.1\.6-linux-amd64/,
  'README must document the sidecar-free upgrade path for older controllers',
);
assert.match(
  readmeEnglish,
  /v1\.1\.0 and v1\.1\.1[\s\S]*tar -xzf yistack-v1\.1\.6-linux-amd64\.tar\.gz[\s\S]*sudo yistackctl upgrade \.\/yistack-v1\.1\.6-linux-amd64/,
  'English README must document the sidecar-free upgrade path for older controllers',
);
assert.match(readme, /yistackctl uninstall[\s\S]*yistackctl uninstall --purge[\s\S]*外部 Supabase 或 PostgreSQL/);
assert.match(readmeEnglish, /yistackctl uninstall[\s\S]*yistackctl uninstall --purge[\s\S]*external Supabase or PostgreSQL/);

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

console.log(`[R7] v1.1.6 public release repository contract valid (${requiredFiles.length} required files).`);
