import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

export const browserAcceptanceSchemaVersion = 'browser_acceptance.v1';

const criticalResourceTypes = new Set(['document', 'fetch', 'font', 'script', 'stylesheet', 'xhr']);

function safeIdentifier(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) {
    throw new Error(`${fieldName} must be a safe identifier`);
  }
  return normalized;
}

function boundedTimeout(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 45_000;
  return Math.min(Math.max(parsed, 5_000), 120_000);
}

function isPrivateIPv4(hostname) {
  const values = hostname.split('.').map((value) => Number.parseInt(value, 10));
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return values[0] === 10
    || values[0] === 127
    || (values[0] === 169 && values[1] === 254)
    || (values[0] === 172 && values[1] >= 16 && values[1] <= 31)
    || (values[0] === 192 && values[1] === 168);
}

function validateTargetURL(rawURL) {
  const target = new URL(String(rawURL ?? '').trim());
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('url protocol must be http or https');
  const allowlist = new Set(
    String(process.env.BROWSER_ACCEPTANCE_TARGET_ALLOWLIST ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const hostname = target.hostname.toLowerCase();
  if (hostname !== 'localhost' && hostname !== '::1' && !isPrivateIPv4(hostname) && !allowlist.has(hostname)) {
    throw new Error(`url hostname is not allowed: ${hostname}`);
  }
  target.username = '';
  target.password = '';
  return target;
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 20);
}

function normalizeActions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((action, index) => {
    const type = String(action?.type ?? '').trim();
    const selector = String(action?.selector ?? '').trim();
    if (!['click', 'fill'].includes(type) || selector.length === 0 || selector.length > 512) {
      throw new Error(`actions[${index}] is invalid`);
    }
    return {
      type,
      selector,
      text: String(action?.text ?? '').slice(0, 4_096),
      expect_text: String(action?.expect_text ?? '').trim(),
    };
  });
}

