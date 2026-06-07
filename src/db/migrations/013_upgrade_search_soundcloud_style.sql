-- Migration: Upgrade search for SoundCloud-style universal results.
BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.unaccent($1)
$$;

CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT search_history_query_check CHECK (length(trim(query)) > 0),
  CONSTRAINT search_history_normalized_query_check CHECK (length(trim(normalized_query)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_user_normalized
ON search_history(user_id, normalized_query)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_history_user_created_at
ON search_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS search_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL UNIQUE,
  search_count INTEGER NOT NULL DEFAULT 1,
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT search_trends_count_check CHECK (search_count >= 1),
  CONSTRAINT search_trends_query_check CHECK (length(trim(query)) > 0),
  CONSTRAINT search_trends_normalized_query_check CHECK (length(trim(normalized_query)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_search_trends_rank
ON search_trends(search_count DESC, last_searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_trends_normalized_trgm
ON search_trends USING GIN (immutable_unaccent(lower(normalized_query)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_songs_title_unaccent_trgm
ON songs USING GIN (immutable_unaccent(lower(title)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_songs_description_unaccent_trgm
ON songs USING GIN (immutable_unaccent(lower(COALESCE(description, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_artists_name_unaccent_trgm
ON artists USING GIN (immutable_unaccent(lower(name)) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_playlists_name_unaccent_trgm
ON playlists USING GIN (immutable_unaccent(lower(name)) gin_trgm_ops);

COMMIT;
