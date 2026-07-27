-- 5 Minute Games: bookmarks and saved highlights for the PDF book reader
-- (Phase 3). Run via `supabase db push` or paste into the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per bookmarked page. Toggled on/off, so (user, book, page) is unique.
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  page_number int not null,
  created_at timestamptz not null default now(),
  unique (user_id, book_id, page_number)
);

create index bookmarks_user_book_idx on bookmarks(user_id, book_id);

-- One row per saved highlight (a selected quote on a page). Rows are
-- immutable -- added or removed, never edited.
create table highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  page_number int not null,
  quote text not null,
  created_at timestamptz not null default now()
);

create index highlights_user_book_idx on highlights(user_id, book_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Same pattern as reading_progress in 0002_books.sql: user-owned data,
-- RLS-scoped client, no service-role bypass. No update policy -- rows are
-- add-or-remove only.

alter table bookmarks enable row level security;

create policy "users can read their own bookmarks"
  on bookmarks for select using (auth.uid() = user_id);

create policy "users can insert their own bookmarks"
  on bookmarks for insert with check (auth.uid() = user_id);

create policy "users can delete their own bookmarks"
  on bookmarks for delete using (auth.uid() = user_id);

alter table highlights enable row level security;

create policy "users can read their own highlights"
  on highlights for select using (auth.uid() = user_id);

create policy "users can insert their own highlights"
  on highlights for insert with check (auth.uid() = user_id);

create policy "users can delete their own highlights"
  on highlights for delete using (auth.uid() = user_id);
