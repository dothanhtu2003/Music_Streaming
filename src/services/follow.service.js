const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { validateUuid } = require("../utils/query.utils");

/**
 * Resolves a target user ID from a given userId parameter.
 * The parameter could be a User ID or an Artist ID.
 * Returns the corresponding User ID, or throws an error.
 */
const resolveTargetUserId = async (
  targetId,
  currentUserId,
  { allowSelf = false } = {}
) => {
  validateUuid(targetId, "userId");

  // 1. Check if the targetId belongs to a user in the users table
  const userResult = await pool.query(
    `SELECT id, username FROM users WHERE id = $1 LIMIT 1`,
    [targetId]
  );

  if (userResult.rows[0]) {
    const targetUser = userResult.rows[0];
    if (!allowSelf && targetUser.id === currentUserId) {
      throw new AppError("Cannot follow yourself", 400);
    }
    return targetUser.id;
  }

  // 2. If not a user, check if it belongs to an artist in the artists table
  const artistResult = await pool.query(
    `SELECT id, name, user_id FROM artists WHERE id = $1 LIMIT 1`,
    [targetId]
  );

  const artist = artistResult.rows[0];
  if (!artist) {
    throw new AppError("User or Artist not found", 404);
  }

  // If the artist already has a linked user_id
  if (artist.user_id) {
    if (!allowSelf && artist.user_id === currentUserId) {
      throw new AppError("Cannot follow yourself", 400);
    }
    return artist.user_id;
  }

  // If user_id is null, try to dynamically link them to a user with matching username
  const matchedUserResult = await pool.query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [artist.name]
  );

  const matchedUser = matchedUserResult.rows[0];
  if (!matchedUser) {
    throw new AppError("This artist is not linked to any active user account", 400);
  }

  if (!allowSelf && matchedUser.id === currentUserId) {
    throw new AppError("Cannot follow yourself", 400);
  }

  // Dynamically update artist user_id association for future queries
  await pool.query(
    `UPDATE artists SET user_id = $1, updated_at = NOW() WHERE id = $2`,
    [matchedUser.id, artist.id]
  );

  return matchedUser.id;
};

const getFollowStatus = async (followerId, targetId) => {
  const followingId = await resolveTargetUserId(targetId, followerId, {
    allowSelf: true,
  });

  if (followingId === followerId) {
    return {
      followed: false,
      isSelf: true,
      followingId,
    };
  }

  const result = await pool.query(
    `SELECT id
     FROM follows
     WHERE "followerId" = $1 AND "followingId" = $2
     LIMIT 1`,
    [followerId, followingId]
  );

  return {
    followed: Boolean(result.rows[0]),
    isSelf: false,
    followingId,
  };
};

/**
 * Toggle follow status for a user/artist.
 * If already following, unfollow; if not, follow.
 */
const toggleFollow = async (followerId, targetId) => {
  const followingId = await resolveTargetUserId(targetId, followerId);

  // Check if follow record already exists
  const checkResult = await pool.query(
    `SELECT id FROM follows WHERE "followerId" = $1 AND "followingId" = $2 LIMIT 1`,
    [followerId, followingId]
  );

  if (checkResult.rows[0]) {
    // Already followed: Unfollow them (delete follow record)
    await pool.query(
      `DELETE FROM follows WHERE "followerId" = $1 AND "followingId" = $2`,
      [followerId, followingId]
    );

    return {
      followed: false,
      followingId,
      message: "Unfollowed successfully",
    };
  }

  // Not followed yet: Create follow record
  const insertResult = await pool.query(
    `INSERT INTO follows ("followerId", "followingId")
     VALUES ($1, $2)
     RETURNING id, "followerId", "followingId", "createdAt"`,
    [followerId, followingId]
  );

  return {
    followed: true,
    follow: insertResult.rows[0],
    message: "Followed successfully",
  };
};

/**
 * Unfollows a user/artist directly.
 * Does not throw an error if follow record does not exist.
 */
const unfollow = async (followerId, targetId) => {
  const followingId = await resolveTargetUserId(targetId, followerId);

  const result = await pool.query(
    `DELETE FROM follows 
     WHERE "followerId" = $1 AND "followingId" = $2
     RETURNING id`,
    [followerId, followingId]
  );

  return {
    unfollowed: result.rowCount > 0,
    followingId,
  };
};

/**
 * Retrieves the list of followed entities for a user.
 * Returns both user profile details and any associated artist information.
 */
const getFollowing = async (followerId) => {
  const result = await pool.query(
    `SELECT 
       u.id AS user_id, 
       u.username, 
       u.email,
       ar.id AS artist_id,
       ar.name AS artist_name,
       ar.bio AS artist_bio,
       ar.avatar_url AS artist_avatar_url,
       f."createdAt" AS followed_at
     FROM follows f
     JOIN users u ON f."followingId" = u.id
     LEFT JOIN artists ar ON ar.user_id = u.id
     WHERE f."followerId" = $1
     ORDER BY f."createdAt" DESC`,
    [followerId]
  );

  return result.rows.map((row) => ({
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    artist_id: row.artist_id,
    name: row.artist_name || row.username,
    avatar_url: row.artist_avatar_url,
    bio: row.artist_bio,
    followed_at: row.followed_at,
  }));
};

module.exports = {
  toggleFollow,
  unfollow,
  getFollowStatus,
  getFollowing,
};
