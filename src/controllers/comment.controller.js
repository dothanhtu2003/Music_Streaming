const commentService = require("../services/comment.service");
const { successResponse } = require("../utils/apiResponse");

const getComments = async (req, res, next) => {
  try {
    const comments = await commentService.getCommentsBySongId(
      req.params.songId,
      req.query.sort || "newest"
    );

    return successResponse(res, "Comments fetched successfully", comments);
  } catch (error) {
    return next(error);
  }
};

const createComment = async (req, res, next) => {
  try {
    const comment = await commentService.createComment({
      songId: req.params.songId,
      userId: req.user.id,
      parentId: req.body.parentId || null,
      content: req.body.content,
    });

    return successResponse(res, "Comment created successfully", comment, 201);
  } catch (error) {
    return next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const result = await commentService.deleteComment(
      req.params.commentId,
      req.user
    );

    return successResponse(res, "Comment deleted successfully", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getComments,
  createComment,
  deleteComment,
};
