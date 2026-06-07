BEGIN;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_songs_uploaded_by
ON songs(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_songs_uploaded_by_active
ON songs(uploaded_by, is_active);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artists' AND column_name = 'user_id'
  ) THEN
    UPDATE songs s
    SET uploaded_by = a.user_id
    FROM artists a
    WHERE s.artist_id = a.id
      AND s.uploaded_by IS NULL
      AND a.user_id IS NOT NULL;
END IF;
END $$;

COMMIT;
