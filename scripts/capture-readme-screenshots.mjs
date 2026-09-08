#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { chromium } from '@playwright/test';

const PROJECT_ID = 'readme-launchboard';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const SCREENSHOT_DIR = path.resolve('docs/assets/screenshots');
const VIEWPORT = { width: 1600, height: 1000 };
const CJK_FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
];

const fileTree = [
  {
    name: 'src',
    path: 'src',
    type: 'directory',
    children: [
      {
        name: 'app',
        path: 'src/app',
        type: 'directory',
        children: [
          { name: 'page.tsx', path: 'src/app/page.tsx', type: 'file' },
          { name: 'globals.css', path: 'src/app/globals.css', type: 'file' },
        ],
      },
      {
        name: 'components',
        path: 'src/components',
        type: 'directory',
        children: [
          { name: 'metric-card.tsx', path: 'src/components/metric-card.tsx', type: 'file' },
          { name: 'release-table.tsx', path: 'src/components/release-table.tsx', type: 'file' },
        ],
      },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'README.md', path: 'README.md', type: 'file' },
];

const previewDocument = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Launchboard</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #f4f4f5;
      background: #09090b;
      font: 14px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    main { min-height: 100vh; padding: 28px; }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 22px;
      border-bottom: 1px solid #27272a;
    }
    h1 { margin: 0; font-size: 28px; line-height: 1.1; }
    .subtitle { margin: 5px 0 0; color: #a1a1aa; }
    .status {
      padding: 7px 10px;
      color: #86efac;
      background: #052e16;
      border: 1px solid #166534;
      border-radius: 6px;
      white-space: nowrap;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-top: 22px;
    }
    .metric, .release {
      border: 1px solid #27272a;
      border-radius: 6px;
      background: #111113;
    }
    .metric { padding: 18px; }
    .label { color: #a1a1aa; }
    .value { margin-top: 8px; font-size: 27px; font-weight: 700; }
    .trend { margin-top: 7px; color: #34d399; font-size: 12px; }
    .release { margin-top: 18px; overflow: hidden; }
    .release h2 {
      margin: 0;
      padding: 15px 18px;
      border-bottom: 1px solid #27272a;
      font-size: 16px;
    }
    .row {
      display: grid;
      grid-template-columns: 1.2fr 1fr .8fr;
      gap: 12px;
      padding: 13px 18px;
      border-bottom: 1px solid #27272a;
    }
    .row:last-child { border-bottom: 0; }
    .healthy { color: #34d399; }
    .review { color: #facc15; }
    @media (max-width: 620px) {
      main { padding: 20px 16px; }
      header { align-items: stretch; flex-direction: column; }
      .status { align-self: flex-start; }
      .metrics { grid-template-columns: 1fr; gap: 10px; margin-top: 16px; }
      .metric { padding: 14px; }
      .release { margin-top: 12px; }
      .row { grid-template-columns: 1fr auto; padding: 12px 14px; }
      .row span:nth-child(2) { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Launchboard</h1>
        <p class="subtitle">Release operations overview</p>
      </div>
      <span class="status">All systems operational</span>
    </header>
    <section class="metrics">
      <article class="metric">
        <div class="label">Active users</div>
        <div class="value">24,892</div>
        <div class="trend">+12.8% this week</div>
      </article>
      <article class="metric">
        <div class="label">Conversion</div>
        <div class="value">18.4%</div>
        <div class="trend">+2.1% this week</div>
      </article>
      <article class="metric">
        <div class="label">Deploy health</div>
        <div class="value">99.98%</div>
        <div class="trend">12 checks passed</div>
      </article>
    </section>
    <section class="release">
      <h2>Recent releases</h2>
      <div class="row"><span>v2.8.0</span><span>Production</span><span class="healthy">Healthy</span></div>
      <div class="row"><span>v2.8.1-rc.2</span><span>Staging</span><span class="healthy">Verified</span></div>
      <div class="row"><span>feature/insights</span><span>Preview</span><span class="review">Review</span></div>
    </section>
  </main>
</body>
</html>`;

function jsonResponse(route, data) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function readCjkFontData() {
  for (const fontPath of CJK_FONT_CANDIDATES) {
    const content = await fs.readFile(fontPath).catch(() => null);
    if (content !== null) {
      return content.toString('base64');
    }
  }
  throw new Error(
    `README screenshot capture requires a CJK font: ${CJK_FONT_CANDIDATES.join(', ')}`,
  );
}

function projectPayload() {
  return {
    id: PROJECT_ID,
    project_id: PROJECT_ID,
    name: 'Launchboard',
    description: 'Release operations dashboard',
    app_type: 'web',
    tech_stack: JSON.stringify({
      runtime: { profile: 'node-nextjs' },
      frontend: { framework: 'Next.js' },
      summary: ['Next.js', 'TypeScript', 'Tailwind CSS'],
    }),
    plan_id: 'production-dashboard',
    plan_data: JSON.stringify({
      id: 'production-dashboard',
      name: 'Production dashboard',
      description: 'A responsive release operations dashboard.',
      tech_stack: ['Next.js', 'TypeScript', 'Tailwind CSS'],
      architecture: 'Responsive dashboard with reusable metrics and release views.',
      complexity: 'medium',
      est_files: 18,
      features: ['Metrics', 'Release status', 'Responsive layout'],
      reasoning: 'Keeps operational status easy to scan.',
    }),
    container_status: 'running',
    preview_url: 'http://127.0.0.1:5000/demo-preview',
    git_branch: 'main',
    access_role: 'owner',
    can_write: true,
    can_manage_members: true,
    file_tree: JSON.stringify(fileTree),
    engineering_state: {
      bootstrap_state: { status: 'completed' },
      execution: { phase: 'completed', next_action: 'Review the verified result' },
      runtime: { status: 'passed' },
    },
  };
}

async function installMocks(context) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/demo-preview') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: previewDocument,
      });
    }

    if (pathname === '/api/llm/providers') {
      return jsonResponse(route, {
        providers: [{
          id: 1,
          name: 'readme-demo',
          display_name: 'YiStack Demo',
          type: 'local',
          model: 'deterministic',
          is_default: true,
          models: [{
            id: 1,
            provider_id: 1,
            model_id: 'deterministic',
            display_name: 'Deterministic Demo',
            enabled: true,
            is_default: true,
            capability_tags: 'chat,coding',
            runtime_id: 'readme-demo::deterministic',
            runtime_loaded: true,
            runtime_active: true,
          }],
        }],
        default_name: 'readme-demo::deterministic',
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}`) {
      return jsonResponse(route, projectPayload());
    }
    if (pathname === `/api/project/${PROJECT_ID}/access`) {
      return jsonResponse(route, {
        role: 'owner',
        can_read: true,
        can_write: true,
        can_manage: true,
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/messages`) {
      return jsonResponse(route, [
        {
          id: 1,
          project_id: PROJECT_ID,
          user_id: USER_ID,
          role: 'user',
          content: '构建一个面向产品团队的实时发布运营看板，包含核心指标、发布节奏与风险状态。',
          created_at: '2026-09-07T08:06:00Z',
        },
        {
          id: 2,
          project_id: PROJECT_ID,
          role: 'assistant',
          content: 'Launchboard 已生成并通过 Build、Test、Lint 与浏览器验收。',
          created_at: '2026-09-07T08:06:20Z',
        },
      ]);
    }
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
      return jsonResponse(route, {
        projectId: PROJECT_ID,
        project_id: PROJECT_ID,
        status: 'ready',
        phase: 'ready',
        containerStatus: 'running',
        container_status: 'running',
        previewUrl: 'http://127.0.0.1:5000/demo-preview',
        preview_url: 'http://127.0.0.1:5000/demo-preview',
        message: 'Preview service is ready',
        updatedAt: '2026-09-07T08:06:30Z',
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/runtime-activity`) {
      return jsonResponse(route, { touched: true });
    }
    if (pathname === `/api/project/${PROJECT_ID}/files`) {
      return jsonResponse(route, fileTree);
    }
    if (pathname === `/api/project/${PROJECT_ID}/worktree-status`) {
      return jsonResponse(route, { branch: 'main', files: [], clean: true });
    }
    if (pathname === `/api/project/${PROJECT_ID}/commits`) {
      return jsonResponse(route, []);
    }
    if (/\/(branches|remotes|remote-branches|tags|stashes)$/.test(pathname)) {
      return jsonResponse(route, []);
    }
    if (pathname === `/api/project/${PROJECT_ID}/terminal/ws-ticket`) {
      return jsonResponse(route, { ticket: 'readme-terminal-ticket' });
    }
    if (pathname === `/api/project/${PROJECT_ID}/collaboration/presence`) {
      return jsonResponse(route, {
        schema_version: 'project_collaboration.v1',
        project_id: PROJECT_ID,
        session_id: 'readme-owner-session',
        cursor: 0,
        participants: [{
          session_id: 'readme-owner-session',
          user_id: USER_ID,
          username: 'Demo Owner',
          role: 'owner',
          activity: 'viewing',
          current_file: '',
          is_self: true,
          joined_at: '2026-09-07T08:06:00Z',
          last_seen_at: '2026-09-07T08:06:30Z',
          expires_at: '2026-09-07T08:07:15Z',
        }],
        events: [],
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/collaboration/state`) {
      return jsonResponse(route, {
        schema_version: 'project_collaboration.v1',
        project_id: PROJECT_ID,
        session_id: 'readme-owner-session',
        cursor: 0,
        participants: [],
        events: [],
      });
    }
    if (pathname === `/api/project/${PROJECT_ID}/collaboration/events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: collaboration_heartbeat\ndata: {"schema_version":"project_collaboration.v1","cursor":0}\n\n',
      });
    }
    if (pathname.startsWith('/api/')) {
      return jsonResponse(route, {});
    }

    return route.continue();
  });

  await context.routeWebSocket(
    (url) => url.pathname.endsWith('/api/project/terminal/ws'),
    (socket) => {
      socket.onMessage(() => {});
      setTimeout(() => {
        socket.send(JSON.stringify({
          type: 'ready',
          sessionId: 'readme-terminal-session',
        }));
        socket.send(JSON.stringify({
          type: 'output',
          data: '\u001b[32m/workspace\u001b[0m $ pnpm test\r\n'
            + '\u001b[32mPASS\u001b[0m 48 tests passed in 3.2s\r\n\r\n'
            + '\u001b[32m/workspace\u001b[0m $ pnpm build\r\n'
            + '\u001b[32mSUCCESS\u001b[0m production build completed\r\n\r\n'
            + '\u001b[32m/workspace\u001b[0m $ git status --short\r\n'
            + '\u001b[90mworking tree clean\u001b[0m\r\n'
            + '\u001b[32m/workspace\u001b[0m $ ',
        }));
      }, 150);
    },
  );
}

async function createWorkspace(browser, baseURL, cjkFontData) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    colorScheme: 'light',
  });
  await context.addInitScript(({ projectId, userId }) => {
    localStorage.setItem('yistack_token', 'readme-screenshot-token');
    localStorage.setItem('yistack_user', JSON.stringify({
      id: userId,
      username: 'Demo Owner',
      email: 'owner@example.invalid',
      role: 'user',
    }));
    localStorage.setItem('yistack_current_project', JSON.stringify({
      id: projectId,
      project_id: projectId,
      name: 'Launchboard',
    }));
  }, { projectId: PROJECT_ID, userId: USER_ID });
  await installMocks(context);

  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/workspace?projectId=${PROJECT_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.addStyleTag({
    content: `
      @font-face {
        font-family: "YiStack Screenshot CJK";
        src: url(data:font/ttf;base64,${cjkFontData}) format("truetype");
        font-style: normal;
        font-weight: 100 900;
      }
      @font-face {
        font-family: "SFMono-Regular";
        src: url(data:font/ttf;base64,${cjkFontData}) format("truetype");
        font-style: normal;
        font-weight: 100 900;
      }
      :root, body, button, input, textarea {
        font-family: "YiStack Screenshot CJK", sans-serif !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.getByText('Launchboard', { exact: true }).first().waitFor({ state: 'visible' });
  await page.getByText('运行与预览', { exact: true }).last().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  return { context, page, errors };
}

async function captureTerminal(browser, baseURL, cjkFontData) {
  const workspace = await createWorkspace(browser, baseURL, cjkFontData);
  try {
    await workspace.page.getByRole('button', { name: '终端', exact: true }).click();
    await workspace.page.getByText('容器 PTY 已连接', { exact: true }).waitFor({
      state: 'visible',
      timeout: 15_000,
    });
    await workspace.page.waitForTimeout(500);
    const outputPath = path.join(SCREENSHOT_DIR, 'terminal-session.png');
    await workspace.page.screenshot({ path: outputPath });
    const stat = await fs.stat(outputPath);
    assert.ok(stat.size > 50_000, 'terminal screenshot is unexpectedly small');
    assert.deepEqual(workspace.errors, [], `terminal page errors: ${workspace.errors.join('; ')}`);
  } finally {
    await workspace.context.close();
  }
}

async function captureMobilePreview(browser, baseURL, cjkFontData) {
  const workspace = await createWorkspace(browser, baseURL, cjkFontData);
  try {
    await workspace.page.getByRole('button', { name: '预览', exact: true }).click();
    const previewFrame = workspace.page.locator('iframe[title="预览"]');
    await previewFrame.waitFor({ state: 'visible', timeout: 15_000 });
    await workspace.page.locator('button:has(svg.lucide-smartphone)').click();
    await previewFrame.contentFrame().getByText('Launchboard', { exact: true }).waitFor({
      state: 'visible',
      timeout: 15_000,
    });
    const frameBox = await previewFrame.boundingBox();
    assert.ok(frameBox !== null, 'mobile preview frame is missing');
    assert.ok(frameBox.width >= 360 && frameBox.width <= 390, `unexpected mobile preview width: ${frameBox.width}`);
    await workspace.page.waitForTimeout(300);
    const outputPath = path.join(SCREENSHOT_DIR, 'mobile-preview.png');
    await workspace.page.screenshot({ path: outputPath });
    const stat = await fs.stat(outputPath);
    assert.ok(stat.size > 50_000, 'mobile preview screenshot is unexpectedly small');
    assert.deepEqual(workspace.errors, [], `mobile preview page errors: ${workspace.errors.join('; ')}`);
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
  assert.ok(address !== null && typeof address !== 'string', 'unable to allocate screenshot port');
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
      if (response.ok) {
        return;
      }
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready:\n${output.join('')}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

if (await fs.stat(path.resolve('.next/BUILD_ID')).catch(() => null) === null) {
  throw new Error('README screenshot capture requires a completed `pnpm build` first');
}

await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
const port = await allocatePort();
const baseURL = `http://127.0.0.1:${port}`;
const serverOutput = [];
const nextServer = spawn(
  path.resolve('node_modules/.bin/next'),
  ['start', '-H', '127.0.0.1', '-p', String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
nextServer.stdout.on('data', (chunk) => serverOutput.push(chunk.toString()));
nextServer.stderr.on('data', (chunk) => serverOutput.push(chunk.toString()));

let browser;
try {
  await waitForServer(`${baseURL}/auth`, nextServer, serverOutput);
  const cjkFontData = await readCjkFontData();
  browser = await chromium.launch({ headless: true });
  await captureTerminal(browser, baseURL, cjkFontData);
  await captureMobilePreview(browser, baseURL, cjkFontData);
} finally {
  await browser?.close();
  await stopServer(nextServer);
}

console.log('[docs] README terminal and mobile Preview screenshots captured.');
