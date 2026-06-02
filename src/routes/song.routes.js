const express = require("express");
const songController = require("../controllers/song.controller");
const {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");
const { uploadTrack } = require("../middlewares/upload.middleware");

const router = express.Router();

router.get("/", songController.getSongs);
router.get("/search", songController.searchSongs);
router.get("/:id", songController.getSongById);
router.post("/upload", authMiddleware, uploadTrack, songController.uploadSong);
router.post("/:id/listen", optionalAuthMiddleware, songController.listenToSong);
router.post("/", authMiddleware, requireRole("admin"), songController.createSong);
router.put("/:id", authMiddleware, requireRole("admin"), songController.updateSong);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  songController.deleteSong
);
router.patch("/:id/play", songController.incrementPlayCount);

module.exports = router;
