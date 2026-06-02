const dotenv = require("dotenv");

dotenv.config({ quiet: true });

const defaultDevOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const defaultDevAccessSecret = "change_this_access_secret";

const parseList = (value, fallback = []) => {
  const source = value ? value.split(",") : fallback;

  return source.map((item) => item.trim()).filter(Boolean);
};

const getJwtAccessSecret = (nodeEnv) => {
  const secret = process.env.JWT_ACCESS_SECRET || "";

  if (nodeEnv === "production") {
    if (!secret || secret === defaultDevAccessSecret || secret.length < 32) {
      throw new Error(
        "JWT_ACCESS_SECRET must be set in .env and be at least 32 characters in production"
      );
    }
  }

  return secret || defaultDevAccessSecret;
};

const getAllowedOrigins = (nodeEnv) => {
  const origins = parseList(
    process.env.FRONTEND_URL || process.env.CORS_ORIGIN,
    nodeEnv === "production" ? [] : defaultDevOrigins
  );

  if (nodeEnv === "production" && origins.length === 0) {
    throw new Error("FRONTEND_URL or CORS_ORIGIN is required in production");
  }

  return origins;
};

const nodeEnv = process.env.NODE_ENV || "development";

const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  cors: {
    allowedOrigins: getAllowedOrigins(nodeEnv),
  },
  database: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || "music_streaming",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl: process.env.DB_SSL === "true",
    connectionString: process.env.DATABASE_URL || "",
  },
  jwt: {
    accessSecret: getJwtAccessSecret(nodeEnv),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshTokenExpiresDays:
      Number(process.env.JWT_REFRESH_TOKEN_EXPIRES_DAYS) || 7,
  },
};

module.exports = env;
