# Changelog

[简体中文](CHANGELOG.md) | [**English**](CHANGELOG.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.

This document records only product, compatibility, and security changes that
matter to public users and contributors. Internal task logs, stage acceptance
records, and development history are not published.

YiStack is currently in Contributor Alpha and has no stable release. After the
first formal release, this changelog will follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

### Changed

- The public repository default branch is now `main`.
- `docs/roadmap/ROADMAP.md` is the only public roadmap source.
- Internal task logs, stage status, and implementation records remain local
  and are excluded from public source.
- `runtime/`, environment files, debug archives, and generated evidence are
  excluded from the release surface.

### Security

- The default administrator must change the initial password on first login;
  existing administrator JWTs become invalid after the change.
- An empty or known example `JWT_SECRET` is replaced with a process-local
  random secret.
- GitHub and deployment credentials are encrypted server-side and never
  returned through project files or API responses.
- Release gates scan public files, commit metadata, and complete Git history
  for credentials and private information.

## Release Notes

- The current version guarantees only clean installation through
  `backend/init.sql`.
- In-place upgrades from arbitrary historical database versions are not yet
  supported.
- Real cloud deployment lifecycles still require separate acceptance using
  external platform credentials.
