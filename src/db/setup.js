const fs = require("fs/promises");
const path = require("path");
const { pool } = require("./pool");

const setupDatabase = async () => {
  const schema = await fs.readFile(path.join(__dirname, "schema.sql"), "utf8");

  try {
    await pool.query(schema);
    console.log("Base database schema applied successfully");
  } finally {
    await pool.end();
  }
};

setupDatabase().catch((error) => {
  console.error("Database setup failed:", error.message);
  process.exitCode = 1;
});
