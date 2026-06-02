const express = require("express");
const artistController = require("../controllers/artist.controller");
const {
  authMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", artistController.getArtists);
router.get("/:id/songs", artistController.getArtistSongs);
router.get("/:id", artistController.getArtistById);
router.post("/", authMiddleware, requireRole("admin"), artistController.createArtist);
router.put("/:id", authMiddleware, requireRole("admin"), artistController.updateArtist);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  artistController.deleteArtist
);

module.exports = router;
