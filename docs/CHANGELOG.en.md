# Changelog

[简体中文](CHANGELOG.md) | [**English**](CHANGELOG.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.

This document records only product, compatibility, and security changes that
matter to public users and contributors. Internal task logs, stage acceptance
records, and development history are not published.

YiStack follows [Semantic Versioning](https://semver.org/) for public releases
starting with v1.0.0.

## [Unreleased]

### Added

- VIS-001 visual context loop: chat accepts pasted or uploaded PNG/JPEG references, and only models declaring the `vision` capability may receive images.
- The backend validates MIME type, size, dimensions, pixel count, and actual decoding before re-encoding images; multimodal analysis must return strict `visual_context.v1`.
- Visual context is bound to messages, candidate plans, and durable Generation Jobs, survives live SSE and refresh replay, and constrains layout, components, color, typography, spacing, responsive behavior, and interactions during planning and generation.
- VIS-002 visual-editing loop: owners and editors can select real page elements in internal project previews and submit change instructions; viewers, public shares, and external URLs cannot enable the inspector.
- Sanitized `visual_edit.v1` evidence is bound to a durable Generation Job, writes changes back to real source, and continues through `generation_result.v2`, project build/test/lint, bounded repair, browser acceptance, and a Git snapshot.
- COLLAB-001 shared-workspace loop: owner/editor/viewer sessions expose durable presence, resource changes synchronize through replayable SSE, and leave/expiry transitions retain append-only audit evidence.
- Remote saves refresh clean buffers automatically. Dirty buffers preserve local content and show a conflict, while SHA-256 revisions and HTTP 409 prevent silent overwrites.

### Security

- Visual context carries a server-issued HMAC integrity proof. Clients cannot forge analysis results by changing both the request and project `plan_data`, while valid context remains reusable across discussion and replanning.
- The Preview inspector validates iframe `source/origin` and never reads cookies, storage, HTML, form values, or URL query parameters. The backend revalidates paths, selectors, rectangles, and the computed-style allowlist, while permission lookup failures fail closed.
- Collaboration resource events are backend-owned file or generation transaction evidence; clients cannot forge mutation audit events.
- The `body-parser` transitive dependency under `express@5.2.1` is pinned to 2.3.0, keeping the High/Critical dependency audit at zero.

## [1.0.0] - 2026-09-01

### Added

- Natural-language solution approval, code generation, project-level
  validation, and bounded automatic repair.
- Durable Generation Jobs, attempts, SSE replay, cancellation, and
  interruption recovery.
- Project isolation, runtime management, and browser acceptance based on
  rootless Podman.
- Supabase Auth, RLS, private Storage, migration, and rollback application
  presets.
- GitHub OAuth/PKCE, repository import, explicit pull/push, and webhook replay
  protection.
- Vercel deployment adapter, custom domains, deployment logs, and guarded
  rollback contracts.
- Owner/editor/viewer project collaboration and versioned official templates.
- Apache-2.0 licensing, CI, contribution guides, security policy, governance
  files, and release auditing.
- Chinese and English entry points for the README, contribution guide, code of
  conduct, and core public documentation.
- Real workspace, runtime preview, and Git delivery screenshots captured with
  sanitized deterministic demo data.

### Changed

- The public repository default branch is now `main`.
- `docs/roadmap/ROADMAP.md` is the only public roadmap source.
- Internal task logs, stage status, and implementation records remain local
  and are excluded from public source.
- `runtime/`, environment files, debug archives, and generated evidence are
  excluded from the release surface.
- CI installs Playwright Chromium in clean environments, waits for the database
  with a real SQL query, and uses Node.js 24-compatible GitHub Actions.
- pnpm explicitly enforces a 24-hour dependency maturity window, with its
  lockfile as the only dependency source of truth.
- The Go baseline is upgraded to 1.26.6, with security updates across the
  Node.js and Go production dependency graphs.

### Security

- The default administrator must change the initial password on first login;
  existing administrator JWTs become invalid after the change.
- An empty or known example `JWT_SECRET` is replaced with a process-local
  random secret.
- GitHub and deployment credentials are encrypted server-side and never
  returned through project files or API responses.
- Release gates scan public files, commit metadata, and complete Git history
  for credentials and private information.
- Mermaid is updated to 11.16.1, including upstream prototype-pollution
  hardening.
- CI now blocks High/Critical dependency advisories; the release contains no
  High/Critical npm advisories or reachable Go vulnerabilities.

### Release Notes

- v1.0.0 guarantees only clean installation through `backend/init.sql`.
- In-place upgrades from arbitrary historical database versions are not yet
  supported.
- Real cloud deployment lifecycles still require separate acceptance using
  external platform credentials.
