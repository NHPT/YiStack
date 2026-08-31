# YiStack

[简体中文](README.md) | [**English**](README.en.md)

YiStack is an AI application generation and engineering workspace driven by
natural-language requirements. It organizes solution approval, code generation,
project-level validation, bounded automatic repair, container execution, browser
acceptance, and version control into a traceable workflow.

> Current stage: **Contributor Alpha**. The source code is now published on
> GitHub and the repository baseline has passed. Before accepting external
> contributions, required CI checks and branch protection must be verified.
> YiStack has not published a stable release and does not promise in-place
> upgrades from arbitrary historical versions.

## Current Capabilities

| Capability | Status | Boundary |
| --- | --- | --- |
| Structured application generation | Implemented | LLM output uses a versioned schema; failures cannot be reported as success |
| Project quality gate | Implemented | Runs stack-aware build/test/lint checks with bounded automatic repair |
| Durable Generation Jobs | Implemented | Supports job state, attempts, SSE replay, and terminal-state recovery |
| Isolated runtime and preview | Implemented | Uses rootless Podman and includes browser acceptance contracts |
| Supabase application preset | Implemented | Generates Auth, RLS, private Storage, migrations/rollback, and type boundaries |
| GitHub import and synchronization | Implemented | OAuth PKCE, encrypted tokens, conflict blocking, safe push, and idempotent webhooks |
| Vercel deployment adapter | Contract implemented | A real cloud lifecycle requires external credentials and will be validated with additional providers |
| Project collaboration | Implemented | Owner/editor/viewer roles, owner-only high-risk operations, and append-only auditing |
| Official templates | Implemented | Persistent versions, SHA-256 verification, and CAS publish/rollback; not a community marketplace |
| Plugin system and template marketplace | Not implemented | Planned for a later phase |
| Commercial editions, SSO, Kubernetes, and SLA | Not released | Product assumptions, not commitments of the current open-source version |

Public changes are recorded in [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
Product direction is defined by [`docs/PRODUCT.md`](docs/PRODUCT.md) and
[`docs/roadmap/ROADMAP.md`](docs/roadmap/ROADMAP.md). Implementation status must
be verified by executable gates. These documents are currently maintained in
Chinese.

## Technology Stack

- Frontend: Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4, Monaco Editor
- Backend: Go 1.21.6+, Hertz, GORM
- Database: Supabase/PostgreSQL
- Runtime: rootless Podman
- Package manager: pnpm 11.5.2

## Requirements

| Tool | Supported baseline |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.21.6 or a newer 1.x release |
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

`backend/init.sql` is the single clean-install schema source for the current
pre-release line. It creates the provider catalog but does not enable an LLM
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

Contributor Alpha only guarantees clean installation through
`backend/init.sql`. Baselines, future migration naming, compatibility scope,
and rollback requirements are documented in
[`docs/engineering/DATABASE_LIFECYCLE.md`](docs/engineering/DATABASE_LIFECYCLE.md).
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

- [Developer Guide](docs/DEVELOPER_GUIDE.md) (Chinese)
- [Architecture](docs/ARCHITECTURE.md) (Chinese)
- [Product Boundaries](docs/PRODUCT.md) (Chinese)
- [Engineering Principles](docs/engineering/PRINCIPLES.md) (Chinese)
- [Development Workflow](docs/engineering/DEVELOPMENT_WORKFLOW.md) (Chinese)
- [Database Lifecycle](docs/engineering/DATABASE_LIFECYCLE.md) (Chinese)
- [Public Roadmap](docs/roadmap/ROADMAP.md) (Chinese)
- [Changelog](docs/CHANGELOG.md) (Chinese)

## Contributing

Before opening an issue or pull request, read:

- [Contributing Guide](CONTRIBUTING.en.md) / [简体中文](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md) / [简体中文](CODE_OF_CONDUCT.zh-CN.md)
- [Governance](GOVERNANCE.md)
- [Maintainers](MAINTAINERS.md)

Security issues must be reported privately through the channel defined in
[`SECURITY.md`](SECURITY.md), not through a public issue.

## License

YiStack is licensed under the [Apache License 2.0](LICENSE).
