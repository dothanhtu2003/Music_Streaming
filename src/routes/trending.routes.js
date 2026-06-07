const express = require("express");
const trendingController = require("../controllers/trending.controller");

const router = express.Router();

router.get("/", trendingController.getTrending);

module.exports = router;
