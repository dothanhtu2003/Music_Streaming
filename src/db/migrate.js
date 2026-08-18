const fs = require("fs/promises");
const path = require("path");
const { pool } = require("./pool");

const migrationsDirectory = path.join(__dirname, "migrations");
const lockId = 73120419;

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const entries = await fs.readdir(migrationsDirectory, {
      withFileTypes: true,
    });
    const migrationFiles = entries
      .filter((entry) => entry.isFile() && /^\d{3}_.+\.sql$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    const appliedResult = await client.query(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    for (const filename of migrationFiles) {
      if (applied.has(filename)) continue;

      const sourceSql = await fs.readFile(
        path.join(migrationsDirectory, filename),
        "utf8"
      );
      const sql = sourceSql
        .replace(/^\s*BEGIN;\s*/i, "")
        .replace(/\s*COMMIT;\s*$/i, "");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`Applied migration: ${filename}`);
    }

    console.log("Database migrations are up to date");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => {});
    client.release();
    await pool.end();
  }
};

runMigrations().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
