const express = require("express");
const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");
const { uploadAvatar } = require("../middlewares/upload.middleware");
const {
  loginLimiter,
  refreshLimiter,
  registerLimiter,
  uploadLimiter,
} = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh", refreshLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authMiddleware, authController.getMe);
router.patch("/me", authMiddleware, authController.updateMe);
router.post(
  "/me/avatar",
  authMiddleware,
  uploadLimiter,
  uploadAvatar,
  authController.uploadAvatar
);

module.exports = router;
