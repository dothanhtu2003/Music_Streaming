const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const notificationService = require("./notification.service");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");
const {
  buildPagination,
  parsePagination,
  validateUuid,
} = require("../utils/query.utils");

const likedSongSelect = `
  l.id AS like_id,
  l.liked_at,
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

const likedSongFromClause = `
  FROM likes l
  JOIN songs s ON s.id = l.song_id
  JOIN artists ar ON ar.id = s.artist_id
  ${artistLinkedUserJoin}
  LEFT JOIN albums al ON al.id = s.album_id
  LEFT JOIN genres g ON g.id = s.genre_id
`;

const getSongIdFromBody = (body = {}) => {
  const songId = body.songId || body.song_id;

  if (!songId) {
    throw new AppError("songId is required", 400);
  }

  validateUuid(songId, "songId");
  return songId;
};

const formatLikedSong = (row) => {
  return {
    like_id: row.like_id,
    liked_at: row.liked_at,
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

const getSongStatus = async (songId) => {
  const result = await pool.query(
    `SELECT id, is_active
     FROM songs
     WHERE id = $1
     LIMIT 1`,
    [songId]
  );

  const song = result.rows[0];

  if (!song) {
    throw new AppError("Song not found", 404);
  }

  return song;
};

const getSongOwnerForNotification = async (songId) => {
  const result = await pool.query(
    `SELECT
       s.id,
       ar.user_id AS owner_user_id
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     WHERE s.id = $1
     LIMIT 1`,
    [songId]
  );

  return result.rows[0] || null;
};

const getUserDisplayName = async (userId) => {
  const result = await pool.query(
    `SELECT username, display_name
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  const user = result.rows[0];

  return user?.display_name || user?.username || "Một người dùng";
};

const likeSong = async (userId, body) => {
  const songId = getSongIdFromBody(body);
  const song = await getSongStatus(songId);

  if (!song.is_active) {
    throw new AppError("Cannot like an inactive song", 400);
  }

  const result = await pool.query(
    `INSERT INTO likes (user_id, song_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, song_id) DO NOTHING
     RETURNING id, user_id, song_id, liked_at`,
    [userId, songId]
  );

  if (result.rowCount === 0) {
    return {
      liked: true,
      alreadyLiked: true,
      songId,
    };
  }

  const songOwner = await getSongOwnerForNotification(songId);
  if (songOwner?.owner_user_id && songOwner.owner_user_id !== userId) {
    const username = await getUserDisplayName(userId);

    await notificationService.createNotification({
      userId: songOwner.owner_user_id,
      actorId: userId,
      type: "LIKE_SONG",
      entityType: "song",
      entityId: songId,
      title: "Có lượt thích mới",
      message: `${username} đã thích bài hát của bạn`,
    });
  }

  return {
    liked: true,
    alreadyLiked: false,
    like: result.rows[0],
  };
};

const unlikeSong = async (userId, body) => {
  const songId = getSongIdFromBody(body);

  await getSongStatus(songId);

  const result = await pool.query(
    `DELETE FROM likes
     WHERE user_id = $1 AND song_id = $2
     RETURNING id, user_id, song_id, liked_at`,
    [userId, songId]
  );

  if (result.rowCount === 0) {
    return {
      liked: false,
      wasLiked: false,
      songId,
    };
  }

  return {
    liked: false,
    wasLiked: true,
    like: result.rows[0],
  };
};

const getMyLikedSongs = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     ${likedSongFromClause}
     WHERE l.user_id = $1 AND s.is_active = TRUE`,
    [userId]
  );

  const result = await pool.query(
    `SELECT ${likedSongSelect}
     ${likedSongFromClause}
     WHERE l.user_id = $1 AND s.is_active = TRUE
     ORDER BY l.liked_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatLikedSong),
    pagination: buildPagination(totalItems, page, limit),
  };
};

module.exports = {
  likeSong,
  unlikeSong,
  getMyLikedSongs,
};
