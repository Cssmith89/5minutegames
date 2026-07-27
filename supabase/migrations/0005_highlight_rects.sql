-- 5 Minute Games: add positional rects to saved highlights, enabling accurate
-- multi-line/multi-fragment highlight rendering (Phase 3 follow-up). Run via
-- `supabase db push` or paste into the Supabase SQL editor. Depends on
-- 0004_bookmarks_highlights.sql already being applied.

alter table highlights add column rects jsonb;
