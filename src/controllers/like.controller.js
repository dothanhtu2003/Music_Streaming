const likeService = require("../services/like.service");
const { successResponse } = require("../utils/apiResponse");

const likeSong = async (req, res, next) => {
  try {
    const result = await likeService.likeSong(req.user.id, req.body);
    const message = result.alreadyLiked
      ? "Song is already liked"
      : "Song liked successfully";

    return successResponse(res, message, result);
  } catch (error) {
    return next(error);
  }
};

const unlikeSong = async (req, res, next) => {
  try {
    const result = await likeService.unlikeSong(req.user.id, req.body);
    const message = result.wasLiked
      ? "Song unliked successfully"
      : "Song was not liked";

    return successResponse(res, message, result);
  } catch (error) {
    return next(error);
  }
};

const getMyLikedSongs = async (req, res, next) => {
  try {
    const result = await likeService.getMyLikedSongs(req.user.id, req.query);

    return successResponse(res, "Liked songs fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  likeSong,
  unlikeSong,
  getMyLikedSongs,
};
