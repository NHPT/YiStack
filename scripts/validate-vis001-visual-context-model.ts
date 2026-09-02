import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  hasVisionCapability,
  isVisualContext,
  parseVisualAttachmentInputsJSON,
  parseVisualContextJSON,
  resolveVisualContextForPlans,
  type VisualContext,
} from '../src/lib/visual-context';
import { deserializeWorkspaceMessage } from '../src/app/workspace/workspace-page-helpers';
import { replayWorkspaceGenerationJob } from '../src/app/workspace/workspace-generation-job-replay';

const visualContext: VisualContext = {
  schema_version: 'visual_context.v1',
  id: 'visual-context-1',
  server_proof: 'a'.repeat(64),
  summary: 'A compact dashboard',
  layout: ['Two-column desktop layout'],
  components: ['Metric cards'],
  color_palette: ['#ffffff', '#111111'],
  typography: ['Sans-serif headings'],
  spacing: ['8px spacing scale'],
  responsive_behavior: ['Collapse to one column'],
  interaction_notes: ['Cards are clickable'],
  attachments: [{
    name: 'reference.png',
    content_type: 'image/png',
    size: 68,
    sha256: 'a'.repeat(64),
    width: 1,
    height: 1,
  }],
  provider: 'openai',
  model: 'gpt-4o',
  analyzed_at: '2026-09-01T10:00:00Z',
};

assert.equal(hasVisionCapability('chat, vision, coding'), true);
assert.equal(hasVisionCapability('chat,computer-vision-preview,coding'), false);
assert.equal(isVisualContext(visualContext), true);
assert.equal(isVisualContext({ ...visualContext, schema_version: 'visual_context.v2' }), false);
assert.equal(isVisualContext({ ...visualContext, server_proof: '' }), false);
assert.equal(parseVisualContextJSON(JSON.stringify(visualContext))?.id, visualContext.id);
assert.equal(parseVisualContextJSON('{"schema_version":"visual_context.v1"}'), undefined);
assert.equal(resolveVisualContextForPlans([
  { id: 'plan-1' },
  { id: 'plan-2', visual_context: visualContext },
], 'plan-2', null)?.id, visualContext.id);
assert.equal(resolveVisualContextForPlans([{ id: 'plan-2', visual_context: visualContext }], null, null)?.id, visualContext.id);

const attachmentDataURL = 'data:image/png;base64,iVBORw0KGgo=';
const attachmentsJSON = JSON.stringify([{
  name: 'reference.png',
  content_type: 'image/png',
  size: 8,
  data_url: attachmentDataURL,
}]);
assert.equal(parseVisualAttachmentInputsJSON(attachmentsJSON).length, 1);
assert.equal(parseVisualAttachmentInputsJSON('[{"content_type":"image/gif"}]').length, 0);

const restoredMessage = deserializeWorkspaceMessage({
  id: 1,
  project_id: 'project-1',
  role: 'user',
  content: 'Use this reference',
  visual_attachments: attachmentsJSON,
  visual_context: JSON.stringify(visualContext),
});
assert.equal(restoredMessage.attachments?.[0]?.dataUrl, attachmentDataURL);
assert.equal(restoredMessage.visualContext?.id, visualContext.id);

