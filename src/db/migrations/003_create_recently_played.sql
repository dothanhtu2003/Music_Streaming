CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS recently_played (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  song_id UUID NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recently_played_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT recently_played_song_id_fk
    FOREIGN KEY (song_id)
    REFERENCES songs(id)
    ON DELETE CASCADE,
  CONSTRAINT recently_played_user_id_song_id_unique UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_recently_played_user_id ON recently_played(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_song_id ON recently_played(song_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_played_at
ON recently_played(user_id, played_at DESC);
