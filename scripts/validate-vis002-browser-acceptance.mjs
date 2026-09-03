#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { chromium } from '@playwright/test';

const PROJECT_ID = 'proj-vis002-browser';
const evidenceDir = path.resolve('runtime/browser-acceptance');
const users = {
  owner: {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'Visual Owner',
    accessRole: 'owner',
    canWrite: true,
  },
  viewer: {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'Visual Viewer',
    accessRole: 'viewer',
    canWrite: false,
  },
};

const previewDocument = `<!doctype html>
<html><head><meta charset="utf-8"><title>VIS-002 Preview</title></head>
<body><main><h1>Visual editing preview</h1>
<button data-testid="primary-action" aria-label="Create project" class="primary">Create project</button>
</main><script>
(() => {
  const schema = 'visual_edit.v1';
  if (new URL(location.href).searchParams.get('__yistack_visual_edit') !== '1') return;
  const parentOrigin = new URL(document.referrer).origin;
  parent.postMessage({ type: 'yistack:visual-edit-ready', schema_version: schema }, parentOrigin);
  document.querySelector('[data-testid="primary-action"]').addEventListener('click', (event) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    parent.postMessage({
      type: 'yistack:visual-edit-selection',
      schema_version: schema,
      selection: {
        schema_version: schema,
        selection_id: 'selection-browser-1',
        page_path: '/preview',
        selector: '[data-testid="primary-action"]',
        tag_name: 'button',
        role: 'button',
        accessible_name: 'Create project',
        text_content: 'Create project',
        test_id: 'primary-action',
        class_names: ['primary'],
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        computed_styles: {
          'background-color': getComputedStyle(event.currentTarget).backgroundColor,
          'font-size': getComputedStyle(event.currentTarget).fontSize
        }
      }
    }, parentOrigin);
  }, true);
})();
</script></body></html>`;

