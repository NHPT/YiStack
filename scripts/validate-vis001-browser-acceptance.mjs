#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { chromium } from '@playwright/test';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHgQCAfXOs4kAAAAASUVORK5CYII=';
const PNG_BUFFER = Buffer.from(PNG_BASE64, 'base64');
const PROJECT_ID = 'proj-vis001-browser';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const evidenceDir = path.resolve('runtime/browser-acceptance');

const visualContext = {
  schema_version: 'visual_context.v1',
  id: 'visual-context-browser',
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
    name: 'history.png',
    content_type: 'image/png',
    size: PNG_BUFFER.length,
    sha256: createHash('sha256').update(PNG_BUFFER).digest('hex'),
    width: 2,
    height: 2,
  }],
  provider: 'vision::vision-model',
  model: 'vision-model',
  analyzed_at: '2026-09-01T10:00:00Z',
};

const plan = {
  id: 'plan-vis001',
  project_id: PROJECT_ID,
  name: 'Visual Plan',
  description: 'Reference-driven dashboard',
  tech_stack: { runtime: { profile: 'nextjs' } },
  architecture: 'Responsive dashboard',
  complexity: 'medium',
  est_files: 8,
  features: ['Dashboard'],
  reasoning: 'Matches the reference image',
  visual_context: visualContext,
};

function jsonResponse(route, data) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}


