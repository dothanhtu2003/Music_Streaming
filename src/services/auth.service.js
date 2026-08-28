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
  "id, email, username, display_name, bio, avatar_url, role, is_verified, is_banned, created_at, updated_at";

const userWithFollowCountsSelect = `
  id, email, username, display_name, bio, avatar_url, role, is_verified, is_banned, created_at, updated_at,
  COALESCE((SELECT COUNT(*)::int FROM follows WHERE "followingId" = users.id), 0) AS followers_count,
  COALESCE((SELECT COUNT(*)::int FROM follows WHERE "followerId" = users.id), 0) AS following_count
`;

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
  return (
    typeof password === "string" &&
    password.length >= 1 &&
    password.length <= 20 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
};

const validateLoginPassword = (password) => {
  return (
    typeof password === "string" &&
    password.length > 0 &&
    password.length <= 20 &&
    Buffer.byteLength(password, "utf8") <= 72
  );
};

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || null;
};

const validateOptionalUrl = (value, fieldName) => {
  if (!value) {
    return;
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw new AppError(`${fieldName} must be a valid URL`, 400);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(`${fieldName} must start with http:// or https://`, 400);
  }
};

const validateRegisterInput = ({ email, username, password }) => {
  if (!validateEmail(email) || email.length > 254) {
    throw new AppError("Invalid email", 400);
  }

  if (!validateUsername(username)) {
    throw new AppError(
      "Username must be 3-30 characters and contain only letters, numbers, or underscores",
      400
    );
  }

  if (!validatePassword(password)) {
    throw new AppError(
      "Password must be between 1 and 20 characters",
      400
    );
  }
};

const validateLoginInput = ({ email, password }) => {
  if (!validateEmail(email)) {
    throw new AppError("Invalid email", 400);
  }

  if (typeof password !== "string" || password.length === 0) {
    throw new AppError("Password is required", 400);
  }

  if (!validateLoginPassword(password)) {
    throw new AppError(
      "Password must be between 1 and 20 characters",
      400
    );
  }
};

const validateProfileInput = ({ displayName, bio }) => {
  if (!displayName || displayName.length < 2) {
    throw new AppError("Display name must be at least 2 characters", 400);
  }

  if (displayName.length > 80) {
    throw new AppError("Display name must be 80 characters or less", 400);
  }

  if (bio && bio.length > 300) {
    throw new AppError("Bio must be 300 characters or less", 400);
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
    displayName: user.display_name,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    role: user.role,
    isVerified: user.is_verified,
    isBanned: user.is_banned,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    followersCount: Number(user.followers_count || 0),
    followingCount: Number(user.following_count || 0),
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

const register = async ({ email, username, password } = {}) => {
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

const login = async ({ email, password } = {}) => {
  const normalizedEmail = normalizeEmail(email);

  validateLoginInput({
    email: normalizedEmail,
    password,
  });

  const result = await pool.query(
    `SELECT ${userSelectFields}, password_hash
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
  const currentUser = await getCurrentUser(user.id);

  return {
    user: currentUser,
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
        u.display_name,
        u.bio,
        u.avatar_url,
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
      display_name: tokenRecord.display_name,
      bio: tokenRecord.bio,
      avatar_url: tokenRecord.avatar_url,
      role: tokenRecord.role,
      is_verified: tokenRecord.is_verified,
      is_banned: tokenRecord.is_banned,
      created_at: tokenRecord.created_at,
      updated_at: tokenRecord.updated_at,
    };

    const tokens = await createTokenPair(user, client);

    await client.query("COMMIT");

    const currentUser = await getCurrentUser(user.id);

    return {
      user: currentUser,
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
    `SELECT ${userWithFollowCountsSelect}
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

const updateCurrentUser = async (userId, data) => {
  const displayName = normalizeOptionalString(
    data.display_name ?? data.displayName ?? data.username
  );
  const bio = normalizeOptionalString(data.bio);

  validateProfileInput({ displayName, bio });

  const result = await pool.query(
    `UPDATE users
     SET display_name = $1,
         bio = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
    [displayName, bio, userId]
  );

  const user = result.rows[0];

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return getCurrentUser(userId);
};

const updateCurrentUserAvatar = async (userId, avatarUrl) => {
  const normalizedAvatarUrl = normalizeOptionalString(avatarUrl);

  if (!normalizedAvatarUrl) {
    throw new AppError("Avatar URL is invalid", 400);
  }

  validateOptionalUrl(normalizedAvatarUrl, "avatar_url");

  if (new URL(normalizedAvatarUrl).protocol !== "https:") {
    throw new AppError("Avatar URL must be a secure URL", 400);
  }

  const currentResult = await pool.query(
    `SELECT avatar_url
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  if (!currentResult.rows[0]) {
    throw new AppError("User not found", 404);
  }

  await pool.query(
    `UPDATE users
     SET avatar_url = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [normalizedAvatarUrl, userId]
  );

  const updatedUser = await getCurrentUser(userId);

  return {
    user: updatedUser,
    previousAvatarUrl: currentResult.rows[0].avatar_url,
  };
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  updateCurrentUser,
  updateCurrentUserAvatar,
};
