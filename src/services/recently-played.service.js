const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { validateUuid } = require("../utils/query.utils");
const { buildArtistLinkedUserJoin } = require("../utils/artist-user.utils");

const allowedItemTypes = ["song", "playlist"];
const defaultRecentlyPlayedLimit = 20;
const maxRecentlyPlayedLimit = 50;
const artistLinkedUserJoin = buildArtistLinkedUserJoin("artist_user");

const recentlyPlayedSelect = `
  rp.id AS recently_played_id,
  rp.item_type,
  rp.played_at,
  s.id AS song_id,
  s.title AS song_title,
  s.description AS song_description,
  s.artist_id AS song_artist_id,
  s.album_id AS song_album_id,
  s.genre_id AS song_genre_id,
  s.file_url AS song_file_url,
  s.cover_url AS song_cover_url,
  s.duration_sec AS song_duration_sec,
  s.play_count AS song_play_count,
  s.is_active AS song_is_active,
  s.created_at AS song_created_at,
  s.updated_at AS song_updated_at,
  ar.name AS artist_name,
  COALESCE(NULLIF(artist_user.display_name, ''), ar.name) AS artist_display_name,
  COALESCE(NULLIF(artist_user.bio, ''), ar.bio) AS artist_bio,
  COALESCE(artist_user.avatar_url, ar.avatar_url) AS artist_avatar_url,
  ar.user_id AS artist_user_id,
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  al.release_date AS album_release_date,
  g.name AS genre_name,
  g.slug AS genre_slug,
  p.id AS playlist_id,
  p.user_id AS playlist_user_id,
  p.name AS playlist_name,
  p.description AS playlist_description,
  p.cover_url AS playlist_cover_url,
  p.is_public AS playlist_is_public,
  p.slug AS playlist_slug,
  p.share_count AS playlist_share_count,
  p.created_at AS playlist_created_at,
  p.updated_at AS playlist_updated_at,
  playlist_owner.username AS playlist_owner_username,
  playlist_owner.display_name AS playlist_owner_display_name,
  playlist_owner.avatar_url AS playlist_owner_avatar_url,
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
  ) AS playlist_display_cover_url,
  (
    SELECT COUNT(*)::int
    FROM playlist_songs ps_count
    JOIN songs s_count ON s_count.id = ps_count.song_id
    WHERE ps_count.playlist_id = p.id AND s_count.is_active = TRUE
  ) AS playlist_song_count
`;

const recentlyPlayedFromClause = `
  FROM recently_played rp
  LEFT JOIN songs s ON s.id = rp.song_id AND rp.item_type = 'song'
  LEFT JOIN artists ar ON ar.id = s.artist_id
  ${artistLinkedUserJoin}
  LEFT JOIN albums al ON al.id = s.album_id
  LEFT JOIN genres g ON g.id = s.genre_id
  LEFT JOIN playlists p ON p.id = rp.playlist_id AND rp.item_type = 'playlist'
  LEFT JOIN users playlist_owner ON playlist_owner.id = p.user_id
`;

const formatRecentlyPlayedSong = (row) => {
  return {
    type: "song",
    id: row.song_id,
    title: row.song_title,
    description: row.song_description,
    file_url: row.song_file_url,
    cover_url: row.song_cover_url,
    duration_sec: row.song_duration_sec,
    play_count: Number(row.song_play_count),
    is_active: row.song_is_active,
    created_at: row.song_created_at,
    updated_at: row.song_updated_at,
    artist: {
      id: row.song_artist_id,
      name: row.artist_name,
      display_name: row.artist_display_name || row.artist_name,
      bio: row.artist_bio,
      avatar_url: row.artist_avatar_url,
      user_id: row.artist_user_id,
    },
    album: row.song_album_id
      ? {
          id: row.song_album_id,
          title: row.album_title,
          cover_url: row.album_cover_url,
          release_date: row.album_release_date,
        }
      : null,
    genre: row.song_genre_id
      ? {
          id: row.song_genre_id,
          name: row.genre_name,
          slug: row.genre_slug,
        }
      : null,
  };
};

const formatRecentlyPlayedPlaylist = (row) => {
  return {
    type: "playlist",
    id: row.playlist_id,
    name: row.playlist_name,
    title: row.playlist_name,
    description: row.playlist_description,
    cover_url: row.playlist_display_cover_url || row.playlist_cover_url || null,
    custom_cover_url: row.playlist_cover_url || null,
    is_public: row.playlist_is_public,
    slug: row.playlist_slug || null,
    share_count: Number(row.playlist_share_count || 0),
    song_count: Number(row.playlist_song_count || 0),
    track_count: Number(row.playlist_song_count || 0),
    user_id: row.playlist_user_id,
    owner: {
      id: row.playlist_user_id,
      username: row.playlist_owner_username,
      display_name: row.playlist_owner_display_name,
      avatar_url: row.playlist_owner_avatar_url,
    },
    owner_name:
      row.playlist_owner_display_name || row.playlist_owner_username || null,
    created_at: row.playlist_created_at,
    updated_at: row.playlist_updated_at,
  };
};

const formatRecentlyPlayedItem = (row) => {
  const item =
    row.item_type === "playlist"
      ? formatRecentlyPlayedPlaylist(row)
      : formatRecentlyPlayedSong(row);

  return {
    recentlyPlayedId: row.recently_played_id,
    itemType: row.item_type,
    playedAt: row.played_at,
    item,
  };
};

