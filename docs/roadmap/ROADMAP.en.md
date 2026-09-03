# YiStack Roadmap

[简体中文](ROADMAP.md) | [**English**](ROADMAP.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.
>
> This document defines YiStack's development stages and priorities. It answers
> what should happen now, what comes later, and what is intentionally deferred.
>
> User-facing changes are recorded in `docs/CHANGELOG.en.md`. Completion status
> must be backed by executable gates. Detailed task logs, stage status, and
> migration notes are local development material and are not published.

## 1. Current Strategy

The highest priority is:

**Build differentiated input and collaboration capabilities on top of the stable
generation-quality loop.**

This file is the only public roadmap source. Internal development may maintain
more detailed task records, but public status and priorities must be reflected
here.

The main sequence is:

1. `LT-02R` R1-R7 are complete and have passed the Production Gate: truthful
   generation, project gates, patch/repair, durable Job/SSE, browser benchmark,
   platform integrations, and the Contributor Alpha repository gate.
2. `VIS-001` is complete: screenshots and reference images are analyzed by a
   real multimodal model into `visual_context.v1`, then bound to plans, messages,
   durable Jobs, SSE recovery, and code generation.
3. `COLLAB-001` is complete: shared workspaces provide durable presence, SSE
   cursor replay, backend-owned resource-event auditing, SHA-256 concurrency
   protection, and dirty-buffer conflict feedback.
4. The GitHub remote, required Actions checks, and branch protection are enabled.
   Continue accepting community contributions through controlled pull requests.
5. Validate real cloud lifecycles for multiple deployment providers and the
   migration runner for the first upgrade-capable tag within their established
   boundaries.
6. `VIS-002` is complete: internal project previews support real-element
   selection, sanitized `visual_edit.v1` evidence, owner/editor authorization,
   durable-Job source writeback, and the complete quality gate.

`LT-02R` repairs LT-02, LT-03, and LT-06. It does not create LT-09 or renumber
the original eight product stages.

The primary user experience must also:

- show the real AI stage, active task, blocking reason, and next action;
- continue subtasks automatically after the user approves the overall plan,
  without requiring repeated "continue" messages.

## 2. Current Freeze

Large new business features are deferred except for:

- defects blocking the primary workflow;
- security issues;
- data consistency problems;
- issues with clear impact on the core experience;
- changes required to build the YES system.

The following are not current priorities:

- Plugin Marketplace;
- decorative functionality unrelated to the primary workflow;
- additional LT-08 readiness-only slices.

Deployment, custom domains, collaboration, and templates are no longer
permanently frozen. They may proceed in R6.3/R6.4 order only after the LT-02R R5
quality, durable-task, and browser-acceptance gates are stable.

## 3. Milestones

### Milestone A: YES Engineering Kernel v2

Goals:

- establish the minimum complete YES Engineering Kernel;
- give AI and human contributors explicit constraints;
- make YES an executable system rather than only a document collection;
- turn `AGENTS.md` into the Kernel entry point.

Scope:

- Engineering Principles;
- Architecture Layer;
- Execution Layer;
- Validation Layer;
- Architecture Rules;
- Development Workflow;
- AI Development Protocol;
- Coding Standard;
- Entry Layer.

### Milestone B: Stable Core Workflow

Goals:

- converge the core workflow on the target architecture and engineering flow;
- stabilize requirement routing, clarification, design, implementation,
  validation, and preview;
- reduce workspace regressions;
- close primary-workflow defects;
- expose stages, tasks, blockers, and next actions to the user;
- automatically advance small tasks under an approved plan.

Scope:

- Workspace;
- requirement routing and solution flow;
- SSE;
- file operations;
- Git;
- preview;
- runtime stability;
- enforcement of YES rules in the primary workflow;
- user-visible stage, task, progress, and blocking state;
- automatic progress and confirmation boundaries after plan approval.

### Milestone B-R: Core Generation Quality Repair

Goals:

- eliminate false success after LLM parse, command, or project validation
  failures;
- run stack-aware build, test, and lint in the generated project's container;
- provide file-level patches, bounded repair, and failure evidence;
- make Generation Jobs, SSE events, and terminal states durable, replayable,
  and recoverable;
- quantify generation quality through browser acceptance and canonical
  benchmarks.

Scope:

- GenerationResult Schema and tool calls;
- Project Validation Gate;
- file patch and repair loop;
- Supabase Job, Attempt, and Event;
- SSE replay, lease, and heartbeat;
- Playwright console, network, DOM, and screenshot acceptance;
- generation benchmark and evaluation.

### Milestone C: Sustainable Development

Goals:

- support continued project iteration beyond a single generation;
- establish minimum foundation design before solution and MVP work;
- internalize target orchestration, state, and Skill capabilities;
- map internal orchestration state to understandable execution visibility.

Scope:

- Project Foundation Stage, artifacts, and gate;
- VIS-001 visual context: image upload/paste, vision-capability enforcement, structured analysis, and generation constraints (Done);
- VIS-002 visual editing: Preview element selection, sanitized DOM location
  evidence, controlled source changes, and the complete quality gate (Done);
- COLLAB-001 shared-workspace collaboration: presence, resource events,
  recovery, and conflict protection (Done);
- Task Orchestration Layer;
- Engineering State Layer;
- Execution Transparency Layer;
- Skill and MCP integration;
- stronger project memory;
- workspace recovery;
- stronger diff and rollback;
- more reliable debugging and logs.

### Milestone D: Professional Productivity

Goal: improve development and collaboration efficiency within each project.

Scope:

- prompt management;
- stronger model governance;
- automatic backups;
- resource monitoring;
- stronger Git capabilities.

### Milestone E: Enterprise Governance

Goal: enterprise identity, organization, audit, resource governance, and
private deployment.

Current order:

- keep the milestone In Progress, but do not add readiness-only slices before
  Milestone B-R P0/P1 work is complete;
- prioritize only security, data correctness, and core-workflow blockers.

### Milestone F: Product Integration and Community Opening

Goals:

- provide a Supabase application backend preset, GitHub import/sync, and at
  least one real deployment and domain lifecycle;
- complete licensing, CI, contribution rules, security policy, clean lint,
  reproducible installation, and upgrade boundaries;
- open in stages: Public Preview, Contributor Alpha, and Community Beta.

Scope:

- Supabase auth, schema, RLS, and Storage preset (R6.1 Done);
- GitHub App or OAuth import and synchronization;
- deployment adapters, custom domains, and rollback;
- minimum project collaboration and versioned official templates;
- open-source governance, CI, security, and upgrade policy.

## 4. Roadmap Rules

- Work outside the roadmap is not a default priority.
- A non-core feature must identify its milestone.
- Priority changes must update this file before implementation starts.
