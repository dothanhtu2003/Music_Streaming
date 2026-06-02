const express = require("express");
const followController = require("../controllers/follow.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

// All follow routes require authentication
router.use(authMiddleware);

router.get("/following", followController.getFollowing);
router.post("/:userId", followController.toggleFollow);
router.delete("/:userId", followController.unfollow);

module.exports = router;
