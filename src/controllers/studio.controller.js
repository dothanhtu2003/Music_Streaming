const studioService = require("../services/studio.service");
const { successResponse } = require("../utils/apiResponse");

const getOverview = async (req, res, next) => {
  try {
    const overview = await studioService.getOverview(req.user.id);

    return successResponse(res, "Studio overview fetched successfully", overview);
  } catch (error) {
    return next(error);
  }
};

const getTopTracks = async (req, res, next) => {
  try {
    const result = await studioService.getTopTracks(req.user.id, req.query);

    return successResponse(res, "Studio top tracks fetched successfully", result);
  } catch (error) {
    return next(error);
  }
};

const getTracks = async (req, res, next) => {
  try {
    const result = await studioService.getTracks(req.user.id, req.query);

    return successResponse(res, "Studio tracks fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const result = await studioService.getRecentActivity(req.user.id, req.query);

    return successResponse(res, "Studio recent activity fetched successfully", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOverview,
  getTopTracks,
  getTracks,
  getRecentActivity,
};
