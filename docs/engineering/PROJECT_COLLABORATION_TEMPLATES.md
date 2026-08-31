# Project Collaboration and Official Templates

Status: Done (R6.4)

## Scope

R6.4 implements a controlled minimum collaboration loop and a versioned official project-template catalog. It does not claim real-time co-editing, email invitations, community templates, plugins, or a marketplace.

## Project roles

| Role | Read project | Edit files / generate / terminal | Manage members | Project metadata / delete | GitHub / deploy / backup |
| --- | --- | --- | --- | --- | --- |
| owner | yes | yes | yes | yes | yes |
| editor | yes | yes | no | no | no |
| viewer | yes | no | no | no | no |

- The project owner remains the `projects.user_id` source of truth.
- Members must already be active YiStack users.
- Member mutations require explicit confirmation.
- Project list responses include `access_role`, `can_write`, and `can_manage_members`.
- Shared projects are included in the normal project list.
- GitHub, deployment, backup, preview sharing, resource enforcement, project metadata, and deletion remain owner-only.
- Every real member add, role update, and removal writes an append-only audit row in the same database transaction.

## Official templates

- Templates and versions are persistent database records.
- Version file payloads are normalized, path-checked, size-limited, sorted, and SHA-256 verified.
- A project may be created from the current or a historical immutable version.
- Template materialization writes only safe project-relative paths and creates the initial Git commit.
- Failed materialization or commit removes the partial workspace and project record.
- Publishing and rollback require explicit confirmation.
- Publishing and rollback use an expected-current version guard.
- Version switching and its audit record are atomic.
- `files_json` is never returned by the API.
- YiStack seeds one minimal `static-web-starter` official template when the catalog is empty.

## API

User routes:

```text
GET    /api/project/:id/access
GET    /api/project/:id/members
POST   /api/project/:id/members
DELETE /api/project/:id/members
GET    /api/project/:id/collaboration-audits
GET    /api/project/templates
GET    /api/project/templates/:template_id/versions
POST   /api/project/templates/create
```

Super-admin routes:

```text
GET  /api/admin/project-templates
POST /api/admin/project-templates
GET  /api/admin/project-templates/:template_id/versions
POST /api/admin/project-templates/:template_id/rollback
```

## Database boundary

Authoritative schema remains `backend/init.sql`.

```text
project_members
project_collaboration_audits
official_project_templates
official_project_template_versions
official_project_template_audits
```

Atomic service-role-only RPCs:

```text
mutate_project_member
publish_official_project_template_version
rollback_official_project_template_version
```

All five tables have RLS enabled and expose no direct authenticated-user policy. The Go backend applies project ownership and role authorization before using the service role.

## Validation

```bash
node scripts/validate-platform001-collaboration-templates.mjs
pnpm yes:validate
pnpm build
cd backend && go test ./... && go vet ./...
git diff --check
```

Acceptance evidence includes real PostgreSQL execution of the complete `init.sql`, transactional member/template RPC exercises, Go service tests, deterministic HTTP/browser fixtures, desktop and mobile Playwright checks, and zero horizontal page overflow.
