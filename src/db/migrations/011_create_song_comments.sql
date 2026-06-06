CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS song_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL,
  user_id UUID NOT NULL,
  parent_id UUID NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT song_comments_song_id_fk
    FOREIGN KEY (song_id)
    REFERENCES songs(id)
    ON DELETE CASCADE,
  CONSTRAINT song_comments_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT song_comments_parent_id_fk
    FOREIGN KEY (parent_id)
    REFERENCES song_comments(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_song_comments_song_id ON song_comments(song_id);
CREATE INDEX IF NOT EXISTS idx_song_comments_parent_id ON song_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_song_comments_user_id ON song_comments(user_id);
