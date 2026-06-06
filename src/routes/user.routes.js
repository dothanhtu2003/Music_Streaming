const express = require("express");
const userController = require("../controllers/user.controller");

const router = express.Router();

router.get("/:id/songs", userController.getUserSongs);
router.get("/:id/playlists", userController.getUserPlaylists);
router.get("/:id", userController.getUserById);

module.exports = router;
