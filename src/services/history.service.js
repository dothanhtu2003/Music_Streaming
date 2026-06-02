const { pool } = require("../db/pool");
const {
  buildPagination,
  parsePagination,
} = require("../utils/query.utils");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");

const historySongSelect = `
  lh.id AS history_id,
  lh.listened_at,
  s.id,
  s.title,
  s.artist_id,
  s.album_id,
  s.genre_id,
  s.file_url,
  s.cover_url,
  s.duration_sec,
  s.play_count,
  s.is_active,
  s.created_at,
  s.updated_at,
  ar.name AS artist_name,
  COALESCE(NULLIF(u.display_name, ''), ar.name) AS artist_display_name,
  COALESCE(NULLIF(u.bio, ''), ar.bio) AS artist_bio,
  COALESCE(u.avatar_url, ar.avatar_url) AS artist_avatar_url,
  ar.user_id AS artist_user_id,
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  al.release_date AS album_release_date,
  g.name AS genre_name,
  g.slug AS genre_slug
`;

const historySongFromClause = `
  FROM listening_history lh
  JOIN songs s ON s.id = lh.song_id
  JOIN artists ar ON ar.id = s.artist_id
  ${artistLinkedUserJoin}
  LEFT JOIN albums al ON al.id = s.album_id
  LEFT JOIN genres g ON g.id = s.genre_id
`;

const formatHistorySong = (row) => {
  return {
    history_id: row.history_id,
    listened_at: row.listened_at,
    id: row.id,
    title: row.title,
    file_url: row.file_url,
    cover_url: row.cover_url,
    duration_sec: row.duration_sec,
    play_count: Number(row.play_count),
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    artist: {
      id: row.artist_id,
      name: row.artist_name,
      display_name: row.artist_display_name || row.artist_name,
      bio: row.artist_bio,
      avatar_url: row.artist_avatar_url,
      user_id: row.artist_user_id,
    },
    album: row.album_id
      ? {
          id: row.album_id,
          title: row.album_title,
          cover_url: row.album_cover_url,
          release_date: row.album_release_date,
        }
      : null,
    genre: row.genre_id
      ? {
          id: row.genre_id,
          name: row.genre_name,
          slug: row.genre_slug,
        }
      : null,
  };
};

const getMyListeningHistory = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     ${historySongFromClause}
     WHERE lh.user_id = $1 AND s.is_active = TRUE`,
    [userId]
  );

  const result = await pool.query(
    `SELECT ${historySongSelect}
     ${historySongFromClause}
     WHERE lh.user_id = $1 AND s.is_active = TRUE
     ORDER BY lh.listened_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatHistorySong),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const clearMyListeningHistory = async (userId) => {
  const result = await pool.query(
    `DELETE FROM listening_history
     WHERE user_id = $1
     RETURNING id`,
    [userId]
  );

  return {
    deletedCount: result.rowCount,
  };
};

module.exports = {
  getMyListeningHistory,
  clearMyListeningHistory,
};
