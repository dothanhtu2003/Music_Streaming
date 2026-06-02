const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const {
  buildPagination,
  buildUpdateSet,
  normalizeSearch,
  parsePagination,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const genreFields = "id, name, slug, created_at, updated_at";
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formatGenre = (genre) => {
  return {
    id: genre.id,
    name: genre.name,
    slug: genre.slug,
    created_at: genre.created_at,
    updated_at: genre.updated_at,
  };
};

const validateSlug = (slug) => {
  const normalizedSlug = validateRequiredString(slug, "slug", 120).toLowerCase();

  if (!slugRegex.test(normalizedSlug)) {
    throw new AppError(
      "slug must use lowercase letters, numbers, and hyphens",
      400
    );
  }

  return normalizedSlug;
};

const validateGenreInput = (data = {}, isUpdate = false) => {
  const fields = {};

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "name")) {
    fields.name = validateRequiredString(data.name, "name", 100);
  }

  if (!isUpdate || Object.prototype.hasOwnProperty.call(data, "slug")) {
    fields.slug = validateSlug(data.slug);
  }

  return fields;
};

const handleGenreUniqueError = (error) => {
  if (error.code === "23505" && error.constraint === "genres_slug_key") {
    throw new AppError("Genre slug is already in use", 409);
  }

  throw error;
};

const getGenres = async (query) => {
  const { page, limit, offset } = parsePagination(query);
  const search = normalizeSearch(query.q || query.search);

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM genres
     WHERE ($1::text IS NULL OR name ILIKE $1 OR slug ILIKE $1)`,
    [search]
  );

  const result = await pool.query(
    `SELECT ${genreFields}
     FROM genres
     WHERE ($1::text IS NULL OR name ILIKE $1 OR slug ILIKE $1)
     ORDER BY name ASC
     LIMIT $2 OFFSET $3`,
    [search, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatGenre),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getGenreById = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `SELECT ${genreFields}
     FROM genres
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  const genre = result.rows[0];

  if (!genre) {
    throw new AppError("Genre not found", 404);
  }

  return formatGenre(genre);
};

const createGenre = async (data) => {
  const fields = validateGenreInput(data);

  try {
    const result = await pool.query(
      `INSERT INTO genres (name, slug)
       VALUES ($1, $2)
       RETURNING ${genreFields}`,
      [fields.name, fields.slug]
    );

    return formatGenre(result.rows[0]);
  } catch (error) {
    handleGenreUniqueError(error);
  }
};

const updateGenre = async (id, data) => {
  validateUuid(id);

  const fields = validateGenreInput(data, true);
  const { setClause, values } = buildUpdateSet(fields);

  try {
    const result = await pool.query(
      `UPDATE genres
       SET ${setClause}
       WHERE id = $1
       RETURNING ${genreFields}`,
      [id, ...values]
    );

    const genre = result.rows[0];

    if (!genre) {
      throw new AppError("Genre not found", 404);
    }

    return formatGenre(genre);
  } catch (error) {
    handleGenreUniqueError(error);
  }
};

const deleteGenre = async (id) => {
  validateUuid(id);

  const result = await pool.query(
    `DELETE FROM genres
     WHERE id = $1
     RETURNING ${genreFields}`,
    [id]
  );

  const genre = result.rows[0];

  if (!genre) {
    throw new AppError("Genre not found", 404);
  }

  return formatGenre(genre);
};

module.exports = {
  getGenres,
  getGenreById,
  createGenre,
  updateGenre,
  deleteGenre,
};
