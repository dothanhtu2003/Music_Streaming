const historyService = require("../services/history.service");
const { successResponse } = require("../utils/apiResponse");

const getMyListeningHistory = async (req, res, next) => {
  try {
    const result = await historyService.getMyListeningHistory(
      req.user.id,
      req.query
    );

    return successResponse(
      res,
      "Listening history fetched successfully",
      result.items,
      200,
      {
        pagination: result.pagination,
      }
    );
  } catch (error) {
    return next(error);
  }
};

const clearMyListeningHistory = async (req, res, next) => {
  try {
    const result = await historyService.clearMyListeningHistory(req.user.id);

    return successResponse(
      res,
      "Listening history cleared successfully",
      result
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMyListeningHistory,
  clearMyListeningHistory,
};
