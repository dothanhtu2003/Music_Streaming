const bcrypt = require("bcrypt");
const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshTokenExpiresAt,
} = require("../utils/token.utils");

const SALT_ROUNDS = 10;

const userSelectFields =
  "id, email, username, role, is_verified, is_banned, created_at, updated_at";

const normalizeEmail = (email) => {
  return String(email || "").trim().toLowerCase();
};

const normalizeUsername = (username) => {
  return String(username || "").trim();
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
};

const validatePassword = (password) => {
  return typeof password === "string" && password.length >= 6;
};

const validateRegisterInput = ({ email, username, password }) => {
  if (!validateEmail(email)) {
    throw new AppError("Invalid email", 400);
  }

  if (!validateUsername(username)) {
    throw new AppError(
      "Username must be 3-30 characters and contain only letters, numbers, or underscores",
      400
    );
  }

  if (!validatePassword(password)) {
    throw new AppError("Password must be at least 6 characters", 400);
  }
};

const validateLoginInput = ({ email, password }) => {
  if (!validateEmail(email)) {
    throw new AppError("Invalid email", 400);
  }

  if (!validatePassword(password)) {
    throw new AppError("Password must be at least 6 characters", 400);
  }
};

const validateRefreshTokenInput = (refreshToken) => {
  if (!refreshToken || typeof refreshToken !== "string") {
    throw new AppError("Refresh token is required", 400);
  }
};

const formatUser = (user) => {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isVerified: user.is_verified,
    isBanned: user.is_banned,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};

const createTokenPair = async (user, client = pool) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const refreshTokenExpiresAt = getRefreshTokenExpiresAt();

  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, refreshTokenHash, refreshTokenExpiresAt]
  );

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt,
  };
};

const register = async ({ email, username, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  validateRegisterInput({
    email: normalizedEmail,
    username: normalizedUsername,
    password,
  });

  const existingUserResult = await pool.query(
    `SELECT email, username
     FROM users
     WHERE email = $1 OR username = $2
     LIMIT 1`,
    [normalizedEmail, normalizedUsername]
  );

  const existingUser = existingUserResult.rows[0];

  if (existingUser?.email === normalizedEmail) {
    throw new AppError("Email is already in use", 409);
  }

  if (existingUser?.username === normalizedUsername) {
    throw new AppError("Username is already in use", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING ${userSelectFields}`,
      [normalizedEmail, normalizedUsername, passwordHash]
    );

    return formatUser(result.rows[0]);
  } catch (error) {
    if (error.code === "23505" && error.constraint === "users_email_key") {
      throw new AppError("Email is already in use", 409);
    }

    if (error.code === "23505" && error.constraint === "users_username_key") {
      throw new AppError("Username is already in use", 409);
    }

    throw error;
  }
};

const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  validateLoginInput({
    email: normalizedEmail,
    password,
  });

  const result = await pool.query(
    `SELECT id, email, username, password_hash, role, is_verified, is_banned, created_at, updated_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("Email or password is incorrect", 401);
  }

  if (user.is_banned) {
    throw new AppError("User account is banned", 403);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new AppError("Email or password is incorrect", 401);
  }

  const tokens = await createTokenPair(user);

  return {
    user: formatUser(user),
    ...tokens,
  };
};

const refresh = async (refreshToken) => {
  validateRefreshTokenInput(refreshToken);

  const refreshTokenHash = hashToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `SELECT
        rt.id AS refresh_token_id,
        rt.expires_at,
        rt.revoked_at,
        u.id,
        u.email,
        u.username,
        u.role,
        u.is_verified,
        u.is_banned,
        u.created_at,
        u.updated_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       LIMIT 1
       FOR UPDATE OF rt`,
      [refreshTokenHash]
    );

    const tokenRecord = tokenResult.rows[0];

    if (!tokenRecord) {
      throw new AppError("Refresh token is invalid", 401);
    }

    if (tokenRecord.revoked_at) {
      throw new AppError("Refresh token has been revoked", 401);
    }

    if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      throw new AppError("Refresh token has expired", 401);
    }

    if (tokenRecord.is_banned) {
      throw new AppError("User account is banned", 403);
    }

    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE id = $1`,
      [tokenRecord.refresh_token_id]
    );

    const user = {
      id: tokenRecord.id,
      email: tokenRecord.email,
      username: tokenRecord.username,
      role: tokenRecord.role,
      is_verified: tokenRecord.is_verified,
      is_banned: tokenRecord.is_banned,
      created_at: tokenRecord.created_at,
      updated_at: tokenRecord.updated_at,
    };

    const tokens = await createTokenPair(user, client);

    await client.query("COMMIT");

    return {
      user: formatUser(user),
      ...tokens,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const logout = async (refreshToken) => {
  validateRefreshTokenInput(refreshToken);

  const refreshTokenHash = hashToken(refreshToken);

  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id`,
    [refreshTokenHash]
  );

  if (result.rowCount === 0) {
    throw new AppError("Refresh token is invalid or already logged out", 401);
  }
};

const getCurrentUser = async (userId) => {
  const result = await pool.query(
    `SELECT ${userSelectFields}
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return formatUser(user);
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
};
