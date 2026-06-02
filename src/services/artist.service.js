const { pool } = require("../db/pool");
const songService = require("./song.service");
const AppError = require("../utils/appError");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");
const {
  buildPagination,
  buildUpdateSet,
  normalizeSearch,
  parsePagination,
  validateOptionalString,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const artistSelect = `
  ar.id,
  ar.name,
  COALESCE(NULLIF(u.display_name, ''), ar.name) AS display_name,
  COALESCE(NULLIF(u.bio, ''), ar.bio) AS bio,
  COALESCE(u.avatar_url, ar.avatar_url) AS avatar_url,
  ar.user_id,
  ar.created_at,
  ar.updated_at
`;

const artistFields = "id, name, bio, avatar_url, user_id, created_at, updated_at";

const formatArtist = (artist) => {
  return {
    id: artist.id,
    name: artist.name,
    display_name: artist.display_name || artist.name,
    bio: artist.bio,
    avatar_url: artist.avatar_url,
    user_id: artist.user_id,
    created_at: artist.created_at,
    updated_at: artist.updated_at,
  };
};

const validateArtistInput = (data = {}, isUpdate = false) => {
  const fields = {};

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "name")) {
    fields.name = validateRequiredString(data.name, "name", 150);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "bio")) {
    fields.bio = validateOptionalString(data.bio, "bio", 5000);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "avatar_url")) {
    fields.avatar_url = validateOptionalString(
      data.avatar_url,
      "avatar_url",
      1000
    );
  }

  return fields;
};

const getArtists = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const search = normalizeSearch(query.q || query.search);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM artists ar
     ${artistLinkedUserJoin}
     WHERE ($1::text IS NULL OR ar.name ILIKE $1 OR u.username ILIKE $1 OR u.display_name ILIKE $1)`,
    [search]
  );

  const result = await pool.query(
    `SELECT ${artistSelect}
     FROM artists ar
     ${artistLinkedUserJoin}
     WHERE ($1::text IS NULL OR ar.name ILIKE $1 OR u.username ILIKE $1 OR u.display_name ILIKE $1)
     ORDER BY ar.created_at DESC
     LIMIT $2 OFFSET $3`,
    [search, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatArtist),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getArtistById = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `SELECT ${artistSelect}
     FROM artists ar
     ${artistLinkedUserJoin}
     WHERE ar.id = $1
     LIMIT 1`,
    [id]
  );

  const artist = result.rows[0];

  if (!artist) {
    throw new AppError("Artist not found", 404);
  }

  return formatArtist(artist);
};

const getArtistSongs = async (id, query = {}) => {
  await getArtistById(id);

  return songService.getSongs({
    ...query,
    artist_id: id,
  });
};

const createArtist = async (data) => {
  const fields = validateArtistInput(data);

  const result = await pool.query(
    `INSERT INTO artists (name, bio, avatar_url)
     VALUES ($1, $2, $3)
     RETURNING ${artistFields}`,
    [fields.name, fields.bio, fields.avatar_url]
  );

  return getArtistById(result.rows[0].id);
};

const updateArtist = async (id, data) => {
  validateUuid(id);

  const fields = validateArtistInput(data, true);
  const { setClause, values } = buildUpdateSet(fields);

  const result = await pool.query(
    `UPDATE artists
     SET ${setClause}
     WHERE id = $1
     RETURNING ${artistFields}`,
    [id, ...values]
  );

  const artist = result.rows[0];

  if (!artist) {
    throw new AppError("Artist not found", 404);
  }

  return getArtistById(id);
};

const deleteArtist = async (id) => {
  validateUuid(id);

  try {
    const result = await pool.query(
      `DELETE FROM artists
       WHERE id = $1
       RETURNING ${artistFields}`,
      [id]
    );

    const artist = result.rows[0];

    if (!artist) {
      throw new AppError("Artist not found", 404);
    }

    return formatArtist(artist);
  } catch (error) {
    if (error.code === "23503") {
      throw new AppError("Cannot delete artist because it is used by albums or songs", 409);
    }

    throw error;
  }
};

module.exports = {
  getArtists,
  getArtistById,
  getArtistSongs,
  createArtist,
  updateArtist,
  deleteArtist,
};
