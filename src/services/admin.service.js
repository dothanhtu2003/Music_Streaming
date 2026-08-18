const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");
const {
  buildPagination,
  normalizeSearch,
  parsePagination,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const userFields =
  "id, email, username, display_name, avatar_url, role, is_verified, is_banned, created_at, updated_at";

const topSongSelect = `
  s.id,
  s.title,
  s.file_url,
  s.cover_url,
  s.duration_sec,
  s.play_count,
  s.is_active,
  s.created_at,
  s.updated_at,
  ar.id AS artist_id,
  ar.name AS artist_name,
  COALESCE(NULLIF(u.display_name, ''), ar.name) AS artist_display_name,
  al.id AS album_id,
  al.title AS album_title,
  g.id AS genre_id,
  g.name AS genre_name,
  g.slug AS genre_slug
`;

const formatUser = (user) => {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    display_name: user.display_name || user.username,
    displayName: user.display_name || user.username,
    avatar_url: user.avatar_url,
    avatarUrl: user.avatar_url,
    role: user.role,
    is_verified: user.is_verified,
    is_banned: user.is_banned,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

const formatTopSong = (song) => {
  return {
    id: song.id,
    title: song.title,
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
      display_name: song.artist_display_name || song.artist_name,
      displayName: song.artist_display_name || song.artist_name,
    },
    album: song.album_id
      ? {
          id: song.album_id,
          title: song.album_title,
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

const formatAdminPlaylist = (playlist) => {
  return {
    id: playlist.id,
    user_id: playlist.user_id,
    title: playlist.name,
    name: playlist.name,
    description: playlist.description,
    cover_url: playlist.cover_url,
    is_public: playlist.is_public,
    track_count: Number(playlist.track_count || 0),
    song_count: Number(playlist.track_count || 0),
    owner_name: playlist.owner_name,
    owner_email: playlist.owner_email,
    created_at: playlist.created_at,
    updated_at: playlist.updated_at,
  };
};

const getCount = async (query, params = []) => {
  const result = await pool.query(query, params);
  return Number(result.rows[0].total || 0);
};

const getDashboard = async () => {
  const [
    totalUsers,
    totalSongs,
    totalArtists,
    totalAlbums,
    totalGenres,
    totalPlaylists,
    playCountResult,
    topSongsResult,
    newestUsersResult,
  ] = await Promise.all([
    getCount("SELECT COUNT(*) AS total FROM users"),
    getCount("SELECT COUNT(*) AS total FROM songs WHERE is_active = TRUE"),
    getCount("SELECT COUNT(*) AS total FROM artists"),
    getCount("SELECT COUNT(*) AS total FROM albums"),
    getCount("SELECT COUNT(*) AS total FROM genres"),
    getCount("SELECT COUNT(*) AS total FROM playlists"),
    pool.query("SELECT COALESCE(SUM(play_count), 0)::bigint AS total FROM songs"),
    pool.query(
      `SELECT ${topSongSelect}
       FROM songs s
       JOIN artists ar ON ar.id = s.artist_id
       ${artistLinkedUserJoin}
       LEFT JOIN albums al ON al.id = s.album_id
       LEFT JOIN genres g ON g.id = s.genre_id
       WHERE s.is_active = TRUE
       ORDER BY s.play_count DESC, s.created_at DESC
       LIMIT 5`
    ),
    pool.query(
      `SELECT ${userFields}
       FROM users
       ORDER BY created_at DESC
       LIMIT 5`
    ),
  ]);

  return {
    total_users: totalUsers,
    total_songs: totalSongs,
    total_artists: totalArtists,
    total_albums: totalAlbums,
    total_genres: totalGenres,
    total_playlists: totalPlaylists,
    total_play_count: Number(playCountResult.rows[0].total),
    top_songs: topSongsResult.rows.map(formatTopSong),
    newest_users: newestUsersResult.rows.map(formatUser),
  };
};

const getPlaylists = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const search = normalizeSearch(query.q || query.search);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     WHERE ($1::text IS NULL OR p.name ILIKE $1 OR u.username ILIKE $1 OR u.display_name ILIKE $1 OR u.email ILIKE $1)`,
    [search]
  );

  const result = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.description,
       p.cover_url,
       p.is_public,
       p.created_at,
       p.updated_at,
       COALESCE(NULLIF(u.display_name, ''), u.username) AS owner_name,
       u.email AS owner_email,
       COUNT(s.id)::int AS track_count
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     LEFT JOIN songs s ON s.id = ps.song_id AND s.is_active = TRUE
     WHERE ($1::text IS NULL OR p.name ILIKE $1 OR u.username ILIKE $1 OR u.display_name ILIKE $1 OR u.email ILIKE $1)
     GROUP BY p.id, u.username, u.display_name, u.email
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [search, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatAdminPlaylist),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const deletePlaylist = async (playlistId) => {
  validateUuid(playlistId, "playlistId");

  const playlistResult = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.description,
       p.cover_url,
       p.is_public,
       p.created_at,
       p.updated_at,
       COALESCE(NULLIF(u.display_name, ''), u.username) AS owner_name,
       u.email AS owner_email,
       COUNT(s.id)::int AS track_count
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     LEFT JOIN songs s ON s.id = ps.song_id AND s.is_active = TRUE
     WHERE p.id = $1
     GROUP BY p.id, u.username, u.display_name, u.email
     LIMIT 1`,
    [playlistId]
  );

  const playlist = playlistResult.rows[0];

  if (!playlist) {
    throw new AppError("Playlist not found", 404);
  }

  await pool.query("DELETE FROM playlists WHERE id = $1", [playlistId]);

  return formatAdminPlaylist(playlist);
};

const getUsers = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const search = normalizeSearch(query.q || query.search);
  const role = query.role ? validateRole(query.role) : null;

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE ($1::text IS NULL OR email ILIKE $1 OR username ILIKE $1 OR display_name ILIKE $1)
       AND ($2::text IS NULL OR role = $2)`,
    [search, role]
  );

  const result = await pool.query(
    `SELECT ${userFields}
     FROM users
     WHERE ($1::text IS NULL OR email ILIKE $1 OR username ILIKE $1 OR display_name ILIKE $1)
       AND ($2::text IS NULL OR role = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [search, role, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatUser),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getUserOptions = async () => {
  const result = await pool.query(
    `SELECT id, username, display_name, avatar_url, email
     FROM users
     WHERE is_banned = FALSE
     ORDER BY COALESCE(NULLIF(display_name, ''), username) ASC
     LIMIT 500`
  );

  return result.rows.map((user) => ({
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    displayName: user.display_name || user.username,
    avatar_url: user.avatar_url,
    avatarUrl: user.avatar_url,
    email: user.email,
  }));
};

const validateRole = (role) => {
  const normalizedRole = validateRequiredString(role, "role", 20);

  if (!["user", "admin"].includes(normalizedRole)) {
    throw new AppError("role must be user or admin", 400);
  }

  return normalizedRole;
};

const updateUserRole = async (userId, role) => {
  validateUuid(userId, "userId");
  const nextRole = validateRole(role);

  const result = await pool.query(
    `UPDATE users
     SET role = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING ${userFields}`,
    [userId, nextRole]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return formatUser(user);
};

const setUserBanned = async (targetUserId, adminUserId, isBanned) => {
  validateUuid(targetUserId, "userId");

  if (targetUserId === adminUserId && isBanned) {
    throw new AppError("Admin cannot ban themselves", 400);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE users
       SET is_banned = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING ${userFields}`,
      [targetUserId, isBanned]
    );

    if (!result.rows[0]) {
      throw new AppError("User not found", 404);
    }

    if (isBanned) {
      await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [targetUserId]
      );
    }

    await client.query("COMMIT");
    return formatUser(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboard,
  getUsers,
  getUserOptions,
  getPlaylists,
  deletePlaylist,
  updateUserRole,
  setUserBanned,
};
