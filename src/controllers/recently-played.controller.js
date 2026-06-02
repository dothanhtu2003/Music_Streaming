const recentlyPlayedService = require("../services/recently-played.service");
const { successResponse } = require("../utils/apiResponse");

const saveRecentlyPlayed = async (req, res, next) => {
  try {
    const song = await recentlyPlayedService.saveRecentlyPlayed(
      req.user.id,
      req.body
    );

    return successResponse(res, "Recently played song saved successfully", song);
  } catch (error) {
    return next(error);
  }
};

const getMyRecentlyPlayed = async (req, res, next) => {
  try {
    const songs = await recentlyPlayedService.getMyRecentlyPlayed(req.user.id);

    return successResponse(
      res,
      "Recently played songs fetched successfully",
      songs
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  saveRecentlyPlayed,
  getMyRecentlyPlayed,
};
