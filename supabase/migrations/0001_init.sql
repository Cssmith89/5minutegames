-- 5 Minute Games: cloud save storage.
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per (user, game, slot). `data` is whatever JSON-safe shape the
-- game's own save format serializes to (see each game's own save/load code) --
-- this table is intentionally generic across every game on the site, not
-- specific to any one game's fields.
create table game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_slug text not null,
  slot int not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, game_slug, slot)
);

create index game_saves_user_game_idx on game_saves(user_id, game_slug);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Unlike the video-hosting site's tables (anonymous/admin-curated data,
-- written via a service-role client), save data is genuinely user-owned, so
-- routes use the normal RLS-scoped client and rely on these policies rather
-- than bypassing RLS.

alter table game_saves enable row level security;

create policy "users can read their own saves"
  on game_saves for select using (auth.uid() = user_id);

create policy "users can insert their own saves"
  on game_saves for insert with check (auth.uid() = user_id);

create policy "users can update their own saves"
  on game_saves for update using (auth.uid() = user_id);

create policy "users can delete their own saves"
  on game_saves for delete using (auth.uid() = user_id);
