const express = require("express");
const adminController = require("../controllers/admin.controller");
const {
  authMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

router.get("/dashboard", adminController.getDashboard);
router.post("/notifications/send", adminController.sendNotification);
router.post(
  "/notifications/broadcast",
  adminController.broadcastNotification
);
router.get("/notifications/history", adminController.getNotificationHistory);
router.get("/users", adminController.getUsers);
router.get("/users/options", adminController.getUserOptions);
router.get("/playlists", adminController.getPlaylists);
router.delete("/playlists/:id", adminController.deletePlaylist);
router.patch("/users/:id/role", adminController.updateUserRole);
router.patch("/users/:id/ban", adminController.banUser);
router.patch("/users/:id/unban", adminController.unbanUser);

module.exports = router;
