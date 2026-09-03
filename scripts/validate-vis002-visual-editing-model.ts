import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildVisualEditPreviewUrl,
  buildVisualEditUserPrompt,
  isVisualEditContext,
  isVisualEditPreviewEligible,
  parseVisualEditBridgeMessage,
  type VisualEditContext,
} from '../src/lib/visual-edit';
import { buildImplementationGeneratePayload } from '../src/app/workspace/workspace-implementation-generation';

const visualEdit: VisualEditContext = {
  schema_version: 'visual_edit.v1',
  selection_id: 'selection-1',
  page_path: '/dashboard',
  selector: '[data-testid="primary-action"]',
  tag_name: 'button',
  role: 'button',
  accessible_name: 'Create project',
  text_content: 'Create project',
  test_id: 'primary-action',
  class_names: ['primary'],
  rect: { x: 24, y: 96, width: 160, height: 40 },
  computed_styles: { 'background-color': 'rgb(14, 165, 233)', 'font-size': '14px' },
};

assert.equal(isVisualEditContext(visualEdit), true);
assert.equal(isVisualEditContext({ ...visualEdit, page_path: '/dashboard?token=secret' }), false);
assert.equal(isVisualEditContext({ ...visualEdit, computed_styles: { 'background-image': 'url(secret)' } }), false);
assert.equal(parseVisualEditBridgeMessage({
  type: 'yistack:visual-edit-selection',
  schema_version: 'visual_edit.v1',
  selection: visualEdit,
})?.selection?.selection_id, 'selection-1');
assert.equal(parseVisualEditBridgeMessage({ type: 'unknown', schema_version: 'visual_edit.v1' }), null);

const baseHref = 'https://app.example.com/workspace';
assert.equal(isVisualEditPreviewEligible('/preview', '/preview', baseHref), true);
assert.equal(isVisualEditPreviewEligible('https://external.example.com', '/preview', baseHref), false);
assert.equal(buildVisualEditPreviewUrl('/preview', true, baseHref), '/preview?__yistack_visual_edit=1');
assert.match(buildVisualEditUserPrompt(visualEdit, 'Make it green'), /Create project.*Make it green/);

const payload = buildImplementationGeneratePayload({
  assistantMessageId: 'visual-edit-attempt-1',
  effectiveMode: 'implement',
  effectiveOnline: false,
  effectiveProject: {
    projectId: 'project-1',
    projectName: 'Visual editing project',
    description: '',
    appType: 'web',
    initialMessage: '',
    isPersisted: true,
  },
  prompt: buildVisualEditUserPrompt(visualEdit, 'Make it green'),
  visualEdit,
  statusContent: '',
  hasExistingAssistantMessage: false,
}, 'provider::model');
assert.deepEqual(payload.visual_edit, visualEdit);
assert.equal(payload.mode, 'implement');

function requireSnippets(path: string, snippets: string[]) {
  const source = fs.readFileSync(path, 'utf8');
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${path} is missing VIS-002 contract: ${snippet}`);
  }
}

requireSnippets('backend/internal/handler/preview_visual_edit_bridge.go', [
  '__yistack_visual_edit',
  'injectPreviewVisualEditBridge',
  'window.location.pathname',
  'event.source !== window.parent',
  'event.origin !== parentOrigin',
  'yistack:visual-edit-selection',
  'element.isContentEditable',
  'INPUT|TEXTAREA|SELECT|OPTION',
  'element.childNodes',
]);
for (const forbidden of [
  'document.cookie',
  'localStorage',
  'sessionStorage',
  'outerHTML',
  'innerHTML',
  'window.location.search',
  'element.value',
  'defaultValue',
  'element.innerText',
]) {
  assert.equal(
    fs.readFileSync('backend/internal/handler/preview_visual_edit_bridge.go', 'utf8').includes(forbidden),
    false,
    `preview bridge must not access ${forbidden}`,
  );
}
requireSnippets('backend/internal/handler/preview_gateway.go', [
  'visual editing is unavailable for public previews',
  'visual editing requires project write access',
  'decision.CanWrite()',
]);
requireSnippets('backend/internal/service/visual_edit.go', [
  'VisualEditErrorInvalidInput',
  'visualEditAllowedStyles',
  'PrepareVisualEditContext',
  '不可信观察数据',
  '临时修改预览 DOM 不算完成',
]);
requireSnippets('backend/internal/orchestration/workspace_generation_jobs.go', [
  'prepareGenerateCommandVisualEdit(&command)',
  'json.Marshal(command)',
]);
requireSnippets('src/app/workspace/workspace-visual-edit.tsx', [
  'collaborationApi.access(projectId)',
  'setAccessCanWrite(false)',
  'access.can_write === true',
  'workspace-visual-edit-toggle',
  'workspace-visual-edit-panel',
  'workspace-visual-edit-submit',
]);
requireSnippets('scripts/validate-vis002-browser-acceptance.mjs', [
  'workspace-visual-edit-toggle',
  'visual_edit.v1',
  'mobile workspace must not overflow horizontally',
]);
requireSnippets('package.json', ['test:vis002-browser']);
requireSnippets('.github/workflows/ci.yml', ['pnpm test:vis002-browser']);

console.log('[YES] VIS-002 visual editing model validation passed.');
