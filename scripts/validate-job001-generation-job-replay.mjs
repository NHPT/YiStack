#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
const assertIncludes = (source, snippet, message) => {
  if (!source.includes(snippet)) throw new Error(message);
};

const initSource = read('backend/init.sql');
const modelSource = read('backend/internal/model/generation_job.go');
const repoContractSource = read('backend/internal/service/generation_job_repo.go');
const jobServiceSource = read('backend/internal/service/generation_job_service.go');
const gormRepoSource = read('backend/internal/repository/generation_job_repository.go');
const supabaseRepoSource = read('backend/pkg/supabase/generation_job_repository.go');
const generateHandlerSource = read('backend/internal/handler/generate.go');
const projectHandlerSource = read('backend/internal/handler/project_runtime_handler.go');
const streamHandlerSource = read('backend/internal/handler/generation_job_stream.go');
const routesSource = read('backend/cmd/server/main.go');
const proxySource = read('src/app/api/_utils/backend-proxy.ts');
const apiSource = read('src/lib/api/index.ts');
const replaySource = read('src/app/workspace/workspace-generation-job-replay.ts');
const pageEffectsSource = read('src/app/workspace/use-workspace-page-effects.ts');
const implementationExecutionSource = read('src/app/workspace/workspace-orchestration-implementation-execution.ts');
const sharedStreamSource = read('src/app/workspace/workspace-orchestration-shared.ts');
const serviceTests = read('backend/internal/service/generation_job_service_test.go');
const handlerTests = read('backend/internal/handler/generation_job_stream_test.go');
const supabaseTests = read('backend/pkg/supabase/generation_job_repository_test.go');
const validationSource = read('docs/engineering/VALIDATION_LAYER.md');

for (const table of ['generation_jobs', 'generation_attempts', 'generation_events']) {
  assertIncludes(initSource, `CREATE TABLE IF NOT EXISTS public.${table}`, `JOB-001 is missing ${table}.`);
}
for (const snippet of [
  'generation_jobs_one_active_per_project',
  'generation_events_job_sequence_unique',
  'generation_events_job_event_key_unique',
  'append_generation_event',
  'create_generation_attempt',
  'transition_generation_job_terminal',
  'heartbeat_generation_job_lease',
  'interrupt_stale_generation_job',
  'FOR UPDATE',
  "'queued', 'running', 'repairing', 'validating', 'previewing', 'succeeded', 'failed', 'cancelled', 'interrupted'",
  'GRANT EXECUTE ON FUNCTION public.append_generation_event',
  'GRANT EXECUTE ON FUNCTION public.transition_generation_job_terminal',
]) {
  assertIncludes(initSource, snippet, `JOB-001 init.sql contract is missing: ${snippet}`);
}

for (const snippet of ['type GenerationJob struct', 'type GenerationAttempt struct', 'type GenerationEvent struct', 'EventSequence', 'LeaseExpiresAt', 'HeartbeatAt']) {
  assertIncludes(modelSource, snippet, `JOB-001 durable model is missing: ${snippet}`);
}
for (const method of ['AcquireJobLease', 'HeartbeatJobLease', 'UpdateJobPhase', 'CompleteJob', 'CancelActiveJob', 'InterruptStaleJobs', 'AppendEvent', 'ListEvents']) {
  assertIncludes(repoContractSource, method, `JOB-001 repository contract is missing: ${method}`);
}
for (const snippet of [
  'context.WithCancel(context.Background())',
  'generationJobLeaseDuration',
  'generationJobHeartbeatInterval',
  'recoverStaleJobs',
  'SupersedeActiveJobs',
  'FindJobByIdempotencyKey',
  'StreamEvents',
  'EventType: terminalEventType',
  'EventPayload: terminalEventPayload',
]) {
  assertIncludes(jobServiceSource, snippet, `JOB-001 coordinator is missing: ${snippet}`);
}
for (const snippet of ['clause.Locking{Strength: "UPDATE"}', 'transitionJobTerminal', 'EventKey: "terminal"', 'context.Canceled']) {
  assertIncludes(gormRepoSource, snippet, `JOB-001 GORM atomicity is missing: ${snippet}`);
}
for (const rpc of [
  'rpc/append_generation_event',
  'rpc/create_generation_attempt',
  'rpc/heartbeat_generation_job_lease',
  'rpc/interrupt_stale_generation_job',
  'rpc/transition_generation_job_terminal',
]) {
  assertIncludes(supabaseRepoSource, rpc, `JOB-001 Supabase atomic RPC is missing: ${rpc}`);
}

