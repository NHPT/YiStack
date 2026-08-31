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

const promptSource = read('backend/internal/prompt/generate.go');
const llmSource = read('backend/pkg/llm/client.go');
const fallbackSource = read('backend/internal/service/llm_fallback.go');
const schemaSource = read('backend/internal/service/generation_result_schema.go');
const schemaRetrySource = read('backend/internal/service/generation_schema_retry.go');
const schemaRetryTests = read('backend/internal/service/generation_schema_retry_test.go');
const applySource = read('backend/internal/service/generation_apply_service.go');
const operationsSource = read('backend/internal/service/generation_file_operations.go');
const artifactsSource = read('backend/internal/service/generator_artifacts_stage.go');
const failureSource = read('backend/internal/service/generation_failure.go');
const handlerSource = read('backend/internal/handler/stream_response_writer.go');
const workflowSource = read('backend/internal/orchestration/workspace_generation_stage.go');
const frontendContractSource = read('src/lib/workspace/workflow-contract.ts');
const testsSource = read('backend/internal/service/generation_contract_test.go');
const validationSource = read('docs/engineering/VALIDATION_LAYER.md');

assertIncludes(promptSource, 'GenerationResultSchemaVersion = "generation_result.v2"', 'GEN-001 must define the versioned generation result protocol.');
assertIncludes(promptSource, '相邻对象必须使用 },{ 分隔', 'GEN-001 must ground multi-operation JSON object separators.');
assertIncludes(promptSource, '生成结果协议（强制）', 'GEN-001 must append a non-overridable generation result protocol.');
assertIncludes(llmSource, 'ResponseFormat  *ChatResponseFormat', 'LLM requests must support an OpenAI-compatible response format.');
assertIncludes(llmSource, 'ReasoningEffort string', 'LLM requests must forward bounded reasoning effort for reasoning models.');
assertIncludes(llmSource, 'WithReasoningEffort(req.ReasoningEffort)', 'Provider manager must preserve request-level reasoning effort.');
assertIncludes(schemaSource, 'Type: "json_schema"', 'Generation requests must use native JSON Schema when supported.');
assertIncludes(schemaSource, '"additionalProperties": false', 'Generation JSON Schema must reject unknown fields.');
assertIncludes(fallbackSource, 'isStructuredResponseFormatUnsupported', 'Providers that reject JSON Schema must use an explicit capability fallback.');
assertIncludes(fallbackSource, 'cloneChatRequestWithoutResponseFormat', 'Unsupported structured output must retry without response_format.');
assertIncludes(schemaRetrySource, 'defaultGenerationSchemaMaxAttempts = 3', 'Schema failures must use a bounded generation retry budget.');
assertIncludes(schemaRetrySource, '相邻对象使用 },{ 分隔', 'Schema retries must correct stringified operation array items.');
assertIncludes(schemaRetrySource, 'GenerationFailureCode(err) != GenerationFailureCodeSchemaInvalid', 'Only schema failures may restart generation before apply.');
assertIncludes(schemaRetrySource, 'structuredOutputReasoningEffort', 'GPT-OSS structured output must use bounded reasoning effort.');
assertIncludes(schemaRetryTests, 'TestRunGenerationContentAttemptsStopsAtSchemaBudgetWithoutApply', 'Schema retry must prove invalid outputs never reach apply.');

assertIncludes(applySource, 'decoder.DisallowUnknownFields()', 'Generation result decoding must reject unknown fields.');
assertIncludes(applySource, 'ensureGenerationResultJSONEOF', 'Generation result decoding must reject trailing JSON values.');
assertIncludes(operationsSource, 'normalizeProjectRelativePath(*wire.Path)', 'Generation result decoding must validate project-relative paths before writes.');
assertExcludes(applySource, 'buildFallbackGenerationResult', 'GEN-001 must not restore the README wrapper fallback.');
assertExcludes(applySource, 'fallback to README wrapper', 'GEN-001 must not log or use the README wrapper fallback.');
assertIncludes(artifactsSource, 'genResult, decodeErr := decodeGenerationResult(rawContent)', 'Artifact application must stop on strict decode failure.');
assertIncludes(artifactsSource, 'return decodeErr', 'Artifact application must return schema failures before file writes.');

assertIncludes(failureSource, 'GenerationFailureCodeSchemaInvalid', 'GEN-001 must expose the schema failure reason code constant.');
assertIncludes(failureSource, '= "generation_schema_invalid"', 'GEN-001 must expose the schema failure reason code value.');
assertIncludes(failureSource, 'GenerationFailureCodeCommandFailed', 'GEN-001 must expose the command failure reason code constant.');
assertIncludes(failureSource, '= "generation_command_failed"', 'GEN-001 must expose the command failure reason code value.');
assertIncludes(applySource, 'return failure', 'Generated command failures must return instead of continuing finalization.');
assertIncludes(applySource, 'if result.ExitCode != 0', 'Non-zero generated command exit codes must be checked.');
assertIncludes(handlerSource, 'var generationErr *service.GenerationFailureError', 'SSE errors must preserve structured generation failure evidence.');
assertIncludes(workflowSource, 'service.GenerationFailureCode(err)', 'Engineering State recovery must preserve structured generation reason codes.');
assertIncludes(frontendContractSource, "'generation_schema_invalid'", 'Frontend workflow contract must recognize generation schema failures.');
assertIncludes(frontendContractSource, "'generation_command_failed'", 'Frontend workflow contract must recognize generation command failures.');

for (const testName of [
  'TestDecodeGenerationResultRejectsInvalidContractsWithoutReadmeFallback',
  'TestCompleteGenerationArtifactsStageDoesNotEmitDoneForInvalidSchema',
  'TestRunGeneratedCommandsStopsOnFirstFailure',
  'TestGenerationChatRequestUsesStrictJSONSchemaResponseFormat',
]) {
  assertIncludes(testsSource, testName, `GEN-001 regression test is missing: ${testName}`);
}

assertIncludes(validationSource, 'GEN-001 生成结果协议与失败真实性校验', 'Validation Layer must document the GEN-001 gate.');

console.log('[YES] GEN-001 generation contract validation passed.');
