# YiStack Development Workflow

[简体中文](DEVELOPMENT_WORKFLOW.md) |
[**English**](DEVELOPMENT_WORKFLOW.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.
>
> This document defines YiStack's standard development workflow. Its purpose is
> to prevent skipped steps, missed work, and drift during human-AI
> collaboration, not to add process for its own sake.

## 1. Scope

This workflow applies to:

- new features;
- cross-module refactoring;
- defects in a core workflow;
- architecture changes;
- data model, state machine, or API contract changes.

Tiny fixes may use a reduced process, but impact analysis and validation are
always required.

## 2. Standard Workflow

### Step 1: Clarify the Requirement

Confirm:

- the required outcome;
- explicit non-goals;
- acceptance criteria;
- whether the work belongs to the current roadmap.

Do not start coding while the requirement itself is unclear.

Foundation Design, historically called Bootstrap Design, is also required when
any of the following applies:

- a new project is starting;
- a new business domain is starting;
- expensive foundation decisions such as users, permissions, state machines,
  or contracts must be frozen first;
- delaying the foundation design would significantly increase refactoring
  cost.

The input framework is defined in
`docs/engineering/YES_BOOTSTRAP_FRAMEWORK.md`.

### Step 2: Read the Context

At minimum, read:

- relevant code;
- `AGENTS.md`;
- relevant engineering rules;
- relevant architecture documents;
- the current roadmap and task records.

Conversation history alone is not sufficient context for changing code.

### Step 3: Analyze the Impact

Explicitly identify:

- affected modules;
- affected interfaces;
- affected states;
- database, container, file, Git, and preview impact;
- likely regression points.

Also provide a runtime-path checklist when the task touches:

- containers or runtime;
- authentication or authorization;
- reverse proxies, CORS, or Origin handling;
- WebSocket, SSE, or streaming;
- scheduled, asynchronous, or long-running work.

The runtime-path checklist must answer:

- where the request starts;
- which forwarding layers it passes through;
- which handler and service receive it;
- which status codes, logs, or frontend symptoms represent failure.

Cross-frontend/backend work and work spanning multiple core modules require
plan approval.

### Step 4: Produce an Implementation Plan

A non-trivial task requires an approved plan containing:

- the change scope;
- execution order;
- risks;
- validation.

For a multi-stage AI execution workflow, the plan must also define what the
user can see:

- the expected stages;
- the goal and main work of each stage;
- the current stage and active task;
- blocking conditions;
- how transitions and completion are displayed.

After the user approves an overall solution or implementation plan, the
execution policy must state:

- which subtasks continue automatically;
- which points still require confirmation;
- which failures or risks interrupt automatic progress.

For runtime incidents, the plan must state:

- which evidence will be collected first;
- the minimum diagnostic method;
- which logs, status codes, or command output prove the fix.

Do not begin large-scale implementation before the plan is approved.

## 3. Implementation Order

The default dependency order is:

```text
Confirm requirement or problem
  -> Analyze impact
  -> Confirm solution and boundaries
  -> Data model or state machine
  -> Repository
  -> Service
  -> Handler or API
  -> Frontend
  -> Integrated validation
  -> Documentation update
  -> Commit and close-out
```

Notes:

- Not every task needs every layer.
- Work that spans the full stack should preserve this dependency direction.
- Sessions, connections, terminals, and streaming tasks need a lifecycle or
  state-machine definition before implementation.
- Once the overall plan is approved, consecutive subtasks should proceed
  automatically instead of requiring the user to repeatedly say "continue."

## 4. Prohibited Practices

The following are prohibited:

- coding before reading the relevant context;
- cross-module changes without impact analysis;
- changing runtime core logic without runtime evidence;
- placing business workflows directly in handlers;
- changing frontend state before defining the backend contract;
- implementing only the primary path and omitting error handling;
- implementing success without recovery behavior;
- changing defaults without checking configuration sources, seeds, and tests;
- claiming completion without validation;
- failing to update related documentation.

## 5. Definition of Done

A task is complete only when:

1. the required code exists;
2. relevant regression points have been checked;
3. required validation has run;
4. required documentation has been updated;
5. the result matches the user's request.

"The code is written" does not mean "the task is complete."

Additional requirements:

- Runtime or connection work must complete at least one real end-to-end check.
- Session, terminal, or streaming work must verify creation, failure,
  shutdown, and recovery.
- Default or policy changes must confirm that code, configuration, seeds, and
  tests no longer drift.

When AI multi-stage execution behavior changes, also confirm:

- displayed stages match real system stages;
- the displayed active task comes from structured state, not guessed text;
- blockers, completed work, and next actions are explicit in the UI;
- approved plans advance automatically and pause only at key decisions, risks,
  or blocking gates.
