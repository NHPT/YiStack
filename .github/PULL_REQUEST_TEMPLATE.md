## Summary

<!-- What behavior changes, and why? -->

## Linked Issue

Closes #

## Scope and Risk

- Ownership boundary:
- Security or privacy impact:
- Persistence or migration impact:
- Backward compatibility:
- Rollback:

## Validation

- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm yes:validate`
- [ ] `(cd backend && go test ./...)`
- [ ] `pnpm eval:smoke:ci`
- [ ] `git diff --check`
- [ ] Relevant desktop/mobile Playwright path, or not applicable with reason
- [ ] Database clean-install/upgrade check, or not applicable with reason

## Evidence

<!-- Add focused test output, screenshots, or sanitized logs. Do not include secrets or user data. -->

## Contributor Checks

- [ ] This change is scoped to the linked issue.
- [ ] Tests cover changed behavior and failure paths.
- [ ] Public contracts and documentation are updated.
- [ ] No credentials, runtime workspaces, or generated evidence are committed.
- [ ] I agree to license this contribution under Apache-2.0.
