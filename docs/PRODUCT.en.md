# YiStack Product Boundaries

[简体中文](PRODUCT.md) | [**English**](PRODUCT.en.md)

> This is an English translation. If the two versions differ, the Chinese
> version is authoritative.

This document defines YiStack's product position and capability boundaries.
Roadmap items and commercial ideas must not be presented as delivered features.

> **Planned does not mean implemented.** Public status is determined only by
> `README.md`, `docs/CHANGELOG.md`, `docs/roadmap/ROADMAP.md`, and evidence
> produced by executable gates.

## 1. Product Position

YiStack is an AI application generation and engineering workspace for
developers. A user starts with a natural-language requirement, selects from
candidate solutions, implements code in an isolated project workspace, and
uses build, test, lint, preview, and browser acceptance results to determine
whether the output is deliverable.

Core goals:

1. **Truthful results**: protocol, command, build, and browser acceptance
   failures must never be reported as success.
2. **Recoverable execution**: long-running generation work has durable state,
   attempts, event replay, and explicit terminal states.
3. **Auditable boundaries**: provider, Git, deployment, collaboration, and
   database operations retain explicit permissions and evidence.
4. **User-owned code**: project source can be inspected, edited, managed with
   Git, and exported.
5. **Minimal deployment surface**: prefer Supabase, rootless Podman, and
   explicit provider adapters before introducing a distributed control plane.

## 2. Status Definitions

| Status | Meaning |
| --- | --- |
| Implemented | A real implementation and automated gates exist in the repository |
| Contract implemented | The local adapter, failure boundaries, and tests are complete; the external platform lifecycle still requires credentialed acceptance |
| Experimental | Usable, but APIs or storage structures may change before a stable release |
| Planned | Not complete and not a release commitment |
| Out of current scope | Not provided during Contributor Alpha |

## 3. Current Product Capabilities

| Area | Status | Current boundary |
| --- | --- | --- |
| Requirements to solution | Implemented | Foundation and solution approval both have structured state |
| Code generation | Implemented | Atomic `generation_result.v2` file operations reject invalid protocols and paths outside the workspace |
| Project quality gate | Implemented | Stack-aware build/test/lint, blocking failures, and bounded automatic repair |
| Durable jobs | Implemented | Generation Jobs, attempts, leases, SSE replay, cancellation, and interruption recovery |
| Browser acceptance | Implemented | Deterministic acceptance runs after preview startup and blocks browser errors |
| Workspace | Implemented | Monaco, file tree, terminal, Git, preview, and generation state |
| Container runtime | Implemented | Per-project rootless Podman boundaries and resource policies |
| Supabase application preset | Implemented | Auth, CRUD RLS, private Storage, types, migrations, and rollback |
| GitHub integration | Implemented | OAuth PKCE, encrypted tokens, import, guarded pull/push, and webhooks |
| Vercel adapter | Contract implemented | Publish, redacted logs, rollback, and domain contracts are tested; live cloud acceptance is deferred to the unified multi-provider phase |
| Project collaboration | Implemented | Owner/editor/viewer roles, owner-only administration, and append-only auditing |
| Official templates | Experimental | One initial template with immutable versions, checksums, publishing, and CAS rollback |
| Contributor workflow | Implemented | Apache-2.0, governance files, CODEOWNERS, CI, and clean-checkout gates |

## 4. Explicitly Not Implemented or Promised

The following must not be described in the README, release notes, or product UI
as currently available:

- a community template marketplace, template sales, or "50+ templates";
- a general plugin system or third-party plugin compatibility;
- a complete production lifecycle across multiple cloud providers;
- end-to-end enterprise SSO, highly available Kubernetes, or a formal SLA;
- released Professional or Enterprise editions, pricing, or paid entitlements;
- automatic in-place upgrades from arbitrary historical database versions;
- automatic merging of community code without human review.

These items may be marked implemented only after their implementation, tests,
security review, and release gates are complete.

## 5. Core Workflow

```text
Requirement input
  -> Foundation decisions
  -> Technical solution approval
  -> Durable Generation Job
  -> Atomic file operations
  -> Project-level build/test/lint
  -> Bounded automatic repair
  -> Preview service
  -> Browser acceptance
  -> Git version and delivery evidence
```

Every blocking failure must produce an explicit failure state, stable error
code, or recovery action. The workflow must not skip a failed stage and still
claim generation succeeded.

## 6. Architecture Boundaries

### Frontend

- Next.js 16, React 19, and TypeScript 5.9.
- The workspace reaches the Go API through same-origin Next.js Route Handlers.
- Browsers never hold service-role credentials, GitHub client secrets, Vercel
  tokens, or application encryption keys.

### Backend

- Go, Hertz, and GORM.
- Services enforce permissions and business invariants; repositories handle
  persistence.
- External commands are constrained by allowlists, workspace paths, and
  timeouts.
- High-risk operations use owner-only authorization, explicit confirmation,
  compare-and-set operations, or idempotency keys.

### Runtime

- Every project runs in an isolated rootless Podman container.
- Project source lives on the file system; the database stores metadata and
  job state.
- `runtime/`, logs, and local acceptance evidence are not source-release
  content.

### Database

- The default integration is Supabase/PostgreSQL.
- `backend/init.sql` is the single source of truth for clean installation.
- `public.schema_migrations` records the known baseline and later upgrades.
- Contributor Alpha does not promise upgrade compatibility for unknown
  historical databases.

## 7. External Integration Boundaries

| Integration | Credential location | Failure principle |
| --- | --- | --- |
| LLM provider | Admin-managed database configuration | Do not load a provider when configuration or preflight fails |
| Supabase | Server environment variables | The service-role credential is server-only |
| GitHub | Server-side encrypted token vault | Block push on conflicts or lease mismatch |
| Vercel | Server environment variables or encrypted secrets | Fail closed on decryption, publish, log, or rollback errors |

The repository contains no shared credential suitable for a real environment.
YiStack does not guarantee external platform availability, quotas, or terms of
service.

## 8. Open-Source and Contribution Stage

The Contributor Alpha repository gate has passed. After the GitHub remote has
required checks and branch protection enabled, controlled pull requests are
accepted under these conditions:

- an issue defines the scope first;
- CODEOWNERS review is required;
- lint, build, YES, Go tests, and canonical eval smoke all pass;
- database and security changes include migration and rollback boundaries;
- user-visible changes include browser acceptance evidence.

Contributor Alpha is not a stable release or Community Beta. See
`docs/roadmap/ROADMAP.en.md` for the opening sequence and remaining gates.

## 9. Commercial and Versioning Notes

Community, Professional, and Enterprise editions and their pricing remain
product hypotheses, not release commitments. Any future closed-source module,
commercial term, or trademark policy must remain clearly separated from the
Apache-2.0 repository and must update governance and licensing documentation
before taking effect.

## 10. License

Repository source is licensed under the
[Apache License 2.0](../LICENSE). Third-party dependencies remain subject to
their own licenses.
