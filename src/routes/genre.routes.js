const express = require("express");
const genreController = require("../controllers/genre.controller");
const {
  authMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", genreController.getGenres);
router.get("/:id", genreController.getGenreById);
router.post("/", authMiddleware, requireRole("admin"), genreController.createGenre);
router.put("/:id", authMiddleware, requireRole("admin"), genreController.updateGenre);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  genreController.deleteGenre
);

module.exports = router;
