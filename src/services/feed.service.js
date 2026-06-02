const { pool } = require("../db/pool");
const {
  buildPagination,
  parsePagination,
} = require("../utils/query.utils");

const songSelect = `
  s.id,
  s.title,
  s.description,
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
  ar.avatar_url AS artist_avatar_url,
  ar.user_id AS artist_user_id,
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  al.release_date AS album_release_date,
  g.name AS genre_name,
  g.slug AS genre_slug
`;

const formatSong = (song) => {
  return {
    id: song.id,
    title: song.title,
    description: song.description,
    file_url: song.file_url,
    cover_url: song.cover_url,
    duration_sec: song.duration_sec,
    play_count: Number(song.play_count),
    is_active: song.is_active,
    created_at: song.created_at,
    updated_at: song.updated_at,
    artist: {
      id: song.artist_id,
      name: song.artist_name,
      avatar_url: song.artist_avatar_url,
      user_id: song.artist_user_id,
    },
    album: song.album_id
      ? {
          id: song.album_id,
          title: song.album_title,
          cover_url: song.album_cover_url,
          release_date: song.album_release_date,
        }
      : null,
    genre: song.genre_id
      ? {
          id: song.genre_id,
          name: song.genre_name,
          slug: song.genre_slug,
        }
      : null,
  };
};

/**
 * Gets a paginated list of songs uploaded by the artists that the user is following.
 * The songs are ordered by creation date, newest first.
 */
const getFeedSongs = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     JOIN follows f ON f."followingId" = ar.user_id
     WHERE f."followerId" = $1 AND s.is_active = TRUE`,
    [userId]
  );

  const result = await pool.query(
    `SELECT ${songSelect}
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     JOIN follows f ON f."followingId" = ar.user_id
     LEFT JOIN albums al ON al.id = s.album_id
     LEFT JOIN genres g ON g.id = s.genre_id
     WHERE f."followerId" = $1 AND s.is_active = TRUE
     ORDER BY s.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatSong),
    pagination: buildPagination(totalItems, page, limit),
  };
};

module.exports = {
  getFeedSongs,
};
