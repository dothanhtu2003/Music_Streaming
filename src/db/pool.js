// src/db/pool.js
const { Pool } = require('pg');
const env = require('../config/env');

const sslConfig = env.database.ssl ? { rejectUnauthorized: false } : false;

const poolConfig = env.database.connectionString
  ? {
      connectionString: env.database.connectionString,
      ssl: sslConfig,
    }
  : {
      host:     env.database.host,
      port:     env.database.port,
      database: env.database.name,
      user:     env.database.user,
      password: env.database.password,
      ssl:      sslConfig,
    };


const pool = new Pool(poolConfig);

const connectToDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connected successfully');
  } finally {
    client.release();
  }
};

module.exports = { pool, connectToDatabase };