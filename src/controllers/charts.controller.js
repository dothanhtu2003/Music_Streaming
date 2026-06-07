const chartsService = require("../services/charts.service");
const { successResponse } = require("../utils/apiResponse");

const getCharts = async (req, res, next) => {
  try {
    const result = await chartsService.getCharts(req.query);

    return successResponse(res, "Charts fetched successfully", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCharts,
};
