drop policy if exists note_attachments_owner_delete on storage.objects;
drop policy if exists note_attachments_owner_update on storage.objects;
drop policy if exists note_attachments_owner_insert on storage.objects;
drop policy if exists note_attachments_owner_select on storage.objects;

-- Empty and delete note-attachments through the Storage API before this SQL.
-- Direct writes to storage tables are intentionally forbidden by Supabase.

drop policy if exists notes_owner_delete on public.notes;
drop policy if exists notes_owner_update on public.notes;
drop policy if exists notes_owner_insert on public.notes;
drop policy if exists notes_owner_select on public.notes;
drop table if exists public.notes;
