import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const preset = read("backend/internal/service/supabase_app_preset.go");
const artifacts = read("backend/internal/service/generator_artifacts_stage.go");
const runtime = read("backend/internal/service/generator_runtime_stage.go");
const fileOperations = read("backend/internal/service/generation_file_operations.go");
const fixtureRoot = "evals/fixtures/supabase-user-crud";
const migration = read(`${fixtureRoot}/supabase/migrations/202608280001_user_notes.sql`);
const rollback = read(`${fixtureRoot}/supabase/rollback/202608280001_user_notes.sql`);
const browserClient = read(`${fixtureRoot}/src/lib/supabase/client.ts`);
const fixturePage = read(`${fixtureRoot}/src/app/page.tsx`);
const rlsTest = read(`${fixtureRoot}/tests/rls.e2e.mjs`);
const storageRollback = read(`${fixtureRoot}/tests/rollback.mjs`);
const envExample = read(`${fixtureRoot}/.env.example`);

assert.match(preset, /supabase_app\.v1/);
assert.match(runtime, /appendSupabaseAppPresetContext/);
assert.match(artifacts, /validateSupabaseAppPresetOperations/);
assert.match(artifacts, /newGenerationSchemaFailure\(presetErr\)/);
assert.match(fileOperations, /base != "\.env\.example"/);

for (const expected of [
  "enable row level security",
  "auth.uid() = user_id",
  "for select",
  "for insert",
  "for update",
  "for delete",
  "storage.objects",
  "storage.foldername(name)",
]) {
  assert.ok(migration.toLowerCase().includes(expected.toLowerCase()), `migration missing ${expected}`);
}

for (const expected of [
  "drop policy if exists",
  "drop table if exists public.notes",
]) {
  assert.ok(rollback.toLowerCase().includes(expected.toLowerCase()), `rollback missing ${expected}`);
}
assert.match(storageRollback, /emptyBucket\("note-attachments"\)/);
assert.match(storageRollback, /deleteBucket\("note-attachments"\)/);
assert.doesNotMatch(rollback, /delete from storage\.(objects|buckets)/i);

assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_URL/);
assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.doesNotMatch(browserClient, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(fixturePage, /signInWithPassword/);
assert.match(fixturePage, /\.from\("notes"\)\.select/);
assert.match(fixturePage, /\.from\("notes"\)\.insert/);
assert.match(fixturePage, /\.from\("notes"\)\.update/);
assert.match(fixturePage, /\.from\("notes"\)\.delete/);

assert.match(rlsTest, /createUser/);
assert.match(rlsTest, /signInWithPassword/);
assert.match(rlsTest, /RLS must hide another user's row/);
assert.match(rlsTest, /RLS must block another user's update/);
assert.match(rlsTest, /RLS must reject a forged user_id insert/);
assert.match(rlsTest, /RLS must block another user's delete/);

for (const line of envExample.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [, value = ""] = line.split("=", 2);
  assert.match(value, /your[-_]|example/, `environment example contains a non-placeholder value: ${line}`);
}
assert.doesNotMatch(envExample, /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/);
assert.doesNotMatch(envExample, /VITE_[A-Z0-9_]*SERVICE_ROLE/);

const fixtureFiles = [
  `${fixtureRoot}/.env.example`,
  `${fixtureRoot}/package.json`,
  `${fixtureRoot}/src/app/page.tsx`,
  `${fixtureRoot}/src/lib/supabase/client.ts`,
  `${fixtureRoot}/src/lib/supabase/database.types.ts`,
  `${fixtureRoot}/supabase/migrations/202608280001_user_notes.sql`,
  `${fixtureRoot}/supabase/rollback/202608280001_user_notes.sql`,
  `${fixtureRoot}/tests/rls.e2e.mjs`,
  `${fixtureRoot}/tests/rollback.mjs`,
];
for (const relativePath of fixtureFiles) {
  assert.ok(fs.statSync(path.join(root, relativePath)).isFile(), `missing fixture file ${relativePath}`);
}

process.stdout.write("PLATFORM-001 Supabase application preset contract passed.\n");
