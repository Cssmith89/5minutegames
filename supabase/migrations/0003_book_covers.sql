-- 5 Minute Games: cover thumbnails for the PDF book library (Phase 2).
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- Small first-page thumbnail, generated client-side and stored inline as a
-- data URL -- no new storage bucket/RLS needed, and it's dropped for free
-- when the owning book row is deleted.
alter table books add column cover_data_url text;
