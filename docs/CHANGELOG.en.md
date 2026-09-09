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

No public changes yet.

## [1.1.2] - 2026-09-09

### Changed

- Standardized all user-facing upgrades on `yistackctl upgrade`; the READMEs no longer expose a version-specific path that directly invokes the internal Release `upgrade.sh`.

### Fixed

- Fixed archive upgrades where a root-owned `0700` extraction directory prevented the `yistack` service user from executing the database backup helper.

### Security

- Upgrades no longer require a colocated `.sha256` sidecar that could be replaced with the archive. The internal `MANIFEST.sha256` still verifies file integrity, while the READMEs describe Release checksums as optional transfer-corruption checks and use GitHub artifact attestations for build provenance.

## [1.1.1] - 2026-09-09

### Fixed

- Fixed systemd system-manager expansion of `%U` to the root UID, which started rootless Podman for the `yistack` service with the incorrect `/run/user/0` runtime directory.
- Changed the backend service to `ProtectHome=read-only`, retaining read-only isolation while allowing access to `/run/user/<uid>/podman/podman.sock`.
- Added the installer `--postgres-image` option and documented real mirror references for networks where Docker Hub is restricted.

### Changed

- Standardized Ephemeral Experience Mode on the `ephemeral` name and removed the `demo` command, old configuration name, old environment variables, and old systemd units without compatibility aliases.
- Standardized routine service, PostgreSQL, migration, upgrade, and Ephemeral Experience Mode operations on `yistackctl`; the installer now provides Bash completion and both READMEs document the full command surface.
- `yistackctl postgres` now switches to the `yistack` service user and its rootless Podman runtime instead of accidentally selecting the root container context under `sudo`.

### Security

- Pinned the ESLint transitive dependency `js-yaml` to 4.3.2, fixing the high-severity CPU consumption issue described by GHSA-2883-xcg3-v3hh.

## [1.1.0] - 2026-09-07

### Added

- Added official prebuilt Linux amd64/arm64 production packages, fully validated on Debian 12, containing the Go backend, Next.js standalone output, Node.js 22, the browser-acceptance worker, systemd units, and an optional PostgreSQL 16 rootless Podman control-plane database; the web client remains cross-platform.
- Added a tag-triggered Release workflow that builds and validates packages on amd64 and native arm64 runners, then publishes SHA-256 files, SPDX JSON SBOMs, and GitHub build provenance.
- Added a disabled-by-default ephemeral experience mode for local PostgreSQL deployments, with a user-data-free baseline, configurable daily restoration, complete user/project data cleanup, project and container TTLs, disk watermarks, and reusable image retention.
- Added an explicit database migration runner with manifest ordering, SHA-256 integrity, a PostgreSQL advisory lock, upgrades from the known v1.0.0 baseline, and one-step rollback.
- VIS-001 visual context loop: chat accepts pasted or uploaded PNG/JPEG references, and only models declaring the `vision` capability may receive images.
- Added safe one-command upgrades: v1.0.0 runs the new Release's `upgrade.sh`, while later versions use `yistackctl upgrade`; the command automates backup, migration, verification, running-state restoration, and failure recovery of the database, configuration, systemd units, and Release pointer.
- The backend validates MIME type, size, dimensions, pixel count, and actual decoding before re-encoding images; multimodal analysis must return strict `visual_context.v1`.
- Visual context is bound to messages, candidate plans, and durable Generation Jobs, survives live SSE and refresh replay, and constrains layout, components, color, typography, spacing, responsive behavior, and interactions during planning and generation.
- VIS-002 visual-editing loop: owners and editors can select real page elements in internal project previews and submit change instructions; viewers, public shares, and external URLs cannot enable the inspector.
- Sanitized `visual_edit.v1` evidence is bound to a durable Generation Job, writes changes back to real source, and continues through `generation_result.v2`, project build/test/lint, bounded repair, browser acceptance, and a Git snapshot.
- COLLAB-001 shared-workspace loop: owner/editor/viewer sessions expose durable presence, resource changes synchronize through replayable SSE, and leave/expiry transitions retain append-only audit evidence.
- Remote saves refresh clean buffers automatically. Dirty buffers preserve local content and show a conflict, while SHA-256 revisions and HTTP 409 prevent silent overwrites.
- Added real-interface README screenshots for the project container terminal and mobile Preview viewport, using sanitized deterministic demo data and a reproducible capture script.

### Changed

- The primary README quick start now downloads a Release deployment package and configures a production database; source cloning, dependency installation, and `scripts/dev.sh` moved to the source-development flow.
- Pull-request CI now runs the lightweight repository contract before expensive build and browser jobs, and validates the packaged runtime.
- Production configuration disables implicit GORM schema mutation and verifies the latest database version required by the Release. Release packages now carry the complete migration directory and exercise the v1.0.0 upgrade at runtime; nullable `users.instance_id` aligns local PostgreSQL registration with the Supabase model.
- The README now presents one-prompt complete application generation, the YES Engineering System, high-performance isolated execution, durable recovery, visual context, and live collaboration as core advantages.
- An English YES Engineering System document was added, and the product-gap and open-source-readiness report now reflects VIS-001, COLLAB-001, and the remaining verified gaps.

### Security

- Visual context carries a server-issued HMAC integrity proof. Clients cannot forge analysis results by changing both the request and project `plan_data`, while valid context remains reusable across discussion and replanning.
- The Preview inspector validates iframe `source/origin` and never reads cookies, storage, HTML, form values, or URL query parameters. The backend revalidates paths, selectors, rectangles, and the computed-style allowlist, while permission lookup failures fail closed.
- systemd exposes the complete secret configuration only to the backend. The frontend reads an allowlist of non-sensitive runtime settings, while the browser worker receives only its browser path and listen port.
- Upgrade backups use PostgreSQL custom format and a filename-bound SHA-256 for the YiStack-managed `public` schema only. Recovery cleans and restores backed-up objects in one transaction and leaves services stopped when automatic recovery is incomplete.
- Ephemeral experience maintenance accepts only the installer-managed local PostgreSQL database, operates only on Podman resources labeled with `yistack.project_id`, and protects templates, browser runtimes, configuration, and Release directories.
- The database runner rejects tampered SQL, checksum drift, history gaps, and unknown or newer versions; production startup fails closed until pending migrations are applied explicitly.
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
