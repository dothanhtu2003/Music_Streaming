const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { rateLimit } = require("express-rate-limit");
const env = require("./config/env");
const routes = require("./routes");
const AppError = require("./utils/appError");
const { errorResponse } = require("./utils/apiResponse");
const {
  notFoundHandler,
  errorHandler,
} = require("./middlewares/error.middleware");

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler(req, res) {
    return errorResponse(res, "Too many requests. Please try again later.", 429);
  },
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new AppError("CORS origin is not allowed", 403));
  },
};

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiLimiter);
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
