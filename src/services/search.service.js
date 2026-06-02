const { pool } = require("../db/pool");
const { artistLinkedUserJoin } = require("../utils/artist-user.utils");
const { normalizeSearch } = require("../utils/query.utils");

const search = async (query = {}) => {
  const keyword = String(query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(query.limit || "5", 10), 1), 20);
  const searchPattern = normalizeSearch(keyword);

  if (!searchPattern) {
    return {
      songs: [],
      artists: [],
    };
  }

  // 1. Parameterized query for Songs
  // Matches song title, description, artist name, artist display name, username, and genre
  const songQuery = `
    SELECT 
      s.id,
      s.title,
      s.description,
      s.cover_url,
      s.file_url,
      s.duration_sec,
      s.play_count,
      s.created_at,
      ar.id AS artist_id,
      ar.name AS artist_name,
      COALESCE(NULLIF(u.display_name, ''), ar.name) AS artist_display_name,
      COALESCE(u.avatar_url, ar.avatar_url) AS artist_avatar_url,
      g.name AS genre_name
    FROM songs s
    JOIN artists ar ON ar.id = s.artist_id
    LEFT JOIN users u ON u.id = ar.user_id
    LEFT JOIN genres g ON g.id = s.genre_id
    WHERE s.is_active = TRUE AND (
      s.title ILIKE $1 
      OR ar.name ILIKE $1 
      OR u.username ILIKE $1 
      OR u.display_name ILIKE $1 
      OR g.name ILIKE $1 
      OR s.description ILIKE $1
    )
    ORDER BY s.play_count DESC, s.created_at DESC
    LIMIT $2
  `;

  // 2. Parameterized query for Artists
  // Matches artist name, linked user username, and display name
  const artistQuery = `
    SELECT 
      ar.id,
      ar.name,
      COALESCE(NULLIF(u.display_name, ''), ar.name) AS display_name,
      COALESCE(u.avatar_url, ar.avatar_url) AS avatar_url
    FROM artists ar
    LEFT JOIN users u ON u.id = ar.user_id
    WHERE ar.name ILIKE $1 
      OR u.username ILIKE $1 
      OR u.display_name ILIKE $1
    ORDER BY ar.created_at DESC
    LIMIT $2
  `;

  const [songsResult, artistsResult] = await Promise.all([
    pool.query(songQuery, [searchPattern, limit]),
    pool.query(artistQuery, [searchPattern, limit]),
  ]);

  const songs = songsResult.rows.map((song) => ({
    id: song.id,
    title: song.title,
    description: song.description,
    cover_url: song.cover_url,
    file_url: song.file_url,
    duration_sec: song.duration_sec,
    play_count: Number(song.play_count),
    created_at: song.created_at,
    artist: {
      id: song.artist_id,
      name: song.artist_name,
      display_name: song.artist_display_name,
      avatar_url: song.artist_avatar_url,
    },
    genre: song.genre_name
      ? {
          name: song.genre_name,
        }
      : null,
  }));

  const artists = artistsResult.rows.map((artist) => ({
    id: artist.id,
    name: artist.name,
    display_name: artist.display_name,
    avatar_url: artist.avatar_url,
  }));

  return {
    songs,
    artists,
  };
};

module.exports = {
  search,
};
