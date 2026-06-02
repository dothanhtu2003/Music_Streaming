const authService = require("../services/auth.service");
const fsPromises = require("fs/promises");
const path = require("path");
const { successResponse } = require("../utils/apiResponse");
const AppError = require("../utils/appError");

const avatarUploadRoot = path.join(process.cwd(), "uploads", "avatars");

const removeOldAvatar = async (avatarUrl) => {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/avatars/")) {
    return;
  }

  const fileName = path.basename(avatarUrl);
  const filePath = path.join(avatarUploadRoot, fileName);
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(avatarUploadRoot);

  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return;
  }

  await fsPromises.unlink(resolvedPath).catch(() => {});
};

const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);

    return successResponse(res, "Register successful", { user }, 201);
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    return successResponse(res, "Login successful", result);
  } catch (error) {
    return next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const result = await authService.refresh(req.body.refreshToken);

    return successResponse(res, "Refresh token successful", result);
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);

    return successResponse(res, "Logout successful");
  } catch (error) {
    return next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);

    return successResponse(res, "Current user profile fetched successfully", {
      user,
    });
  } catch (error) {
    return next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await authService.updateCurrentUser(req.user.id, req.body);

    return successResponse(res, "Profile updated successfully", { user });
  } catch (error) {
    return next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("Avatar image is required", 400);
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const result = await authService.updateCurrentUserAvatar(
      req.user.id,
      avatarUrl
    );

    await removeOldAvatar(result.previousAvatarUrl);

    return successResponse(res, "Avatar uploaded successfully", {
      user: result.user,
    });
  } catch (error) {
    if (req.file?.path) {
      await fsPromises.unlink(req.file.path).catch(() => {});
    }

    return next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  uploadAvatar,
};
