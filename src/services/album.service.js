const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");
const {
  buildPagination,
  buildUpdateSet,
  normalizeSearch,
  parsePagination,
  validateOptionalDate,
  validateOptionalString,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const albumSelect = `
  al.id,
  al.title,
  al.artist_id,
  al.cover_url,
  al.release_date,
  al.created_at,
  al.updated_at,
  ar.name AS artist_name,
  COALESCE(NULLIF(u.display_name, ''), ar.name) AS artist_display_name,
  COALESCE(NULLIF(u.bio, ''), ar.bio) AS artist_bio,
  COALESCE(u.avatar_url, ar.avatar_url) AS artist_avatar_url
`;

const formatAlbum = (album) => {
  return {
    id: album.id,
    title: album.title,
    artist_id: album.artist_id,
    cover_url: album.cover_url,
    release_date: album.release_date,
    created_at: album.created_at,
    updated_at: album.updated_at,
    artist: album.artist_id
      ? {
          id: album.artist_id,
          name: album.artist_name,
          display_name: album.artist_display_name || album.artist_name,
          bio: album.artist_bio,
          avatar_url: album.artist_avatar_url,
        }
      : null,
  };
};

const ensureArtistExists = async (artistId) => {
  const result = await pool.query(
    `SELECT id
     FROM artists
     WHERE id = $1
     LIMIT 1`,
    [artistId]
  );

  if (result.rowCount === 0) {
    throw new AppError("Artist not found", 404);
  }
};

const validateAlbumInput = async (data = {}, isUpdate = false) => {
  const fields = {};

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "title")) {
    fields.title = validateRequiredString(data.title, "title", 200);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "artist_id")) {
    validateUuid(data.artist_id, "artist_id");
    await ensureArtistExists(data.artist_id);
    fields.artist_id = data.artist_id;
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "cover_url")) {
    fields.cover_url = validateOptionalString(data.cover_url, "cover_url", 1000);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "release_date")) {
    fields.release_date = validateOptionalDate(data.release_date, "release_date");
  }

  return fields;
};

const getAlbums = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const search = normalizeSearch(query.q || query.search);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM albums al
     JOIN artists ar ON ar.id = al.artist_id
     WHERE ($1::text IS NULL OR al.title ILIKE $1 OR ar.name ILIKE $1)`,
    [search]
  );

  const result = await pool.query(
    `SELECT ${albumSelect}
     FROM albums al
     JOIN artists ar ON ar.id = al.artist_id
     ${artistLinkedUserJoin}
     WHERE ($1::text IS NULL OR al.title ILIKE $1 OR ar.name ILIKE $1)
     ORDER BY al.created_at DESC
     LIMIT $2 OFFSET $3`,
    [search, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatAlbum),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getAlbumById = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `SELECT ${albumSelect}
     FROM albums al
     JOIN artists ar ON ar.id = al.artist_id
     ${artistLinkedUserJoin}
     WHERE al.id = $1
     LIMIT 1`,
    [id]
  );

  const album = result.rows[0];

  if (!album) {
    throw new AppError("Album not found", 404);
  }

  return formatAlbum(album);
};

const createAlbum = async (data) => {
  const fields = await validateAlbumInput(data);

  const result = await pool.query(
    `INSERT INTO albums (title, artist_id, cover_url, release_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [fields.title, fields.artist_id, fields.cover_url, fields.release_date]
  );

  return getAlbumById(result.rows[0].id);
};

const updateAlbum = async (id, data) => {
  validateUuid(id);

  const fields = await validateAlbumInput(data, true);
  const { setClause, values } = buildUpdateSet(fields);

  const result = await pool.query(
    `UPDATE albums
     SET ${setClause}
     WHERE id = $1
     RETURNING id`,
    [id, ...values]
  );

  if (result.rowCount === 0) {
    throw new AppError("Album not found", 404);
  }

  return getAlbumById(id);
};

const deleteAlbum = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `DELETE FROM albums
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    throw new AppError("Album not found", 404);
  }

  return { id };
};

module.exports = {
  getAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
};