async function verifyVisualContextReplay() {
  const replayedEvents: string[] = [];
  const replayResponse = new Response(
    `id: 1\nevent: visual_context\ndata: ${JSON.stringify({ visual_context: visualContext })}\n\n`
    + 'id: 2\nevent: done\ndata: {"message":"done"}\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
  await replayWorkspaceGenerationJob(replayResponse, {
    onCursor: () => undefined,
    onEvent: (event) => replayedEvents.push(event),
    onStage: () => undefined,
    onTerminal: () => undefined,
  });
  assert.deepEqual(replayedEvents, ['visual_context', 'done']);
}

const visualServiceSource = fs.readFileSync('backend/internal/service/visual_context.go', 'utf8');
const generationJobSource = fs.readFileSync('backend/internal/orchestration/workspace_generation_jobs.go', 'utf8');
const generationJobServiceSource = fs.readFileSync('backend/internal/service/generation_job_service.go', 'utf8');
const generationJobRepoSource = fs.readFileSync('backend/internal/service/generation_job_repo.go', 'utf8');
const initSQLSource = fs.readFileSync('backend/init.sql', 'utf8');
const browserAcceptanceSource = fs.readFileSync('scripts/validate-vis001-browser-acceptance.mjs', 'utf8');
const packageSource = fs.readFileSync('package.json', 'utf8');
const ciSource = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const serverSource = fs.readFileSync('backend/cmd/server/main.go', 'utf8');
const serverBootstrapSource = fs.readFileSync('backend/cmd/server/bootstrap.go', 'utf8');
const promptActionsSource = fs.readFileSync('src/app/workspace/use-workspace-prompt-actions.ts', 'utf8');
const chatMessageSource = fs.readFileSync('src/app/workspace/workspace-chat-message-list.tsx', 'utf8');

for (const snippet of [
  'MaxVisualAttachmentCount',
  'image.DecodeConfig',
  'encodeSanitizedVisualImage',
  'SupportsCapability(providerName, "vision")',
  'requestedModel != configuredModel',
  'ResponseFormat: visualContextResponseFormat()',
  'decoder.DisallowUnknownFields()',
  'loadTrustedProjectVisualContext',
  'sourceBytes += attachment.SourceSize',
  'sanitizedBytes += attachment.Input.Size',
  'interaction_notes is missing',
  'signVisualContext',
  'verifyVisualContextProof',
]) {
  assert.ok(visualServiceSource.includes(snippet), `VIS-001 backend contract is missing: ${snippet}`);
}
assert.ok(serverSource.includes('server.WithMaxRequestBodySize(service.MaxVisualRequestBodyBytes)'), 'VIS-001 HTTP body limit must cover the declared visual attachment budget');
assert.ok(serverBootstrapSource.includes('VisualContextSigningKey: cfg.JWT.Secret'), 'VIS-001 runtime must inject a non-client signing key');
assert.ok(serverBootstrapSource.includes('cfg.JWT.Secret,'), 'VIS-001 planning runtime must inject the same signing key');
assert.ok(
  generationJobSource.indexOf('prepareGenerateCommandVisualAttachments(&command)')
    < generationJobSource.indexOf('prepareGenerateCommandVisualContext(ctx, o.generatorService, &command)')
    && generationJobSource.indexOf('prepareGenerateCommandVisualContext(ctx, o.generatorService, &command)')
      < generationJobSource.indexOf('json.Marshal(command)'),
  'VIS-001 must sanitize visual attachments before persisting the Generation Job payload',
);
for (const snippet of [
  'BindVisualContextSnapshot(',
  'mergeGenerationJobVisualContextSnapshot',
  'request["visual_context"] = visualContext',
]) {
  assert.ok(generationJobServiceSource.includes(snippet), `VIS-001 durable Job binding is missing: ${snippet}`);
}
assert.ok(generationJobRepoSource.includes('BindVisualContextSnapshot('), 'VIS-001 Generation Job repository contract must bind visual context snapshots');
assert.ok(initSQLSource.includes('bind_generation_job_visual_context'), 'VIS-001 Supabase transaction must bind Job and attempt snapshots');
for (const snippet of ['toWorkspaceVisualAttachmentInputs(attachedFiles)', 'selectedWorkspaceModelSupportsVision', 'visualAttachments: requestVisualAttachments', 'visualContext: requestVisualContext', 'resolveVisualContextForPlans', 'onTerminal: completeVisualSubmission']) {
  assert.ok(promptActionsSource.includes(snippet), `VIS-001 prompt flow is missing: ${snippet}`);
}
assert.ok(chatMessageSource.includes('workspace-chat-message-attachments'), 'VIS-001 chat history must render restored visual attachments');
for (const snippet of ['workspace-chat-image-input', 'ClipboardEvent', 'Text Model', 'mobile workspace must not overflow horizontally']) {
  assert.ok(browserAcceptanceSource.includes(snippet), `VIS-001 browser acceptance is missing: ${snippet}`);
}
assert.ok(packageSource.includes('test:vis001-browser'), 'VIS-001 browser acceptance must expose a package command');
assert.ok(ciSource.includes('pnpm test:vis001-browser'), 'VIS-001 browser acceptance must run in CI after the production build');
const adminLLMSource = fs.readFileSync('src/app/admin/llm/page.tsx', 'utf8');
for (const snippet of ['vision_model_ids', 'getAdminLLMProviderVisionModelIds', 'getAdminLLMProviderModelCapabilityTags', '图片输入能力']) {
  assert.ok(adminLLMSource.includes(snippet), `VIS-001 admin model capability control is missing: ${snippet}`);
}

void verifyVisualContextReplay().then(() => {
  console.log('[YES] VIS-001 visual context model validation passed.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
