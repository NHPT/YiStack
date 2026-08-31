#!/usr/bin/env node

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import {
  aggregateReport,
  benchmarkStopReason,
  requestRaw,
  runGeneration,
} from './run-generation-benchmark.mjs';

const suite = JSON.parse(readFileSync('evals/canonical-prompts.v1.json', 'utf8'));
const configuration = {
  provider: 'fixed-provider',
  model: 'fixed-model',
  suiteHash: 'fixture-suite-hash',
  baseURL: 'http://127.0.0.1:8080/api',
  generationTimeoutMs: 45 * 60 * 1000,
};
const passedSample = (sample) => ({
  id: sample.id,
  category: sample.category,
  status: 'passed',
  duration_ms: 100,
  metrics: {
    schema_pass: true,
    first_pass_build: true,
    repair_success: false,
    final_build: true,
    preview: true,
    browser_acceptance: true,
    terminal_event_unique: true,
    false_success: false,
    command_failure_blocked: true,
    blocking_browser_error_count: 0,
    token_usage: null,
  },
});

const passing = suite.samples.map(passedSample);
const passingReport = aggregateReport(suite, passing, configuration);
assert.equal(passingReport.status, 'passed');
assert.equal(passingReport.scope, 'canonical_full');
assert.equal(passingReport.metrics.final_build_preview_browser_rate, 1);
assert.equal(passingReport.metrics.command_failure_block_rate, 1);
assert.equal(passingReport.configuration.provider, 'fixed-provider');
assert.equal(passingReport.configuration.model, 'fixed-model');
assert.equal(passingReport.configuration.generation_timeout_ms, 45 * 60 * 1000);

const belowThreshold = suite.samples.map(passedSample);
for (const sample of belowThreshold.slice(0, 3)) {
  sample.status = 'failed';
  sample.metrics.browser_acceptance = false;
}
const failedReport = aggregateReport(suite, belowThreshold, configuration);
assert.equal(failedReport.metrics.final_build_preview_browser_rate, 21 / 24);
assert.equal(failedReport.threshold_results.final_build_preview_browser_rate, false);
assert.equal(failedReport.status, 'failed');

const falseSuccess = suite.samples.map(passedSample);
falseSuccess[0].status = 'failed';
falseSuccess[0].metrics.false_success = true;
const falseSuccessReport = aggregateReport(suite, falseSuccess, configuration);
assert.equal(falseSuccessReport.threshold_results.false_success_count, false);
assert.equal(falseSuccessReport.status, 'failed');

const unblockedCommandFailure = suite.samples.map(passedSample);
unblockedCommandFailure[0].status = 'failed';
unblockedCommandFailure[0].metrics.command_failure_blocked = false;
const unblockedCommandFailureReport = aggregateReport(suite, unblockedCommandFailure, configuration);
assert.equal(unblockedCommandFailureReport.threshold_results.command_failure_block_rate, false);
assert.equal(unblockedCommandFailureReport.status, 'failed');

assert.equal(
  benchmarkStopReason(
    [passedSample(suite.samples[0])],
    suite.samples.length,
    suite.thresholds,
  ),
  '',
);

const schemaFailure = passedSample(suite.samples[0]);
schemaFailure.status = 'failed';
schemaFailure.metrics.schema_pass = false;
assert.match(
  benchmarkStopReason(
    [schemaFailure],
    suite.samples.length,
    suite.thresholds,
  ),
  /schema validation did not pass/,
);

const allowedFailures = suite.samples.slice(0, 2).map(passedSample);
for (const sample of allowedFailures) {
  sample.status = 'failed';
  sample.metrics.browser_acceptance = false;
}
assert.equal(
  benchmarkStopReason(
    allowedFailures,
    suite.samples.length,
    suite.thresholds,
  ),
  '',
);

const unreachable = suite.samples.slice(0, 3).map(passedSample);
for (const sample of unreachable) {
  sample.status = 'failed';
  sample.metrics.browser_acceptance = false;
}
assert.match(
  benchmarkStopReason(
    unreachable,
    suite.samples.length,
    suite.thresholds,
  ),
  /threshold is no longer reachable/,
);

