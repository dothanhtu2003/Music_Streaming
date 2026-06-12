BEGIN;

WITH ranked_artists AS (
  SELECT
    id,
    user_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM artists
  WHERE user_id IS NOT NULL
),
duplicate_artists AS (
  SELECT id, canonical_id
  FROM ranked_artists
  WHERE id <> canonical_id
)
UPDATE songs s
SET artist_id = da.canonical_id,
    updated_at = NOW()
FROM duplicate_artists da
WHERE s.artist_id = da.id;

WITH ranked_artists AS (
  SELECT
    id,
    user_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM artists
  WHERE user_id IS NOT NULL
),
duplicate_artists AS (
  SELECT id, canonical_id
  FROM ranked_artists
  WHERE id <> canonical_id
)
UPDATE albums al
SET artist_id = da.canonical_id,
    updated_at = NOW()
FROM duplicate_artists da
WHERE al.artist_id = da.id;

WITH ranked_artists AS (
  SELECT
    id,
    user_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM artists
  WHERE user_id IS NOT NULL
),
duplicate_artists AS (
  SELECT id
  FROM ranked_artists
  WHERE id <> canonical_id
)
DELETE FROM artists ar
USING duplicate_artists da
WHERE ar.id = da.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_user_id_unique
ON artists(user_id)
WHERE user_id IS NOT NULL;

COMMIT;
