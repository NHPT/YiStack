#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    throw new Error(message);
  }
}

function assertExcludes(source, snippet, message) {
  if (source.includes(snippet)) {
    throw new Error(message);
  }
}

const gateSource = read("backend/internal/service/project_validation.go") + "\n" + read("backend/internal/service/project_validation_vite_react.go");
const commandPolicySource = read('backend/internal/service/generation_command_policy.go');
const pythonRuntimeSource = read('backend/internal/service/python_project_runtime.go');
const promptSource = read('backend/internal/prompt/generate.go');
const generationContractTestsSource = read('backend/internal/service/generation_contract_test.go');
const applySource = read('backend/internal/service/generation_apply_service.go');
const failureSource = read('backend/internal/service/generation_failure.go');
const handlerSource = read('backend/internal/handler/stream_response_writer.go');
const generationStageSource = read('backend/internal/orchestration/workspace_generation_stage.go');
const generateOrchestratorSource = read('backend/internal/orchestration/workspace_generate_orchestrator.go');
const frontendContractSource = read('src/lib/workspace/workflow-contract.ts');
const testsSource = read('backend/internal/service/project_validation_test.go');
const validationSource = read('docs/engineering/VALIDATION_LAYER.md');

for (const snippet of [
  'ProjectValidationStackStaticHTML = "static-html"',
  'ProjectValidationStackNodeNextJS = "node-nextjs"',
  'ProjectValidationStackNodeVite   = "node-vite"',
  'ProjectValidationStackGo         = "go"',
  'ProjectValidationStackPython     = "python"',
  '(hasPyproject || hasRequirements) && !hasPackageJSON && !hasGoMod',
  'check.AttemptCount = attemptCount',
  'if planned.kind == "prepare"',
  'isTransientProjectValidationPrepareFailure(err, commandResult)',
  'totalDurationMS += durationMS',
  'RunCommandArgs(ctx context.Context',
  'viteReactJSXRuntimeValidationScript',
  'buildViteReactRuntimeCheck()',
  'React is not defined at runtime',
  'package.json 未配置 %s script，记录为 skipped_with_reason',
  'multiple package manager lockfiles found',
  '[]string{"go", "mod", "tidy"}',
  '[]string{"go", "build", "./..."}',
  '[]string{"go", "test", "./..."}',
  '[]string{"go", "vet", "./..."}',
  'id: "python-environment", kind: "prepare"',
  'projectPythonExecutablePath()',
]) {
  assertIncludes(gateSource, snippet, `GEN-002 project validation contract is missing: ${snippet}`);
}

for (const command of [
  '"npm ci"',
  '"pnpm install --frozen-lockfile"',
  '"go mod download"',
  '"python3 -m pip install -r requirements.txt"',
]) {
  assertIncludes(commandPolicySource, command, `GEN-002 command allowlist is missing: ${command}`);
}
for (const command of ['"npm run', '"pnpm run', '"yarn run', '"go generate']) {
  assertExcludes(commandPolicySource, command, `GEN-002 command policy must not allow project-script execution: ${command}`);
}
assertIncludes(commandPolicySource, 'strings.ContainsAny(command', 'GEN-002 command policy must reject shell control syntax.');
assertIncludes(commandPolicySource, 'strings.Contains(command, "$(")', 'GEN-002 command policy must reject command substitution.');
assertIncludes(commandPolicySource, 'generatedCommandExecutionPlan(command string)', 'Python dependency commands must use a controlled execution plan.');
assertIncludes(pythonRuntimeSource, 'projectPythonRuntimeExecutable        = "python3.11"', 'Python runtime must enforce the declared 3.11 interpreter.');
assertIncludes(pythonRuntimeSource, 'projectPythonVirtualEnvironmentPath   = ".yistack/runtime/python-venv"', 'Python projects must use an isolated virtual environment.');
assertIncludes(pythonRuntimeSource, 'projectPythonPackageIndexURL          = "https://mirrors.aliyun.com/pypi/simple"', 'Python dependency preparation must use the verified package mirror.');
assertIncludes(promptSource, 'commands 只允许使用系统明确许可的依赖准备命令', 'The mandatory generation protocol must explain the command allowlist boundary.');
assertIncludes(generationContractTestsSource, 'TestGeneratedCommandPolicyRejectsShellAndRuntimeCommands', 'GEN-002 must test rejected shell and runtime commands.');
assertIncludes(generationContractTestsSource, '"npm run build"', 'GEN-002 must test that project scripts cannot bypass the validation gate.');

assertIncludes(applySource, 'executionPlan := generatedCommandExecutionPlan(cmd)', 'Model-recommended dependency commands must use the controlled execution plan.');
assertIncludes(applySource, 'Args:      args', 'Model-recommended dependency commands must bypass the shell through structured argv.');
assertIncludes(applySource, 'WorkDir:   "/workspace"', 'Model-recommended dependency commands must stay in /workspace.');

const commandIndex = applySource.indexOf('s.runGeneratedCommands(');
const validationIndex = applySource.indexOf('s.validateAndRepairGeneratedProject(');
const finalizeIndex = applySource.indexOf('s.finalizeGeneratedProject(');
if (commandIndex < 0 || validationIndex <= commandIndex || finalizeIndex <= validationIndex) {
  throw new Error('GEN-002 order must be generated commands -> project validation -> Preview/Git finalization.');
}

assertIncludes(failureSource, 'GenerationFailureCodeProjectValidationFailed = "project_validation_failed"', 'GEN-002 must expose project_validation_failed.');
assertIncludes(handlerSource, 'payload["project_validation"] = generationErr.ValidationResult', 'SSE errors must expose project validation evidence.');
assertIncludes(generationStageSource, 'withValidationStatus(EngineeringStatusPassed)', 'Successful generation state must mark project validation passed.');
assertIncludes(generationStageSource, 'GenerationFailureCodeProjectValidationFailed', 'Failed project validation must update Engineering State.');
assertExcludes(generateOrchestratorSource, 'executeValidationGate(ctx, validationRunner', 'The generation main path must not validate the YiStack repository after project finalization.');
assertIncludes(frontendContractSource, "'project_validation_failed'", 'Frontend workflow contract must recognize project_validation_failed.');

for (const testName of [
  'TestProjectValidationRunnerStaticHTMLFixture',
  'TestProjectValidationRunnerNextFixtureUsesPackageLock',
  'TestProjectValidationRunnerViteFixtureSkipsMissingLint',
  'TestProjectValidationRunnerRejectsMissingViteReactRuntime',
  'TestProjectValidationRunnerGoFixture',
  'TestProjectValidationRunnerRetriesTransientGoPrepareWithoutRepair',
  'TestProjectValidationPrepareRetryClassification',
  'TestProjectValidationRunnerPythonFixture',
  'TestProjectValidationRunnerInfersPythonFromManifest',
  'TestProjectValidationRunnerStopsAfterBuildFailure',
  'TestApplyGenerationArtifactsStopsBeforePreviewAndGitWhenProjectValidationFails',
]) {
  assertIncludes(testsSource, testName, `GEN-002 fixture or ordering test is missing: ${testName}`);
}

assertIncludes(validationSource, 'GEN-002 生成项目 Build/Test/Lint Gate 校验', 'Validation Layer must document GEN-002.');

console.log('[YES] GEN-002 project validation gate passed.');
