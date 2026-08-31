import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required at runtime");

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: emptyError } = await admin.storage.emptyBucket("note-attachments");
if (emptyError && !/not found/i.test(emptyError.message)) {
  throw emptyError;
}
const { error: deleteError } = await admin.storage.deleteBucket("note-attachments");
if (deleteError && !/not found/i.test(deleteError.message)) {
  throw deleteError;
}
process.stdout.write("Supabase fixture storage rollback passed.\n");
