const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const {
  normalizeSearch,
  validateUuid,
} = require("../utils/query.utils");

const allowedTrackSorts = new Set(["newest", "oldest", "plays", "likes", "comments"]);

const parsePositiveInteger = (value, defaultValue, fieldName, maxValue) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > maxValue) {
    throw new AppError(`${fieldName} must be between 1 and ${maxValue}`, 400);
  }

  return parsedValue;
};

const parseStudioPagination = (query = {}) => {
  const page = parsePositiveInteger(query.page, 1, "page", 1000000);
  const limit = parsePositiveInteger(query.limit, 10, "limit", 50);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const parseLimit = (query = {}, defaultLimit, maxLimit) => {
  return parsePositiveInteger(query.limit, defaultLimit, "limit", maxLimit);
};

const formatStudioTrack = (row) => ({
  id: row.id,
  title: row.title,
  coverUrl: row.cover_url,
  artistName: row.artist_name,
  playCount: Number(row.play_count || 0),
  likeCount: Number(row.like_count || 0),
  commentCount: Number(row.comment_count || 0),
  duration: row.duration_sec === null ? null : Number(row.duration_sec),
  createdAt: row.created_at,
  isActive: row.is_active,
  fileUrl: row.file_url,
});

const formatActivity = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  isRead: row.is_read,
  createdAt: row.created_at,
});

const getOverview = async (userId) => {
  validateUuid(userId, "userId");

  const [tracksResult, likesResult, commentsResult, followersResult, followingResult] =
    await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_tracks,
           COALESCE(SUM(play_count), 0)::bigint AS total_plays
         FROM songs
         WHERE uploaded_by = $1
           AND is_active = TRUE`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_likes
         FROM likes l
         JOIN songs s ON s.id = l.song_id
         WHERE s.uploaded_by = $1
           AND s.is_active = TRUE`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total_comments
         FROM song_comments c
         JOIN songs s ON s.id = c.song_id
         WHERE s.uploaded_by = $1
           AND s.is_active = TRUE`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS followers
         FROM follows
         WHERE "followingId" = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS following
         FROM follows
         WHERE "followerId" = $1`,
        [userId]
      ),
    ]);

  const trackStats = tracksResult.rows[0];

  return {
    totalTracks: Number(trackStats.total_tracks || 0),
    totalPlays: Number(trackStats.total_plays || 0),
    totalLikes: Number(likesResult.rows[0].total_likes || 0),
    totalComments: Number(commentsResult.rows[0].total_comments || 0),
    followers: Number(followersResult.rows[0].followers || 0),
    following: Number(followingResult.rows[0].following || 0),
  };
};

const getTopTracks = async (userId, query = {}) => {
  validateUuid(userId, "userId");
  const limit = parseLimit(query, 5, 10);

  const result = await pool.query(
    `SELECT
       s.id,
       s.title,
       s.cover_url,
       s.file_url,
       s.duration_sec,
       s.play_count,
       s.is_active,
       s.created_at,
       ar.name AS artist_name,
       COUNT(DISTINCT l.id)::int AS like_count,
       COUNT(DISTINCT c.id)::int AS comment_count
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     LEFT JOIN likes l ON l.song_id = s.id
     LEFT JOIN song_comments c ON c.song_id = s.id
     WHERE s.uploaded_by = $1
       AND s.is_active = TRUE
     GROUP BY s.id, ar.name
     ORDER BY s.play_count DESC, like_count DESC, s.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return {
    items: result.rows.map(formatStudioTrack),
  };
};

const getTracks = async (userId, query = {}) => {
  validateUuid(userId, "userId");
  const { page, limit, offset } = parseStudioPagination(query);
  const sort = query.sort || "newest";

  if (!allowedTrackSorts.has(sort)) {
    throw new AppError("sort must be newest, oldest, plays, likes, or comments", 400);
  }

  const search = normalizeSearch(query.q);
  const params = [userId, search];
  const whereClause = `
    WHERE s.uploaded_by = $1
      AND s.is_active = TRUE
      AND ($2::text IS NULL OR s.title ILIKE $2)
  `;
  const orderByMap = {
    newest: "s.created_at DESC",
    oldest: "s.created_at ASC",
    plays: "s.play_count DESC, s.created_at DESC",
    likes: "like_count DESC, s.created_at DESC",
    comments: "comment_count DESC, s.created_at DESC",
  };

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM songs s
     ${whereClause}`,
    params
  );

  const result = await pool.query(
    `SELECT
       s.id,
       s.title,
       s.cover_url,
       s.file_url,
       s.duration_sec,
       s.play_count,
       s.is_active,
       s.created_at,
       ar.name AS artist_name,
       COUNT(DISTINCT l.id)::int AS like_count,
       COUNT(DISTINCT c.id)::int AS comment_count
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     LEFT JOIN likes l ON l.song_id = s.id
     LEFT JOIN song_comments c ON c.song_id = s.id
     ${whereClause}
     GROUP BY s.id, ar.name
     ORDER BY ${orderByMap[sort]}
     LIMIT $3 OFFSET $4`,
    [...params, limit, offset]
  );

  const total = Number(countResult.rows[0].total || 0);

  return {
    items: result.rows.map(formatStudioTrack),
    pagination: {
      page,
      limit,
      total,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getRecentActivity = async (userId, query = {}) => {
  validateUuid(userId, "userId");
  const limit = parseLimit(query, 10, 20);

  const result = await pool.query(
    `SELECT id, type, title, message, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return {
    items: result.rows.map(formatActivity),
  };
};

module.exports = {
  getOverview,
  getTopTracks,
  getTracks,
  getRecentActivity,
};
