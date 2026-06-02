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

const router = express.Router();

router.post(
  "/audio",
  authMiddleware,
  requireRole("admin"),
  uploadAudio,
  uploadController.uploadAudio
);

router.post(
  "/cover",
  authMiddleware,
  requireRole("admin"),
  uploadCover,
  uploadController.uploadCover
);

module.exports = router;
