const { pool } = require("../db/pool");
const AppError = require("../utils/appError");

const parseLimit = (value) => {
  if (value === undefined || value === null || value === "") {
    return 30;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError("limit must be between 1 and 50", 400);
  }

  return limit;
};

const formatTrendingTrack = (row) => {
  return {
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    coverUrl: row.cover_url || row.album_cover_url || null,
    fileUrl: row.file_url,
    playCount: Number(row.play_count || 0),
    likeCount: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || 0),
    score: Number(row.score || 0),
    duration: Number(row.duration_sec || 0),
    createdAt: row.created_at,
  };
};

const getTrending = async (query = {}) => {
  const limit = parseLimit(query.limit);

  // TODO: If this becomes slow on a large catalog, move counts to cached counters.
  const result = await pool.query(
    `WITH stats AS (
       SELECT
         s.id,
         s.title,
         s.file_url,
         s.cover_url,
         s.duration_sec,
         s.play_count,
         s.created_at,
         ar.name AS artist_name,
         al.cover_url AS album_cover_url,
         (SELECT COUNT(*)::int FROM likes l WHERE l.song_id = s.id) AS like_count,
         (SELECT COUNT(*)::int FROM song_comments sc WHERE sc.song_id = s.id) AS comment_count,
         (SELECT COUNT(*)::int
          FROM listening_history lh
          WHERE lh.song_id = s.id
            AND lh.listened_at >= NOW() - INTERVAL '7 days') AS recent_play_count
       FROM songs s
       JOIN artists ar ON ar.id = s.artist_id
       LEFT JOIN albums al ON al.id = s.album_id
       WHERE s.is_active = TRUE
     )
     SELECT *,
            (
              play_count
              + (like_count * 5)
              + (comment_count * 3)
              + recent_play_count
              + CASE
                  WHEN created_at >= NOW() - INTERVAL '7 days' THEN 50
                  WHEN created_at >= NOW() - INTERVAL '30 days' THEN 20
                  ELSE 0
                END
            )::numeric AS score
     FROM stats
     ORDER BY score DESC, play_count DESC, created_at DESC
     LIMIT $1`,
    [limit]
  );

  return {
    items: result.rows.map(formatTrendingTrack),
  };
};

module.exports = {
  getTrending,
};
