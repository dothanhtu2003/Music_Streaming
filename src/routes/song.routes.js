const express = require("express");
const songController = require("../controllers/song.controller");
const commentController = require("../controllers/comment.controller");
const {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");
const { uploadTrack } = require("../middlewares/upload.middleware");
const {
  playCountLimiter,
  searchLimiter,
  uploadLimiter,
} = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.get("/", songController.getSongs);
router.get("/search", searchLimiter, songController.searchSongs);
router.get("/me", authMiddleware, songController.getMySongs);
router.get("/:id/waveform", songController.getSongWaveform);
router.post("/:id/waveform", songController.saveSongWaveform);
router.get("/:id", songController.getSongById);
router.post(
  "/upload",
  authMiddleware,
  uploadLimiter,
  uploadTrack,
  songController.uploadSong
);
router.post(
  "/:id/listen",
  playCountLimiter,
  optionalAuthMiddleware,
  songController.listenToSong
);
router.post("/", authMiddleware, requireRole("admin"), songController.createSong);
router.put("/:id", authMiddleware, requireRole("admin"), songController.updateSong);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  songController.deleteSong
);
router.patch("/:id/play", playCountLimiter, songController.incrementPlayCount);

// Song Comments
router.get("/:songId/comments", commentController.getComments);
router.post("/:songId/comments", authMiddleware, commentController.createComment);

module.exports = router;
