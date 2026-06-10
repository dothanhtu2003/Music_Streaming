const env = require("../config/env");
const { errorResponse } = require("../utils/apiResponse");

const getMulterError = (err) => {
  if (err.name !== "MulterError") {
    return null;
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return {
      statusCode: 413,
      message: "File is too large",
    };
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return {
      statusCode: 400,
      message: "Invalid file field for this upload endpoint",
    };
  }

  return {
    statusCode: 400,
    message: err.message,
  };
};

const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const multerError = getMulterError(err);
  const statusCode = multerError?.statusCode || err.statusCode || err.status || 500;
  const message =
    multerError?.message ||
    (statusCode === 500 ? "Internal server error" : err.message);
  const errors = env.nodeEnv === "development" ? { stack: err.stack } : null;

  if (env.nodeEnv !== "test") {
    if (statusCode >= 500) {
      console.error(err);
    } else {
      console.warn(`${req.method} ${req.originalUrl} ${statusCode}: ${message}`);
    }
  }

  return errorResponse(res, message, statusCode, errors);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
