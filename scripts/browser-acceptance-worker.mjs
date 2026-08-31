#!/usr/bin/env node
import http from 'node:http';
import { browserAcceptanceSchemaVersion, runBrowserAcceptance } from './lib/browser-acceptance.mjs';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.BROWSER_ACCEPTANCE_WORKER_PORT ?? '43120', 10);
const maxConcurrency = 2;
let activeRequests = 0;

function writeJSON(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJSON(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_048_576) throw new Error('request body is too large');
  }
  return JSON.parse(raw || '{}');
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    writeJSON(response, 200, { status: 'ready', schema_version: browserAcceptanceSchemaVersion, active_requests: activeRequests });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/v1/accept') {
    writeJSON(response, 404, { error: 'not found' });
    return;
  }
  if (activeRequests >= maxConcurrency) {
    writeJSON(response, 429, { error: 'browser acceptance worker is busy' });
    return;
  }
  activeRequests += 1;
  try {
    const result = await runBrowserAcceptance(await readJSON(request));
    writeJSON(response, result.status === 'passed' ? 200 : 422, result);
  } catch (error) {
    writeJSON(response, 400, {
      schema_version: browserAcceptanceSchemaVersion,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeRequests -= 1;
  }
});

server.listen(port, host, () => process.stdout.write(`browser acceptance worker listening on http://${host}:${port}\n`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
