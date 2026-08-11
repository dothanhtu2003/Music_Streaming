const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { validateUuid } = require("../utils/query.utils");

const minSearchLength = 2;
const maxQueryLength = 100;
const maxLimit = 20;
const topResultMinScore = 20;

const normalizeSearchQuery = (value = "") => {
  const query = String(value).trim().replace(/\s+/g, " ");

  if (query.length > maxQueryLength) {
    throw new AppError(`Search query must be at most ${maxQueryLength} characters`, 400);
  }

  const normalizedQuery = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

  return {
    query,
    normalizedQuery,
    shouldSearch: normalizedQuery.length >= minSearchLength,
  };
};

const parseLimit = (value, defaultValue = 5) => {
  const parsed = Number(value || defaultValue);

  if (!Number.isInteger(parsed)) {
    throw new AppError("limit must be an integer", 400);
  }

  return Math.min(Math.max(parsed, 1), maxLimit);
};

const parseInclude = (value = "all") => {
  const include = String(value || "all").toLowerCase();
  const allowedIncludes = new Set(["all", "songs", "artists", "playlists"]);

  if (!allowedIncludes.has(include)) {
    throw new AppError("include must be one of all, songs, artists, playlists", 400);
  }

  return include;
};

const toBoolean = (value, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return String(value).toLowerCase() === "true";
};

const getImageUrl = (...values) => values.find((value) => Boolean(value)) || null;

const formatScore = (value) => Math.round(Number(value || 0) * 100) / 100;

const formatSongItem = (song) => ({
  type: "song",
  id: song.id,
  title: song.title,
  subtitle: song.artist_display_name || song.artist_name,
  imageUrl: getImageUrl(song.cover_url, song.artist_avatar_url),
  href: `/songs/${song.id}`,
  score: formatScore(song.score),
  duration: Number(song.duration_sec || 0),
  createdAt: song.created_at,
  likeCount: Number(song.likes_count || 0),
  repostCount: 0,
  commentCount: Number(song.comments_count || 0),
  playCount: Number(song.play_count || 0),
});

const formatArtistItem = (artist) => ({
  type: "artist",
  id: artist.id,
  title: artist.display_name || artist.name,
  subtitle:
    Number(artist.followers_count || 0) > 0
      ? `${Number(artist.followers_count)} followers`
      : "Artist",
  imageUrl: artist.avatar_url,
  href: `/artists/${artist.id}`,
  score: formatScore(artist.score),
});

const formatPlaylistItem = (playlist) => ({
  type: "playlist",
  id: playlist.id,
  title: playlist.name,
  subtitle: `${playlist.owner_name || "User"} • ${Number(playlist.track_count || 0)} tracks`,
  imageUrl: getImageUrl(playlist.cover_url, playlist.first_song_cover_url),
  href: `/playlists/${playlist.id}`,
  score: formatScore(playlist.score),
});

