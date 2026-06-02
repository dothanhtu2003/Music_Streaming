const express = require("express");
const recentlyPlayedController = require("../controllers/recently-played.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", recentlyPlayedController.saveRecentlyPlayed);
router.get("/", recentlyPlayedController.getMyRecentlyPlayed);

module.exports = router;
