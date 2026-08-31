#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function runtimeProviderID(provider, model) {
  const normalizedProvider = String(provider ?? "").trim();
  const normalizedModel = String(model ?? "").trim();
  if (normalizedProvider.includes("::")) return normalizedProvider;
  if (!normalizedProvider || !normalizedModel) throw new Error("provider and model are required");
  return normalizedProvider + "::" + normalizedModel;
}

function safeName(value) {
  return String(value ?? 'unknown').trim().replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'unknown';
}

function parseSSE(raw) {
  const events = [];
  for (const block of raw.replace(/\r\n/g, '\n').split('\n\n')) {
    let event = 'message';
    let id = '';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('id:')) id = line.slice(3).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) continue;
    const rawData = dataLines.join('\n');
    let data = {};
    try {
      data = JSON.parse(rawData);
    } catch {
      data = { raw: rawData };
    }
    events.push({ event, id, data });
  }
  return events;
}

function generationEventSequence(event) {
  const sequence = Number.parseInt(
    String(
      event?.data?.generation_event_sequence ??
        event?.id ??
        "",
    ),
    10,
  );
  return Number.isSafeInteger(sequence) && sequence > 0
    ? sequence
    : 0;
}

function isGenerationReplayFailure(event) {
  return event?.event === "error" &&
    event?.data?.code === "generation_event_replay_failed";
}

export function mergeGenerationEvents(current, incoming) {
  const merged = [];
  const sequences = new Set();
  for (const event of [...current, ...incoming]) {
    if (isGenerationReplayFailure(event)) {
      continue;
    }
    const sequence = generationEventSequence(event);
    if (sequence > 0) {
      if (sequences.has(sequence)) {
        continue;
      }
      sequences.add(sequence);
    }
    merged.push(event);
  }
  return merged;
}

function generationEventCursor(events) {
  return events.reduce(
    (cursor, event) => Math.max(
      cursor,
      generationEventSequence(event),
    ),
    0,
  );
}

function hasDurableGenerationTerminal(events) {
  return events.some(
    (event) =>
      (event.event === "done" || event.event === "error") &&
      generationEventSequence(event) > 0,
  );
}

function isGenerationJobTerminal(job) {
  return [
    "succeeded",
    "failed",
    "cancelled",
    "interrupted",
  ].includes(String(job?.status ?? ""));
}

function generationTimeoutSignal(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error("generation timeout exceeded");
  }
  return AbortSignal.timeout(remaining);
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function requestRaw(url, init = {}) {
  const target = new URL(url);
  const transport = target.protocol === 'https:'
    ? https
    : target.protocol === 'http:'
      ? http
      : null;
  if (transport === null) {
    return Promise.reject(new Error(`unsupported request protocol: ${target.protocol}`));
  }

  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      method: init.method ?? 'GET',
      headers: init.headers,
      signal: init.signal,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? '',
          headers: response.headers,
          raw: Buffer.concat(chunks).toString('utf8'),
        });
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(init.body ?? undefined);
  });
}

