const notificationService = require("../services/notification.service");
const notificationStreamService = require("../services/notification-stream.service");
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

const streamNotifications = async (req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const userId = req.user.id;
    const cleanup = notificationStreamService.addClient(userId, res);

    console.log(`SSE client connected userId=${userId}`);

    req.on("close", () => {
      cleanup();
      console.log(`SSE client disconnected userId=${userId}`);
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  streamNotifications,
};
