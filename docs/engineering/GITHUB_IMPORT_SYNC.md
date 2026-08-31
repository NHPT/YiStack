# GitHub Import and Sync

`PLATFORM-001 / R6.2` provides user-owned GitHub OAuth, repository import, and explicit synchronization.

## Authentication and secrets

- OAuth Authorization Code uses a one-time, SHA-256-hashed state and PKCE `S256`.
- Access tokens are encrypted with AES-256-GCM before persistence.
- Token ciphertext, nonce, encryption configuration, and temporary Git environment values are excluded from JSON responses.
- Git authentication is injected only for network commands through `http.extraHeader`; tokens are never written to remote URLs, project files, Git argv, logs, or API responses.
- Disconnect revokes the OAuth token through GitHub before deleting the local encrypted connection.

Required bootstrap configuration:

```text
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
GITHUB_OAUTH_CALLBACK_URL
GITHUB_TOKEN_ENCRYPTION_KEY
GITHUB_WEBHOOK_SECRET
GITHUB_WEBHOOK_URL
```

`GITHUB_TOKEN_ENCRYPTION_KEY` must decode to exactly 32 bytes. Sensitive values in `.env.example` remain empty placeholders.

## Import and synchronization

- Import requires repository admin permission, explicit workspace replacement confirmation, and a clean worktree.
- The existing `HEAD` is preserved under `refs/yistack/import-backup/<timestamp>` before checkout.
- The configured remote URL contains no credentials.
- Pull requires explicit confirmation, a clean worktree, the bound branch, and fast-forward-only history.
- Push requires explicit confirmation and push permission. Remote-ahead and divergent histories are blocked.
- Force push additionally requires repository admin permission, a second confirmation, the expected remote SHA, and exact `--force-with-lease`.
- Import, pull, and push use durable idempotency records keyed by user and caller-provided idempotency key.

## Webhooks

Import installs or reuses a repository push webhook. Incoming requests require `X-GitHub-Delivery`, `X-GitHub-Event`, and a valid HMAC-SHA256 `X-Hub-Signature-256`.

Delivery IDs are persisted as replay keys. A push webhook only records the latest remote SHA on matching bindings. It never runs Git or modifies a workspace; users must still trigger Pull explicitly.

## Validation

Run `node scripts/validate-platform001-github-sync.mjs`, backend Go tests, `pnpm exec tsc --noEmit`, `pnpm build`, and `pnpm yes:validate`.
