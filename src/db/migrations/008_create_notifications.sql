CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  actor_id UUID,
  type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT notifications_actor_id_fk
    FOREIGN KEY (actor_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT notifications_type_check
    CHECK (
      type IN (
        'LIKE_SONG',
        'FOLLOW_USER',
        'UPLOAD_SUCCESS',
        'NEW_SONG_FROM_FOLLOWING',
        'PLAYLIST_ADD_SONG',
        'SYSTEM'
      )
    ),
  CONSTRAINT notifications_entity_type_check
    CHECK (
      entity_type IS NULL
      OR entity_type IN ('song', 'user', 'artist', 'playlist', 'system')
    )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read
  ON notifications(user_id, is_read);
