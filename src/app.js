const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const env = require("./config/env");
const routes = require("./routes");
const AppError = require("./utils/appError");
const { errorResponse } = require("./utils/apiResponse");
const {
  notFoundHandler,
  errorHandler,
} = require("./middlewares/error.middleware");
const { requestContext } = require("./middlewares/request-context.middleware");

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

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);
app.use(requestContext);
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(apiLimiter);
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
