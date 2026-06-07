const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const songService = require("./song.service");
const { buildArtistLinkedUserJoin } = require("../utils/artist-user.utils");
const {
  buildPagination,
  buildUpdateSet,
  parsePagination,
  validateBoolean,
  validateNonNegativeInteger,
  validateOptionalBoolean,
  validateOptionalString,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const playlistSummarySelect = `
  p.id,
  p.user_id,
  p.name,
  p.description,
  p.cover_url,
  p.is_public,
  p.slug,
  p.share_count,
  p.created_at,
  p.updated_at,
  u.username AS owner_name,
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
  ) AS display_cover_url,
  COUNT(ps.id)::int AS song_count
`;

const artistUserJoin = buildArtistLinkedUserJoin("u_artist");

const playlistSongSelect = `
  ps.id AS playlist_song_id,
  ps.position,
  ps.added_at,
  s.id,
  s.title,
  s.artist_id,
  s.uploaded_by,
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
  COALESCE(NULLIF(u_artist.display_name, ''), ar.name) AS artist_display_name,
  COALESCE(NULLIF(u_artist.bio, ''), ar.bio) AS artist_bio,
  COALESCE(u_artist.avatar_url, ar.avatar_url) AS artist_avatar_url,
  ar.user_id AS artist_user_id,
  uploader.username AS uploader_username,
  uploader.display_name AS uploader_display_name,
  uploader.avatar_url AS uploader_avatar_url,
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  al.release_date AS album_release_date,
  g.name AS genre_name,
  g.slug AS genre_slug
`;

const formatPlaylist = (playlist) => {
  return {
    id: playlist.id,
    user_id: playlist.user_id,
    name: playlist.name,
    title: playlist.name,
    description: playlist.description,
    cover_url: playlist.display_cover_url || playlist.cover_url || null,
    custom_cover_url: playlist.cover_url || null,
    is_public: playlist.is_public,
    slug: playlist.slug || null,
    share_count: Number(playlist.share_count || 0),
    share_url: playlist.share_url || null,
    song_count: Number(playlist.song_count || 0),
    track_count: Number(playlist.song_count || 0),
    owner_name: playlist.owner_name || null,
    is_owner: Boolean(playlist.is_owner),
    created_at: playlist.created_at,
    updated_at: playlist.updated_at,
  };
};

const formatPlaylistSong = (row) => {
  return {
    playlist_song_id: row.playlist_song_id,
    position: row.position,
    added_at: row.added_at,
    id: row.id,
    title: row.title,
    file_url: row.file_url,
    cover_url: row.cover_url,
    duration_sec: row.duration_sec,
    play_count: Number(row.play_count),
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    uploaded_by: row.uploaded_by,
    uploadedBy: row.uploaded_by,
    uploadedByUser: row.uploaded_by
      ? {
          id: row.uploaded_by,
          username: row.uploader_username,
          displayName: row.uploader_display_name,
          avatarUrl: row.uploader_avatar_url,
        }
      : null,
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

const getSongIdFromBody = (body = {}) => {
  const songId = body.songId || body.song_id || body.trackId || body.track_id;

  if (!songId) {
    throw new AppError("songId or track_id is required", 400);
  }

  validateUuid(songId, "songId");
  return songId;
};

const validatePlaylistInput = (body = {}, isUpdate = false) => {
  const fields = {};

  if (
    !isUpdate ||
    Object.prototype.hasOwnProperty.call(body, "name") ||
    Object.prototype.hasOwnProperty.call(body, "title")
  ) {
    fields.name = validateRequiredString(body.title ?? body.name, "title", 150);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "description")) {
    fields.description = validateOptionalString(
      body.description,
      "description",
      5000
    );
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(body, "cover_url")) {
    fields.cover_url = validateOptionalString(body.cover_url, "cover_url", 1000);
  }

  if (!isUpdate) {
    fields.is_public =
      body.is_public === undefined
        ? false
        : validateBoolean(body.is_public, "is_public");
  } else if (Object.prototype.hasOwnProperty.call(body, "is_public")) {
    fields.is_public = validateOptionalBoolean(body.is_public, "is_public");
  }

  return fields;
};

const validatePosition = (value, fieldName = "position") => {
  return validateNonNegativeInteger(value, fieldName);
};

const getPlaylistById = async (playlistId, client = pool) => {
  const result = await client.query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.description,
       p.cover_url,
       p.is_public,
       p.slug,
       p.share_count,
       p.created_at,
       p.updated_at,
       u.username AS owner_name
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1
     LIMIT 1`,
    [playlistId]
  );

  return result.rows[0] || null;
};

const slugifyPlaylistName = (value) => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
};

const randomHex = () => {
  return Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
};

const buildShareUrl = (slugOrId) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${frontendUrl.replace(/\/$/, "")}/playlists/${slugOrId}`;
};

const generateUniquePlaylistSlug = async (playlist, client = pool) => {
  const shortId = String(playlist.id).slice(0, 8);
  const baseSlug = slugifyPlaylistName(playlist.name) || `playlist-${shortId}`;
  let slug = baseSlug;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await client.query(
      `SELECT id
       FROM playlists
       WHERE slug = $1 AND id <> $2
       LIMIT 1`,
      [slug, playlist.id]
    );

    if (result.rowCount === 0) {
      return slug;
    }

    const prefix = baseSlug.slice(0, 115);
    slug = `${prefix}-${randomHex()}`;
  }

  return `playlist-${shortId}-${randomHex()}`;
};

const ensurePlaylistReadable = async (playlistId, user, client = pool) => {
  validateUuid(playlistId, "playlistId");

  const playlist = await getPlaylistById(playlistId, client);

  if (!playlist) {
    throw new AppError("Playlist not found", 404);
  }

  const isOwner = playlist.user_id === user.id;
  const isAdmin = user.role === "admin";

  if (!isOwner && !playlist.is_public && !isAdmin) {
    throw new AppError("You do not have permission to access this playlist", 403);
  }

  return playlist;
};

const ensurePlaylistOwner = async (playlistId, userId, client = pool) => {
  validateUuid(playlistId, "playlistId");

  const playlist = await getPlaylistById(playlistId, client);

  if (!playlist) {
    throw new AppError("Playlist not found", 404);
  }

  if (playlist.user_id !== userId) {
    throw new AppError("You do not have permission to modify this playlist", 403);
  }

  return playlist;
};

const ensurePlaylistOwnerOrAdmin = async (playlistId, user, client = pool) => {
  validateUuid(playlistId, "playlistId");

  const playlist = await getPlaylistById(playlistId, client);

  if (!playlist) {
    throw new AppError("Playlist not found", 404);
  }

  if (playlist.user_id !== user.id && user.role !== "admin") {
    throw new AppError("You do not have permission to modify this playlist", 403);
  }

  return playlist;
};

const getSongStatus = async (songId, client = pool) => {
  const result = await client.query(
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

const getNextPosition = async (playlistId, client = pool) => {
  const result = await client.query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next_position
     FROM playlist_songs
     WHERE playlist_id = $1`,
    [playlistId]
  );

  return Number(result.rows[0].next_position);
};

const getActivePlaylistSongCount = async (playlistId, client = pool) => {
  const result = await client.query(
    `SELECT COUNT(*)::int AS song_count
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     WHERE ps.playlist_id = $1 AND s.is_active = TRUE`,
    [playlistId]
  );

  return Number(result.rows[0].song_count);
};

const getMyPlaylists = async (userId, query) => {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM playlists
     WHERE user_id = $1`,
    [userId]
  );

  const result = await pool.query(
    `SELECT ${playlistSummarySelect}
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id, u.username
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatPlaylist),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getPublicPlaylists = async (query) => {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM playlists
     WHERE is_public = TRUE`
  );

  const result = await pool.query(
    `SELECT ${playlistSummarySelect}
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE p.is_public = TRUE
     GROUP BY p.id, u.username
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatPlaylist),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getPlaylistDetail = async (playlistId, user) => {
  const playlist = await ensurePlaylistReadable(playlistId, user);
  const isOwner = playlist.user_id === user.id;

  const songsResult = await pool.query(
    `SELECT ${playlistSongSelect}
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     JOIN artists ar ON ar.id = s.artist_id
     ${artistUserJoin}
     LEFT JOIN users uploader ON uploader.id = s.uploaded_by
     LEFT JOIN albums al ON al.id = s.album_id
     LEFT JOIN genres g ON g.id = s.genre_id
     WHERE ps.playlist_id = $1 AND s.is_active = TRUE
     ORDER BY ps.position ASC, ps.added_at ASC`,
    [playlistId]
  );
  const songs = songsResult.rows.map(formatPlaylistSong);
  const firstSongCoverUrl = songs[0]?.cover_url || songs[0]?.album?.cover_url || null;

  return {
    ...formatPlaylist({
      ...playlist,
      display_cover_url: playlist.cover_url || firstSongCoverUrl,
      song_count: songs.length,
      is_owner: isOwner,
    }),
    songs,
    tracks: songs,
  };
};

const getPublicPlaylistDetail = async (slugOrId) => {
  const value = validateRequiredString(slugOrId, "slugOrId", 160);
  const isPlaylistId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const result = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.name,
       p.description,
       p.cover_url,
       p.is_public,
       p.slug,
       p.share_count,
       p.created_at,
       p.updated_at,
       u.username AS owner_name,
       u.username AS owner_username,
       u.display_name AS owner_display_name,
       u.avatar_url AS owner_avatar_url
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     WHERE (${isPlaylistId ? "p.id = $1" : "p.slug = $1"}) AND p.is_public = TRUE
     LIMIT 1`,
    [value]
  );

  const playlist = result.rows[0];

  if (!playlist) {
    throw new AppError("Public playlist not found or this playlist is private", 404);
  }

  const songsResult = await pool.query(
    `SELECT ${playlistSongSelect}
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     JOIN artists ar ON ar.id = s.artist_id
     ${artistUserJoin}
     LEFT JOIN users uploader ON uploader.id = s.uploaded_by
     LEFT JOIN albums al ON al.id = s.album_id
     LEFT JOIN genres g ON g.id = s.genre_id
     WHERE ps.playlist_id = $1 AND s.is_active = TRUE
     ORDER BY ps.position ASC, ps.added_at ASC`,
    [playlist.id]
  );
  const songs = songsResult.rows.map(formatPlaylistSong);
  const firstSongCoverUrl = songs[0]?.cover_url || songs[0]?.album?.cover_url || null;

  return {
    ...formatPlaylist({
      ...playlist,
      display_cover_url: playlist.cover_url || firstSongCoverUrl,
      song_count: songs.length,
      is_owner: false,
      share_url: buildShareUrl(playlist.slug || playlist.id),
    }),
    owner: {
      id: playlist.user_id,
      username: playlist.owner_username,
      displayName: playlist.owner_display_name,
      avatarUrl: playlist.owner_avatar_url,
    },
    songs,
    tracks: songs,
  };
};

const createPlaylist = async (userId, body) => {
  const fields = validatePlaylistInput(body);

  const result = await pool.query(
    `INSERT INTO playlists (user_id, name, description, cover_url, is_public)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, name, description, cover_url, is_public, created_at, updated_at`,
    [userId, fields.name, fields.description, fields.cover_url, fields.is_public]
  );

  return {
    ...formatPlaylist(result.rows[0]),
    songs: [],
    tracks: [],
  };
};

const updatePlaylist = async (playlistId, userId, body) => {
  const playlist = await ensurePlaylistOwner(playlistId, userId);

  const fields = validatePlaylistInput(body, true);
  const { setClause, values } = buildUpdateSet(fields);

  const result = await pool.query(
    `UPDATE playlists
     SET ${setClause}
     WHERE id = $1
     RETURNING id, user_id, name, description, cover_url, is_public, created_at, updated_at`,
    [playlistId, ...values]
  );

  const songCount = await getActivePlaylistSongCount(playlistId);

  return formatPlaylist({
    ...result.rows[0],
    owner_name: playlist.owner_name,
    song_count: songCount,
    display_cover_url: result.rows[0].cover_url,
  });
};

const updatePlaylistVisibility = async (playlistId, user, body) => {
  const isPublic =
    body.isPublic === undefined
      ? validateBoolean(body.is_public, "isPublic")
      : validateBoolean(body.isPublic, "isPublic");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const playlist = await ensurePlaylistOwnerOrAdmin(playlistId, user, client);
    const slug = isPublic && !playlist.slug
      ? await generateUniquePlaylistSlug(playlist, client)
      : playlist.slug;

    const result = await client.query(
      `UPDATE playlists
       SET is_public = $2,
           slug = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, is_public, slug, share_count`,
      [playlistId, isPublic, slug]
    );

    await client.query("COMMIT");

    const updated = result.rows[0];

    return {
      id: updated.id,
      isPublic: updated.is_public,
      is_public: updated.is_public,
      slug: updated.slug,
      shareCount: Number(updated.share_count || 0),
      share_count: Number(updated.share_count || 0),
      shareUrl: buildShareUrl(updated.slug || updated.id),
      share_url: buildShareUrl(updated.slug || updated.id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const incrementPlaylistShare = async (playlistId, user = null) => {
  validateUuid(playlistId, "playlistId");
  const playlist = await getPlaylistById(playlistId);

  if (!playlist) {
    throw new AppError("Playlist not found", 404);
  }

  const canShare =
    playlist.is_public ||
    (user && (user.id === playlist.user_id || user.role === "admin"));

  if (!canShare) {
    throw new AppError("Cannot share a private playlist", 403);
  }

  const result = await pool.query(
    `UPDATE playlists
     SET share_count = share_count + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING share_count`,
    [playlistId]
  );

  return {
    shareCount: Number(result.rows[0].share_count || 0),
    share_count: Number(result.rows[0].share_count || 0),
  };
};

const deletePlaylist = async (playlistId, userId) => {
  await ensurePlaylistOwner(playlistId, userId);

  const result = await pool.query(
    `DELETE FROM playlists
     WHERE id = $1
     RETURNING id, user_id, name, description, cover_url, is_public, created_at, updated_at`,
    [playlistId]
  );

  return formatPlaylist(result.rows[0]);
};

const addSongToPlaylist = async (playlistId, userId, body) => {
  const songId = getSongIdFromBody(body);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensurePlaylistOwner(playlistId, userId, client);

    const song = await getSongStatus(songId, client);

    if (!song.is_active) {
      throw new AppError("Cannot add an inactive song to playlist", 400);
    }

    const position =
      body.position === undefined
        ? await getNextPosition(playlistId, client)
        : validatePosition(body.position);

    const result = await client.query(
      `INSERT INTO playlist_songs (playlist_id, song_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, song_id) DO NOTHING
       RETURNING id, playlist_id, song_id, position, added_at`,
      [playlistId, songId, position]
    );

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return {
        added: false,
        alreadyExists: true,
        playlistId,
        songId,
        trackId: songId,
      };
    }

    return {
      added: true,
      alreadyExists: false,
      playlistSong: result.rows[0],
      playlistTrack: result.rows[0],
      playlistId,
      songId,
      trackId: songId,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const removeSongFromPlaylist = async (playlistId, userId, songId) => {
  validateUuid(songId, "songId");
  await ensurePlaylistOwner(playlistId, userId);
  await getSongStatus(songId);

  const result = await pool.query(
    `DELETE FROM playlist_songs
     WHERE playlist_id = $1 AND song_id = $2
     RETURNING id, playlist_id, song_id, position, added_at`,
    [playlistId, songId]
  );

  if (result.rowCount === 0) {
    return {
      removed: false,
      wasInPlaylist: false,
      playlistId,
      songId,
      trackId: songId,
    };
  }

  return {
    removed: true,
    wasInPlaylist: true,
    playlistSong: result.rows[0],
    playlistTrack: result.rows[0],
    playlistId,
    songId,
    trackId: songId,
  };
};

const removeSongFromPlaylistByBody = async (playlistId, userId, body) => {
  const songId = getSongIdFromBody(body);
  return removeSongFromPlaylist(playlistId, userId, songId);
};

const validateReorderItems = (body = {}) => {
  const items = body.songs || body.tracks || body.items;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("songs must be a non-empty array", 400);
  }

  const seenSongIds = new Set();

  return items.map((item, index) => {
    const songId = item.songId || item.song_id || item.trackId || item.track_id;

    if (!songId) {
      throw new AppError(`songs[${index}].songId is required`, 400);
    }

    validateUuid(songId, `songs[${index}].songId`);

    if (seenSongIds.has(songId)) {
      throw new AppError("Duplicate songId in reorder payload", 400);
    }

    seenSongIds.add(songId);

    return {
      songId,
      position: validatePosition(item.position, `songs[${index}].position`),
    };
  });
};

const reorderPlaylistSongs = async (playlistId, userId, body) => {
  const items = validateReorderItems(body);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensurePlaylistOwner(playlistId, userId, client);

    const songIds = items.map((item) => item.songId);
    const existingResult = await client.query(
      `SELECT song_id
       FROM playlist_songs
       WHERE playlist_id = $1 AND song_id = ANY($2::uuid[])`,
      [playlistId, songIds]
    );

    if (existingResult.rowCount !== songIds.length) {
      throw new AppError("One or more songs are not in this playlist", 400);
    }

    for (const item of items) {
      await client.query(
        `UPDATE playlist_songs
         SET position = $3
         WHERE playlist_id = $1 AND song_id = $2`,
        [playlistId, item.songId, item.position]
      );
    }

    await client.query("COMMIT");

    return getPlaylistDetail(playlistId, { id: userId, role: "user" });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const uploadTrackToPlaylist = async (playlistId, user, data) => {
  await ensurePlaylistOwner(playlistId, user.id);

  const song = await songService.createUploadedSong(data, user);
  const addResult = await addSongToPlaylist(playlistId, user.id, {
    songId: song.id,
  });

  return {
    added: addResult.added,
    alreadyExists: addResult.alreadyExists,
    playlistId,
    songId: song.id,
    trackId: song.id,
    song,
    track: song,
    playlistSong: addResult.playlistSong,
    playlistTrack: addResult.playlistTrack,
  };
};

module.exports = {
  getMyPlaylists,
  getPublicPlaylists,
  getPublicPlaylistDetail,
  getPlaylistDetail,
  createPlaylist,
  updatePlaylist,
  updatePlaylistVisibility,
  incrementPlaylistShare,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  removeSongFromPlaylistByBody,
  reorderPlaylistSongs,
  uploadTrackToPlaylist,
};
