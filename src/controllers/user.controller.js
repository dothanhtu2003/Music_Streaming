const userService = require("../services/user.service");
const { successResponse } = require("../utils/apiResponse");

const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getPublicUserById(req.params.id);

    return successResponse(res, "User profile fetched successfully", user);
  } catch (error) {
    return next(error);
  }
};

const getUserSongs = async (req, res, next) => {
  try {
    const result = await userService.getPublicUserSongs(req.params.id, req.query);

    return successResponse(res, "User songs fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getUserPlaylists = async (req, res, next) => {
  try {
    const result = await userService.getPublicUserPlaylists(
      req.params.id,
      req.query
    );

    return successResponse(res, "User playlists fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getUserById,
  getUserSongs,
  getUserPlaylists,
};
