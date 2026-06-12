const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { validateUuid } = require("../utils/query.utils");
const songService = require("./song.service");

const followArtistLateralJoin = `
  LEFT JOIN LATERAL (
    SELECT ar.id, ar.name
    FROM artists ar
    WHERE ar.user_id = u.id
       OR (
         ar.user_id IS NULL
         AND LOWER(ar.name) = LOWER(u.username)
       )
    ORDER BY (ar.user_id IS NOT NULL) DESC, ar.created_at ASC
    LIMIT 1
  ) ar ON true
`;

const formatPublicUser = (row) => ({
  id: row.id,
  username: row.username,
  display_name: row.display_name || row.username,
  bio: row.bio,
  avatar_url: row.avatar_url,
  created_at: row.created_at,
  artist_id: row.artist_id,
  artist_name: row.artist_name,
  followers_count: Number(row.followers_count || 0),
  following_count: Number(row.following_count || 0),
  track_count: Number(row.track_count || 0),
});

const getPublicUserById = async (userId) => {
  validateUuid(userId, "userId");

  const result = await pool.query(
    `SELECT
       u.id,
       u.username,
       u.display_name,
       u.bio,
       u.avatar_url,
       u.created_at,
       COALESCE((SELECT COUNT(*)::int FROM follows WHERE "followingId" = u.id), 0) AS followers_count,
       COALESCE((SELECT COUNT(*)::int FROM follows WHERE "followerId" = u.id), 0) AS following_count,
       COALESCE((
         SELECT COUNT(*)::int
         FROM songs s
         JOIN artists ar ON ar.id = s.artist_id
         WHERE s.is_active = TRUE
           AND (
             ar.user_id = u.id
             OR LOWER(ar.name) = LOWER(u.username)
           )
       ), 0) AS track_count,
       ar.id AS artist_id,
       ar.name AS artist_name
     FROM users u
     ${followArtistLateralJoin}
     WHERE u.id = $1 AND u.is_banned = FALSE
     LIMIT 1`,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return formatPublicUser(user);
};

const getPublicUserSongs = async (userId, query = {}) => {
  const user = await getPublicUserById(userId);

  return songService.getSongsByUser(
    { id: user.id, username: user.username },
    query
  );
};

const getPublicUserPlaylists = async (userId, query = {}) => {
  const { parsePagination, buildPagination } = require("../utils/query.utils");
  const { page, limit, offset } = parsePagination(query);

  await getPublicUserById(userId);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM playlists
     WHERE user_id = $1 AND is_public = TRUE`,
    [userId]
  );

  const result = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.description,
       COALESCE(
         p.cover_url,
         (
           SELECT COALESCE(s_cover.cover_url, al_cover.cover_url)
           FROM playlist_songs ps_cover
           JOIN songs s_cover ON s_cover.id = ps_cover.song_id
           LEFT JOIN albums al_cover ON al_cover.id = s_cover.album_id
           WHERE ps_cover.playlist_id = p.id AND s_cover.is_active = TRUE
           ORDER BY ps_cover.position ASC, ps_cover.added_at ASC
           LIMIT 1
         )
       ) AS cover_url,
       p.is_public,
       p.slug,
       p.share_count,
       p.created_at,
       p.updated_at,
       COALESCE(NULLIF(u.display_name, ''), u.username) AS owner_name,
       COUNT(ps.song_id)::int AS song_count
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE p.user_id = $1 AND p.is_public = TRUE
     GROUP BY p.id, u.username, u.display_name
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      title: row.name,
      description: row.description,
      cover_url: row.cover_url,
      is_public: row.is_public,
      slug: row.slug,
      share_count: Number(row.share_count || 0),
      song_count: Number(row.song_count || 0),
      track_count: Number(row.song_count || 0),
      owner_name: row.owner_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    pagination: buildPagination(totalItems, page, limit),
  };
};

module.exports = {
  getPublicUserById,
  getPublicUserSongs,
  getPublicUserPlaylists,
};
