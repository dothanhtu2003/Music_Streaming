const express = require("express");
const searchController = require("../controllers/search.controller");
const {
  authMiddleware,
  optionalAuthMiddleware,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", optionalAuthMiddleware, searchController.searchRealtime);
router.get("/suggestions", optionalAuthMiddleware, searchController.getSuggestions);
router.get("/recent", authMiddleware, searchController.getRecentSearches);
router.delete("/recent", authMiddleware, searchController.clearRecentSearches);
router.delete("/recent/:id", authMiddleware, searchController.deleteRecentSearch);
router.get("/trending", searchController.getTrendingSearches);

module.exports = router;
