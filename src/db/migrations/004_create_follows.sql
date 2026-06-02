-- Migration: Create follows table and add user_id relation to artists
BEGIN;

-- 1. Add user_id column to artists to link artists directly to registered users
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Link existing artists to users with matching usernames (case-insensitive)
UPDATE artists ar
SET user_id = u.id
FROM users u
WHERE LOWER(ar.name) = LOWER(u.username);

-- 3. Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "followerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "followingId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follows_not_self_check CHECK ("followerId" <> "followingId"),
  CONSTRAINT follows_follower_following_unique UNIQUE ("followerId", "followingId")
);

DELETE FROM follows
WHERE "followerId" = "followingId";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'follows_not_self_check'
  ) THEN
    ALTER TABLE follows
    ADD CONSTRAINT follows_not_self_check
    CHECK ("followerId" <> "followingId");
  END IF;
END;
$$;

-- 4. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows("followerId");
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows("followingId");
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON artists(user_id);

COMMIT;
