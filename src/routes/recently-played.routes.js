const express = require("express");
const recentlyPlayedController = require("../controllers/recently-played.controller");
const {
  authMiddleware,
  optionalAuthMiddleware,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", optionalAuthMiddleware, recentlyPlayedController.saveRecentlyPlayed);
router.get("/", authMiddleware, recentlyPlayedController.getMyRecentlyPlayed);

module.exports = router;
