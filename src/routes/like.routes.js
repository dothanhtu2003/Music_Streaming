const express = require("express");
const likeController = require("../controllers/like.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", likeController.likeSong);
router.delete("/", likeController.unlikeSong);
router.get("/me", likeController.getMyLikedSongs);

module.exports = router;