const searchSongs = async (normalizedQuery, limit) => {
  const result = await pool.query(
    `SELECT
       s.id,
       s.title,
       s.cover_url,
       s.duration_sec,
       s.play_count,
       s.created_at,
       ar.name AS artist_name,
       COALESCE(NULLIF(u.display_name, ''), ar.name) AS artist_display_name,
       COALESCE(u.avatar_url, ar.avatar_url) AS artist_avatar_url,
       COALESCE(likes.likes_count, 0) AS likes_count,
       COALESCE(comments.comments_count, 0) AS comments_count,
       (
         CASE
           WHEN immutable_unaccent(lower(s.title)) = $1 THEN 100
           WHEN immutable_unaccent(lower(s.title)) LIKE $1 || '%' THEN 90
           WHEN immutable_unaccent(lower(s.title)) LIKE '%' || $1 || '%' THEN 75
           WHEN immutable_unaccent(lower(ar.name)) LIKE '%' || $1 || '%' THEN 65
           WHEN immutable_unaccent(lower(COALESCE(u.display_name, ''))) LIKE '%' || $1 || '%' THEN 62
           WHEN immutable_unaccent(lower(COALESCE(s.description, ''))) LIKE '%' || $1 || '%' THEN 45
           ELSE GREATEST(
             similarity(immutable_unaccent(lower(s.title)), $1),
             similarity(immutable_unaccent(lower(ar.name)), $1),
             similarity(immutable_unaccent(lower(COALESCE(u.display_name, ''))), $1)
           ) * 60
         END
         + LEAST(COALESCE(s.play_count, 0) / 1000.0, 10)
         + LEAST(COALESCE(likes.likes_count, 0) / 100.0, 5)
       ) AS score
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     LEFT JOIN users u ON u.id = ar.user_id
     LEFT JOIN (
       SELECT song_id, COUNT(*)::int AS likes_count
       FROM likes
       GROUP BY song_id
     ) likes ON likes.song_id = s.id
     LEFT JOIN (
       SELECT song_id, COUNT(*)::int AS comments_count
       FROM song_comments
       GROUP BY song_id
     ) comments ON comments.song_id = s.id
     WHERE s.is_active = TRUE
       AND (
         immutable_unaccent(lower(s.title)) LIKE '%' || $1 || '%'
         OR immutable_unaccent(lower(ar.name)) LIKE '%' || $1 || '%'
         OR immutable_unaccent(lower(COALESCE(u.display_name, ''))) LIKE '%' || $1 || '%'
         OR immutable_unaccent(lower(COALESCE(s.description, ''))) LIKE '%' || $1 || '%'
         OR similarity(immutable_unaccent(lower(s.title)), $1) > 0.25
         OR similarity(immutable_unaccent(lower(ar.name)), $1) > 0.25
       )
     ORDER BY score DESC, s.play_count DESC, s.created_at DESC
     LIMIT $2`,
    [normalizedQuery, limit]
  );

  return result.rows.map(formatSongItem);
};

const searchArtists = async (normalizedQuery, limit) => {
  const result = await pool.query(
    `SELECT
       ar.id,
       ar.name,
       COALESCE(NULLIF(u.display_name, ''), ar.name) AS display_name,
       COALESCE(u.avatar_url, ar.avatar_url) AS avatar_url,
       COALESCE(u.is_verified, FALSE) AS is_verified,
       COALESCE(follows.followers_count, 0) AS followers_count,
       (
         CASE
           WHEN immutable_unaccent(lower(ar.name)) = $1 THEN 100
           WHEN immutable_unaccent(lower(ar.name)) LIKE $1 || '%' THEN 90
           WHEN immutable_unaccent(lower(ar.name)) LIKE '%' || $1 || '%' THEN 75
           WHEN immutable_unaccent(lower(COALESCE(u.display_name, ''))) LIKE '%' || $1 || '%' THEN 70
           ELSE GREATEST(
             similarity(immutable_unaccent(lower(ar.name)), $1),
             similarity(immutable_unaccent(lower(COALESCE(u.display_name, ''))), $1)
           ) * 60
         END
         + CASE WHEN COALESCE(u.is_verified, FALSE) THEN 8 ELSE 0 END
         + LEAST(COALESCE(follows.followers_count, 0) / 100.0, 8)
       ) AS score
     FROM artists ar
     LEFT JOIN users u ON u.id = ar.user_id
     LEFT JOIN (
       SELECT "followingId" AS user_id, COUNT(*)::int AS followers_count
       FROM follows
       GROUP BY "followingId"
     ) follows ON follows.user_id = u.id
     WHERE immutable_unaccent(lower(ar.name)) LIKE '%' || $1 || '%'
       OR immutable_unaccent(lower(COALESCE(u.display_name, ''))) LIKE '%' || $1 || '%'
       OR immutable_unaccent(lower(COALESCE(u.username, ''))) LIKE '%' || $1 || '%'
       OR similarity(immutable_unaccent(lower(ar.name)), $1) > 0.25
     ORDER BY score DESC, is_verified DESC, followers_count DESC, ar.created_at DESC
     LIMIT $2`,
    [normalizedQuery, limit]
  );

  return result.rows.map(formatArtistItem);
};

