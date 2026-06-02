const express = require("express");
const albumController = require("../controllers/album.controller");
const {
  authMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", albumController.getAlbums);
router.get("/:id", albumController.getAlbumById);
router.post("/", authMiddleware, requireRole("admin"), albumController.createAlbum);
router.put("/:id", authMiddleware, requireRole("admin"), albumController.updateAlbum);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  albumController.deleteAlbum
);

module.exports = router;
