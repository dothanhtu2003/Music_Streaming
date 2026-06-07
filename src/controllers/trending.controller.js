const trendingService = require("../services/trending.service");
const { successResponse } = require("../utils/apiResponse");

const getTrending = async (req, res, next) => {
  try {
    const result = await trendingService.getTrending(req.query);

    return successResponse(res, "Trending tracks fetched successfully", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getTrending,
};
