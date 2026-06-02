const feedService = require("../services/feed.service");
const { successResponse } = require("../utils/apiResponse");

const getFeedSongs = async (req, res, next) => {
  try {
    const result = await feedService.getFeedSongs(req.user.id, req.query);
    return successResponse(res, "Feed songs fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getFeedSongs,
};
