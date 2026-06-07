BEGIN;

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE playlists
ALTER COLUMN is_public SET DEFAULT false;

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS slug TEXT NULL;

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_slug_unique
ON playlists(slug)
WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playlists_is_public
ON playlists(is_public);

CREATE INDEX IF NOT EXISTS idx_playlists_user_public
ON playlists(user_id, is_public);

CREATE INDEX IF NOT EXISTS idx_songs_active_play_count
ON songs(is_active, play_count DESC);

CREATE INDEX IF NOT EXISTS idx_songs_active_created_at
ON songs(is_active, created_at DESC);

COMMIT;
