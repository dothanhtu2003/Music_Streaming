const { rateLimit } = require("express-rate-limit");
const { errorResponse } = require("../utils/apiResponse");

const createLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(req, res) {
      return errorResponse(res, message, 429);
    },
  });

const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many login attempts. Please try again later.",
});

const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many registration attempts. Please try again later.",
});

const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: "Too many token refresh attempts. Please try again later.",
});

const uploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: "Too many upload attempts. Please try again later.",
});

const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: "Too many search requests. Please try again later.",
});

const playCountLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: "Too many playback tracking requests. Please try again later.",
});

module.exports = {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  uploadLimiter,
  searchLimiter,
  playCountLimiter,
};
