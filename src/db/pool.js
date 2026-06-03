const { Pool } = require("pg");
const env = require("../config/env");

const parseNumber = (value, fallback) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

const getSslConfig = (sslMode = null) => {
  if (sslMode === "disable") {
    return false;
  }

  if (env.database.ssl || sslMode) {
    return { rejectUnauthorized: false };
  }

  return false;
};

const decodeUrlPart = (value) => {
  return decodeURIComponent(value || "");
};

const parseDatabaseUrl = (connectionString) => {
  const url = new URL(connectionString);

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
  }

  const database = decodeUrlPart(url.pathname.replace(/^\/+/, ""));
  const sslMode = url.searchParams.get("sslmode");

  return {
    host: url.hostname,
    port: parseNumber(url.port, 5432),
    database: database || "postgres",
    user: decodeUrlPart(url.username),
    password: decodeUrlPart(url.password),
    ssl: getSslConfig(sslMode),
  };
};

const hasSplitDatabaseConfig = () => {
  return Boolean(
    process.env.DB_HOST ||
      process.env.DB_PORT ||
      process.env.DB_NAME ||
      process.env.DB_USER ||
      process.env.DB_PASSWORD
  );
};

const getPoolConfig = () => {
  const shouldUseDatabaseUrl =
    env.database.connectionString && !hasSplitDatabaseConfig();
  const databaseConfig = shouldUseDatabaseUrl
    ? parseDatabaseUrl(env.database.connectionString)
    : {
        host: env.database.host,
        port: env.database.port,
        database: env.database.name,
        user: env.database.user,
        password: env.database.password,
        ssl: getSslConfig(),
      };

  return {
    ...databaseConfig,
    max: parseNumber(process.env.DB_POOL_MAX, 5),
    idleTimeoutMillis: parseNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parseNumber(
      process.env.DB_CONNECTION_TIMEOUT_MS,
      15000
    ),
    application_name: process.env.DB_APPLICATION_NAME || "music-streaming-api",
  };
};

const pool = new Pool(getPoolConfig());

// const connectToDatabase = async () => {
//   const client = await pool.connect();

//   try {
//     await client.query("SELECT 1");
//     console.log("PostgreSQL connected successfully");
//   } finally {
//     client.release();
//   }
// };

const connectToDatabase = async () => {
  const config = getPoolConfig();
  console.log('Connecting with:', {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    ssl: config.ssl
  });
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("PostgreSQL connected successfully");
  } finally {
    client.release();
  }
};

module.exports = { pool, connectToDatabase };
