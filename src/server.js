

const app = require("./app");
const env = require("./config/env");
const { connectToDatabase, pool } = require("./db/pool");

const startServer = async () => {
  try {
    await connectToDatabase();

    const server = app.listen(env.port, () => {
      console.log(`Music API server is running on port ${env.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Closing server...`);

      server.close(async () => {
        await pool.end();
        console.log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_SSL:', process.env.DB_SSL);

startServer();
