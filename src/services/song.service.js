const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");
const {
  buildPagination,
  buildUpdateSet,
  normalizeSearch,
  parsePagination,
  validateBoolean,
  validateNonNegativeInteger,
  validateOptionalBoolean,
  validateOptionalString,
  validateOptionalUuid,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const songSelect = `
  s.id,
  s.title,
  s.description,
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
  COALESCE(NULLIF(u.display_name, ''), ar.name) AS artist_display_name,
  COALESCE(NULLIF(u.bio, ''), ar.bio) AS artist_bio,
  COALESCE(u.avatar_url, ar.avatar_url) AS artist_avatar_url,
  ar.user_id AS artist_user_id,
  COALESCE(u.is_verified, FALSE) AS artist_is_verified,
  al.title AS album_title,
  al.cover_url AS album_cover_url,
  al.release_date AS album_release_date,
  g.name AS genre_name,
  g.slug AS genre_slug,
  uploader.username AS uploader_username,
  uploader.display_name AS uploader_display_name,
  uploader.avatar_url AS uploader_avatar_url,
  (SELECT COUNT(*)::int FROM likes WHERE song_id = s.id) AS likes_count,
  COALESCE((SELECT COUNT(*)::int FROM follows WHERE "followingId" = u.id), 0) AS artist_followers_count
`;

const songFromClause = `
  FROM songs s
  JOIN artists ar ON ar.id = s.artist_id
  ${artistLinkedUserJoin}
  LEFT JOIN albums al ON al.id = s.album_id
  LEFT JOIN genres g ON g.id = s.genre_id
  LEFT JOIN users uploader ON uploader.id = s.uploaded_by
`;
const waveformMaxChannels = 2;
const waveformMaxPeaksPerChannel = 2000;

const formatSong = (song) => {
  return {
    id: song.id,
    title: song.title,
    description: song.description,
    file_url: song.file_url,
    cover_url: song.cover_url,
    duration_sec: song.duration_sec,
    play_count: Number(song.play_count),
    likes_count: Number(song.likes_count ?? 0),
    is_active: song.is_active,
    created_at: song.created_at,
    updated_at: song.updated_at,
    uploaded_by: song.uploaded_by,
    uploadedBy: song.uploaded_by,
    uploadedByUser: song.uploaded_by
      ? {
          id: song.uploaded_by,
          username: song.uploader_username,
          displayName: song.uploader_display_name,
          avatarUrl: song.uploader_avatar_url,
        }
      : null,
    artist: {
      id: song.artist_id,
      name: song.artist_name,
      display_name: song.artist_display_name || song.artist_name,
      bio: song.artist_bio,
      avatar_url: song.artist_avatar_url,
      user_id: song.artist_user_id,
      followers_count: Number(song.artist_followers_count || 0),
      is_verified: Boolean(song.artist_is_verified),
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

const ensureRecordExists = async (tableName, id, errorMessage) => {
  const allowedTables = new Set(["artists", "albums", "genres"]);

  if (!allowedTables.has(tableName)) {
    throw new AppError("Invalid table name", 500);
  }

  const result = await pool.query(
    `SELECT id
     FROM ${tableName}
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError(errorMessage, 404);
  }
};

const validateSongInput = async (data = {}, isUpdate = false) => {
  const fields = {};

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "title")) {
    fields.title = validateRequiredString(data.title, "title", 200);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "artist_id")) {
    validateUuid(data.artist_id, "artist_id");
    await ensureRecordExists("artists", data.artist_id, "Artist not found");
    fields.artist_id = data.artist_id;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "description")) {
    fields.description = validateOptionalString(
      data.description,
      "description",
      5000
    );
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "album_id")) {
    fields.album_id = validateOptionalUuid(data.album_id, "album_id");

    if (fields.album_id) {
      await ensureRecordExists("albums", fields.album_id, "Album not found");
    }
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "genre_id")) {
    fields.genre_id = validateOptionalUuid(data.genre_id, "genre_id");

    if (fields.genre_id) {
      await ensureRecordExists("genres", fields.genre_id, "Genre not found");
    }
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "file_url")) {
    fields.file_url = validateRequiredString(data.file_url, "file_url", 1000);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "cover_url")) {
    fields.cover_url = validateOptionalString(data.cover_url, "cover_url", 1000);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "duration_sec")) {
    fields.duration_sec = validateNonNegativeInteger(
      data.duration_sec,
      "duration_sec"
    );
  }

  if (!isUpdate) {
    fields.is_active =
      data.is_active === undefined
        ? true
        : validateBoolean(data.is_active, "is_active");
  } else if (Object.prototype.hasOwnProperty.call(data, "is_active")) {
    fields.is_active = validateOptionalBoolean(data.is_active, "is_active");
  }

  return fields;
};

const validateWaveformDuration = (value) => {
  const duration = Number(value);

  if (!Number.isFinite(duration) || duration <= 0 || duration > 86400) {
    throw new AppError("waveform duration must be between 0 and 86400 seconds", 400);
  }

  return duration;
};

const validateWaveformPeaks = (peaks) => {
  if (!Array.isArray(peaks) || peaks.length === 0) {
    throw new AppError("peaks must be a non-empty array", 400);
  }

  if (peaks.length > waveformMaxChannels) {
    throw new AppError(`peaks can contain at most ${waveformMaxChannels} channels`, 400);
  }

  return peaks.map((channel, channelIndex) => {
    if (!Array.isArray(channel) || channel.length === 0) {
      throw new AppError(`peaks channel ${channelIndex + 1} must be a non-empty array`, 400);
    }

    if (channel.length > waveformMaxPeaksPerChannel) {
      throw new AppError(
        `peaks channel ${channelIndex + 1} can contain at most ${waveformMaxPeaksPerChannel} values`,
        400
      );
    }

    return channel.map((value, peakIndex) => {
      const peak = Number(value);

      if (!Number.isFinite(peak) || peak < -1 || peak > 1) {
        throw new AppError(
          `peaks channel ${channelIndex + 1} value ${peakIndex + 1} must be between -1 and 1`,
          400
        );
      }

      return peak;
    });
  });
};

const slugifyGenreName = (name) => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
};

const getUserArtistName = async (user = {}) => {
  const nameFromToken = validateOptionalString(
    user.display_name || user.username,
    "artist_name",
    150
  );

  if (nameFromToken) {
    return nameFromToken;
  }

  if (!user.id) {
    throw new AppError("Authentication required", 401);
  }

  const result = await pool.query(
    `SELECT username
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [user.id]
  );

  const username = result.rows[0]?.username;

  if (!username) {
    throw new AppError("User not found", 401);
  }

  return validateRequiredString(username, "artist_name", 150);
};

const findOrCreateArtistByName = async (name, userId = null) => {
  if (userId) {
    const ownedArtistResult = await pool.query(
      `SELECT id, user_id
       FROM artists
       WHERE LOWER(name) = LOWER($1)
         AND (user_id = $2 OR user_id IS NULL)
       ORDER BY CASE WHEN user_id = $2 THEN 0 ELSE 1 END, created_at ASC
       LIMIT 1`,
      [name, userId]
    );

    if (ownedArtistResult.rows[0]) {
      const artist = ownedArtistResult.rows[0];

      if (!artist.user_id) {
        await pool.query(
          `UPDATE artists
           SET user_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [userId, artist.id]
        );
      }

      return artist.id;
    }

    const insertResult = await pool.query(
      `INSERT INTO artists (name, user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [name, userId]
    );

    return insertResult.rows[0].id;
  }

  const result = await pool.query(
    `SELECT id, user_id
     FROM artists
     WHERE LOWER(name) = LOWER($1)
     ORDER BY created_at ASC
     LIMIT 1`,
    [name]
  );

  if (result.rows[0]) {
    const artist = result.rows[0];
    if (userId && !artist.user_id) {
      await pool.query(
        `UPDATE artists
         SET user_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [userId, artist.id]
      );
    }
    return artist.id;
  }

  const insertResult = await pool.query(
    `INSERT INTO artists (name, user_id)
     VALUES ($1, $2)
     RETURNING id`,
    [name, userId]
  );

  return insertResult.rows[0].id;
};

const findOrCreateGenreByName = async (genreName) => {
  const name = validateOptionalString(genreName, "genre", 100);

  if (!name) {
    return null;
  }

  const result = await pool.query(
    `SELECT id
     FROM genres
     WHERE LOWER(name) = LOWER($1)
     ORDER BY created_at ASC
     LIMIT 1`,
    [name]
  );

  if (result.rows[0]) {
    return result.rows[0].id;
  }

  const baseSlug = slugifyGenreName(name);
  const slug = baseSlug || `genre-${Date.now()}`;

  try {
    const insertResult = await pool.query(
      `INSERT INTO genres (name, slug)
       VALUES ($1, $2)
       RETURNING id`,
      [name, slug]
    );

    return insertResult.rows[0].id;
  } catch (error) {
    if (error.code === "23505" && error.constraint === "genres_slug_key") {
      const fallbackSlug = `${slug.slice(0, 100)}-${Date.now()}`;
      const fallbackResult = await pool.query(
        `INSERT INTO genres (name, slug)
         VALUES ($1, $2)
         RETURNING id`,
        [name, fallbackSlug]
      );

      return fallbackResult.rows[0].id;
    }

    throw error;
  }
};

const buildSongWhere = (query, forceSearch = false) => {
  const conditions = ["s.is_active = TRUE"];
  const params = [];

  const addUuidFilter = (queryKey, columnName) => {
    if (query[queryKey]) {
      validateUuid(query[queryKey], queryKey);
      params.push(query[queryKey]);
      conditions.push(`${columnName} = $${params.length}`);
    }
  };

  addUuidFilter("genre_id", "s.genre_id");
  addUuidFilter("artist_id", "s.artist_id");
  addUuidFilter("album_id", "s.album_id");

  const search = normalizeSearch(query.q || query.search);

  if (forceSearch && !search) {
    throw new AppError("Search keyword q is required", 400);
  }

  if (search) {
    params.push(search);
    conditions.push(
      `(s.title ILIKE $${params.length} OR ar.name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.display_name ILIKE $${params.length} OR al.title ILIKE $${params.length} OR g.name ILIKE $${params.length})`
    );
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    params,
  };
};

const getSongs = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { whereClause, params } = buildSongWhere(query);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     ${songFromClause}
     ${whereClause}`,
    params
  );

  let orderBy = "s.created_at DESC";
  if (query.sort === "random") {
    orderBy = "RANDOM()";
  }

  const result = await pool.query(
    `SELECT ${songSelect}
     ${songFromClause}
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatSong),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getSongsByUser = async (user, query = {}) => {
  const { page, limit, offset } = parsePagination(query);
  const params = [user.id];
  const whereClause = "WHERE s.is_active = TRUE AND s.uploaded_by = $1";

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     ${songFromClause}
     ${whereClause}`,
    params
  );

  const result = await pool.query(
    `SELECT ${songSelect}
     ${songFromClause}
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatSong),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const searchSongs = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const { whereClause, params } = buildSongWhere(query, true);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     ${songFromClause}
     ${whereClause}`,
    params
  );

  const result = await pool.query(
    `SELECT ${songSelect}
     ${songFromClause}
     ${whereClause}
     ORDER BY s.play_count DESC, s.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatSong),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getSongByIdRecord = async (id, includeInactive = false) => {
  validateUuid(id);

  const activeCondition = includeInactive ? "" : "AND s.is_active = TRUE";

  const result = await pool.query(
    `SELECT ${songSelect}
     ${songFromClause}
     WHERE s.id = $1 ${activeCondition}
     LIMIT 1`,
    [id]
  );

  const song = result.rows[0];

  if (!song) {
    throw new AppError("Song not found", 404);
  }

  return formatSong(song);
};

const getSongById = async (id) => {
  return getSongByIdRecord(id);
};

const formatWaveformCache = (row) => {
  const peaks = row.waveform_peaks ?? null;
  const duration =
    row.waveform_duration === null || row.waveform_duration === undefined
      ? null
      : Number(row.waveform_duration);

  return {
    song_id: row.id,
    peaks,
    duration,
    cached: Array.isArray(peaks) && peaks.length > 0 && Number.isFinite(duration),
    updated_at: row.updated_at,
  };
};

const getSongWaveform = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `SELECT id, waveform_peaks, waveform_duration, updated_at
     FROM songs
     WHERE id = $1 AND is_active = TRUE
     LIMIT 1`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  return formatWaveformCache(result.rows[0]);
};

const saveSongWaveform = async (id, data = {}) => {
  validateUuid(id);

  const peaks = validateWaveformPeaks(data.peaks);
  const duration = validateWaveformDuration(data.duration);

  const result = await pool.query(
    `UPDATE songs
     SET waveform_peaks = $2::jsonb,
         waveform_duration = $3,
         updated_at = NOW()
     WHERE id = $1 AND is_active = TRUE
     RETURNING id, waveform_peaks, waveform_duration, updated_at`,
    [id, JSON.stringify(peaks), duration]
  );

  if (result.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  return formatWaveformCache(result.rows[0]);
};

const createSong = async (data, uploadedBy) => {
  const fields = await validateSongInput(data);
  validateUuid(uploadedBy, "uploadedBy");

  const result = await pool.query(
    `INSERT INTO songs (
      title,
      description,
      artist_id,
      uploaded_by,
      album_id,
      genre_id,
      file_url,
      cover_url,
      duration_sec,
      is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      fields.title,
      fields.description,
      fields.artist_id,
      uploadedBy,
      fields.album_id,
      fields.genre_id,
      fields.file_url,
      fields.cover_url,
      fields.duration_sec,
      fields.is_active,
    ]
  );

  return getSongByIdRecord(result.rows[0].id, true);
};

const createUploadedSong = async (data, user) => {
  const title = validateRequiredString(data.title, "title", 200);
  const description = validateOptionalString(
    data.description,
    "description",
    5000
  );
  const fileUrl = validateRequiredString(data.file_url, "file_url", 1000);
  const coverUrl = validateOptionalString(data.cover_url, "cover_url", 1000);
  const artistName = await getUserArtistName(user);
  validateUuid(user.id, "uploadedBy");
  const artistId = await findOrCreateArtistByName(artistName, user.id);
  const genreId = await findOrCreateGenreByName(data.genre);

  const result = await pool.query(
    `INSERT INTO songs (
      title,
      description,
      artist_id,
      uploaded_by,
      genre_id,
      file_url,
      cover_url,
      duration_sec,
      is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [title, description, artistId, user.id, genreId, fileUrl, coverUrl, 0, true]
  );

  return getSongByIdRecord(result.rows[0].id, true);
};

const updateSong = async (id, data) => {
  validateUuid(id);

  const fields = await validateSongInput(data, true);
  const { setClause, values } = buildUpdateSet(fields);

  const result = await pool.query(
    `UPDATE songs
     SET ${setClause}
     WHERE id = $1 AND is_active = TRUE
     RETURNING id`,
    [id, ...values]
  );

  if (result.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  return getSongByIdRecord(id, true);
};

const deleteSong = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `UPDATE songs
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND is_active = TRUE
     RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  return { id, is_active: false };
};

const incrementPlayCount = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `UPDATE songs
     SET play_count = play_count + 1, updated_at = NOW()
     WHERE id = $1 AND is_active = TRUE
     RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  return getSongById(id);
};

const listenToSong = async (id, userId = null) => {
  validateUuid(id);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE songs
       SET play_count = play_count + 1, updated_at = NOW()
       WHERE id = $1 AND is_active = TRUE
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError("Song not found", 404);
    }

    if (userId) {
      await client.query(
        `INSERT INTO listening_history (user_id, song_id)
         VALUES ($1, $2)`,
        [userId, id]
      );
    }

    await client.query("COMMIT");

    return {
      song: await getSongById(id),
      historySaved: Boolean(userId),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getSongs,
  getSongsByUser,
  searchSongs,
  getSongById,
  getSongWaveform,
  saveSongWaveform,
  createSong,
  createUploadedSong,
  updateSong,
  deleteSong,
  incrementPlayCount,
  listenToSong,
};
