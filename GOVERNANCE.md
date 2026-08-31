# YiStack Governance

## Current Model

YiStack uses a maintainer-led model during Contributor Alpha. Active
maintainers are listed in [MAINTAINERS.md](MAINTAINERS.md).

Contributor Alpha is controlled: issues define accepted work, CODEOWNERS
approval is required, blocking CI must pass, and sensitive boundaries receive
maintainer review.

## Roles

**Contributors** report issues, improve documentation, review changes, or
submit code under the project license.

**Reviewers** are contributors asked to review a specific area. Reviewer
status does not grant merge, release, secret, or infrastructure access.

**Maintainers** triage issues, define release scope, review and merge changes,
manage security reports, and protect repository and release credentials.

## Decisions

Routine implementation decisions are made in pull-request review. Material
changes require an issue or design document before implementation, including:

- public API or persisted schema changes;
- authentication, authorization, secret, or sandbox boundaries;
- provider contracts and external data transfer;
- dependency or license changes;
- backward-incompatible behavior;
- release, migration, or rollback policy.

Maintainers seek practical consensus. When consensus cannot be reached, the
lead maintainer records the decision and rationale in the issue or pull
request. Security fixes may be decided privately until disclosure is safe.

## Governance Changes

Governance, maintainer membership, and release authority changes require a
public proposal, lead-maintainer approval, and matching updates to this file,
`MAINTAINERS.md`, and `CODEOWNERS`. Urgent security removals may remain private
until disclosure is safe.

## Releases

Only maintainers may create release tags or publish artifacts. A release must
identify its source commit, pass required CI, document incompatible changes,
follow `docs/engineering/DATABASE_LIFECYCLE.md`, and contain no credentials,
runtime data, or local evidence.

## Conflict of Interest

Reviewers disclose material conflicts and do not approve their own changes as
the sole required reviewer. The lead maintainer assigns another reviewer or
records why an exception is necessary.
