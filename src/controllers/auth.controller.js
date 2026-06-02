const authService = require("../services/auth.service");
const { successResponse } = require("../utils/apiResponse");

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

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
};
