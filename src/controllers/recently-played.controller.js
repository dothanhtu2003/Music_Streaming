const recentlyPlayedService = require("../services/recently-played.service");
const { successResponse } = require("../utils/apiResponse");

const saveRecentlyPlayed = async (req, res, next) => {
  try {
    const item = await recentlyPlayedService.saveRecentlyPlayed(req.user, req.body);

    return successResponse(res, "Recently played item saved successfully", item);
  } catch (error) {
    return next(error);
  }
};

const getMyRecentlyPlayed = async (req, res, next) => {
  try {
    const items = await recentlyPlayedService.getMyRecentlyPlayed(
      req.user,
      req.query
    );

    return successResponse(
      res,
      "Recently played items fetched successfully",
      items
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  saveRecentlyPlayed,
  getMyRecentlyPlayed,
};
