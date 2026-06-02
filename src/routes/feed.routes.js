const express = require("express");
const feedController = require("../controllers/feed.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

// Feed requires authentication
router.use(authMiddleware);

router.get("/", feedController.getFeedSongs);

module.exports = router;
