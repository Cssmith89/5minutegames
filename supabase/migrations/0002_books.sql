-- 5 Minute Games: personal PDF book library (Phase 0 of the book reader).
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- Private bucket for uploaded PDFs, one folder per user: books/{user_id}/{book_id}.pdf
-- PDF-only and a generous backend safety cap; the real user-facing upload
-- limit/UX is decided in a later phase, this is just an infra guardrail.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 104857600, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per uploaded book.
create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_filename text not null,
  file_path text not null,
  file_size bigint not null,
  page_count int,
  uploaded_at timestamptz not null default now()
);

create index books_user_idx on books(user_id);

-- One row per (user, book) reading position -- same shape as game_saves.
create table reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  current_page int not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index reading_progress_user_book_idx on reading_progress(user_id, book_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Same pattern as game_saves in 0001_init.sql: user-owned data, RLS-scoped
-- client, no service-role bypass.

alter table books enable row level security;

create policy "users can read their own books"
  on books for select using (auth.uid() = user_id);

create policy "users can insert their own books"
  on books for insert with check (auth.uid() = user_id);

create policy "users can update their own books"
  on books for update using (auth.uid() = user_id);

create policy "users can delete their own books"
  on books for delete using (auth.uid() = user_id);

alter table reading_progress enable row level security;

create policy "users can read their own reading progress"
  on reading_progress for select using (auth.uid() = user_id);

create policy "users can insert their own reading progress"
  on reading_progress for insert with check (auth.uid() = user_id);

create policy "users can update their own reading progress"
  on reading_progress for update using (auth.uid() = user_id);

create policy "users can delete their own reading progress"
  on reading_progress for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------
-- Scope the `books` bucket so a user can only read/write objects under their
-- own {user_id}/ folder -- object paths are books/{user_id}/{book_id}.pdf,
-- so (storage.foldername(name))[1] is the first path segment (the user id).

create policy "users can read their own book files"
  on storage.objects for select
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can upload their own book files"
  on storage.objects for insert
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can update their own book files"
  on storage.objects for update
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own book files"
  on storage.objects for delete
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
