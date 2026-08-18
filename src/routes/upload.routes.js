const express = require("express");
const uploadController = require("../controllers/upload.controller");
const {
  authMiddleware,
  requireRole,
} = require("../middlewares/auth.middleware");
const {
  uploadAudio,
  uploadCover,
} = require("../middlewares/upload.middleware");
const { uploadLimiter } = require("../middlewares/rate-limit.middleware");

const router = express.Router();

router.post(
  "/audio",
  authMiddleware,
  requireRole("admin"),
  uploadLimiter,
  uploadAudio,
  uploadController.uploadAudio
);

router.post(
  "/cover",
  authMiddleware,
  requireRole("admin"),
  uploadLimiter,
  uploadCover,
  uploadController.uploadCover
);

module.exports = router;
