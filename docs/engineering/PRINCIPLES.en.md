# YiStack Engineering Principles

[简体中文](PRINCIPLES.md) | [**English**](PRINCIPLES.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.
>
> This document defines the highest-level principles of the YiStack
> engineering system and belongs to the Principle Layer of the YES Engineering
> Kernel.

These principles govern:

- development by people;
- AI-assisted development;
- future software-engineering automation implemented by YiStack itself.

When an implementation detail, short-term request, or local optimization
conflicts with this document, this document takes priority.

## 1. Project First

`Project` is YiStack's core business entity.

- Requirements, solutions, messages, files, runtime, preview, Git, and delivery
  must be organized around a project.
- A new capability must first explain how it attaches to the Project
  lifecycle.
- Do not add an independent core model outside the main Project workflow.

## 2. Real over Mock

YiStack prioritizes real engineering capabilities instead of relying on mocks
for the main workflow:

- a real file tree;
- real Git operations;
- a real runtime;
- a real preview;
- real APIs and state transitions.

Mocks are acceptable for exploratory prototypes, temporarily unavailable
third-party dependencies, and test doubles. They must not permanently replace
the primary workflow.

## 3. Workspace is IDE

`Workspace` is an engineering workbench, not a generic chat window.

- Chat is only one entry point.
- Files, preview, terminal, Git, and status feedback must support delivery.
- Interaction design must prioritize controllable development work and
  truthful, visible state.

## 4. AI is Engineer

AI acts as a software-engineering executor, not merely a question-answering
assistant.

- AI is responsible for implementation paths, boundaries, impact, and
  validation.
- The goal is not only to generate code, but to deliver changes reliably.
- The default behavior is to understand context before execution.

## 5. Human in Control

The user retains final authority.

- Users can interrupt, modify, reject, or roll back AI plans and changes.
- High-risk changes require a human confirmation path.
- AI may recommend decisions but must not exceed its authority.

## 6. MVP First

Complete the smallest closed, verifiable, deliverable capability before adding
enhancements.

- The main workflow takes priority over auxiliary features.
- Stability takes priority over feature count.
- Governance takes priority over superficial feature accumulation.

## 7. High Cohesion, Low Coupling

Architecture and implementation must remain cohesive and loosely coupled.

- A module carries one primary axis of change.
- Direct cross-layer calls are constrained.
- HTTP, business logic, containers, files, Git, and persistence must not be
  mixed in one place.

## 8. Documented before Automated

Every engineering capability intended for AI automation must first have clear,
documented constraints.

- Define rules before automating them.
- Define the workflow before adding multi-agent, Skill, or engine automation.
- Automation without stable rules only amplifies disorder.

## 9. Safety before Speed

Security and data correctness take priority over delivery speed.

- Protect permissions, isolation, path safety, and state consistency first.
- Do not retain clearly over-privileged or destructive behavior merely to get
  something running.
- Changes to containers, files, Git, and deletion paths must consider rollback
  and isolation first.

## 10. Dogfooding

YiStack should use its own engineering system to develop YiStack.

- Documentation must feed real development work.
- Every iteration should verify that YES actually constrains development.
- If a rule cannot help current development, the rule itself needs iteration.

## 11. Prefer Clean Target State

During the current development phase, converge directly on the intended state
instead of preserving branches for hypothetical compatibility.

- Do not retain constants, branches, or fallback behavior for old paths that
  are not confirmed to remain in use.
- Correct wrong defaults, policies, and workflow directions directly.
- Compatibility logic is allowed only for confirmed data, callers, and
  migration windows.
- Every compatibility branch must document why it exists, when it can be
  removed, and how it will be cleaned up.

## 12. Evidence before Fix

Runtime problems require evidence before changes.

- Identify the actual failure point before selecting a fix.
- Static-reading assumptions are not runtime facts.
- Status codes, logs, request paths, container output, and browser errors are
  valid evidence.
- When evidence is missing, add minimal diagnostics before changing core
  behavior.

## 13. Stateful Systems Need Lifecycle Design

Connections, sessions, streaming output, terminals, and asynchronous tasks
need explicit lifecycle design.

- Define creation, running, failure, shutdown, and cleanup states.
- State who starts, keeps alive, and cleans up each resource.
- Plan for tab changes, page navigation, reconnection, and timeout cleanup.
- A successful primary path is insufficient without failure and recovery
  paths.

## 14. Configuration Must Stay Consistent

Defaults, configuration sources, seed data, and fallback policies must remain
consistent across the repository.

- A default-value change must inspect code constants, configuration files,
  initialization SQL, migrations, and tests.
- Code defaults, database seeds, and runtime configuration must not drift.
- Implicit fallback must not hide configuration errors.
- When multiple configuration sources exist, identify the authoritative one.
