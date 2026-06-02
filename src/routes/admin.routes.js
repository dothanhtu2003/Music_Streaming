const express = require("express");
const adminController = require("../controllers/admin.controller");
const {
  authMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/dashboard", adminController.getDashboard);
router.get("/users", adminController.getUsers);
router.get("/playlists", adminController.getPlaylists);
router.delete("/playlists/:id", adminController.deletePlaylist);
router.patch("/users/:id/role", adminController.updateUserRole);
router.patch("/users/:id/ban", adminController.banUser);
router.patch("/users/:id/unban", adminController.unbanUser);

module.exports = router;
