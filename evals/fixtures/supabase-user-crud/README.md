# Supabase User CRUD Fixture

This fixture is the executable acceptance target for `supabase_app.v1`.

## Apply

1. Apply `supabase/migrations/202608280001_user_notes.sql` to an isolated Supabase project.
2. Inject the three variables documented in `.env.example` at runtime.
3. Run `pnpm install`, `pnpm build`, and `pnpm test:rls` in this directory.
4. Start the app and verify `/` shows `Private Notes`; without credentials it renders deterministic local demo state.

The RLS test creates two temporary authenticated users. User A performs CRUD on its own row. User B must be unable to read, update, or delete that row and must be unable to insert a row owned by user A.

## Rollback

Run `pnpm rollback:storage` first so the Storage API empties and removes the private bucket without bypassing Storage integrity triggers. Then run `supabase/rollback/202608280001_user_notes.sql` against the isolated fixture project to remove policies and the table.

Both steps require runtime-injected credentials. Neither step writes secrets to the project.

## Secret Boundary

- Browser code reads only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is read only by the Node test process and is never returned to browser code.
- Real environment files are not committed. `.env.example` contains placeholders only.
