# Contributing to YiStack

[简体中文](CONTRIBUTING.md) | [**English**](CONTRIBUTING.en.md)

> This is an English translation of the contribution guide. If the two
> versions differ, the Chinese version is authoritative.

YiStack is currently in **Contributor Alpha**. Contributions are accepted
through reviewed issues and pull requests; the `main` branch is not an
unreviewed integration branch.

By submitting a contribution, you agree that it is licensed under the
[Apache License 2.0](LICENSE).

## Before You Start

- Use an existing issue for bug fixes.
- Open a feature request before implementing a new capability or changing a
  public API, database contract, security boundary, or user workflow.
- Do not open a public issue for a suspected vulnerability. Follow
  [SECURITY.md](SECURITY.md).
- Keep changes scoped. Generated applications, runtime data, credentials, and
  local evidence do not belong in a pull request.

## Development Baseline

Required tools:

| Tool | Supported baseline |
| --- | --- |
| Node.js | 22.x |
| pnpm | 11.5.2 |
| Go | 1.21.6 or newer 1.x |
| Podman | 3.4 or newer, rootless |
| PostgreSQL | 15 or newer, or a Supabase project |

Install from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
(cd backend && go mod download)
cp .env.example .env
```

Initialize a new Supabase project by applying `backend/init.sql`. The file is
the single clean-install schema source for the current pre-release line.
Database upgrade rules are defined in
[`docs/engineering/DATABASE_LIFECYCLE.en.md`](docs/engineering/DATABASE_LIFECYCLE.en.md).

## Required Validation

Run the same blocking checks used by CI:

```bash
pnpm lint
pnpm build
pnpm yes:validate
(cd backend && go test ./...)
pnpm eval:smoke:ci
git diff --check
```

For changes to a user-visible workflow, also run the relevant Playwright
acceptance path on desktop and mobile. For database or environment changes,
run:

```bash
bash scripts/verify-clean-checkout.sh
```

The live canonical generation benchmark needs a running YiStack instance and
an explicitly configured model:

```bash
YISTACK_EVAL_TOKEN=... \
YISTACK_EVAL_PROVIDER=... \
YISTACK_EVAL_MODEL=... \
pnpm eval:smoke
```

Do not commit benchmark credentials or generated files under `runtime/`.

## Pull Request Requirements

A pull request must:

- explain the user-visible behavior and the ownership boundary being changed;
- reference its issue unless it is a small documentation correction;
- include focused tests for changed behavior;
- update contracts and documentation when public behavior changes;
- preserve backward compatibility or document the migration and rollback;
- pass all required CI checks with zero ESLint errors;
- contain no secrets, generated runtime workspaces, or unrelated refactors.

Maintainers may close stale, unsafe, unverifiable, or out-of-scope changes.
Approval from the applicable entry in `.github/CODEOWNERS` is required before
merge.

## Commit Style

Use a short imperative subject with a conventional prefix when practical:

```text
feat: add ...
fix: prevent ...
docs: clarify ...
test: cover ...
chore: update ...
```

## Review and Merge

Maintainers decide whether a change fits the current roadmap. Review focuses
on correctness, security boundaries, failure behavior, tests, and operational
rollback. Passing CI is necessary but does not guarantee merge.
