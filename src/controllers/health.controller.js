const { successResponse } = require("../utils/apiResponse");

const getHealth = (req, res) => {
  return successResponse(res, "Music API is running");
};

module.exports = {
  getHealth,
};
