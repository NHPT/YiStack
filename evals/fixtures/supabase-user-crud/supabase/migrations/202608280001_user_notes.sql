create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_id_created_at_idx
  on public.notes (user_id, created_at desc);

alter table public.notes enable row level security;

create policy notes_owner_select
  on public.notes
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy notes_owner_insert
  on public.notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy notes_owner_update
  on public.notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy notes_owner_delete
  on public.notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', false)
on conflict (id) do update set public = false;

create policy note_attachments_owner_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy note_attachments_owner_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy note_attachments_owner_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy note_attachments_owner_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
