const express = require("express");
const historyController = require("../controllers/history.controller");
const { authMiddleware } = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/me", historyController.getMyListeningHistory);
router.delete("/me", historyController.clearMyListeningHistory);

module.exports = router;
