const AppError = require("../utils/appError");
const { successResponse } = require("../utils/apiResponse");

const uploadAudio = (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("Audio file is required", 400);
    }

    return successResponse(res, "Audio uploaded successfully", {
      url: `/uploads/audio/${req.file.filename}`,
    });
  } catch (error) {
    return next(error);
  }
};

const uploadCover = (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("Cover file is required", 400);
    }

    return successResponse(res, "Cover uploaded successfully", {
      url: `/uploads/covers/${req.file.filename}`,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadAudio,
  uploadCover,
};
