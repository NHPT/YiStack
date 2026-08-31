# Supabase Application Preset

`supabase_app.v1` is the R6.1 generation contract for applications that use Supabase as their backend.

## Activation

The preset is selected automatically when either condition is true:

- structured project or plan `tech_stack` declares `backend.preset = "supabase"`, `database.type = "Supabase"`, or an equivalent provider field;
- the approved plan or current implementation request explicitly asks for Supabase and does not explicitly opt out.

There is no administrator binding step. The resolved contract is appended to the stable generation context before the model request.

## Generated Contract

A new Supabase scaffold must contain:

- Supabase Auth integration;
- owner-scoped tables with `user_id` referencing `auth.users(id)`;
- forward SQL below `supabase/migrations/`;
- rollback SQL below `supabase/rollback/`;
- enabled RLS and owner policies for select, insert, update, and delete;
- private Storage bucket policies using the authenticated user ID as the first object path segment;
- generated TypeScript `Database` types;
- `.env.example` with placeholders only.

The pre-write gate materializes the final file view from the workspace snapshot plus create/replace/patch/delete operations. A missing artifact or invalid policy fails as `generation_schema_invalid` before any file is written.

## Secret Boundary

Browser code may read only the public Supabase URL and anon/publishable key. It must never reference a public-prefixed service-role variable or `SUPABASE_SERVICE_ROLE_KEY`.

Server code may read `SUPABASE_SERVICE_ROLE_KEY` only at runtime from a server-only module. The key must not be committed, logged, returned by an API, or copied into an error message. Generation operations reject browser-exposed service-role names and committed service-role-shaped values in both initial generation and repair output.

Real `.env`, `.env.local`, and environment-specific files remain protected generation paths. `.env.example` is the only allowed environment file and must contain placeholders.

## Fixture

`evals/fixtures/supabase-user-crud` provides the executable acceptance fixture:

- Next.js login and owner CRUD UI;
- typed Supabase browser client;
- notes schema and four owner RLS policies;
- private `note-attachments` bucket policies;
- two-user Auth and RLS negative test;
- Storage API cleanup followed by SQL rollback.

The RLS test proves that one authenticated user cannot read, update, delete, or forge an insert for another user's data. Owner CRUD remains available.

## Validation

Run:

```bash
node scripts/validate-platform001-supabase-preset.mjs
cd backend && go test ./internal/service -count=1
pnpm exec tsc -p evals/fixtures/supabase-user-crud/tsconfig.json --noEmit
cd evals/fixtures/supabase-user-crud && pnpm exec next build --webpack
```

The live RLS and rollback tests additionally require an isolated Supabase target and runtime-injected values from `.env.example`. Do not run them against production data.

R6.1 does not include GitHub import/sync, deployment, custom domains, project collaboration, or the official template catalog.
