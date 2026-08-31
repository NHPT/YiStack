import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required at runtime");

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runID = randomUUID();
const password = `Fixture-${runID}!`;
const users = [
  { email: `fixture-a-${runID}@example.test`, id: "" },
  { email: `fixture-b-${runID}@example.test`, id: "" },
];

async function createUser(user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  assert.ok(data.user?.id);
  user.id = data.user.id;
}

async function userClient(user) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password,
  });
  assert.ifError(error);
  return client;
}

async function run() {
  await createUser(users[0]);
  await createUser(users[1]);
  const owner = await userClient(users[0]);
  const stranger = await userClient(users[1]);

  const { data: created, error: createError } = await owner
    .from("notes")
    .insert({ user_id: users[0].id, title: "owner note" })
    .select()
    .single();
  assert.ifError(createError);
  assert.equal(created.user_id, users[0].id);

  const { data: ownerRows, error: ownerReadError } = await owner
    .from("notes")
    .select("*")
    .eq("id", created.id);
  assert.ifError(ownerReadError);
  assert.equal(ownerRows.length, 1, "owner must read its row");

  const { data: strangerRows, error: strangerReadError } = await stranger
    .from("notes")
    .select("*")
    .eq("id", created.id);
  assert.ifError(strangerReadError);
  assert.equal(strangerRows.length, 0, "RLS must hide another user's row");

  const { data: strangerUpdates, error: strangerUpdateError } = await stranger
    .from("notes")
    .update({ title: "unauthorized update" })
    .eq("id", created.id)
    .select();
  assert.ifError(strangerUpdateError);
  assert.equal(strangerUpdates.length, 0, "RLS must block another user's update");

  const { error: forgedInsertError } = await stranger
    .from("notes")
    .insert({ user_id: users[0].id, title: "forged owner" });
  assert.ok(forgedInsertError, "RLS must reject a forged user_id insert");

  const { data: strangerDeletes, error: strangerDeleteError } = await stranger
    .from("notes")
    .delete()
    .eq("id", created.id)
    .select();
  assert.ifError(strangerDeleteError);
  assert.equal(strangerDeletes.length, 0, "RLS must block another user's delete");

  const { data: updated, error: updateError } = await owner
    .from("notes")
    .update({ title: "owner updated" })
    .eq("id", created.id)
    .select()
    .single();
  assert.ifError(updateError);
  assert.equal(updated.title, "owner updated");

  const { data: deleted, error: deleteError } = await owner
    .from("notes")
    .delete()
    .eq("id", created.id)
    .select();
  assert.ifError(deleteError);
  assert.equal(deleted.length, 1, "owner must delete its row");
}

async function cleanup() {
  for (const user of users) {
    if (user.id) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

try {
  await run();
  process.stdout.write("Supabase auth, owner CRUD, and RLS negative checks passed.\n");
} finally {
  await cleanup();
}
