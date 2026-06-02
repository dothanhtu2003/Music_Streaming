const genreService = require("../services/genre.service");
const { successResponse } = require("../utils/apiResponse");

const getGenres = async (req, res, next) => {
  try {
    const result = await genreService.getGenres(req.query);

    return successResponse(res, "Genres fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getGenreById = async (req, res, next) => {
  try {
    const genre = await genreService.getGenreById(req.params.id);

    return successResponse(res, "Genre fetched successfully", genre);
  } catch (error) {
    return next(error);
  }
};

const createGenre = async (req, res, next) => {
  try {
    const genre = await genreService.createGenre(req.body);

    return successResponse(res, "Genre created successfully", genre, 201);
  } catch (error) {
    return next(error);
  }
};

const updateGenre = async (req, res, next) => {
  try {
    const genre = await genreService.updateGenre(req.params.id, req.body);

    return successResponse(res, "Genre updated successfully", genre);
  } catch (error) {
    return next(error);
  }
};

const deleteGenre = async (req, res, next) => {
  try {
    const genre = await genreService.deleteGenre(req.params.id);

    return successResponse(res, "Genre deleted successfully", genre);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getGenres,
  getGenreById,
  createGenre,
  updateGenre,
  deleteGenre,
};