const parseRecentlyPlayedLimit = (query = {}) => {
  const rawLimit = query.limit;

  if (rawLimit === undefined || rawLimit === null || rawLimit === "") {
    return defaultRecentlyPlayedLimit;
  }

  const limit = Number(rawLimit);

  if (!Number.isInteger(limit)) {
    throw new AppError("limit must be an integer", 400);
  }

  if (limit < 1) {
    throw new AppError("limit must be greater than or equal to 1", 400);
  }

  return Math.min(limit, maxRecentlyPlayedLimit);
};

const getBodyValue = (body, keys) => {
  const source = body || {};

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ""
    ) {
      return source[key];
    }
  }

  return null;
};

const validateRecentlyPlayedInput = (body = {}) => {
  const rawType = getBodyValue(body, ["itemType", "item_type", "type"]);
  const songId = getBodyValue(body, ["songId", "song_id", "trackId", "track_id"]);
  const playlistId = getBodyValue(body, ["playlistId", "playlist_id"]);
  const itemId = getBodyValue(body, ["itemId", "item_id"]);
  let itemType = rawType ? String(rawType).trim().toLowerCase() : null;

  if (itemType && !allowedItemTypes.includes(itemType)) {
    throw new AppError("itemType must be song or playlist", 400);
  }

  if (!itemType) {
    if (songId && playlistId) {
      throw new AppError("Send only one recently played item", 400);
    }

    if (songId) {
      itemType = "song";
    } else if (playlistId) {
      itemType = "playlist";
    } else {
      throw new AppError("songId or playlistId is required", 400);
    }
  }

  const itemIdByType =
    itemType === "playlist" ? playlistId || itemId : songId || itemId;

  if (!itemIdByType) {
    throw new AppError(
      itemType === "playlist" ? "playlistId is required" : "songId is required",
      400
    );
  }

  validateUuid(itemIdByType, itemType === "playlist" ? "playlistId" : "songId");

  return {
    itemType,
    itemId: itemIdByType,
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

const ensurePlaylistReadable = async (playlistId, user) => {
  const result = await pool.query(
    `SELECT id, user_id, is_public
     FROM playlists
     WHERE id = $1
     LIMIT 1`,
    [playlistId]
  );

  const playlist = result.rows[0];

  if (!playlist) {
    throw new AppError("Playlist not found", 404);
  }

  const canRead =
    playlist.is_public || playlist.user_id === user.id || user.role === "admin";

  if (!canRead) {
    throw new AppError("You do not have permission to access this playlist", 403);
  }
};

const getRecentlyPlayedById = async (recentlyPlayedId, user) => {
  const result = await pool.query(
    `SELECT ${recentlyPlayedSelect}
     ${recentlyPlayedFromClause}
     WHERE rp.id = $1
       AND rp.user_id = $2
       AND (
         (rp.item_type = 'song' AND s.is_active = TRUE)
         OR (
           rp.item_type = 'playlist'
           AND p.id IS NOT NULL
           AND (p.is_public = TRUE OR p.user_id = $2 OR $3 = 'admin')
         )
       )
     LIMIT 1`,
    [recentlyPlayedId, user.id, user.role]
  );

  if (result.rowCount === 0) {
    throw new AppError("Recently played item not found", 404);
  }

  return formatRecentlyPlayedItem(result.rows[0]);
};

const saveRecentlyPlayed = async (user, body = {}) => {
  const { itemType, itemId } = validateRecentlyPlayedInput(body);

  validateUuid(user.id, "userId");

  if (itemType === "playlist") {
    await ensurePlaylistReadable(itemId, user);
  } else {
    await ensureSongExists(itemId);
  }

  const result = await pool.query(
    itemType === "playlist"
      ? `INSERT INTO recently_played (user_id, item_type, playlist_id, played_at)
         VALUES ($1, 'playlist', $2, NOW())
         ON CONFLICT (user_id, playlist_id) WHERE item_type = 'playlist'
         DO UPDATE SET played_at = NOW()
         RETURNING id`
      : `INSERT INTO recently_played (user_id, item_type, song_id, played_at)
     VALUES ($1, 'song', $2, NOW())
     ON CONFLICT (user_id, song_id) WHERE item_type = 'song'
     DO UPDATE SET played_at = NOW()
     RETURNING id`,
    [user.id, itemId]
  );

  return getRecentlyPlayedById(result.rows[0].id, user);
};

const getMyRecentlyPlayed = async (user, query = {}) => {
  validateUuid(user.id, "userId");
  const limit = parseRecentlyPlayedLimit(query);

  const result = await pool.query(
    `SELECT ${recentlyPlayedSelect}
     ${recentlyPlayedFromClause}
     WHERE rp.user_id = $1
       AND (
         (rp.item_type = 'song' AND s.is_active = TRUE)
         OR (
           rp.item_type = 'playlist'
           AND p.id IS NOT NULL
           AND (p.is_public = TRUE OR p.user_id = $1 OR $2 = 'admin')
         )
       )
     ORDER BY rp.played_at DESC
     LIMIT $3`,
    [user.id, user.role, limit]
  );

  return result.rows.map(formatRecentlyPlayedItem);
};

module.exports = {
  saveRecentlyPlayed,
  getMyRecentlyPlayed,
};