const searchPlaylists = async (normalizedQuery, limit, userId = null) => {
  const result = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.cover_url,
       p.created_at,
       COALESCE(NULLIF(u.display_name, ''), u.username) AS owner_name,
       COUNT(ps.id)::int AS track_count,
       (
         SELECT s.cover_url
         FROM playlist_songs ps2
         JOIN songs s ON s.id = ps2.song_id AND s.is_active = TRUE
         WHERE ps2.playlist_id = p.id
         ORDER BY ps2.position ASC, ps2.added_at ASC
         LIMIT 1
       ) AS first_song_cover_url,
       (
         CASE
           WHEN immutable_unaccent(lower(p.name)) = $1 THEN 100
           WHEN immutable_unaccent(lower(p.name)) LIKE $1 || '%' THEN 90
           WHEN immutable_unaccent(lower(p.name)) LIKE '%' || $1 || '%' THEN 75
           WHEN immutable_unaccent(lower(COALESCE(p.description, ''))) LIKE '%' || $1 || '%' THEN 45
           ELSE similarity(immutable_unaccent(lower(p.name)), $1) * 60
         END
         + LEAST(COUNT(ps.id) / 10.0, 8)
       ) AS score
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE (p.is_public = TRUE OR p.user_id = $3)
       AND (
         immutable_unaccent(lower(p.name)) LIKE '%' || $1 || '%'
         OR immutable_unaccent(lower(COALESCE(p.description, ''))) LIKE '%' || $1 || '%'
         OR similarity(immutable_unaccent(lower(p.name)), $1) > 0.25
       )
     GROUP BY p.id, u.display_name, u.username
     ORDER BY score DESC, track_count DESC, p.created_at DESC
     LIMIT $2`,
    [normalizedQuery, limit, userId]
  );

  return result.rows.map(formatPlaylistItem);
};

const getTopResult = (items) => {
  const topResult = items
    .filter((item) => Number(item.score || 0) >= topResultMinScore)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];

  return topResult || null;
};

const saveSearchActivity = async ({ userId, query, normalizedQuery }) => {
  if (!normalizedQuery || normalizedQuery.length < minSearchLength) {
    return;
  }

  await pool.query(
    `INSERT INTO search_trends (query, normalized_query, search_count, last_searched_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (normalized_query)
     DO UPDATE SET
       query = EXCLUDED.query,
       search_count = search_trends.search_count + 1,
       last_searched_at = NOW()`,
    [query, normalizedQuery]
  );

  if (!userId) {
    return;
  }

  await pool.query(
    `INSERT INTO search_history (user_id, query, normalized_query, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, normalized_query)
     WHERE user_id IS NOT NULL
     DO UPDATE SET query = EXCLUDED.query, created_at = NOW()`,
    [userId, query, normalizedQuery]
  );
};

const getRecentSearches = async (userId, limit = 10, prefix = "") => {
  if (!userId) {
    return [];
  }

  const params = [userId, limit];
  let matchClause = "";

  if (prefix) {
    params.push(`${prefix}%`);
    matchClause = `AND normalized_query LIKE $${params.length}`;
  }

  const result = await pool.query(
    `SELECT id, query, normalized_query, created_at
     FROM search_history
     WHERE user_id = $1 ${matchClause}
     ORDER BY created_at DESC
     LIMIT $2`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    query: row.query,
    normalizedQuery: row.normalized_query,
    createdAt: row.created_at,
  }));
};

const deleteRecentSearch = async (userId, historyId) => {
  validateUuid(historyId, "id");

  await pool.query(
    `DELETE FROM search_history
     WHERE id = $1 AND user_id = $2`,
    [historyId, userId]
  );
};

const clearRecentSearches = async (userId) => {
  await pool.query("DELETE FROM search_history WHERE user_id = $1", [userId]);
};

const getTrendingSearches = async (limit = 10, prefix = "") => {
  const params = [limit];
  let matchClause = "";

  if (prefix) {
    params.push(`${prefix}%`);
    matchClause = `WHERE normalized_query LIKE $${params.length}`;
  }

  const result = await pool.query(
    `SELECT query, normalized_query, search_count, last_searched_at
     FROM search_trends
     ${matchClause}
     ORDER BY search_count DESC, last_searched_at DESC
     LIMIT $1`,
    params
  );

  return result.rows.map((row) => row.query);
};

const getSuggestions = async (userId, normalizedQuery, limit = 5) => {
  if (!normalizedQuery || normalizedQuery.length < minSearchLength) {
    return [];
  }

  const [recentSearches, trendResult, songResult] = await Promise.all([
    getRecentSearches(userId, limit, normalizedQuery),
    pool.query(
      `SELECT query
       FROM search_trends
       WHERE normalized_query LIKE $1 || '%'
       ORDER BY search_count DESC, last_searched_at DESC
       LIMIT $2`,
      [normalizedQuery, limit]
    ),
    pool.query(
      `SELECT s.title AS query
       FROM songs s
       WHERE s.is_active = TRUE
         AND immutable_unaccent(lower(s.title)) LIKE '%' || $1 || '%'
       ORDER BY s.play_count DESC, s.created_at DESC
       LIMIT $2`,
      [normalizedQuery, limit]
    ),
  ]);

  const seen = new Set();
  const suggestions = [];

  [...recentSearches.map((item) => item.query), ...trendResult.rows.map((row) => row.query), ...songResult.rows.map((row) => row.query)]
    .filter(Boolean)
    .forEach((value) => {
      const key = value.toLowerCase();
      if (!seen.has(key) && suggestions.length < limit) {
        seen.add(key);
        suggestions.push(value);
      }
    });

  return suggestions;
};

const search = async (queryParams = {}, user = null) => {
  const { query, normalizedQuery, shouldSearch } = normalizeSearchQuery(queryParams.q || "");
  const limit = parseLimit(queryParams.limit, 5);
  const include = parseInclude(queryParams.include);
  const saveHistory = toBoolean(queryParams.saveHistory, true);
  const userId = user?.id || null;

  if (!shouldSearch) {
    const [recentSearches, trendingSearches] = await Promise.all([
      getRecentSearches(userId, 10),
      getTrendingSearches(10),
    ]);

    return {
      query,
      normalizedQuery,
      topResult: null,
      songs: [],
      artists: [],
      playlists: [],
      suggestions: [],
      recentSearches,
      trendingSearches,
    };
  }

  const [songs, artists, playlists, suggestions] = await Promise.all([
    include === "all" || include === "songs" ? searchSongs(normalizedQuery, limit) : [],
    include === "all" || include === "artists" ? searchArtists(normalizedQuery, limit) : [],
    include === "all" || include === "playlists" ? searchPlaylists(normalizedQuery, limit, userId) : [],
    getSuggestions(userId, normalizedQuery, 8),
  ]);

  if (saveHistory) {
    await saveSearchActivity({ userId, query, normalizedQuery });
  }

  return {
    query,
    normalizedQuery,
    topResult: getTopResult([...songs, ...artists, ...playlists]),
    songs,
    artists,
    playlists,
    suggestions,
  };
};

const getSearchSuggestions = async (queryParams = {}, user = null) => {
  const { query, normalizedQuery, shouldSearch } = normalizeSearchQuery(queryParams.q || "");
  const limit = parseLimit(queryParams.limit, 5);
  const userId = user?.id || null;

  if (!shouldSearch) {
    const [recentSearches, trendingSearches] = await Promise.all([
      getRecentSearches(userId, 10),
      getTrendingSearches(10),
    ]);

    return {
      query,
      normalizedQuery,
      topResult: null,
      songs: [],
      artists: [],
      playlists: [],
      suggestions: [],
      recentSearches,
      trendingSearches,
    };
  }

  const [songs, artists, playlists, suggestions, recentSearches, trendingSearches] = await Promise.all([
    searchSongs(normalizedQuery, Math.min(limit, 5)),
    searchArtists(normalizedQuery, Math.min(limit, 3)),
    searchPlaylists(normalizedQuery, Math.min(limit, 3), userId),
    getSuggestions(userId, normalizedQuery, 5),
    getRecentSearches(userId, 5, normalizedQuery),
    getTrendingSearches(5, normalizedQuery),
  ]);

  return {
    query,
    normalizedQuery,
    topResult: getTopResult([...songs, ...artists, ...playlists]),
    songs,
    artists,
    playlists,
    suggestions,
    recentSearches,
    trendingSearches,
  };
};

module.exports = {
  search,
  getSearchSuggestions,
  getRecentSearches,
  deleteRecentSearch,
  clearRecentSearches,
  getTrendingSearches,
  normalizeSearchQuery,
};