const delayedResponseServer = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.write('first');
  setTimeout(() => response.end('second'), 100);
});
delayedResponseServer.listen(0, '127.0.0.1');
await once(delayedResponseServer, 'listening');
try {
  const address = delayedResponseServer.address();
  assert.equal(typeof address, 'object');
  const delayed = await requestRaw(
    `http://127.0.0.1:${address.port}/stream`,
    { signal: AbortSignal.timeout(1000) },
  );
  assert.equal(delayed.status, 200);
  assert.equal(delayed.raw, 'firstsecond');
} finally {
  delayedResponseServer.close();
  await once(delayedResponseServer, 'close');
}

function benchmarkSSE(id, event, data) {
  return (id ? "id: " + id + "\n" : "") +
    "event: " + event + "\n" +
    "data: " + JSON.stringify(data) + "\n\n";
}

let replayStatusCalls = 0;
const replayRequests = [];
const replayJobID = "job-replay-1";
const schemaEvent = {
  id: "generation-result-validation",
  status: "done",
  generation_event_sequence: 1,
  generation_job_id: replayJobID,
};
const replayServer = createServer((request, response) => {
  const requestURL = new URL(
    request.url,
    "http://127.0.0.1",
  );
  if (
    request.method === "POST" &&
    requestURL.pathname === "/api/chat/generate"
  ) {
    request.resume();
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "x-generation-job-id": replayJobID,
    });
    response.end(
      benchmarkSSE("1", "step", schemaEvent) +
        benchmarkSSE("", "error", {
          code: "generation_event_replay_failed",
          blocking: true,
        }),
    );
    return;
  }
  if (
    request.method === "GET" &&
    requestURL.pathname ===
      "/api/project/project-replay/generation/status"
  ) {
    replayStatusCalls += 1;
    const terminal = replayStatusCalls > 1;
    response.writeHead(200, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify({
      generation_active: !terminal,
      generation_job: {
        id: replayJobID,
        status: terminal ? "succeeded" : "running",
        last_event_sequence: terminal ? 4 : 1,
      },
    }));
    return;
  }
  if (
    request.method === "GET" &&
    requestURL.pathname ===
      "/api/project/project-replay/generation/events"
  ) {
    replayRequests.push(requestURL);
    response.writeHead(200, {
      "content-type": "text/event-stream",
    });
    response.end(
      benchmarkSSE("1", "step", schemaEvent) +
        benchmarkSSE("2", "step", {
          id: "preview-server",
          status: "done",
          generation_event_sequence: 2,
          generation_job_id: replayJobID,
        }) +
        benchmarkSSE("3", "step", {
          id: "browser-acceptance",
          status: "done",
          generation_event_sequence: 3,
          generation_job_id: replayJobID,
        }) +
        benchmarkSSE("4", "done", {
          generation_event_sequence: 4,
          generation_job_id: replayJobID,
          projectValidation: { status: "passed" },
          repair: null,
          browserAcceptance: {
            status: "passed",
            blocking_errors: [],
          },
        }),
    );
    return;
  }
  response.writeHead(404);
  response.end();
});
replayServer.listen(0, "127.0.0.1");
await once(replayServer, "listening");
try {
  const address = replayServer.address();
  assert.equal(typeof address, "object");
  const generation = await runGeneration({
    baseURL: "http://127.0.0.1:" + address.port + "/api",
    token: "test-token",
    provider: "ollama-cloud",
    model: "gpt-oss:20b",
    sample: { id: "replay", app_type: "web" },
    projectID: "project-replay",
    plan: {},
    prompt: "replay",
    acceptance: {},
    suffix: "target",
    generationTimeoutMs: 5000,
  });
  assert.equal(generation.metrics.status, "passed");
  assert.equal(generation.metrics.schema_pass, true);
  assert.equal(generation.metrics.terminal_event_count, 1);
  assert.equal(generation.metrics.terminal_status, "succeeded");
  assert.equal(generation.events.length, 4);
  assert.equal(replayRequests.length, 1);
  assert.equal(replayRequests[0].searchParams.get("job_id"), replayJobID);
  assert.equal(replayRequests[0].searchParams.get("cursor"), "1");
} finally {
  replayServer.close();
  await once(replayServer, "close");
}

console.log("[YES] Generation benchmark threshold model passed.");