async function requestJSONOnce(url, init, token) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${raw.slice(0, 1000)}`);
  return payload;
}

async function requestJSON(url, init, token) {
  const method = String(init?.method ?? 'GET').toUpperCase();
  const retryDelays = method === 'GET' ? [500, 1000] : [];
  let lastError;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await requestJSONOnce(url, init, token);
    } catch (error) {
      lastError = error;
      const status = Number.parseInt(String(error?.message ?? '').split(' ', 1)[0], 10);
      const retryableStatus = [408, 425, 429].includes(status) || status >= 500;
      if (Number.isInteger(status) && !retryableStatus) throw error;
    }
    if (attempt < retryDelays.length) {
      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }
  throw lastError;
}

function projectIDFromCreate(payload) {
  return String(payload?.data?.project_id ?? payload?.data?.id ?? payload?.project_id ?? '').trim();
}

function findStep(events, id, status) {
  return events.some((item) => item.event === 'step' && item.data?.id === id && item.data?.status === status);
}

function terminalEvents(events) {
  return events.filter((item) => item.event === 'done' || item.event === 'error');
}

function generationMetrics(events, job, durationMs) {
  const terminals = terminalEvents(events);
  const done = terminals.find((item) => item.event === 'done')?.data ?? null;
  const error = terminals.find((item) => item.event === 'error')?.data ?? null;
  const validation = done?.projectValidation ?? null;
  const repair = done?.repair ?? null;
  const browser = done?.browserAcceptance ?? null;
  const schemaPass = findStep(events, 'generation-result-validation', 'done');
  const finalBuild = validation?.status === 'passed';
  const preview = findStep(events, 'preview-server', 'done');
  const browserAcceptance = findStep(events, 'browser-acceptance', 'done') && browser?.status === 'passed';
  const terminalUnique = terminals.length === 1;
  const blockingBrowserErrors = Array.isArray(browser?.blocking_errors) ? browser.blocking_errors.length : 0;
  const commandFailureObserved = (error?.code ?? job?.error_code ?? '') === 'generation_command_failed';
  const commandFailureBlocked = commandFailureObserved === false || (
    terminalUnique && terminals[0]?.event === 'error' && job?.status !== 'succeeded'
  );
  const falseSuccess = terminals.some((item) => item.event === 'done')
    && (!schemaPass || !finalBuild || !preview || !browserAcceptance || blockingBrowserErrors > 0);
  return {
    status: schemaPass && finalBuild && preview && browserAcceptance && terminalUnique && !falseSuccess ? 'passed' : 'failed',
    job_id: job?.id ?? '',
    terminal_status: job?.status ?? (error ? 'failed' : done ? 'succeeded' : 'unknown'),
    schema_pass: schemaPass,
    first_pass_build: finalBuild && repair === null,
    repair_success: repair?.status === 'passed',
    final_build: finalBuild,
    preview,
    browser_acceptance: browserAcceptance,
    terminal_event_count: terminals.length,
    terminal_event_unique: terminalUnique,
    command_failure_observed: commandFailureObserved,
    command_failure_blocked: commandFailureBlocked,
    blocking_browser_error_count: blockingBrowserErrors,
    false_success: falseSuccess,
    latency_ms: durationMs,
    token_usage: null,
    failure_code: error?.code ?? job?.error_code ?? '',
    failure_message: error?.message ?? job?.error_message ?? '',
    browser_evidence: browser,
  };
}

function foundationMetrics(events, job, durationMs) {
  const terminals = terminalEvents(events);
  const done = terminals.find((item) => item.event === "done")?.data ?? null;
  const bootstrapState = done?.bootstrap_state ?? done?.engineeringState?.bootstrap_state ?? null;
  const terminalUnique = terminals.length === 1;
  const completed = bootstrapState?.status === "completed";
  const succeeded = job?.status === "succeeded";
  return {
    status: completed && succeeded && terminalUnique ? "passed" : "failed",
    job_id: job?.id ?? "",
    terminal_status: job?.status ?? "unknown",
    bootstrap_status: bootstrapState?.status ?? "",
    terminal_event_count: terminals.length,
    terminal_event_unique: terminalUnique,
    latency_ms: durationMs,
    failure_code: job?.error_code ?? "",
    failure_message: job?.error_message ?? "",
  };
}

function planForSample(sample) {
  return {
    id: `eval-plan-${sample.id}`,
    name: `EVAL ${sample.id}`,
    description: 'Canonical generation benchmark plan',
    tech_stack: {
      runtime: {
        profile: sample.runtime_profile,
        needs_container: true,
        package_manager: sample.runtime_profile.startsWith('python-') ? 'pip' : sample.runtime_profile.startsWith('go-') ? 'go' : 'pnpm',
        languages: [],
      },
      summary: [sample.runtime_profile],
    },
    architecture: 'Single-project canonical benchmark fixture',
    complexity: 'medium',
    est_files: 8,
    features: ['build', 'preview', 'browser acceptance'],
    reasoning: 'Fixed R5 canonical benchmark plan',
  };
}

async function createProject(baseURL, token, sample) {
  const plan = planForSample(sample);
  const payload = await requestJSON(`${baseURL}/project/create`, {
    method: 'POST',
    body: JSON.stringify({
      name: `eval-${sample.id}-${Date.now()}`,
      description: sample.prompt,
      app_type: sample.app_type,
      tech_stack: JSON.stringify(plan.tech_stack),
      plan_id: plan.id,
      plan_data: JSON.stringify(plan),
    }),
  }, token);
  const projectID = projectIDFromCreate(payload);
  if (!projectID) throw new Error(`create project did not return project_id: ${JSON.stringify(payload)}`);
  return { projectID, plan };
}

async function stopProject(baseURL, token, projectID) {
  try {
    const statusURL =
      baseURL + "/project/" +
      encodeURIComponent(projectID) +
      "/generation/status";
    let statusPayload = await requestJSON(
      statusURL,
      {
        method: "GET",
        signal: AbortSignal.timeout(120_000),
      },
      token,
    );
    if (statusPayload?.generation_active === true) {
      await requestJSON(
        baseURL + "/project/" +
          encodeURIComponent(projectID) +
          "/generation/stop",
        { method: "POST", body: "{}" },
        token,
      );
      const deadline = Date.now() + 120_000;
      while (
        statusPayload?.generation_active === true &&
        Date.now() < deadline
      ) {
        await wait(500);
        statusPayload = await requestJSON(
          statusURL,
          {
            method: "GET",
            signal: AbortSignal.timeout(
              Math.max(1, deadline - Date.now()),
            ),
          },
          token,
        );
      }
      if (statusPayload?.generation_active === true) {
        throw new Error(
          "generation job did not reach a terminal state before cleanup",
        );
      }
    }
    await requestJSON(
      baseURL + "/project/" + encodeURIComponent(projectID) + "/stop",
      { method: "POST", body: "{}" },
      token,
    );
    return { status: "passed", error: "" };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function prepareFoundation({ baseURL, token, provider, model, sample, projectID, generationTimeoutMs }) {
  const startedAt = Date.now();
  const response = await requestRaw(baseURL + "/chat/generate", {
    method: "POST",
    signal: AbortSignal.timeout(generationTimeoutMs),
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "idempotency-key": "eval-" + sample.id + "-foundation-" + randomUUID(),
    },
    body: JSON.stringify({
      project_id: projectID,
      prompt: "Automatically complete Project Foundation using safe executable defaults, record all required decisions, and confirm progression to the Plan stage.",
      conversation_stage: "bootstrap_confirmed",
      app_type: sample.app_type,
      project_name: "eval-" + sample.id,
      mode: "foundation",
      online: false,
      provider: runtimeProviderID(provider, model),
      model,
      temperature: 0.1,
    }),
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      response.status + " " + response.statusText + ": " +
        response.raw.slice(0, 1500),
    );
  }
  const events = parseSSE(response.raw);
  const jobID = String(
    response.headers["x-generation-job-id"] ?? "",
  );
  const statusPayload = await requestJSON(
    baseURL + "/project/" + encodeURIComponent(projectID) + "/generation/status",
    { method: "GET" },
    token,
  );
  const job = statusPayload?.generation_job ?? null;
  if (jobID && job?.id && job.id !== jobID) throw new Error("foundation status returned another job: " + job.id);
  return foundationMetrics(events, job, Date.now() - startedAt);
}

export async function runGeneration({ baseURL, token, provider, model, sample, projectID, plan, prompt, acceptance, suffix, generationTimeoutMs }) {
  const startedAt = Date.now();
  const deadline = startedAt + generationTimeoutMs;
  const response = await requestRaw(`${baseURL}/chat/generate`, {
    method: "POST",
    signal: generationTimeoutSignal(deadline),
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "idempotency-key":
        "eval-" + sample.id + "-" + suffix + "-" + randomUUID(),
    },
    body: JSON.stringify({
      project_id: projectID,
      prompt,
      conversation_stage: "plan-approved",
      plan_context: JSON.stringify(plan),
      app_type: sample.app_type,
      project_name: "eval-" + sample.id,
      mode: "implement",
      online: false,
      provider: runtimeProviderID(provider, model),
      model,
      temperature: 0.1,
      browser_acceptance: acceptance,
    }),
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      response.status + " " + response.statusText + ": " +
        response.raw.slice(0, 1500),
    );
  }

  let events = mergeGenerationEvents([], parseSSE(response.raw));
  const jobID = String(
    response.headers["x-generation-job-id"] ?? "",
  );
  if (!jobID) {
    throw new Error("generation response did not return a job id");
  }
  const statusURL =
    baseURL + "/project/" + encodeURIComponent(projectID) +
    "/generation/status";
  const readStatus = async () => {
    const payload = await requestJSON(
      statusURL,
      {
        method: "GET",
        signal: generationTimeoutSignal(deadline),
      },
      token,
    );
    const currentJob = payload?.generation_job ?? null;
    if (currentJob?.id && currentJob.id !== jobID) {
      throw new Error(
        "generation status returned another job: " + currentJob.id,
      );
    }
    return currentJob;
  };

  let job = await readStatus();
  while (!hasDurableGenerationTerminal(events)) {
    const cursor = generationEventCursor(events);
    const lastEventSequence = Number.parseInt(
      String(job?.last_event_sequence ?? "0"),
      10,
    );
    if (
      isGenerationJobTerminal(job) &&
      lastEventSequence <= cursor
    ) {
      break;
    }

    const replayURL = new URL(
      baseURL + "/project/" + encodeURIComponent(projectID) +
        "/generation/events",
    );
    replayURL.searchParams.set("job_id", jobID);
    replayURL.searchParams.set("cursor", String(cursor));
    const replay = await requestRaw(replayURL, {
      method: "GET",
      signal: generationTimeoutSignal(deadline),
      headers: { authorization: "Bearer " + token },
    });
    if (replay.status < 200 || replay.status >= 300) {
      throw new Error(
        replay.status + " " + replay.statusText + ": " +
          replay.raw.slice(0, 1500),
      );
    }
    const merged = mergeGenerationEvents(
      events,
      parseSSE(replay.raw),
    );
    const madeProgress =
      generationEventCursor(merged) > cursor;
    events = merged;
    job = await readStatus();
    if (!madeProgress && !isGenerationJobTerminal(job)) {
      await wait(500);
    }
  }

  return {
    events,
    job,
    metrics: generationMetrics(
      events,
      job,
      Date.now() - startedAt,
    ),
  };
}

async function runSample(configuration, sample) {
  const startedAt = Date.now();
  const result = {
    id: sample.id,
    category: sample.category,
    status: 'failed',
    project_id: '',
    cleanup: null,
    foundation: null,
    seed: null,
    metrics: null,
    error: '',
    duration_ms: 0,
  };
  try {
    const { projectID, plan } = await createProject(configuration.baseURL, configuration.token, sample);
    result.project_id = projectID;
    result.foundation = await prepareFoundation({
      ...configuration,
      sample,
      projectID,
    });
    if (result.foundation.status !== "passed") {
      throw new Error(
        "foundation failed: " + (result.foundation.failure_message || result.foundation.failure_code || result.foundation.bootstrap_status),
      );
    }
    if (sample.seed_prompt) {
      const seed = await runGeneration({
        ...configuration,
        sample,
        projectID,
        plan,
        prompt: sample.seed_prompt,
        acceptance: { required_text: ['Iteration Baseline'], actions: [] },
        suffix: 'seed',
      });
      result.seed = seed.metrics;
      if (seed.metrics.status !== 'passed') {
        result.metrics = seed.metrics;
        throw new Error(`iteration seed failed: ${seed.metrics.failure_message || seed.metrics.failure_code}`);
      }
    }
    const generation = await runGeneration({
      ...configuration,
      sample,
      projectID,
      plan,
      prompt: sample.prompt,
      acceptance: sample.acceptance,
      suffix: 'target',
    });
    result.metrics = generation.metrics;
    result.status = generation.metrics.status;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  if (result.project_id) {
    result.cleanup = await stopProject(configuration.baseURL, configuration.token, result.project_id);
  }
  result.duration_ms = Date.now() - startedAt;
  return result;
}

export function aggregateReport(suite, samples, configuration) {
  const count = samples.length;
  const passed = samples.filter((sample) => sample.status === 'passed');
  const withMetrics = samples.filter((sample) => sample.metrics !== null);
  const rate = (predicate) => count === 0 ? 0 : samples.filter(predicate).length / count;
  const metrics = {
    sample_count: count,
    passed_count: passed.length,
    schema_pass_rate: rate((sample) => sample.metrics?.schema_pass === true),
    command_failure_block_rate: rate((sample) => sample.metrics?.command_failure_blocked === true),
    first_pass_build_rate: rate((sample) => sample.metrics?.first_pass_build === true),
    repair_success_count: samples.filter((sample) => sample.metrics?.repair_success === true).length,
    final_build_preview_browser_rate: rate((sample) => sample.metrics?.final_build === true && sample.metrics?.preview === true && sample.metrics?.browser_acceptance === true),
    terminal_event_uniqueness_rate: rate((sample) => sample.metrics?.terminal_event_unique === true),
    false_success_count: samples.filter((sample) => sample.metrics?.false_success === true).length,
    blocking_browser_error_count_on_success: passed.reduce((total, sample) => total + (sample.metrics?.blocking_browser_error_count ?? 0), 0),
    measured_token_sample_count: withMetrics.filter((sample) => sample.metrics?.token_usage !== null).length,
    total_latency_ms: samples.reduce((total, sample) => total + sample.duration_ms, 0),
  };
  const fullSuite = count === suite.samples.length;
  const thresholdResults = {
    schema_pass_rate: metrics.schema_pass_rate >= suite.thresholds.schema_pass_rate,
    command_failure_block_rate: metrics.command_failure_block_rate >= suite.thresholds.command_failure_block_rate,
    false_success_count: metrics.false_success_count <= suite.thresholds.false_success_count,
    terminal_event_uniqueness_rate: metrics.terminal_event_uniqueness_rate >= suite.thresholds.terminal_event_uniqueness_rate,
    final_build_preview_browser_rate: metrics.final_build_preview_browser_rate >= suite.thresholds.final_build_preview_browser_rate,
    blocking_browser_error_count_on_success: metrics.blocking_browser_error_count_on_success <= suite.thresholds.blocking_browser_error_count_on_success,
  };
  return {
    schema_version: 'generation_benchmark_report.v1',
    generated_at: new Date().toISOString(),
    scope: fullSuite ? 'canonical_full' : 'canonical_subset',
    status: Object.values(thresholdResults).every(Boolean) ? 'passed' : 'failed',
    configuration: {
      provider: configuration.provider,
      model: configuration.model,
      prompt_version: suite.prompt_version,
      suite_hash: configuration.suiteHash,
      base_url: configuration.baseURL,
      generation_timeout_ms: configuration.generationTimeoutMs,
    },
    thresholds: suite.thresholds,
    threshold_results: thresholdResults,
    metrics,
    samples,
  };
}

export function benchmarkStopReason(samples, sampleCount, thresholds) {
  const latest = samples.at(-1);
  if (latest?.metrics?.schema_pass !== true) {
    return `schema validation did not pass for ${latest?.id ?? 'unknown sample'}`;
  }

  const requiredPasses = Math.ceil(
    sampleCount * thresholds.final_build_preview_browser_rate,
  );
  const passedCount = samples.filter(
    (sample) => sample.status === 'passed',
  ).length;
  const remainingCount = sampleCount - samples.length;
  if (passedCount + remainingCount < requiredPasses) {
    return `complete-chain threshold is no longer reachable: ` +
      `${passedCount} passed, ${remainingCount} remaining, ` +
      `${requiredPasses} required`;
  }
  return '';
}

async function main() {
  const args = readArguments(process.argv.slice(2));
  const suitePath = path.resolve(rootDir, String(args.suite ?? 'evals/canonical-prompts.v1.json'));
  const suiteRaw = await fs.readFile(suitePath, 'utf8');
  const suite = JSON.parse(suiteRaw);
  if (suite.schema_version !== 'canonical_generation_suite.v1' || !Array.isArray(suite.samples) || suite.samples.length < 24) {
    throw new Error('canonical suite must contain at least 24 versioned samples');
  }
  const token = String(process.env.YISTACK_EVAL_TOKEN ?? '').trim();
  const provider = String(args.provider ?? process.env.YISTACK_EVAL_PROVIDER ?? '').trim();
  const model = String(args.model ?? process.env.YISTACK_EVAL_MODEL ?? '').trim();
  const generationTimeoutMinutes = Number.parseInt(String(args['generation-timeout-minutes'] ?? process.env.YISTACK_EVAL_GENERATION_TIMEOUT_MINUTES ?? '45'), 10);
  if (!token) throw new Error('YISTACK_EVAL_TOKEN is required');
  if (!provider || !model) throw new Error('--provider and --model are required for a comparable benchmark');
  if (!Number.isInteger(generationTimeoutMinutes) || generationTimeoutMinutes < 5 || generationTimeoutMinutes > 90) {
    throw new Error('--generation-timeout-minutes must be an integer between 5 and 90');
  }

  let selected = [...suite.samples];
  if (args.category) selected = selected.filter((sample) => sample.category === args.category);
  if (args.sample) selected = selected.filter((sample) => sample.id === args.sample);
  if (args.limit) selected = selected.slice(0, Math.max(0, Number.parseInt(args.limit, 10) || 0));
  if (selected.length === 0) throw new Error('no canonical samples selected');

  const configuration = {
    baseURL: String(args['base-url'] ?? process.env.YISTACK_EVAL_BASE_URL ?? 'http://127.0.0.1:8080/api').replace(/\/$/, ''),
    token,
    provider,
    model,
    generationTimeoutMs: generationTimeoutMinutes * 60 * 1000,
    suiteHash: createHash('sha256').update(suiteRaw).digest('hex'),
  };
  const samples = [];
  for (const [index, sample] of selected.entries()) {
    process.stdout.write(`[EVAL] ${index + 1}/${selected.length} ${sample.id}\n`);
    const result = await runSample(configuration, sample);
    samples.push(result);
    process.stdout.write(`[EVAL] ${sample.id}: ${result.status}${result.error ? ` (${result.error})` : ''}\n`);
    const stopReason = benchmarkStopReason(
      samples,
      selected.length,
      suite.thresholds,
    );
    if (stopReason) {
      process.stdout.write(`[EVAL] stopping: ${stopReason}\n`);
      break;
    }
  }
  const report = aggregateReport(suite, samples, configuration);
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const outputRoot = path.resolve(rootDir, String(args.output ?? 'runtime/evals'));
  const outputDir = path.join(outputRoot, `${timestamp}-${safeName(provider)}-${safeName(model)}`);
  await fs.mkdir(outputDir, { recursive: true, mode: 0o750 });
  const reportPath = path.join(outputDir, 'report.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o640 });
  process.stdout.write(`[EVAL] report=${path.relative(rootDir, reportPath)}\n`);
  process.stdout.write(`[EVAL] status=${report.status} pass_rate=${report.metrics.final_build_preview_browser_rate.toFixed(4)}\n`);
  if (report.status !== 'passed') process.exitCode = 1;
}


if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  void main().catch((error) => {
    process.stderr.write(`[EVAL] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
