const express = require("express");
const recentlyPlayedController = require("../controllers/recently-played.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", authMiddleware, recentlyPlayedController.saveRecentlyPlayed);
router.get("/", authMiddleware, recentlyPlayedController.getMyRecentlyPlayed);

module.exports = router;
