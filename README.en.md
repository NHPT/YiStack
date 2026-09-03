# YiStack

[简体中文](README.md) | [**English**](README.en.md)

**One prompt to a complete application: from natural-language requirements to
a runnable, verified, and evolvable full-stack delivery.**

YiStack is a high-performance, open-source AI application generation platform
for developers and small teams, driven by the **YES Engineering System**. Its
Go backend, isolated Workspaces, and durable jobs connect requirements and
visual references, solution approval, full-stack code generation, project-level
validation, bounded automatic repair, container execution, browser acceptance,
and Git delivery into a truthful, traceable, and recoverable engineering loop.

> Current release: **v1.0.0**, YiStack's first stable open-source release. Its
> stability scope is limited to the capabilities documented in this README and
> [`docs/PRODUCT.en.md`](docs/PRODUCT.en.md). Only clean database installation
> is guaranteed; arbitrary in-place upgrades from historical versions are not.

## Why YiStack

| Advantage | What it delivers |
| --- | --- |
| One prompt to a complete application | Starts with a natural-language requirement or reference image and connects Foundation, planning, implementation, validation, preview, and Git delivery instead of stopping at code snippets |
| YES Engineering System | Governs human and AI development through Specification, Execution, and Validation; protocol, authorization, or validation failures cannot be reported as success |
| Real project-level validation | Runs stack-aware build/test/lint inside the generated project, applies bounded repair, and validates the result in a browser |
| High-performance isolated runtime | Uses a Go backend for orchestration and streaming events, with every project running in an isolated rootless Podman Workspace |
| Durable and recoverable execution | Generation Jobs, attempts, leases, and SSE replay preserve state across refreshes, disconnects, and process interruptions |
| Visual context and live collaboration | Converts references into trusted `visual_context.v1`; shared workspaces add roles, presence, remote synchronization, and SHA-256 conflict protection |
| User-owned source and delivery | Monaco, terminal, Git, GitHub synchronization, version recovery, and export keep generated source under user control |

## Product Preview

![YiStack workspace with generation workflow, quality gates, and Monaco code editor](docs/assets/screenshots/workspace-overview.png)

<p align="center">One workspace from requirements and engineering execution to verified, reviewable source code</p>

<table>
  <tr>
    <td width="50%"><img src="docs/assets/screenshots/verified-preview.png" alt="YiStack runtime preview and browser acceptance"></td>
    <td width="50%"><img src="docs/assets/screenshots/git-delivery.png" alt="YiStack Git commit and diff view"></td>
  </tr>
  <tr>
    <td align="center">Live runtime preview and browser acceptance</td>
    <td align="center">Git commits, file diffs, and delivery traceability</td>
  </tr>
</table>

> Screenshots are captured from the real YiStack interface with a sanitized demo project and deterministic demo data.

## Current Capabilities

| Capability | Status | Boundary |
| --- | --- | --- |
| Foundation and solution decisions | Implemented | Produces a structured Foundation and candidate technical plans from requirements, then waits for user approval before implementation |
| Visual context | Implemented | PNG/JPEG upload or paste, real multimodal analysis, HMAC integrity proof, and end-to-end `visual_context.v1` binding |
| Structured application generation | Implemented | LLM output uses a versioned schema; failures cannot be reported as success |
| Project quality gate | Implemented | Runs stack-aware build/test/lint checks with bounded automatic repair |
| Durable Generation Jobs | Implemented | Supports job state, attempts, SSE replay, and terminal-state recovery |
| Isolated runtime and preview | Implemented | Uses rootless Podman and includes browser acceptance contracts |
| Supabase application preset | Implemented | Generates Auth, RLS, private Storage, migrations/rollback, and type boundaries |
| GitHub import and synchronization | Implemented | OAuth PKCE, encrypted tokens, conflict blocking, safe push, and idempotent webhooks |
| Vercel deployment adapter | Implemented; live acceptance pending | Publish, domain, log, and rollback behavior has automated coverage; the real lifecycle still requires external credentials |
| Shared-workspace collaboration | Implemented | Owner/editor/viewer roles, durable presence, SSE replay, remote file synchronization, append-only auditing, and SHA-256 CAS |
| Official templates | Implemented | Persistent versions, SHA-256 verification, and CAS publish/rollback; not a community marketplace |
| Plugin system and template marketplace | Not implemented | Planned for a later phase |
| Commercial editions, SSO, Kubernetes, and SLA | Not released | Product assumptions, not commitments of the current open-source version |

Public changes are recorded in
[`docs/CHANGELOG.en.md`](docs/CHANGELOG.en.md). Product direction is defined by
[`docs/PRODUCT.en.md`](docs/PRODUCT.en.md) and
[`docs/roadmap/ROADMAP.en.md`](docs/roadmap/ROADMAP.en.md). Implementation
status must be verified by executable gates.

## YES Engineering System

