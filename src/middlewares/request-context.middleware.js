const crypto = require("crypto");
const env = require("../config/env");

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;

const requestContext = (req, res, next) => {
  const incomingRequestId = req.get("x-request-id");
  req.id = REQUEST_ID_PATTERN.test(incomingRequestId || "")
    ? incomingRequestId
    : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    if (env.nodeEnv === "test") return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const entry = {
      level: res.statusCode >= 500 ? "error" : "info",
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    console.log(JSON.stringify(entry));
  });

  return next();
};

module.exports = { requestContext };
