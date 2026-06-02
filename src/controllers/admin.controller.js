const adminService = require("../services/admin.service");
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

module.exports = {
  getDashboard,
  getUsers,
  getPlaylists,
  deletePlaylist,
  updateUserRole,
  banUser,
  unbanUser,
};
