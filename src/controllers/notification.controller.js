const notificationService = require("../services/notification.service");
const { successResponse } = require("../utils/apiResponse");

const getNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.getNotifications(
      req.user.id,
      req.query
    );

    return successResponse(
      res,
      "Notifications fetched successfully",
      result.items,
      200,
      { pagination: result.pagination }
    );
  } catch (error) {
    return next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user.id);

    return successResponse(
      res,
      "Unread notification count fetched successfully",
      result
    );
  } catch (error) {
    return next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(
      req.user.id,
      req.params.id
    );

    return successResponse(res, "Notification marked as read", notification);
  } catch (error) {
    return next(error);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);

    return successResponse(res, "Notifications marked as read", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
