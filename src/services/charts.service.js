const { pool } = require("../db/pool");
const AppError = require("../utils/appError");

const allowedPeriods = new Set(["today", "week", "month", "all"]);

const parseLimit = (value, defaultLimit, maxLimit) => {
  if (value === undefined || value === null || value === "") {
    return defaultLimit;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new AppError(`limit must be between 1 and ${maxLimit}`, 400);
  }

  return limit;
};

const validatePeriod = (value) => {
  const period = value || "week";

  if (!allowedPeriods.has(period)) {
    throw new AppError("period must be today, week, month, or all", 400);
  }

  return period;
};

const getPeriodInterval = (period) => {
  if (period === "today") {
    return "1 day";
  }

  if (period === "week") {
    return "7 days";
  }

  return "30 days";
};

const formatChartTrack = (row, index) => {
  return {
    rank: index + 1,
    id: row.id,
    title: row.title,
    artistName: row.artist_name,
    coverUrl: row.cover_url || row.album_cover_url || null,
    fileUrl: row.file_url,
    playCount: Number(row.chart_play_count ?? row.play_count ?? 0),
    totalPlayCount: Number(row.play_count || 0),
    likeCount: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || 0),
    duration: Number(row.duration_sec || 0),
    createdAt: row.created_at,
  };
};

const baseTrackSelect = `
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
  (SELECT COUNT(*)::int FROM song_comments sc WHERE sc.song_id = s.id) AS comment_count
`;

const baseTrackJoins = `
  FROM songs s
  JOIN artists ar ON ar.id = s.artist_id
  LEFT JOIN albums al ON al.id = s.album_id
`;

const getFallbackCharts = async (period, limit) => {
  // TODO: Replace this fallback when the app has enough time-window listen data.
  const result = await pool.query(
    `SELECT ${baseTrackSelect},
            s.play_count AS chart_play_count
     ${baseTrackJoins}
     WHERE s.is_active = TRUE
     ORDER BY s.play_count DESC, s.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return {
    period,
    items: result.rows.map(formatChartTrack),
  };
};

const getCharts = async (query = {}) => {
  const period = validatePeriod(query.period);
  const limit = parseLimit(query.limit, 50, 100);

  if (period === "all") {
    return getFallbackCharts(period, limit);
  }

  const interval = getPeriodInterval(period);
  const result = await pool.query(
    `SELECT ${baseTrackSelect},
            COUNT(lh.id)::int AS chart_play_count
     ${baseTrackJoins}
     LEFT JOIN listening_history lh
       ON lh.song_id = s.id
      AND lh.listened_at >= NOW() - $1::interval
     WHERE s.is_active = TRUE
     GROUP BY s.id, ar.name, al.cover_url
     HAVING COUNT(lh.id) > 0
     ORDER BY chart_play_count DESC, s.play_count DESC, s.created_at DESC
     LIMIT $2`,
    [interval, limit]
  );

  if (result.rowCount === 0) {
    return getFallbackCharts(period, limit);
  }

  return {
    period,
    items: result.rows.map(formatChartTrack),
  };
};

module.exports = {
  getCharts,
};
