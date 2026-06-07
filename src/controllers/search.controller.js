const searchService = require("../services/search.service");
const { successResponse } = require("../utils/apiResponse");

const searchRealtime = async (req, res, next) => {
  try {
    const data = await searchService.search(req.query, req.user);
    return successResponse(res, "Search results fetched successfully", data, 200);
  } catch (error) {
    return next(error);
  }
};

const getSuggestions = async (req, res, next) => {
  try {
    const data = await searchService.getSearchSuggestions(req.query, req.user);
    return successResponse(res, "Search suggestions fetched successfully", data, 200);
  } catch (error) {
    return next(error);
  }
};

const getRecentSearches = async (req, res, next) => {
  try {
    const data = await searchService.getRecentSearches(req.user.id, 10);
    return successResponse(res, "Recent searches fetched successfully", data, 200);
  } catch (error) {
    return next(error);
  }
};

const deleteRecentSearch = async (req, res, next) => {
  try {
    await searchService.deleteRecentSearch(req.user.id, req.params.id);
    return successResponse(res, "Recent search deleted successfully", { id: req.params.id }, 200);
  } catch (error) {
    return next(error);
  }
};

const clearRecentSearches = async (req, res, next) => {
  try {
    await searchService.clearRecentSearches(req.user.id);
    return successResponse(res, "Recent searches cleared successfully", { cleared: true }, 200);
  } catch (error) {
    return next(error);
  }
};

const getTrendingSearches = async (req, res, next) => {
  try {
    const data = await searchService.getTrendingSearches(10);
    return successResponse(res, "Trending searches fetched successfully", data, 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  searchRealtime,
  getSuggestions,
  getRecentSearches,
  deleteRecentSearch,
  clearRecentSearches,
  getTrendingSearches,
};
