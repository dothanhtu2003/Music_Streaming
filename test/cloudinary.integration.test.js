const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const express = require("express");
const request = require("supertest");
require("dotenv").config({ quiet: true });

process.env.NODE_ENV = "test";

const requiredEnvironment = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for the Cloudinary integration test`);
  }
}

if (!process.env.DB_NAME || !process.env.DB_NAME.includes("_test_")) {
  throw new Error("DB_NAME must explicitly identify a dedicated test database");
}

const testPublicId = `codex-cleanup-${Date.now()}-${crypto
  .randomBytes(4)
  .toString("hex")}`;
const originalRandomUuid = crypto.randomUUID;
crypto.randomUUID = () => testPublicId;

const { pool } = require("../src/db/pool");
const { cloudinary } = require("../src/config/cloudinary");
const {
  uploadTrack,
  removeUploadedFiles,
} = require("../src/middlewares/upload.middleware");

crypto.randomUUID = originalRandomUuid;

const createAudioFixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "music-upload-test-"));
  const filePath = path.join(directory, "fixture.mp3");

  execFileSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=0.5",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "9",
      filePath,
    ],
    { stdio: "ignore" }
  );

  return { directory, filePath };
};

const resourceExists = async (publicId) => {
  try {
    await cloudinary.api.resource(publicId, { resource_type: "video" });
    return true;
  } catch (error) {
    if (error?.error?.http_code === 404 || error?.http_code === 404) {
      return false;
    }
    throw error;
  }
};

const run = async () => {
  const fixture = createAudioFixture();
  let uploadedPublicId = null;
  const app = express();

  app.post(
    "/forced-db-failure",
    (req, res, next) => {
      req.user = { id: "11111111-1111-4111-8111-111111111111" };
      next();
    },
    ...uploadTrack,
    async (req, res) => {
      const files = Object.values(req.files || {}).flat();
      uploadedPublicId = files[0]?.filename || null;

      try {
        await pool.query("INSERT INTO missing_table_for_cleanup_test VALUES (1)");
        return res.status(500).json({ success: false });
      } catch {
        await removeUploadedFiles(files);
        return res.status(503).json({ success: false, cleanupAttempted: true });
      }
    }
  );

  try {
    const response = await request(app)
      .post("/forced-db-failure")
      .field("title", "Cloudinary cleanup test")
      .attach("audio", fixture.filePath, { contentType: "audio/mpeg" })
      .expect(503);

    assert.equal(response.body.cleanupAttempted, true);
    assert.ok(uploadedPublicId, "Cloudinary upload did not return a public ID");
    assert.equal(
      await resourceExists(uploadedPublicId),
      false,
      "Cloudinary resource still exists after the forced database failure"
    );
    console.log("Cloudinary upload and DB-failure cleanup integration test passed");
  } finally {
    if (uploadedPublicId && (await resourceExists(uploadedPublicId))) {
      await cloudinary.uploader.destroy(uploadedPublicId, {
        resource_type: "video",
        invalidate: true,
      });
    }
    await pool.end();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
};

run().catch((error) => {
  console.error(`Cloudinary integration test failed: ${error.message}`);
  process.exitCode = 1;
});
