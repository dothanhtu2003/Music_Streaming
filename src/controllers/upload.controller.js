const AppError = require("../utils/appError");
const { successResponse } = require("../utils/apiResponse");
const { getUploadedFileUrl } = require("../middlewares/upload.middleware");

const uploadAudio = (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError("Audio file is required", 400);
    }

    return successResponse(res, "Audio uploaded successfully", {
      url: getUploadedFileUrl(req.file),
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
      url: getUploadedFileUrl(req.file),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadAudio,
  uploadCover,
};
