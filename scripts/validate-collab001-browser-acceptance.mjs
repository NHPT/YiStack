#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { chromium } from '@playwright/test';

const PROJECT_ID = 'proj-collab001-browser';
const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const EDITOR_ID = '22222222-2222-2222-2222-222222222222';
const VIEWER_ID = '33333333-3333-3333-3333-333333333333';
const FILE_PATH = 'src/App.tsx';
const evidenceDir = path.resolve('runtime/browser-acceptance');

const users = {
  owner: { id: OWNER_ID, username: 'Owner', role: 'owner' },
  editor: { id: EDITOR_ID, username: 'Editor', role: 'editor' },
  viewer: { id: VIEWER_ID, username: 'Viewer', role: 'viewer' },
};

const collaborationState = {
  cursor: 0,
  events: [],
  sessions: new Map(),
  fileContent: 'export const value = \"initial\";\n',
  readCounts: new Map(),
  rejectedWrites: [],
  touchActivities: new Map(),
  observedRequests: [],
};

function revision(content) {
  return createHash('sha256').update(content).digest('hex');
}

function jsonResponse(route, data) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

function appendEvent(user, eventType, resourcePath = '', resourceRevision = '', metadata = {}) {
  collaborationState.cursor += 1;
  const event = {
    sequence: collaborationState.cursor,
    id: randomUUID(),
    project_id: PROJECT_ID,
    event_type: eventType,
    actor_user_id: user.id,
    actor_username: user.username,
    resource_path: resourcePath,
    resource_revision: resourceRevision,
    metadata,
    created_at: new Date().toISOString(),
  };
  collaborationState.events.push(event);
  return event;
}

function activeParticipants(currentUserId) {
  return Array.from(collaborationState.sessions.values()).map((session) => ({
    session_id: session.sessionId,
    user_id: session.user.id,
    username: session.user.username,
    role: session.user.role,
    activity: session.activity,
    current_file: session.currentFile,
    is_self: session.user.id === currentUserId,
    joined_at: session.joinedAt,
    last_seen_at: session.lastSeenAt,
    expires_at: new Date(Date.now() + 45_000).toISOString(),
  }));
}

function snapshot(user, cursor, sessionId = '') {
  return {
    schema_version: 'project_collaboration.v1',
    project_id: PROJECT_ID,
    session_id: sessionId,
    cursor: collaborationState.cursor,
    participants: activeParticipants(user.id),
    events: collaborationState.events.filter((event) => event.sequence > cursor),
  };
}

