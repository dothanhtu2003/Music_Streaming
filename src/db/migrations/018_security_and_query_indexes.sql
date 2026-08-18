BEGIN;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_user
ON refresh_tokens(user_id, expires_at)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listening_history_user_listened_at
ON listening_history(user_id, listened_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'song_comments_content_length_check'
  ) THEN
    ALTER TABLE song_comments
    ADD CONSTRAINT song_comments_content_length_check
    CHECK (length(trim(content)) BETWEEN 1 AND 2000) NOT VALID;
  END IF;
END;
$$;

COMMIT;
