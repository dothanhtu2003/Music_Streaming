const adminService = require("../services/admin.service");
const notificationService = require("../services/notification.service");
const { successResponse } = require("../utils/apiResponse");

const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await adminService.getDashboard();

    return successResponse(res, "Admin dashboard fetched successfully", dashboard);
  } catch (error) {
    return next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const result = await adminService.getUsers(req.query);

    return successResponse(res, "Users fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getUserOptions = async (req, res, next) => {
  try {
    const users = await adminService.getUserOptions();

    return successResponse(res, "User options fetched successfully", users);
  } catch (error) {
    return next(error);
  }
};

const getPlaylists = async (req, res, next) => {
  try {
    const result = await adminService.getPlaylists(req.query);

    return successResponse(res, "Playlists fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const deletePlaylist = async (req, res, next) => {
  try {
    const playlist = await adminService.deletePlaylist(req.params.id);

    return successResponse(res, "Playlist deleted successfully", playlist);
  } catch (error) {
    return next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await adminService.updateUserRole(req.params.id, req.body.role);

    return successResponse(res, "User role updated successfully", user);
  } catch (error) {
    return next(error);
  }
};

const banUser = async (req, res, next) => {
  try {
    const user = await adminService.setUserBanned(
      req.params.id,
      req.user.id,
      true
    );

    return successResponse(res, "User banned successfully", user);
  } catch (error) {
    return next(error);
  }
};

const unbanUser = async (req, res, next) => {
  try {
    const user = await adminService.setUserBanned(
      req.params.id,
      req.user.id,
      false
    );

    return successResponse(res, "User unbanned successfully", user);
  } catch (error) {
    return next(error);
  }
};

const broadcastNotification = async (req, res, next) => {
  try {
    const result = await notificationService.createBroadcastNotification({
      actorId: req.user.id,
      title: req.body.title,
      message: req.body.message,
    });

    return res.status(200).json({
      success: true,
      sent: result.sent,
      message: "Broadcast notification sent successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const result = await notificationService.createAdminNotification({
      actorId: req.user.id,
      targetType: req.body.targetType,
      targetUserId: req.body.targetUserId,
      targetUserIds: req.body.targetUserIds,
      title: req.body.title,
      message: req.body.message,
    });

    return res.status(200).json({
      success: true,
      sent: result.sent,
      message: "Notification sent successfully",
    });
  } catch (error) {
    return next(error);
  }
};

const getNotificationHistory = async (req, res, next) => {
  try {
    const result = await notificationService.getAdminNotificationHistory(
      req.query
    );

    return successResponse(
      res,
      "Notification history fetched successfully",
      result.items,
      200,
      { pagination: result.pagination }
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDashboard,
  getUsers,
  getUserOptions,
  getPlaylists,
  deletePlaylist,
  updateUserRole,
  banUser,
  unbanUser,
  broadcastNotification,
  sendNotification,
  getNotificationHistory,
};
