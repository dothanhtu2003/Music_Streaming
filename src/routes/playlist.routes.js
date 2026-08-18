const express = require("express");
const playlistController = require("../controllers/playlist.controller");
const {
  authMiddleware,
  optionalAuthMiddleware,
} = require("../middlewares/auth.middleware");
const { uploadTrack } = require("../middlewares/upload.middleware");
const { uploadLimiter } = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.get("/public/:slugOrId", playlistController.getPublicPlaylistDetail);
router.post(
  "/:id/share",
  optionalAuthMiddleware,
  playlistController.incrementPlaylistShare
);

router.use(authMiddleware);

router.post("/", playlistController.createPlaylist);
router.get("/me", playlistController.getMyPlaylists);
router.get("/", playlistController.getPublicPlaylists);
router.get("/:id", playlistController.getPlaylistDetail);
router.put("/:id", playlistController.updatePlaylist);
router.patch("/:id/visibility", playlistController.updatePlaylistVisibility);
router.delete("/:id", playlistController.deletePlaylist);
router.post("/:id/songs", playlistController.addSongToPlaylist);
router.post("/:id/tracks", playlistController.addSongToPlaylist);
router.post(
  "/:id/upload-track",
  uploadLimiter,
  uploadTrack,
  playlistController.uploadTrackToPlaylist
);
router.delete("/:id/songs/:songId", playlistController.removeSongFromPlaylist);
router.delete(
  "/:id/tracks/:songId",
  playlistController.removeSongFromPlaylist
);
router.delete("/:id/songs", playlistController.removeSongFromPlaylist);
router.delete("/:id/tracks", playlistController.removeSongFromPlaylist);
router.patch("/:id/songs/reorder", playlistController.reorderPlaylistSongs);
router.patch("/:id/tracks/reorder", playlistController.reorderPlaylistSongs);

module.exports = router;
