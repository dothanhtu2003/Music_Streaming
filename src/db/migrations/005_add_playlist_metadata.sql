-- Migration: Add playlist metadata fields for SoundCloud-like sets.
BEGIN;

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE playlists
ALTER COLUMN is_public SET DEFAULT TRUE;

COMMIT;