YES (YiStack Engineering Specification) is YiStack's engineering specification
and execution kernel, not a prompt template. Its five layers distinguish
"code was generated" from "software is ready to deliver":

1. **Entry** defines the common entry point, context-reading order, and hard constraints.
2. **Principle** defines truthfulness, security, user control, and engineering priorities.
3. **Architecture** governs module boundaries, call direction, state ownership, and data ownership.
4. **Execution** defines the continuous protocol from clarification and planning through implementation, validation, and delivery.
5. **Validation** supplies executable evidence through `pnpm yes:validate`, project-level build/test/lint, database checks, security audits, and browser acceptance.

YES prevents YiStack from treating a file write or model response as success.
Protocol, authorization, build, test, runtime, or browser-acceptance failures
must block the workflow, record the cause, and expose a recovery path.

See [YES Engineering System](docs/engineering/YES.en.md) for its complete
definition, current boundary, and evolution path.

## Technology Stack

- Frontend: Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Monaco Editor
- Backend: Go 1.26.6+, Hertz, GORM
- Database: Supabase/PostgreSQL
- Runtime: rootless Podman
- Package manager: pnpm 11.5.2

## Requirements

| Tool | Supported baseline |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.26.6 or a newer 1.x release |
| Podman | 3.4+, rootless |
| Database | Supabase, or PostgreSQL 15+ for SQL verification |

## Quick Start

```bash
git clone https://github.com/NHPT/YiStack.git
cd YiStack
corepack enable
pnpm install --frozen-lockfile
(cd backend && go mod download)
cp .env.example .env
```

Apply the following file to a new Supabase project:

```text
backend/init.sql
```

`backend/init.sql` is the single clean-install schema source for v1.0.0. It
creates the provider catalog but does not enable an LLM
provider by default. Configure and preflight at least one provider in the admin
console before starting generation. Never commit API keys.

Start the local development environment:

```bash
bash scripts/dev.sh
```

Default endpoints:

- Frontend: <http://localhost:5000>
- Backend API: <http://localhost:8080/api>

The repository does not publish test credentials suitable for deployment.
Seed credentials in `backend/init.sql` are only for local initialization and
must be changed immediately in any shared or production environment.

## Validation

Run the baseline gates:

```bash
pnpm lint
pnpm build
pnpm yes:validate
(cd backend && go test ./...)
pnpm eval:smoke:ci
git diff --check
```

Verify a clean checkout, toolchain, rootless Podman, Supabase SQL baseline, and
minimum provider catalog:

```bash
bash scripts/verify-clean-checkout.sh
```

`pnpm eval:smoke:ci` is a deterministic canonical benchmark contract smoke test
that requires no external credentials. A live model smoke test requires a
running YiStack instance and explicit credentials:

```bash
YISTACK_EVAL_TOKEN=... \
YISTACK_EVAL_PROVIDER=... \
YISTACK_EVAL_MODEL=... \
pnpm eval:smoke
```

## Database Upgrade Boundary

v1.0.0 guarantees only clean installation through `backend/init.sql`.
Baselines, future migration naming, compatibility scope, and rollback
requirements are documented in
[`docs/engineering/DATABASE_LIFECYCLE.en.md`](docs/engineering/DATABASE_LIFECYCLE.en.md).
YiStack does not claim support for upgrading arbitrary existing databases until
the migration runner and compatibility matrix are complete.

## Repository Layout

```text
backend/       Go API, services, repositories, and database initialization
src/           Next.js application, pages, and API proxies
scripts/       Build scripts, engineering gates, benchmarks, and environment checks
evals/         Canonical prompts and executable fixtures
docs/          Architecture, engineering rules, public roadmap, and changelog
runtime/       Local workspaces and evidence; excluded from source review
.github/       CI, CODEOWNERS, issue templates, and pull request templates
```

## Documentation

- [Developer Guide](docs/DEVELOPER_GUIDE.en.md)
- [Architecture](docs/ARCHITECTURE.en.md)
- [Product Boundaries](docs/PRODUCT.en.md)
- [YES Engineering System](docs/engineering/YES.en.md)
- [Engineering Principles](docs/engineering/PRINCIPLES.en.md)
- [Development Workflow](docs/engineering/DEVELOPMENT_WORKFLOW.en.md)
- [Database Lifecycle](docs/engineering/DATABASE_LIFECYCLE.en.md)
- [Public Roadmap](docs/roadmap/ROADMAP.en.md)
- [Changelog](docs/CHANGELOG.en.md)

## Contributing

Before opening an issue or pull request, read:

- [Contributing Guide](CONTRIBUTING.en.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Governance](GOVERNANCE.md)
- [Maintainers](MAINTAINERS.md)

Security issues must be reported privately through the channel defined in
[`SECURITY.md`](SECURITY.md), not through a public issue.

## License

YiStack is licensed under the [Apache License 2.0](LICENSE).
