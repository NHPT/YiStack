# Vercel Deployment and Domain Lifecycle

`PLATFORM-001 / R6.3` uses the Vercel REST API as the first managed deployment adapter.

## Deployment boundary

A deployment is accepted only when the caller owns the project, explicitly confirms the operation, supplies a durable idempotency key, and the Vercel adapter is configured. Before any provider mutation, YiStack:

1. starts or reuses the project runtime;
2. runs the existing project Validation Gate;
3. requires a clean Git worktree;
4. resolves the exact Git commit;
5. reads only tracked files, rejects protected paths and bounded-size violations;
6. computes one SHA-256 artifact fingerprint and per-file SHA-1 upload digests.

Vercel receives immutable file references. Local generation success is not modified when deployment fails, and provider success cannot override a failed local Validation Gate.

## Secret boundary

Required server-only bootstrap values:

```text
VERCEL_ACCESS_TOKEN
VERCEL_TEAM_ID
VERCEL_API_BASE_URL
DEPLOYMENT_SECRET_ENCRYPTION_KEY
```

The Vercel token and encryption key remain empty in `.env.example` and are excluded from config JSON. Application environment values are submitted as Vercel `sensitive` variables. YiStack stores only variable names in API-visible fields; values are encrypted with AES-256-GCM in hidden release fields so build logs and provider errors can be redacted exactly. Decryption failure blocks log/status responses.

## Release lifecycle

- Preview and production deployment creation are explicit and idempotent.
- Release status is refreshed from the provider and persisted.
- Build events are loaded on demand, bounded, and redacted before returning.
- Rollback requires a ready target release, explicit confirmation, and the expected current production deployment ID. It promotes the immutable previous deployment without rebuilding it.

## Domain lifecycle

A ready production release is required before adding a custom domain. Add, verify, and remove are separate confirmed, idempotent operations. Pending domains expose the DNS verification type, name, and challenge value returned by Vercel.

## Validation

```bash
node scripts/validate-platform001-deployment.mjs
cd backend && go test ./internal/service ./internal/handler ./internal/repository ./pkg/supabase ./cmd/server
pnpm exec tsc --noEmit
pnpm yes:validate
pnpm build
```

The adapter and UI are accepted through deterministic HTTP tests, YES contracts, and browser fixtures without provider credentials. R6.3 is complete at the adapter-contract level. Live production deployment, status/log retrieval, rollback, and add/verify/remove domain operations remain explicitly deferred and will be exercised together in the later multi-provider deployment acceptance phase.
