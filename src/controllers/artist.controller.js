const artistService = require("../services/artist.service");
const { successResponse } = require("../utils/apiResponse");

const getArtists = async (req, res, next) => {
  try {
    const result = await artistService.getArtists(req.query);

    return successResponse(res, "Artists fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getArtistById = async (req, res, next) => {
  try {
    const artist = await artistService.getArtistById(req.params.id);

    return successResponse(res, "Artist fetched successfully", artist);
  } catch (error) {
    return next(error);
  }
};

const createArtist = async (req, res, next) => {
  try {
    const artist = await artistService.createArtist(req.body);

    return successResponse(res, "Artist created successfully", artist, 201);
  } catch (error) {
    return next(error);
  }
};

const updateArtist = async (req, res, next) => {
  try {
    const artist = await artistService.updateArtist(req.params.id, req.body);

    return successResponse(res, "Artist updated successfully", artist);
  } catch (error) {
    return next(error);
  }
};

const deleteArtist = async (req, res, next) => {
  try {
    const artist = await artistService.deleteArtist(req.params.id);

    return successResponse(res, "Artist deleted successfully", artist);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getArtists,
  getArtistById,
  createArtist,
  updateArtist,
  deleteArtist,
};