function jsonResponse(route, data) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function installMocks(context, user, generatePayloads, observedPreviewUrls) {
  await context.route('**/preview**', async (route) => {
    observedPreviewUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: previewDocument,
    });
  });

  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/chat/generate' && request.method() === 'POST') {
      generatePayloads.push(JSON.parse(request.postData() ?? '{}'));
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: done\ndata: {"message":"Visual edit applied","mode":"implement","files":[]}\n\n',
      });
    }
    if (pathname === '/api/llm/providers') {
      return jsonResponse(route, {
        providers: [{
          id: 1,
          name: 'coding',
          display_name: 'Coding Provider',
          type: 'cloud',
          model: 'coding-model',
          is_default: true,
          models: [{
            id: 1,
            provider_id: 1,
            model_id: 'coding-model',
            display_name: 'Coding Model',
            enabled: true,
            is_default: true,
            capability_tags: 'chat,coding',
            runtime_id: 'coding::coding-model',
            runtime_loaded: true,
            runtime_active: true,
          }],
        }],
        default_name: 'coding::coding-model',
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}`) {
      return jsonResponse(route, {
        id: PROJECT_ID,
        project_id: PROJECT_ID,
        name: 'VIS-002 Browser Acceptance',
        description: 'Visual editing acceptance project',
        app_type: 'web',
        tech_stack: '{}',
        plan_id: 'plan-vis002',
        plan_data: '{"id":"plan-vis002","name":"Visual editing plan"}',
        container_status: 'running',
        preview_url: '/preview',
        git_branch: 'main',
        access_role: user.accessRole,
        can_write: user.canWrite,
        can_manage_members: user.accessRole === 'owner',
        file_tree: '[]',
        engineering_state: { bootstrap_state: { status: 'completed' } },
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/access`) {
      return jsonResponse(route, {
        role: user.accessRole,
        can_read: true,
        can_write: user.canWrite,
        can_manage: user.accessRole === 'owner',
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/runtime-status`
      || pathname === `/api/project/${PROJECT_ID}/start`) {
      return jsonResponse(route, {
        projectId: PROJECT_ID,
        status: 'ready',
        containerStatus: 'running',
        phase: 'ready',
        previewUrl: '/preview',
        message: 'ready',
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/messages`) return jsonResponse(route, []);
    if (pathname === `/api/project/${PROJECT_ID}/generation/status`) {
      return jsonResponse(route, {
        success: true,
        project_id: PROJECT_ID,
        generation_active: false,
        generation_job: null,
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/files`) return jsonResponse(route, []);
    if (pathname === `/api/project/${PROJECT_ID}/worktree-status`) {
      return jsonResponse(route, { branch: 'main', files: [], clean: true });
    }
    if (/\/(branches|commits|remotes|remote-branches|tags|stashes)$/.test(pathname)) {
      return jsonResponse(route, []);
    }
    if (pathname.includes('/collaboration/')) {
      if (pathname.endsWith('/events')) {
        return route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'event: collaboration_heartbeat\ndata: {"schema_version":"project_collaboration.v1","cursor":0}\n\n',
        });
      }
      return jsonResponse(route, {
        schema_version: 'project_collaboration.v1',
        project_id: PROJECT_ID,
        cursor: 0,
        participants: [],
        events: [],
      });
    }
    return jsonResponse(route, {});
  });
}

async function createWorkspace(browser, baseURL, user, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ currentUser }) => {
    localStorage.setItem('yistack_token', `vis002-token-${currentUser.accessRole}`);
    localStorage.setItem('yistack_user', JSON.stringify({
      id: currentUser.id,
      username: currentUser.username,
      email: `${currentUser.accessRole}@example.invalid`,
      role: 'user',
    }));
  }, { currentUser: user });
  const generatePayloads = [];
  const observedPreviewUrls = [];
  await installMocks(context, user, generatePayloads, observedPreviewUrls);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/workspace?projectId=${PROJECT_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  if (viewport.width <= 480) {
    await page.getByRole('button', { name: 'IDE', exact: true }).click();
  }
  const previewTab = page.getByRole('button', { name: '预览', exact: true });
  await previewTab.waitFor({ state: 'visible' });
  await previewTab.click();
  await page.getByTestId('workspace-visual-edit-toggle').waitFor({ state: 'visible' });
  return { context, page, errors, generatePayloads, observedPreviewUrls };
}

async function screenshotEvidence(page, name) {
  const filePath = path.join(evidenceDir, name);
  await page.screenshot({ path: filePath, fullPage: true });
  const content = await fs.readFile(filePath);
  return {
    path: path.relative(process.cwd(), filePath).split(path.sep).join('/'),
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

async function waitUntil(check, message, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function runDesktopAcceptance(browser, baseURL) {
  const workspace = await createWorkspace(
    browser,
    baseURL,
    users.owner,
    { width: 1440, height: 900 },
  );
  try {
    const toggle = workspace.page.getByTestId('workspace-visual-edit-toggle');
    await waitUntil(
      () => toggle.isEnabled(),
      'owner visual editing permission was not confirmed',
    );
    assert.equal(await toggle.isEnabled(), true, 'owner must be able to start visual editing');
    await toggle.click();
    await waitUntil(
      () => workspace.observedPreviewUrls.some((value) => value.includes('__yistack_visual_edit=1')),
      'visual edit preview URL was not requested',
    );

    const frame = workspace.page.frameLocator('iframe[title="预览"]');
    await frame.getByTestId('primary-action').click();
    await workspace.page.getByTestId('workspace-visual-edit-panel').waitFor({ state: 'visible' });
    await workspace.page.getByText('button · Create project', { exact: true }).waitFor();
    await workspace.page
      .getByTestId('workspace-visual-edit-instruction')
      .fill('Make the selected button green and more prominent');
    await workspace.page.getByTestId('workspace-visual-edit-submit').click();

    await waitUntil(
      () => workspace.generatePayloads.some(
        (payload) => payload.visual_edit?.schema_version === 'visual_edit.v1',
      ),
      `visual edit payload did not reach generation API: ${JSON.stringify(workspace.generatePayloads)}`,
    );
    const payload = workspace.generatePayloads.find(
      (item) => item.visual_edit?.schema_version === 'visual_edit.v1',
    );
    assert.equal(payload.mode, 'implement');
    assert.equal(payload.visual_edit.selector, '[data-testid="primary-action"]');
    assert.equal(payload.visual_edit.page_path, '/preview');
    assert.equal('html' in payload.visual_edit, false);
    assert.equal('form_values' in payload.visual_edit, false);
    assert.match(payload.prompt, /Make the selected button green and more prominent/);

    const screenshot = await screenshotEvidence(workspace.page, 'vis002-desktop.png');
    assert.deepEqual(workspace.errors, [], `desktop console errors: ${workspace.errors.join('; ')}`);
    return {
      schemaVersion: payload.visual_edit.schema_version,
      selector: payload.visual_edit.selector,
      mode: payload.mode,
      screenshot,
    };
  } finally {
    await workspace.context.close();
  }
}

async function runMobileAcceptance(browser, baseURL) {
  const workspace = await createWorkspace(
    browser,
    baseURL,
    users.viewer,
    { width: 390, height: 844 },
  );
  try {
    const toggle = workspace.page.getByTestId('workspace-visual-edit-toggle');
    assert.equal(await toggle.isDisabled(), true, 'viewer must not be able to start visual editing');
    const dimensions = await workspace.page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(
      dimensions.scrollWidth,
      dimensions.viewport,
      'mobile workspace must not overflow horizontally',
    );
    const screenshot = await screenshotEvidence(workspace.page, 'vis002-mobile-viewer.png');
    assert.deepEqual(workspace.errors, [], `mobile console errors: ${workspace.errors.join('; ')}`);
    return {
      ...dimensions,
      viewerBlocked: await toggle.isDisabled(),
      screenshot,
    };
  } finally {
    await workspace.context.close();
  }
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('unable to allocate browser acceptance port');
  }
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next server exited before readiness:\n${output.join('')}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready:\n${output.join('')}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

if (await fs.stat(path.resolve('.next/BUILD_ID')).catch(() => null) === null) {
  throw new Error('VIS-002 browser acceptance requires a completed `pnpm build` first');
}

await fs.mkdir(evidenceDir, { recursive: true });
const port = await allocatePort();
const baseURL = `http://127.0.0.1:${port}`;
const serverOutput = [];
const nextServer = spawn(
  path.resolve('node_modules/.bin/next'),
  ['start', '-H', '127.0.0.1', '-p', String(port)],
  {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_DIST_DIR: '.next' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
nextServer.stdout.on('data', (chunk) => serverOutput.push(chunk.toString()));
nextServer.stderr.on('data', (chunk) => serverOutput.push(chunk.toString()));

let browser;
try {
  await waitForServer(`${baseURL}/auth`, nextServer, serverOutput);
  browser = await chromium.launch({ headless: true });
  const desktop = await runDesktopAcceptance(browser, baseURL);
  const mobile = await runMobileAcceptance(browser, baseURL);
  const result = { status: 'passed', desktop, mobile };
  await fs.writeFile(
    path.join(evidenceDir, 'vis002-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(`[VIS-002] Browser acceptance passed: ${JSON.stringify(result)}`);
} finally {
  await browser?.close();
  await stopServer(nextServer);
}
