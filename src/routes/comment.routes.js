const express = require("express");
const commentController = require("../controllers/comment.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.delete("/:commentId", authMiddleware, commentController.deleteComment);

module.exports = router;
