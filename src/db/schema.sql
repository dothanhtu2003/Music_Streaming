CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

BEGIN;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Stores registered users and their account state.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(80),
  bio VARCHAR(300),
  avatar_url TEXT,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

COMMENT ON TABLE users IS 'Stores registered users, login identity, role, and verification state.';

-- Stores music artists.
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(150) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE artists IS 'Stores artist profile information used by albums and songs.';

-- Stores song genres.
CREATE TABLE IF NOT EXISTS genres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE genres IS 'Stores music categories such as pop, rock, lo-fi, or ballad.';

-- Stores albums created by artists.
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  artist_id UUID NOT NULL,
  cover_url TEXT,
  release_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT albums_artist_id_fk
    FOREIGN KEY (artist_id)
    REFERENCES artists(id)
    ON DELETE RESTRICT
);

COMMENT ON TABLE albums IS 'Stores album metadata and links each album to one artist.';

-- Stores playable songs and their metadata.
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  artist_id UUID NOT NULL,
  uploaded_by UUID,
  album_id UUID,
  genre_id UUID,
  file_url TEXT NOT NULL,
  cover_url TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  waveform_peaks JSONB,
  waveform_duration NUMERIC,
  play_count BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT songs_duration_sec_check CHECK (duration_sec >= 0),
  CONSTRAINT songs_waveform_duration_check CHECK (waveform_duration IS NULL OR waveform_duration >= 0),
  CONSTRAINT songs_play_count_check CHECK (play_count >= 0),
  CONSTRAINT songs_artist_id_fk
    FOREIGN KEY (artist_id)
    REFERENCES artists(id)
    ON DELETE RESTRICT,
  CONSTRAINT songs_uploaded_by_fk
    FOREIGN KEY (uploaded_by)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT songs_album_id_fk
    FOREIGN KEY (album_id)
    REFERENCES albums(id)
    ON DELETE SET NULL,
  CONSTRAINT songs_genre_id_fk
    FOREIGN KEY (genre_id)
    REFERENCES genres(id)
    ON DELETE SET NULL
);

COMMENT ON TABLE songs IS 'Stores song files, display metadata, counters, and active status.';

-- Stores user likes for songs.
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  song_id UUID NOT NULL,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT likes_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT likes_song_id_fk
    FOREIGN KEY (song_id)
    REFERENCES songs(id)
    ON DELETE CASCADE,
  CONSTRAINT likes_user_id_song_id_unique UNIQUE (user_id, song_id)
);

COMMENT ON TABLE likes IS 'Stores which songs each user has liked.';

-- Stores user-created playlists.
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT playlists_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

COMMENT ON TABLE playlists IS 'Stores playlists created by users, including public/private visibility.';

-- Stores songs inside playlists.
CREATE TABLE IF NOT EXISTS playlist_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL,
  song_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT playlist_songs_position_check CHECK (position >= 0),
  CONSTRAINT playlist_songs_playlist_id_fk
    FOREIGN KEY (playlist_id)
    REFERENCES playlists(id)
    ON DELETE CASCADE,
  CONSTRAINT playlist_songs_song_id_fk
    FOREIGN KEY (song_id)
    REFERENCES songs(id)
    ON DELETE CASCADE,
  CONSTRAINT playlist_songs_playlist_id_song_id_unique UNIQUE (playlist_id, song_id)
);

COMMENT ON TABLE playlist_songs IS 'Stores the songs and order for each playlist.';

-- Stores refresh tokens for authentication sessions.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT refresh_tokens_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

COMMENT ON TABLE refresh_tokens IS 'Stores hashed refresh tokens for user sessions.';

-- Stores song listening events for history and analytics.
CREATE TABLE IF NOT EXISTS listening_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  song_id UUID NOT NULL,
  listened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listening_history_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT listening_history_song_id_fk
    FOREIGN KEY (song_id)
    REFERENCES songs(id)
    ON DELETE CASCADE
);

COMMENT ON TABLE listening_history IS 'Stores when users listen to songs.';

