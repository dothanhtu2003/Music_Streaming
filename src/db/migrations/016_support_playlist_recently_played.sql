ALTER TABLE recently_played
ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) NOT NULL DEFAULT 'song';

ALTER TABLE recently_played
ADD COLUMN IF NOT EXISTS playlist_id UUID;

ALTER TABLE recently_played
ALTER COLUMN song_id DROP NOT NULL;

ALTER TABLE recently_played
DROP CONSTRAINT IF EXISTS recently_played_user_id_song_id_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recently_played_playlist_id_fk'
  ) THEN
    ALTER TABLE recently_played
    ADD CONSTRAINT recently_played_playlist_id_fk
      FOREIGN KEY (playlist_id)
      REFERENCES playlists(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recently_played_item_type_check'
  ) THEN
    ALTER TABLE recently_played
    ADD CONSTRAINT recently_played_item_type_check
      CHECK (item_type IN ('song', 'playlist'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recently_played_item_reference_check'
  ) THEN
    ALTER TABLE recently_played
    ADD CONSTRAINT recently_played_item_reference_check
      CHECK (
        (item_type = 'song' AND song_id IS NOT NULL AND playlist_id IS NULL)
        OR
        (item_type = 'playlist' AND playlist_id IS NOT NULL AND song_id IS NULL)
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_played_user_song_unique
ON recently_played(user_id, song_id)
WHERE item_type = 'song';

CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_played_user_playlist_unique
ON recently_played(user_id, playlist_id)
WHERE item_type = 'playlist';

CREATE INDEX IF NOT EXISTS idx_recently_played_playlist_id
ON recently_played(playlist_id);

CREATE INDEX IF NOT EXISTS idx_recently_played_user_item_type
ON recently_played(user_id, item_type);

COMMENT ON TABLE recently_played IS 'Stores each user latest played songs and playlists without duplicate item rows.';
