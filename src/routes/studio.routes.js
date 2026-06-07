const express = require("express");
const studioController = require("../controllers/studio.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/overview", studioController.getOverview);
router.get("/top-tracks", studioController.getTopTracks);
router.get("/tracks", studioController.getTracks);
router.get("/recent-activity", studioController.getRecentActivity);

module.exports = router;
