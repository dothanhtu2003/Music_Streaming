const express = require("express");
const feedController = require("../controllers/feed.controller");
const { authMiddleware, optionalAuthMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/discover", optionalAuthMiddleware, feedController.getDiscover);
router.get("/", authMiddleware, feedController.getFeedSongs);

module.exports = router;

