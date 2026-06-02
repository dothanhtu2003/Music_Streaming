const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { validateUuid } = require("../utils/query.utils");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");

const recentlyPlayedSongSelect = `
  rp.id AS recently_played_id,
  rp.played_at,
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

const recentlyPlayedFromClause = `
  FROM recently_played rp
  JOIN songs s ON s.id = rp.song_id
  JOIN artists ar ON ar.id = s.artist_id
  ${artistLinkedUserJoin}
  LEFT JOIN albums al ON al.id = s.album_id
  LEFT JOIN genres g ON g.id = s.genre_id
`;

const formatRecentlyPlayedSong = (row) => {
  return {
    recently_played_id: row.recently_played_id,
    played_at: row.played_at,
    id: row.id,
    title: row.title,
    description: row.description,
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

const ensureSongExists = async (songId) => {
  const result = await pool.query(
    `SELECT id
     FROM songs
     WHERE id = $1 AND is_active = TRUE
     LIMIT 1`,
    [songId]
  );

  if (result.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }
};

const getRecentlyPlayedById = async (recentlyPlayedId, userId) => {
  const result = await pool.query(
    `SELECT ${recentlyPlayedSongSelect}
     ${recentlyPlayedFromClause}
     WHERE rp.id = $1 AND rp.user_id = $2 AND s.is_active = TRUE
     LIMIT 1`,
    [recentlyPlayedId, userId]
  );

  return formatRecentlyPlayedSong(result.rows[0]);
};

const saveRecentlyPlayed = async (userId, body = {}) => {
  const songId = body.songId || body.song_id;

  validateUuid(userId, "userId");
  validateUuid(songId, "songId");
  await ensureSongExists(songId);

  const result = await pool.query(
    `INSERT INTO recently_played (user_id, song_id, played_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, song_id)
     DO UPDATE SET played_at = NOW()
     RETURNING id`,
    [userId, songId]
  );

  return getRecentlyPlayedById(result.rows[0].id, userId);
};

const getMyRecentlyPlayed = async (userId) => {
  validateUuid(userId, "userId");

  const result = await pool.query(
    `SELECT ${recentlyPlayedSongSelect}
     ${recentlyPlayedFromClause}
     WHERE rp.user_id = $1 AND s.is_active = TRUE
     ORDER BY rp.played_at DESC
     LIMIT 20`,
    [userId]
  );

  return result.rows.map(formatRecentlyPlayedSong);
};

module.exports = {
  saveRecentlyPlayed,
  getMyRecentlyPlayed,
};