function relativeArtifactPath(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

async function fileEvidence(filePath) {
  const content = await fs.readFile(filePath);
  return {
    path: relativeArtifactPath(filePath),
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

async function executeActions(page, actions) {
  const results = [];
  for (const action of actions) {
    const startedAt = Date.now();
    try {
      const locator = page.locator(action.selector).first();
      await locator.waitFor({ state: 'visible', timeout: 10_000 });
      if (action.type === 'fill') await locator.fill(action.text);
      else await locator.click();
      if (action.expect_text) {
        await page.getByText(action.expect_text, { exact: false }).first().waitFor({ state: 'visible', timeout: 10_000 });
      }
      results.push({ type: action.type, selector: action.selector, status: 'passed', duration_ms: Date.now() - startedAt });
    } catch (error) {
      results.push({
        type: action.type,
        selector: action.selector,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startedAt,
      });
    }
  }
  return results;
}

function visibleRequiredTextLocator(page, text) {
  return page.getByText(text, { exact: false }).filter({ visible: true });
}

async function waitForRequiredText(page, requiredText, timeoutMs) {
  const deadline = Date.now() + Math.min(timeoutMs, 10_000);
  for (const text of requiredText) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    try {
      await visibleRequiredTextLocator(page, text).first().waitFor({
        state: 'visible',
        timeout: remaining,
      });
    } catch {
      // Missing text is recorded below with the rest of the browser evidence.
    }
  }
}

export async function runBrowserAcceptance(input) {
  const jobId = safeIdentifier(input?.job_id, 'job_id');
  const projectId = safeIdentifier(input?.project_id, 'project_id');
  const targetURL = validateTargetURL(input?.url);
  const timeoutMs = boundedTimeout(input?.timeout_ms);
  const requiredText = normalizeTextList(input?.required_text);
  const actions = normalizeActions(input?.actions);
  const evidenceId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  const evidenceRoot = path.resolve(process.env.YISTACK_BROWSER_EVIDENCE_DIR ?? 'runtime/generation-evidence');
  const evidenceDir = path.join(evidenceRoot, jobId, evidenceId);
  const screenshotPath = path.join(evidenceDir, 'screenshot.png');
  const resultPath = path.join(evidenceDir, 'result.json');
  await fs.mkdir(evidenceDir, { recursive: true, mode: 0o750 });

  const startedAt = new Date();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const failedRequests = [];
  const missingRequiredText = [];
  const blockingErrors = [];
  let actionsResult = [];
  let navigationStatus = 0;
  let finalURL = targetURL.toString();
  let browserVersion = '';
  let screenshot = null;
  let dom = { title: '', html_length: 0, body_text_length: 0, root_visible: false };
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    browserVersion = browser.version();
    const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(Math.min(timeoutMs, 30_000));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push({ text: message.text(), location: message.location() });
    });
    page.on('pageerror', (error) => pageErrors.push({ name: error.name, message: error.message, stack: error.stack ?? '' }));
    page.on('response', (response) => {
      const request = response.request();
      if (response.status() >= 400 && criticalResourceTypes.has(request.resourceType())) {
        failedResponses.push({ url: response.url(), method: request.method(), status: response.status(), resource_type: request.resourceType() });
      }
    });
    page.on('requestfailed', (request) => {
      if (criticalResourceTypes.has(request.resourceType())) {
        failedRequests.push({ url: request.url(), method: request.method(), resource_type: request.resourceType(), error: request.failure()?.errorText ?? 'request failed' });
      }
    });

    const response = await page.goto(targetURL.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    navigationStatus = response?.status() ?? 0;
    try {
      await page.waitForLoadState('networkidle', { timeout: Math.min(timeoutMs, 15_000) });
    } catch {
      // Development HMR and long polling can keep the network active.
    }
    actionsResult = await executeActions(page, actions);
    await waitForRequiredText(page, requiredText, timeoutMs);
    finalURL = page.url();
    dom = await page.evaluate(() => {
      const root = document.querySelector('#root, #__next, main, body');
      const style = root ? window.getComputedStyle(root) : null;
      const rect = root?.getBoundingClientRect();
      return {
        title: document.title,
        html_length: document.documentElement?.outerHTML?.length ?? 0,
        body_text_length: document.body?.innerText?.trim().length ?? 0,
        root_visible: Boolean(root && style && style.display !== 'none' && style.visibility !== 'hidden' && rect && rect.width > 0 && rect.height > 0),
      };
    });
    for (const text of requiredText) {
      if (await visibleRequiredTextLocator(page, text).count() === 0) {
        missingRequiredText.push(text);
      }
    }
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshot = await fileEvidence(screenshotPath);
    await context.close();
  } catch (error) {
    blockingErrors.push({ source: 'navigation', message: error instanceof Error ? error.message : String(error) });
  } finally {
    await browser?.close();
  }

  if (navigationStatus >= 400 || navigationStatus === 0) blockingErrors.push({ source: 'navigation_status', message: `navigation returned status ${navigationStatus}` });
  if (dom.html_length === 0 || dom.body_text_length === 0 || dom.root_visible === false) blockingErrors.push({ source: 'dom', message: 'page root is empty or not visible' });
  for (const item of consoleErrors) blockingErrors.push({ source: 'console', message: item.text });
  for (const item of pageErrors) blockingErrors.push({ source: 'pageerror', message: item.message });
  for (const item of failedResponses) blockingErrors.push({ source: 'network_response', message: `${item.status} ${item.method} ${item.url}` });
  for (const item of failedRequests) blockingErrors.push({ source: 'network_request', message: `${item.error}: ${item.method} ${item.url}` });
  for (const text of missingRequiredText) blockingErrors.push({ source: 'required_text', message: `missing required text: ${text}` });
  for (const action of actionsResult) {
    if (action.status === 'failed') blockingErrors.push({ source: 'smoke_action', message: `${action.type} ${action.selector}: ${action.error}` });
  }
  if (screenshot === null) blockingErrors.push({ source: 'screenshot', message: 'browser screenshot was not created' });

  const completedAt = new Date();
  const result = {
    schema_version: browserAcceptanceSchemaVersion,
    evidence_id: evidenceId,
    job_id: jobId,
    project_id: projectId,
    status: blockingErrors.length === 0 ? 'passed' : 'failed',
    requested_url: targetURL.toString(),
    final_url: finalURL,
    navigation_status: navigationStatus,
    browser: { name: 'chromium', version: browserVersion },
    dom,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    failed_responses: failedResponses,
    failed_requests: failedRequests,
    required_text: requiredText,
    missing_required_text: missingRequiredText,
    actions: actionsResult,
    blocking_errors: blockingErrors,
    screenshot,
    result_path: relativeArtifactPath(resultPath),
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms: completedAt.getTime() - startedAt.getTime(),
  };
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o640 });
  return result;
}
