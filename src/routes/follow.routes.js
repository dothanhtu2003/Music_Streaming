const express = require("express");
const followController = require("../controllers/follow.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

// Public listing routes
router.get("/list/:userId/followers", followController.getFollowers);
router.get("/list/:userId/following", followController.getFollowingForUser);

// All follow routes below require authentication
router.use(authMiddleware);

router.get("/following", followController.getFollowing);
router.get("/status/:artistId", followController.getFollowStatus);
router.post("/:userId", followController.toggleFollow);
router.delete("/:userId", followController.unfollow);

module.exports = router;
