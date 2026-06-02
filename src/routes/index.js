const express = require("express");
const adminRoutes = require("./admin.routes");
const albumRoutes = require("./album.routes");
const artistRoutes = require("./artist.routes");
const authRoutes = require("./auth.routes");
const genreRoutes = require("./genre.routes");
const healthRoutes = require("./health.routes");
const historyRoutes = require("./history.routes");
const likeRoutes = require("./like.routes");
const playlistRoutes = require("./playlist.routes");
const recentlyPlayedRoutes = require("./recently-played.routes");
const songRoutes = require("./song.routes");
const uploadRoutes = require("./upload.routes");
const followRoutes = require("./follow.routes");
const feedRoutes = require("./feed.routes");
const searchRoutes = require("./search.routes");

const router = express.Router();

router.use("/admin", adminRoutes);
router.use("/albums", albumRoutes);
router.use("/artists", artistRoutes);
router.use("/auth", authRoutes);
router.use("/genres", genreRoutes);
router.use("/health", healthRoutes);
router.use("/history", historyRoutes);
router.use("/likes", likeRoutes);
router.use("/playlists", playlistRoutes);
router.use("/recently-played", recentlyPlayedRoutes);
router.use("/songs", songRoutes);
router.use("/upload", uploadRoutes);
router.use("/follow", followRoutes);
router.use("/feed", feedRoutes);
router.use("/search", searchRoutes);

module.exports = router;
