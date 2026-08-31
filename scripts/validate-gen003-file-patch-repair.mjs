#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const assertIncludes = (source, snippet, message) => {
  if (!source.includes(snippet)) throw new Error(message);
};

const promptSource = read('backend/internal/prompt/generate.go');
const runtimeRequirementsSource = read('backend/internal/prompt/generation_runtime_requirements.go');
const operationsSource = read('backend/internal/service/generation_file_operations.go');
const snapshotSource = read('backend/internal/service/generation_workspace_snapshot.go');
const applySource = read('backend/internal/service/generation_apply_service.go');
const diagnosticsSource = read('backend/internal/service/project_validation_diagnostics.go');
const repairSource = read('backend/internal/service/generation_repair.go');
const repairPromptSource = read('backend/internal/prompt/repair.go');
const failureSource = read('backend/internal/service/generation_failure.go');
const handlerSource = read('backend/internal/handler/stream_response_writer.go');
const workflowSource = read('backend/internal/orchestration/workspace_generation_stage.go');
const llmSource = read('backend/pkg/llm/client.go');
const frontendSource = read('src/lib/workspace/workflow-contract.ts');
const operationTests = read('backend/internal/service/generation_file_operations_test.go');
const repairTests = read('backend/internal/service/generation_repair_test.go');
const diagnosticTests = read('backend/internal/service/project_validation_diagnostics_test.go');
const initSource = read('backend/init.sql');
const validationSource = read('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(promptSource, 'GenerationResultSchemaVersion = "generation_result.v2"', 'GEN-003 must use generation_result.v2.');
for (const snippet of ['schema_version、operations、message、commands', 'create 必须且只能包含', 'patch 必须且只能包含', 'base_hash']) {
  assertIncludes(promptSource, snippet, `GEN-003 generation protocol is missing: ${snippet}`);
}
for (const snippet of ['必须创建项目根目录 index.html', '必须创建 package.json、index.html 和源码入口', '@vitejs/plugin-react', '浏览器无 React is not defined', 'app/page.tsx 与 app/layout.tsx', 'baseUrl 和 paths', './components/Card', 'use client', '禁止在 render 中使用 await new Promise', 'typescript 精确固定为 5.4.5', '必须创建 go.mod', '必须创建 requirements.txt 或 pyproject.toml', 'ASGITransport(app=app)']) {
  assertIncludes(runtimeRequirementsSource, snippet, `GEN-003 runtime scaffold contract is missing: ${snippet}`);
}
for (const snippet of [
  'GenerationFileOperationCreate', 'GenerationFileOperationReplace', 'GenerationFileOperationPatch', 'GenerationFileOperationDelete',
  'generationContentHash', 'PathDirty', 'base_hash_mismatch', 'recheckGenerationOperationPlan',
  'rollbackGenerationFileOperations', 'isProtectedGenerationPath', 'containsPrivateKeyMaterial', 'ResultHash',
]) {
  assertIncludes(operationsSource, snippet, `GEN-003 file operation guard is missing: ${snippet}`);
}
for (const snippet of ['generationSnapshotMaxFiles', 'generationSnapshotMaxTotalBytes', 'SHA256', 'isExcludedGenerationSnapshotPath', 'containsPrivateKeyMaterial']) {
  assertIncludes(snapshotSource, snippet, `GEN-003 workspace snapshot boundary is missing: ${snippet}`);
}

const operationIndex = applySource.indexOf('applyGenerationFileOperations(');
const commandIndex = applySource.indexOf('s.runGeneratedCommands(');
const validationFlowIndex = applySource.indexOf('s.validateAndRepairGeneratedProject(');
const finalizeIndex = applySource.indexOf('s.finalizeGeneratedProject(');
if (operationIndex < 0 || commandIndex <= operationIndex || validationFlowIndex <= commandIndex || finalizeIndex <= validationFlowIndex) {
  throw new Error('GEN-003 order must be operations -> commands -> validation/repair -> Preview/Git finalization.');
}
const validationHelperIndex = applySource.indexOf('func (s *GeneratorService) validateAndRepairGeneratedProject(');
const validationHelperSource = applySource.slice(validationHelperIndex, applySource.indexOf('// writeGeneratedFiles', validationHelperIndex));
const validationIndex = validationHelperSource.indexOf('s.validateGeneratedProject(');
const repairIndex = validationHelperSource.indexOf('s.repairGeneratedProject(');
if (validationHelperIndex < 0 || validationIndex < 0 || repairIndex <= validationIndex) {
  throw new Error('GEN-003 validation failures must enter bounded repair after full Project Validation.');
}
for (const snippet of ['isRepairableGenerationCommandFailure(commandErr)', 'failure.Check = "policy"']) {
  assertIncludes(applySource, snippet, 'GEN-003 command repair boundary is missing: ' + snippet);
}
assertIncludes(failureSource, 'Check:    "execution"', 'GEN-003 execution command failures must be marked repairable.');

for (const snippet of ['ProjectValidationDiagnostic', 'collectProjectValidationDiagnostics', 'FailureFingerprint', 'sha256.Sum256']) {
  assertIncludes(diagnosticsSource, snippet, `GEN-003 structured diagnostics are missing: ${snippet}`);
}
for (const snippet of [
  'generationRepairDefaultAttempts = 2', 'generationRepairHardMaxAttempts = 3',
  'generationRepairDefaultTimeout  = 90 * time.Second', 'generationRepairDefaultTokens   = 4096',
  'generationRepairSchemaAttempts  = 2', 'runGenerationRepairSchemaAttempts', 'runGenerationRepairProtocolAttempts', 'generationRepairResponseFormatForPaths',
  'request.Provider', 'request.Model', 'allowed_paths', 'validateGenerationRepairPaths',
  'readGenerationRepairFileStates', 'generationRepairAllowedPathSet', 'generationRepairGuidance', 'repair_guidance', 'validateGenerationRepairOperationStates', 'applyGenerationTextEdits(state.Content, operation.Edits)', 'previous_repair_error', 'FailureFingerprint', 's.validateGeneratedProject(',
  'GenerationFailureCodeRepairRepeatedFailure', 'GenerationFailureCodeRepairBudgetExhausted',
]) {
  assertIncludes(repairSource, snippet, `GEN-003 bounded repair contract is missing: ${snippet}`);
}
assertIncludes(repairPromptSource, 'GenerationRepairSchemaVersion = "generation_repair.v1"', 'GEN-003 must version the repair protocol.');
assertIncludes(repairPromptSource, '判别字段必须名为 operation', 'GEN-003 repair protocol must require the exact operation discriminator.');
assertIncludes(repairPromptSource, 'exists=false', 'GEN-003 repair protocol must allow diagnosed missing files within its explicit path scope.');
assertIncludes(repairPromptSource, 'exists=true', 'GEN-003 repair protocol must distinguish create from patch/replace using snapshot existence.');
assertIncludes(repairPromptSource, '禁止改成另一个 @/ 前缀', 'GEN-003 repair protocol must give deterministic guidance for unresolved Next.js aliases.');
assertIncludes(repairPromptSource, 'Expected workStore to be initialized', 'GEN-003 repair protocol must give deterministic guidance for the Next.js WorkStore invariant.');
assertIncludes(repairPromptSource, 'devDependencies.typescript 精确固定为 5.4.5', 'GEN-003 repair protocol must repair incompatible Next.js TypeScript toolchains.');
assertIncludes(repairPromptSource, 'AsyncClient(transport=transport', 'GEN-003 repair protocol must repair httpx ASGI transport compatibility.');
assertIncludes(llmSource, 'MaxTokens', 'Repair token budgets must reach provider requests.');

for (const code of ['generation_file_conflict', 'repair_result_invalid', 'repair_budget_exhausted', 'repair_repeated_failure']) {
  assertIncludes(failureSource, `"${code}"`, `Backend failure code is missing: ${code}`);
  assertIncludes(frontendSource, `'${code}'`, `Frontend failure code is missing: ${code}`);
}
assertIncludes(handlerSource, 'payload["file_conflict"]', 'SSE must expose file conflict evidence.');
assertIncludes(handlerSource, 'payload["repair"]', 'SSE must expose repair evidence.');
assertIncludes(workflowSource, 'GenerationFailureCodeRepairBudgetExhausted', 'Engineering State must preserve repair stop reasons.');

for (const [source, names] of [
  [operationTests, ['TestApplyGenerationFileOperationsSupportsCreateReplacePatchDelete', 'TestGenerationFileOperationsBlockDirtyAndStalePaths', 'TestGenerationFileOperationsRollbackAppliedChanges', 'TestValidateGenerationPatchReportsNoOpAsEditError']],
  [repairTests, ['TestRepairGeneratedProjectPassesAfterBoundedPatch', 'TestRepairGeneratedProjectStopsOnRepeatedFingerprint', 'TestRepairGeneratedProjectStopsAtDefaultBudget', 'TestRepairGeneratedProjectAllowsDiagnosedNextRootLayoutCreation', 'TestRepairGeneratedProjectRetriesSnapshotIncompatibleOperation', 'TestRepairGeneratedProjectRetriesPatchContextMismatch', 'TestRepairGeneratedProjectRetriesNoOpPatchWithReplace', 'TestDecodeGenerationRepairResultNormalizesOnlyOperationSeparators', 'TestRunGenerationRepairSchemaAttemptsRetriesDecodeFailure', 'TestRunGenerationRepairSchemaAttemptsStopsAtBudget', 'TestRunGenerationRepairProtocolAttemptsRetriesSnapshotMismatch', 'TestGenerationRepairSchemaRetryDisablesPatchForNoOp', 'TestGenerationRepairAllowedPathsIncludeDiagnosedRuntimeManifest', 'TestGenerationRepairGuidanceForViteReactRuntime', 'TestGenerationRepairGuidanceForUnresolvedNextAlias', 'TestGenerationRepairGuidanceForNextWorkStoreInvariant', 'TestGenerationRepairGuidanceForNextTypeScriptCompatibility', 'TestGenerationRepairGuidanceForHTTPXASGITransport', 'TestRepairGeneratedProjectUsesPostValidationSnapshotForToolchainChanges', 'TestRepairGeneratedProjectRejectsChangeAfterRepairSnapshot']],
  [diagnosticTests, ['TestCollectProjectValidationDiagnosticsParsesCommonLocations', 'TestFinalizeProjectValidationFailureProducesStableFingerprint']],
]) {
  for (const name of names) assertIncludes(source, name, `GEN-003 regression test is missing: ${name}`);
}

for (const key of ['project.generation_repair_max_attempts', 'project.generation_repair_timeout_seconds', 'project.generation_repair_max_output_units']) {
  assertIncludes(initSource, key, `Supabase init.sql is missing repair config: ${key}`);
}
assertIncludes(validationSource, 'GEN-003 文件级 Patch 与有限自动修复校验', 'Validation Layer must document GEN-003.');

console.log('[YES] GEN-003 file patch and bounded repair validation passed.');
