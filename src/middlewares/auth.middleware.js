const AppError = require("../utils/appError");
const { pool } = require("../db/pool");
const { verifyAccessToken } = require("../utils/token.utils");

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const [type, token] = authorizationHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
};

const getUserFromTokenPayload = async (payload) => {
  const result = await pool.query(
    `SELECT id, username, role, is_banned
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [payload.sub]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 401);
  }

  if (user.is_banned) {
    throw new AppError("User account is banned", 403);
  }

  return {
    id: user.id,
    username: payload.username || user.username,
    role: user.role,
  };
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError("Access token is required", 401);
    }

    const payload = verifyAccessToken(token);

    req.user = await getUserFromTokenPayload(payload);

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return next(new AppError("Access token is invalid or expired", 401));
    }

    return next(error);
  }
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return next();
    }

    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError("Access token is invalid or expired", 401);
    }

    const payload = verifyAccessToken(token);

    req.user = await getUserFromTokenPayload(payload);

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return next(new AppError("Access token is invalid or expired", 401));
    }

    return next(error);
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Forbidden", 403));
    }

    return next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
};
