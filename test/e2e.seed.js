const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { Client } = require("pg");
const dotenv = require("dotenv");

const rootDirectory = path.resolve(__dirname, "..");
const environmentPath = path.join(rootDirectory, ".env");
const fileEnvironment = fs.existsSync(environmentPath)
  ? dotenv.parse(fs.readFileSync(environmentPath))
  : {};
const databaseEnvironment = { ...fileEnvironment, ...process.env };
const testDatabaseName =
  process.env.E2E_DB_NAME || "music_streaming_test_codex_20260813";

if (!testDatabaseName.includes("_test_")) {
  throw new Error("E2E_DB_NAME must explicitly identify a test database");
}

const config = {
  host: databaseEnvironment.DB_HOST,
  port: Number(databaseEnvironment.DB_PORT || 5432),
  database: testDatabaseName,
  user: databaseEnvironment.DB_USER,
  password: databaseEnvironment.DB_PASSWORD,
  ssl:
    databaseEnvironment.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
  connectionTimeoutMillis: 15000,
};

const ids = {
  user: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  artist: "33333333-3333-4333-8333-333333333333",
  genre: "44444444-4444-4444-8444-444444444444",
  song: "55555555-5555-4555-8555-555555555555",
};

const seed = async () => {
  const client = new Client(config);
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      TRUNCATE TABLE
        admin_notification_logs,
        notifications,
        search_history,
        search_trends,
        song_comments,
        recently_played,
        listening_history,
        refresh_tokens,
        playlist_songs,
        playlists,
        likes,
        follows,
        songs,
        albums,
        genres,
        artists,
        users
      CASCADE
    `);

    const passwordHash = await bcrypt.hash("TestPassword123!", 10);
    await client.query(
      `INSERT INTO users
        (id, email, username, display_name, password_hash, role, is_verified)
       VALUES
        ($1, 'e2e-user@example.com', 'e2e_user', 'E2E User', $3, 'user', TRUE),
        ($2, 'e2e-admin@example.com', 'e2e_admin', 'E2E Admin', $3, 'admin', TRUE)`,
      [ids.user, ids.admin, passwordHash]
    );
    await client.query(
      `INSERT INTO artists (id, name, user_id)
       VALUES ($1, 'E2E Artist', $2)`,
      [ids.artist, ids.user]
    );
    await client.query(
      `INSERT INTO genres (id, name, slug)
       VALUES ($1, 'E2E Genre', 'e2e-genre')`,
      [ids.genre]
    );
    await client.query(
      `INSERT INTO songs
        (id, title, artist_id, uploaded_by, genre_id, file_url, duration_sec)
       VALUES ($1, 'E2E Track', $2, $3, $4, $5, 1)`,
      [
        ids.song,
        ids.artist,
        ids.user,
        ids.genre,
        "http://media.test/e2e-tone.wav",
      ]
    );
    await client.query("COMMIT");
    console.log(`Seeded dedicated E2E database: ${testDatabaseName}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

seed().catch((error) => {
  console.error(`E2E database seed failed: ${error.message}`);
  process.exitCode = 1;
});