function eventStreamBody(cursor) {
  const events = collaborationState.events
    .filter((event) => event.sequence > cursor)
    .map((event) => `id: ${event.sequence}\nevent: ${event.event_type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join('');
  return events + `id: ${collaborationState.cursor}\nevent: collaboration_heartbeat\ndata: ${JSON.stringify({
    schema_version: 'project_collaboration.v1',
    project_id: PROJECT_ID,
    cursor: collaborationState.cursor,
  })}\n\n`;
}

async function installApiMocks(context, user) {
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    collaborationState.observedRequests.push(`${user.role} ${request.method()} ${pathname}`);

    if (pathname === `/api/project/${PROJECT_ID}/access`) {
      return jsonResponse(route, {
        role: user.role,
        can_read: true,
        can_write: user.role !== 'viewer',
        can_manage: user.role === 'owner',
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}/collaboration/presence`) {
      if (request.method() === 'DELETE') {
        const body = JSON.parse(request.postData() ?? '{}');
        const existing = collaborationState.sessions.get(body.client_id);
        if (existing) {
          collaborationState.sessions.delete(body.client_id);
          appendEvent(user, 'presence_left', existing.currentFile, '', {
            role: user.role,
            activity: existing.activity,
          });
        }
        return jsonResponse(route, { left: true });
      }
      const body = JSON.parse(request.postData() ?? '{}');
      const existing = collaborationState.sessions.get(body.client_id);
      const now = new Date().toISOString();
      const session = {
        sessionId: existing?.sessionId ?? randomUUID(),
        user,
        activity: body.activity,
        currentFile: body.current_file ?? '',
        joinedAt: existing?.joinedAt ?? now,
        lastSeenAt: now,
      };
      collaborationState.sessions.set(body.client_id, session);
      collaborationState.touchActivities.set(user.id, body.activity);
      if (!existing) {
        appendEvent(user, 'presence_joined', session.currentFile, '', {
          role: user.role,
          activity: session.activity,
        });
      } else if (existing.activity !== session.activity || existing.currentFile !== session.currentFile) {
        appendEvent(user, 'presence_updated', session.currentFile, '', {
          role: user.role,
          activity: session.activity,
        });
      }
      return jsonResponse(route, snapshot(user, Number(body.after_sequence ?? 0), session.sessionId));
    }

    if (pathname === `/api/project/${PROJECT_ID}/collaboration/state`) {
      return jsonResponse(
        route,
        snapshot(user, Number(url.searchParams.get('cursor') ?? 0), url.searchParams.get('session_id') ?? ''),
      );
    }

    if (pathname === `/api/project/${PROJECT_ID}/collaboration/events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: eventStreamBody(Number(url.searchParams.get('cursor') ?? 0)),
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}/files/content` && request.method() === 'GET') {
      collaborationState.readCounts.set(user.id, (collaborationState.readCounts.get(user.id) ?? 0) + 1);
      return jsonResponse(route, {
        path: FILE_PATH,
        content: collaborationState.fileContent,
        resource_revision: revision(collaborationState.fileContent),
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}/files/content` && request.method() === 'PUT') {
      const body = JSON.parse(request.postData() ?? '{}');
      const currentRevision = revision(collaborationState.fileContent);
      if (body.expected_revision && body.expected_revision !== currentRevision) {
        collaborationState.rejectedWrites.push({ userId: user.id, body });
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File changed since it was opened',
            reason_code: 'file_revision_conflict',
            data: {
              expected_revision: body.expected_revision,
              current_revision: currentRevision,
            },
          }),
        });
      }
      collaborationState.fileContent = String(body.content ?? '');
      const resourceRevision = revision(collaborationState.fileContent);
      appendEvent(user, 'file_saved', FILE_PATH, resourceRevision, {
        role: user.role,
        source: 'workspace',
        operation: 'write',
      });
      return jsonResponse(route, {
        path: FILE_PATH,
        write_status: 'saved',
        resource_revision: resourceRevision,
        collaboration_event_status: 'recorded',
        file_tree_status: 'updated',
        file_tree_status_label: 'File tree updated',
        commit_status: 'created',
        commit_status_label: 'Git snapshot created',
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}`) {
      return jsonResponse(route, {
        id: PROJECT_ID,
        project_id: PROJECT_ID,
        name: 'COLLAB-001 Browser Acceptance',
        description: 'Shared workspace acceptance project',
        app_type: 'web',
        tech_stack: '{}',
        container_status: 'ready',
        file_tree: '[]',
        git_branch: 'main',
        engineering_state: { bootstrap_state: { status: 'completed' } },
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
    if (pathname === `/api/project/${PROJECT_ID}/runtime-status`
      || pathname === `/api/project/${PROJECT_ID}/start`) {
      return jsonResponse(route, { project_id: PROJECT_ID, status: 'ready' });
    }
    if (pathname === `/api/project/${PROJECT_ID}/files`) {
      return jsonResponse(route, [{
        name: 'src',
        path: 'src',
        type: 'directory',
        children: [{ name: 'App.tsx', path: FILE_PATH, type: 'file' }],
      }]);
    }
    if (pathname === `/api/project/${PROJECT_ID}/worktree-status`) {
      return jsonResponse(route, { branch: 'main', files: [], clean: true });
    }
    if (/\/(branches|commits|remotes|remote-branches|tags|stashes)$/.test(pathname)) {
      return jsonResponse(route, []);
    }
    if (pathname === '/api/llm/providers') {
      return jsonResponse(route, { providers: [], default_name: '' });
    }
    return jsonResponse(route, {});
  });
}

async function createWorkspace(browser, baseURL, user, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ currentUser }) => {
    localStorage.setItem('yistack_token', `collab-token-${currentUser.role}`);
    localStorage.setItem('yistack_user', JSON.stringify({
      id: currentUser.id,
      username: currentUser.username,
      email: `${currentUser.role}@example.invalid`,
      role: 'user',
    }));
  }, { currentUser: user });
  await installApiMocks(context, user);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/workspace?projectId=${PROJECT_ID}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('workspace-collaboration-presence').waitFor({ state: 'visible' });
  return { context, page, errors };
}

async function openFile(page) {
  const sourceFolder = page.getByRole('button', { name: 'src', exact: true }).first();
  await sourceFolder.waitFor({ state: 'visible' });
  await sourceFolder.click();
  const file = page.getByRole('button', { name: 'App.tsx', exact: true }).first();
  try {
    await file.waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    const bodyText = (await page.locator('body').innerText()).slice(0, 4_000);
    throw new Error(
      `App.tsx was not rendered.\nRequests:\n${collaborationState.observedRequests.join('\n')}`
      + `\nBody:\n${bodyText}`,
      { cause: error },
    );
  }
  await file.click();
  await page.locator('.monaco-editor').first().waitFor({ state: 'visible', timeout: 45_000 });
}

