const followService = require("../services/follow.service");
const { successResponse } = require("../utils/apiResponse");

const toggleFollow = async (req, res, next) => {
  try {
    const result = await followService.toggleFollow(req.user.id, req.params.userId);
    return successResponse(res, result.message, result, 200);
  } catch (error) {
    return next(error);
  }
};

const unfollow = async (req, res, next) => {
  try {
    const result = await followService.unfollow(req.user.id, req.params.userId);
    const message = result.unfollowed
      ? "Unfollowed successfully"
      : "You were not following this user/artist";
    return successResponse(res, message, result, 200);
  } catch (error) {
    return next(error);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const result = await followService.getFollowing(req.user.id);
    return successResponse(res, "Following list fetched successfully", result, 200);
  } catch (error) {
    return next(error);
  }
};

const getFollowStatus = async (req, res, next) => {
  try {
    const result = await followService.getFollowStatus(
      req.user.id,
      req.params.artistId
    );

    return successResponse(res, "Follow status fetched successfully", result, 200);
  } catch (error) {
    return next(error);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const result = await followService.getFollowers(req.params.userId);
    return successResponse(res, "Followers list fetched successfully", result, 200);
  } catch (error) {
    return next(error);
  }
};

const getFollowingForUser = async (req, res, next) => {
  try {
    const result = await followService.getFollowingForUser(req.params.userId);
    return successResponse(res, "Following list fetched successfully", result, 200);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  toggleFollow,
  unfollow,
  getFollowStatus,
  getFollowing,
  getFollowers,
  getFollowingForUser,
};