async function screenshotEvidence(filePath) {
  const content = await fs.readFile(filePath);
  return {
    path: path.relative(process.cwd(), filePath).split(path.sep).join('/'),
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}
async function installApiMocks(context) {
  const observedRequests = [];
  const generatePayloads = [];
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    observedRequests.push(`${request.method()} ${pathname}`);

    if ((pathname === '/api/chat/generate' || pathname === '/api/project/plans')
      && request.method() === 'POST') {
      generatePayloads.push(JSON.parse(request.postData() ?? '{}'));
      const donePayload = pathname === '/api/project/plans'
        ? { plans: [plan], analysis: 'Visual plan ready' }
        : { message: 'done', mode: 'implement', files: [] };
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `event: visual_context\ndata: ${JSON.stringify({ visual_context: visualContext })}\n\n`
          + `event: done\ndata: ${JSON.stringify(donePayload)}\n\n`,
      });
    }

    if (pathname === '/api/llm/providers') {
      return jsonResponse(route, {
        providers: [{
          id: 1,
          name: 'vision',
          display_name: 'Vision Provider',
          type: 'cloud',
          model: 'vision-model',
          is_default: true,
          models: [
            {
              id: 1,
              provider_id: 1,
              model_id: 'vision-model',
              display_name: 'Vision Model',
              enabled: true,
              is_default: true,
              capability_tags: 'chat,vision',
              runtime_id: 'vision::vision-model',
              runtime_loaded: true,
              runtime_active: true,
            },
            {
              id: 2,
              provider_id: 1,
              model_id: 'text-model',
              display_name: 'Text Model',
              enabled: true,
              is_default: false,
              capability_tags: 'chat,coding',
              runtime_id: 'vision::text-model',
              runtime_loaded: true,
              runtime_active: false,
            },
          ],
        }],
        default_name: 'vision::vision-model',
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}`) {
      return jsonResponse(route, {
        id: PROJECT_ID,
        project_id: PROJECT_ID,
        name: 'VIS-001 Browser Acceptance',
        description: 'Build a dashboard from the supplied reference image',
        app_type: 'web',
        tech_stack: '{}',
        plan_id: plan.id,
        plan_data: JSON.stringify(plan),
        container_status: 'stopped',
        file_tree: '[]',
        git_branch: 'main',
        engineering_state: { bootstrap_state: { status: 'completed' } },
      });
    }

    if (pathname === `/api/project/${PROJECT_ID}/messages`) {
      return jsonResponse(route, [{
        id: 1,
        project_id: PROJECT_ID,
        user_id: USER_ID,
        role: 'user',
        content: 'Use this persisted reference',
        visual_attachments: JSON.stringify([{
          name: 'history.png',
          content_type: 'image/png',
          size: PNG_BUFFER.length,
          data_url: `data:image/png;base64,${PNG_BASE64}`,
        }]),
        visual_context: JSON.stringify(visualContext),
        created_at: '2026-09-01T10:00:00Z',
      }]);
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
      return jsonResponse(route, { project_id: PROJECT_ID, status: 'stopped' });
    }

    if (pathname === `/api/project/${PROJECT_ID}/files`
      || /\/(branches|commits|remotes|remote-branches|tags|stashes)$/.test(pathname)) {
      return jsonResponse(route, []);
    }

    if (pathname === `/api/project/${PROJECT_ID}/worktree-status`) {
      return jsonResponse(route, { branch: 'main', files: [], clean: true });
    }

    return jsonResponse(route, {});
  });
  return { observedRequests, generatePayloads };
}

async function createAuthenticatedContext(browser, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ userId }) => {
    localStorage.setItem('yistack_token', 'vis001-browser-test-token');
    localStorage.setItem('yistack_user', JSON.stringify({
      id: userId,
      username: 'visual-user',
      email: 'visual@example.com',
      role: 'user',
    }));
  }, { userId: USER_ID });
  return context;
}

async function openWorkspace(browser, baseURL, viewport) {
  const context = await createAuthenticatedContext(browser, viewport);
  const apiEvidence = await installApiMocks(context);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/workspace?projectId=${PROJECT_ID}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('textarea:visible').first().waitFor({ state: 'visible' });
  await page.getByLabel('视觉参考图：history.png').waitFor({ state: 'visible' });
  return { context, page, errors, ...apiEvidence };
}

async function pasteImage(page, name) {
  await page.locator('textarea:visible').first().evaluate((textarea, input) => {
    const binary = atob(input.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], input.name, { type: 'image/png' }));
    textarea.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer,
    }));
  }, { base64: PNG_BASE64, name });
}

async function runDesktopAcceptance(browser, baseURL) {
  const { context, page, errors, observedRequests, generatePayloads } = await openWorkspace(
    browser,
    baseURL,
    { width: 1440, height: 900 },
  );
  try {
    const imageInput = page.getByTestId('workspace-chat-image-input').first();
    await imageInput.setInputFiles({
      name: 'upload.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    await page.getByLabel('图片预览：upload.png').waitFor({ state: 'visible' });

    await pasteImage(page, 'pasted.png');
    await page.getByLabel('图片预览：pasted.png').waitFor({ state: 'visible' });

    const sendButton = page.getByTestId('workspace-chat-send').first();
    assert.equal(await sendButton.isEnabled(), true, 'vision model should allow image-only submission');
    await sendButton.click();
    await page.getByLabel('视觉参考图：upload.png').waitFor({ state: 'visible' });
    const submissionDeadline = Date.now() + 10_000;
    let submittedPayload;
    while (submittedPayload === undefined && Date.now() < submissionDeadline) {
      submittedPayload = generatePayloads.find((payload) => (
        Array.isArray(payload.visual_attachments) && payload.visual_attachments.length === 2
      ));
      if (submittedPayload === undefined) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    assert.ok(submittedPayload, `image-only submission must include both visual attachments: ${JSON.stringify(generatePayloads)}`);
    assert.equal(submittedPayload.prompt, '请根据附带的视觉参考继续当前任务。');
    const requestCountAfterVisionSubmit = generatePayloads.length;
    await page.getByLabel(/^图片预览：/).first().waitFor({ state: 'detached' });

    await imageInput.setInputFiles({
      name: 'blocked.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    await page.getByLabel('图片预览：blocked.png').waitFor({ state: 'visible' });

    await page.getByTestId('workspace-chat-model-trigger').first().click();
    await page.getByRole('button', { name: /Text Model/ }).click();
    await page.getByText('当前模型不支持图片输入。请选择标记为支持视觉的模型后再发送。').first().waitFor();
    assert.equal(await sendButton.isDisabled(), true, 'text-only model must block image submission');

    await imageInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await page.locator('p:visible').filter({ hasText: '仅支持 PNG 或 JPEG 图片' }).first().waitFor();
    assert.equal(await page.getByLabel(/^图片预览：/).count(), 1, 'invalid input must preserve accepted attachments');

    const screenshotPath = path.join(evidenceDir, 'vis001-desktop.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshot = await screenshotEvidence(screenshotPath);
    assert.deepEqual(errors, [], `desktop console errors: ${errors.join('; ')}`);
    assert.equal(generatePayloads.length, requestCountAfterVisionSubmit, 'blocked submission must not reach generation API');
    assert.equal(
      observedRequests.includes('POST /api/chat/generate')
        || observedRequests.includes('POST /api/project/plans'),
      true,
      'vision submission must reach a generation endpoint',
    );
    return {
      submittedAttachmentCount: submittedPayload.visual_attachments.length,
      retainedAttachmentCount: await page.getByLabel(/^图片预览：/).count(),
      unsupportedModelBlocked: await sendButton.isDisabled(),
      invalidMimeRejected: await page.locator('p:visible').filter({ hasText: '仅支持 PNG 或 JPEG 图片' }).first().isVisible(),
      screenshot,
    };
  } finally {
    await context.close();
  }
}

async function runMobileAcceptance(browser, baseURL) {
  const { context, page, errors } = await openWorkspace(
    browser,
    baseURL,
    { width: 390, height: 844 },
  );
  try {
    const imageInput = page.getByTestId('workspace-chat-image-input').first();
    await imageInput.setInputFiles({
      name: 'mobile.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    await page.getByLabel('图片预览：mobile.png').waitFor({ state: 'visible' });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.equal(dimensions.scrollWidth, dimensions.viewport, 'mobile workspace must not overflow horizontally');
    const screenshotPath = path.join(evidenceDir, 'vis001-mobile.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const screenshot = await screenshotEvidence(screenshotPath);
    assert.deepEqual(errors, [], `mobile console errors: ${errors.join('; ')}`);
    return { ...dimensions, screenshot };
  } finally {
    await context.close();
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
      // The server is still starting.
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
  throw new Error('VIS-001 browser acceptance requires a completed `pnpm build` first');
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
  const mobileViewport = await runMobileAcceptance(browser, baseURL);
  const result = {
    status: 'passed',
    desktopSubmittedAttachments: desktop.submittedAttachmentCount,
    desktopRetainedAttachments: desktop.retainedAttachmentCount,
    unsupportedModelBlocked: desktop.unsupportedModelBlocked,
    invalidMimeRejected: desktop.invalidMimeRejected,
    desktopScreenshot: desktop.screenshot,
    mobileViewport,
  };
  await fs.writeFile(
    path.join(evidenceDir, 'vis001-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(`[VIS-001] Browser acceptance passed: ${JSON.stringify(result)}`);
} finally {
  await browser?.close();
  await stopServer(nextServer);
}
