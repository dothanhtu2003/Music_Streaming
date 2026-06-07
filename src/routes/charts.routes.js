const express = require("express");
const chartsController = require("../controllers/charts.controller");

const router = express.Router();

router.get("/", chartsController.getCharts);

module.exports = router;
