const searchService = require("../services/search.service");
const { successResponse } = require("../utils/apiResponse");

const searchRealtime = async (req, res, next) => {
  try {
    const data = await searchService.search(req.query);
    return successResponse(res, "Search suggestions fetched successfully", data, 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  searchRealtime,
};