-- Stores the latest played songs and playlists per user without duplicates.
CREATE TABLE IF NOT EXISTS recently_played (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  item_type VARCHAR(20) NOT NULL DEFAULT 'song',
  song_id UUID,
  playlist_id UUID,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recently_played_item_type_check CHECK (item_type IN ('song', 'playlist')),
  CONSTRAINT recently_played_item_reference_check CHECK (
    (item_type = 'song' AND song_id IS NOT NULL AND playlist_id IS NULL)
    OR
    (item_type = 'playlist' AND playlist_id IS NOT NULL AND song_id IS NULL)
  ),
  CONSTRAINT recently_played_user_id_fk
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT recently_played_song_id_fk
    FOREIGN KEY (song_id)
    REFERENCES songs(id)
    ON DELETE CASCADE,
  CONSTRAINT recently_played_playlist_id_fk
    FOREIGN KEY (playlist_id)
    REFERENCES playlists(id)
    ON DELETE CASCADE
);

COMMENT ON TABLE recently_played IS 'Stores each user latest played songs and playlists without duplicate item rows.';

-- Stores social connections between users and/or artists.
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "followerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "followingId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follows_not_self_check CHECK ("followerId" <> "followingId"),
  CONSTRAINT follows_follower_following_unique UNIQUE ("followerId", "followingId")
);

COMMENT ON TABLE follows IS 'Stores social connections where users follow other users or artists.';

-- Foreign key and filter indexes.
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_user_id_unique ON artists(user_id)
WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows("followerId");
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows("followingId");
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);

CREATE INDEX IF NOT EXISTS idx_songs_artist_id ON songs(artist_id);
CREATE INDEX IF NOT EXISTS idx_songs_uploaded_by ON songs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_songs_uploaded_by_active ON songs(uploaded_by, is_active);
CREATE INDEX IF NOT EXISTS idx_songs_album_id ON songs(album_id);
CREATE INDEX IF NOT EXISTS idx_songs_genre_id ON songs(genre_id);
CREATE INDEX IF NOT EXISTS idx_songs_is_active ON songs(is_active);
CREATE INDEX IF NOT EXISTS idx_songs_play_count ON songs(play_count DESC);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_song_id ON likes(song_id);

CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_is_public ON playlists(is_public);

CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON playlist_songs(song_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_position ON playlist_songs(playlist_id, position);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);

CREATE INDEX IF NOT EXISTS idx_listening_history_user_id ON listening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_song_id ON listening_history(song_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_listened_at ON listening_history(listened_at DESC);

CREATE INDEX IF NOT EXISTS idx_recently_played_user_id ON recently_played(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_song_id ON recently_played(song_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_playlist_id ON recently_played(playlist_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_user_item_type ON recently_played(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_recently_played_played_at ON recently_played(user_id, played_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_played_user_song_unique
ON recently_played(user_id, song_id)
WHERE item_type = 'song';
CREATE UNIQUE INDEX IF NOT EXISTS idx_recently_played_user_playlist_unique
ON recently_played(user_id, playlist_id)
WHERE item_type = 'playlist';

-- Basic text search indexes for common search screens.
CREATE INDEX IF NOT EXISTS idx_users_email_search ON users USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_search ON users USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);
CREATE INDEX IF NOT EXISTS idx_artists_name_search ON artists USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_genres_name_search ON genres USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_albums_title_search ON albums USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_songs_title_search ON songs USING GIN (title gin_trgm_ops);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_users_updated_at') THEN
    CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_artists_updated_at') THEN
    CREATE TRIGGER set_artists_updated_at
    BEFORE UPDATE ON artists
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_genres_updated_at') THEN
    CREATE TRIGGER set_genres_updated_at
    BEFORE UPDATE ON genres
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_albums_updated_at') THEN
    CREATE TRIGGER set_albums_updated_at
    BEFORE UPDATE ON albums
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_songs_updated_at') THEN
    CREATE TRIGGER set_songs_updated_at
    BEFORE UPDATE ON songs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_playlists_updated_at') THEN
    CREATE TRIGGER set_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

COMMIT;
