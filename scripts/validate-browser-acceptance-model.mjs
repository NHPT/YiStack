#!/usr/bin/env node

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { runBrowserAcceptance } from './lib/browser-acceptance.mjs';

const evidenceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yistack-browser-evidence-'));
process.env.YISTACK_BROWSER_EVIDENCE_DIR = evidenceRoot;

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (request.url === '/fail') {
    response.end('<!doctype html><main><h1>Failure fixture</h1></main><script>console.error("blocking fixture error")</script>');
    return;
  }
  if (request.url === '/delayed') {
    response.end(`<!doctype html>
      <main><p>Loading fixture...</p></main>
      <script>setTimeout(()=>document.querySelector('main').innerHTML='<h1>Delayed fixture ready</h1>',250)</script>`);
    return;
  }
  if (request.url === '/hidden') {
    response.end('<!doctype html><main><h1>Visible fixture</h1><p hidden>Hidden required text</p></main>');
    return;
  }
  response.end(`<!doctype html>
    <main><h1>Browser acceptance ready</h1><button data-testid="fixture-action">Run</button><p id="result"></p></main>
    <script>document.querySelector('button').onclick=()=>document.querySelector('#result').textContent='Interaction passed'</script>`);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string') throw new Error('fixture server address is unavailable');
const baseURL = `http://127.0.0.1:${address.port}`;

try {
  await assert.rejects(
    runBrowserAcceptance({ job_id: 'blocked-target', project_id: 'fixture-project', url: 'https://example.com' }),
    /url hostname is not allowed/,
  );
  const passed = await runBrowserAcceptance({
    job_id: 'fixture-pass',
    project_id: 'fixture-project',
    url: `${baseURL}/pass`,
    timeout_ms: 15_000,
    required_text: ['Browser acceptance ready'],
    actions: [{ type: 'click', selector: '[data-testid="fixture-action"]', expect_text: 'Interaction passed' }],
  });
  assert.equal(passed.schema_version, 'browser_acceptance.v1');
  assert.equal(passed.status, 'passed');
  assert.equal(passed.navigation_status, 200);
  assert.equal(passed.dom.root_visible, true);
  assert.equal(passed.blocking_errors.length, 0);
  assert.ok(passed.screenshot?.sha256);
  assert.equal((await fs.stat(passed.screenshot.path)).isFile(), true);

  const delayed = await runBrowserAcceptance({
    job_id: 'fixture-delayed',
    project_id: 'fixture-project',
    url: `${baseURL}/delayed`,
    timeout_ms: 15_000,
    required_text: ['Delayed fixture ready'],
    actions: [],
  });
  assert.equal(delayed.status, 'passed');
  assert.equal(delayed.missing_required_text.length, 0);

  const hidden = await runBrowserAcceptance({
    job_id: 'fixture-hidden',
    project_id: 'fixture-project',
    url: `${baseURL}/hidden`,
    timeout_ms: 1000,
    required_text: ['Hidden required text'],
    actions: [],
  });
  assert.equal(hidden.status, 'failed');
  assert.deepEqual(hidden.missing_required_text, ['Hidden required text']);

  const failed = await runBrowserAcceptance({
    job_id: 'fixture-fail',
    project_id: 'fixture-project',
    url: `${baseURL}/fail`,
    timeout_ms: 15_000,
    required_text: ['Failure fixture'],
    actions: [],
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.console_errors.length, 1);
  assert.ok(failed.blocking_errors.some((item) => item.source === 'console'));
  console.log('[YES] Playwright browser acceptance runtime model passed.');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(evidenceRoot, { recursive: true, force: true });
}
