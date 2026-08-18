const { successResponse } = require("../utils/apiResponse");
const { pool } = require("../db/pool");

const getHealth = (req, res) => {
  return successResponse(res, "Music API is running");
};

const getReadiness = async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    return successResponse(res, "Music API is ready");
  } catch (error) {
    error.statusCode = 503;
    return next(error);
  }
};

module.exports = {
  getHealth,
  getReadiness,
};