for (const snippet of ['IdempotencyKey', 'X-Generation-Job-ID', 'StartGenerationJob', 'StreamGenerationJob']) {
  assertIncludes(generateHandlerSource, snippet, `JOB-001 generate handler is missing: ${snippet}`);
}
for (const snippet of ['GetGenerationStatus', 'GetGenerationEvents', 'job.ProjectID != projectID', 'generationJobResponse']) {
  assertIncludes(projectHandlerSource, snippet, `JOB-001 project handler is missing: ${snippet}`);
}
for (const snippet of ['Last-Event-ID', 'writer.WriteEvent(strconv.FormatInt(event.Sequence, 10)', 'generation_event_sequence']) {
  assertIncludes(streamHandlerSource, snippet, `JOB-001 SSE replay handler is missing: ${snippet}`);
}
assertIncludes(routesSource, 'project.GET("/:id/generation/events", projectHandler.GetGenerationEvents)', 'JOB-001 replay route is not registered.');
for (const snippet of ['Last-Event-ID', 'Idempotency-Key', 'X-Generation-Job-ID']) {
  assertIncludes(proxySource, snippet, `JOB-001 Next proxy header is missing: ${snippet}`);
}
for (const snippet of ['ProjectGenerationJobSummary', 'idempotency_key: string', 'replayGenerationEvents']) {
  assertIncludes(apiSource, snippet, `JOB-001 frontend API contract is missing: ${snippet}`);
}
for (const snippet of ['onEventCursor', 'id?: string', 'isSSEEventIdLine']) {
  assertIncludes(sharedStreamSource, snippet, `JOB-001 SSE cursor parser is missing: ${snippet}`);
}
for (const snippet of ['replayWorkspaceGenerationJob', 'onCursor', 'onEvent?', 'onTerminal']) {
  assertIncludes(replaySource, snippet, `JOB-001 refresh replay helper is missing: ${snippet}`);
}
for (const snippet of [
  'projectApi.replayGenerationEvents',
  'replayCursor',
  'pollGenerationStatusUntilSettled',
  'updateGenerationReplayMessage',
  'applyGenerationReplayEvent',
  "event === 'chunk'",
  "event === 'done'",
  "event === 'error'",
  'generationJob.idempotency_key',
  'replayAttempted',
  'terminalReplayAllowed',
  'shouldReplayWorkspaceGenerationJob',
]) {
  assertIncludes(pageEffectsSource, snippet, `JOB-001 page recovery is missing: ${snippet}`);
}
for (const snippet of ['X-Generation-Job-ID', 'generationEventCursor', 'resolveGenerationJobId', 'job?.idempotency_key === request.assistantMessageId', 'replayGenerationEvents']) {
  assertIncludes(implementationExecutionSource, snippet, `JOB-001 live SSE reconnect is missing: ${snippet}`);
}
for (const forbidden of ['无法恢复已断开的 SSE 增量流', '页面刷新后检测到后端生成任务仍在进行中']) {
  if (pageEffectsSource.includes(forbidden)) throw new Error(`JOB-001 must not emit legacy recovery chat notice: ${forbidden}`);
}

for (const testName of [
  'TestGenerationJobContinuesAfterRequestContextCancellation',
  'TestGenerationJobIdempotencyRunsOnce',
  'TestGenerationJobSupersedesActiveProjectJob',
  'TestGenerationJobStopPersistsSingleTerminalEvent',
  'TestGenerationJobCursorReplay',
  'TestGenerationEventPersistenceFailureFailsJob',
  'TestGenerationJobStartupInterruptsOnlyStaleJobs',
  'TestGenerationJobStatusSweepInterruptsExpiredCurrentWorkerLease',
  'TestGenerationJobRepairAttemptUpdatesCurrentAttempt',
]) {
  assertIncludes(serviceTests, testName, `JOB-001 service regression test is missing: ${testName}`);
}
assertIncludes(handlerTests, 'TestGenerationEventCursorUsesHighestValidCursor', 'JOB-001 cursor handler test is missing.');
assertIncludes(handlerTests, 'TestGetGenerationEventsRejectsNonOwnerBeforeReplay', 'JOB-001 replay ownership test is missing.');
assertIncludes(supabaseTests, 'TestSupabaseGenerationJobAppendEventUsesAtomicRPC', 'JOB-001 Supabase RPC test is missing.');
assertIncludes(supabaseTests, 'TestSupabaseGenerationJobCreateAttemptUsesAtomicRPC', 'JOB-001 Supabase attempt RPC test is missing.');
assertIncludes(supabaseTests, 'TestSupabaseGenerationJobHeartbeatUsesLeaseCASRPC', 'JOB-001 Supabase heartbeat lease CAS test is missing.');
assertIncludes(supabaseTests, 'TestSupabaseGenerationJobInterruptStaleUsesObservedLeaseVersion', 'JOB-001 Supabase stale interrupt CAS test is missing.');
assertIncludes(validationSource, 'JOB-001 持久 Generation Job 与 SSE Replay 校验', 'Validation Layer must document JOB-001.');

console.log('[YES] JOB-001 durable Generation Job and SSE replay validation passed.');