async function setEditorContent(page, content) {
  const editor = page.locator('.monaco-editor').first();
  await editor.click({ position: { x: 160, y: 80 } });
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(content);
  await page.getByRole('button', { name: '保存', exact: true }).waitFor({ state: 'visible' });
}

async function waitUntil(check, message, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function editorText(page) {
  return page.locator('.monaco-editor .view-lines').first().innerText();
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

async function runDesktopAcceptance(browser, baseURL) {
  const owner = await createWorkspace(browser, baseURL, users.owner, { width: 1440, height: 900 });
  const editor = await createWorkspace(browser, baseURL, users.editor, { width: 1440, height: 900 });
  try {
    await openFile(owner.page);
    await openFile(editor.page);
    await owner.page.getByText('2 在线', { exact: true }).waitFor({ state: 'visible' });
    await editor.page.getByText('2 在线', { exact: true }).waitFor({ state: 'visible' });

    const editorReadsBeforeSync = collaborationState.readCounts.get(EDITOR_ID) ?? 0;
    await setEditorContent(owner.page, 'export const value = \"owner-v1\";\n');
    await owner.page.getByRole('button', { name: '保存', exact: true }).click();
    await waitUntil(
      () => (collaborationState.readCounts.get(EDITOR_ID) ?? 0) > editorReadsBeforeSync,
      'editor did not reload a clean file after the remote save event',
    );
    await waitUntil(
      async () => (await editorText(editor.page)).includes('owner-v1'),
      'editor did not render the remote file revision',
    );

    await setEditorContent(editor.page, 'export const value = \"editor-dirty\";\n');
    const editorReadsBeforeConflict = collaborationState.readCounts.get(EDITOR_ID) ?? 0;
    await setEditorContent(owner.page, 'export const value = \"owner-v2\";\n');
    await owner.page.getByRole('button', { name: '保存', exact: true }).click();
    const conflict = editor.page.getByTestId('workspace-collaboration-conflict');
    await conflict.waitFor({ state: 'visible' });
    assert.match(await conflict.innerText(), /本地未覆盖/);
    assert.equal(
      collaborationState.readCounts.get(EDITOR_ID) ?? 0,
      editorReadsBeforeConflict,
      'dirty editor must not fetch and overwrite the remote file',
    );
    assert.match(await editorText(editor.page), /editor-dirty/);

    await editor.page.getByRole('button', { name: '保存', exact: true }).click();
    await waitUntil(
      () => collaborationState.rejectedWrites.some((item) => item.userId === EDITOR_ID),
      'stale editor save did not reach the revision conflict guard',
    );
    assert.equal(collaborationState.fileContent, 'export const value = \"owner-v2\";\n');

    const screenshot = await screenshotEvidence(editor.page, 'collab001-desktop-conflict.png');
    assert.deepEqual(owner.errors, [], `owner console errors: ${owner.errors.join('; ')}`);
    const unexpectedEditorErrors = editor.errors.filter((message) => !message.includes('409 (Conflict)'));
    assert.deepEqual(unexpectedEditorErrors, [], `editor console errors: ${editor.errors.join('; ')}`);
    return {
      participants: collaborationState.sessions.size,
      rejectedWrites: collaborationState.rejectedWrites.length,
      editorReads: collaborationState.readCounts.get(EDITOR_ID) ?? 0,
      screenshot,
    };
  } finally {
    await owner.context.close();
    await editor.context.close();
  }
}

async function runMobileAcceptance(browser, baseURL) {
  const viewer = await createWorkspace(browser, baseURL, users.viewer, { width: 390, height: 844 });
  try {
    await waitUntil(
      () => collaborationState.touchActivities.get(VIEWER_ID) === 'viewing',
      'viewer presence did not remain read-only',
    );
    const dimensions = await viewer.page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.scrollWidth, dimensions.viewport, 'mobile workspace must not overflow horizontally');
    const screenshot = await screenshotEvidence(viewer.page, 'collab001-mobile.png');
    assert.deepEqual(viewer.errors, [], `viewer console errors: ${viewer.errors.join('; ')}`);
    return { ...dimensions, activity: collaborationState.touchActivities.get(VIEWER_ID), screenshot };
  } finally {
    await viewer.context.close();
  }
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('unable to allocate browser acceptance port');
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next server exited before readiness:\n${output.join('')}`);
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
  throw new Error('COLLAB-001 browser acceptance requires a completed `pnpm build` first');
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
    path.join(evidenceDir, 'collab001-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(`[COLLAB-001] Browser acceptance passed: ${JSON.stringify(result)}`);
} finally {
  await browser?.close();
  await stopServer(nextServer);
}
