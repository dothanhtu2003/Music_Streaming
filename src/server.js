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

      const forceExitTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out");
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      server.close(async () => {
        try {
          await pool.end();
          clearTimeout(forceExitTimer);
          console.log("Server closed");
          process.exit(0);
        } catch (error) {
          console.error("Failed to close database pool:", error.message);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
