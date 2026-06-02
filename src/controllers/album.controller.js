const albumService = require("../services/album.service");
const { successResponse } = require("../utils/apiResponse");

const getAlbums = async (req, res, next) => {
  try {
    const result = await albumService.getAlbums(req.query);

    return successResponse(res, "Albums fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getAlbumById = async (req, res, next) => {
  try {
    const album = await albumService.getAlbumById(req.params.id);

    return successResponse(res, "Album fetched successfully", album);
  } catch (error) {
    return next(error);
  }
};

const createAlbum = async (req, res, next) => {
  try {
    const album = await albumService.createAlbum(req.body);

    return successResponse(res, "Album created successfully", album, 201);
  } catch (error) {
    return next(error);
  }
};

const updateAlbum = async (req, res, next) => {
  try {
    const album = await albumService.updateAlbum(req.params.id, req.body);

    return successResponse(res, "Album updated successfully", album);
  } catch (error) {
    return next(error);
  }
};

const deleteAlbum = async (req, res, next) => {
  try {
    const album = await albumService.deleteAlbum(req.params.id);

    return successResponse(res, "Album deleted successfully", album);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
};
