process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_access_secret_that_is_at_least_32_chars";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";

const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../src/app");
const env = require("../src/config/env");
const { pool } = require("../src/db/pool");
const playlistService = require("../src/services/playlist.service");
const followService = require("../src/services/follow.service");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const RESOURCE_ID = "33333333-3333-4333-8333-333333333333";
const originalQuery = pool.query.bind(pool);
const originalConnect = pool.connect.bind(pool);

const tokenFor = (userId = USER_ID, options = {}) =>
  jwt.sign({ sub: userId, role: options.role || "user" }, env.jwt.accessSecret, {
    expiresIn: options.expiresIn || "15m",
  });

const mockAuthenticatedUser = (role = "user") => {
  pool.query = async (sql) => {
    if (String(sql).includes("FROM users") && String(sql).includes("is_banned")) {
      return {
        rows: [
          {
            id: USER_ID,
            username: "tester",
            display_name: "Tester",
            role,
            is_banned: false,
          },
        ],
      };
    }
    throw new Error(`Unexpected query: ${String(sql).slice(0, 80)}`);
  };
};

test.afterEach(() => {
  pool.query = originalQuery;
  pool.connect = originalConnect;
});

test("health check returns a request ID", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.success, true);
  assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/i);
});

test("readiness check verifies PostgreSQL", async () => {
  pool.query = async (sql) => {
    assert.equal(sql, "SELECT 1");
    return { rows: [{ "?column?": 1 }] };
  };
  await request(app).get("/api/health/readiness").expect(200);
});

test("unknown routes return standardized 404 responses", async () => {
  const response = await request(app).get("/api/not-a-route").expect(404);
  assert.deepEqual(response.body.success, false);
});

test("CORS rejects an origin outside the allowlist", async () => {
  await request(app)
    .get("/api/health")
    .set("Origin", "https://attacker.example")
    .expect(403);
});

test("protected user routes reject guests with 401", async (t) => {
  const cases = [
    ["get", "/api/likes/me"],
    ["get", "/api/playlists/me"],
    ["get", "/api/history/me"],
    ["get", "/api/notifications"],
    ["get", "/api/studio/overview"],
    ["post", "/api/recently-played"],
  ];

  for (const [method, path] of cases) {
    await t.test(`${method.toUpperCase()} ${path}`, async () => {
      await request(app)[method](path).expect(401);
    });
  }
});

test("song, playlist, like, comment and follow mutations require auth or role", async (t) => {
  const cases = [
    ["post", "/api/songs"],
    ["put", `/api/songs/${RESOURCE_ID}`],
    ["delete", `/api/songs/${RESOURCE_ID}`],
    ["post", "/api/playlists"],
    ["post", "/api/likes"],
    ["post", `/api/songs/${RESOURCE_ID}/comments`],
    ["post", `/api/follow/${OTHER_USER_ID}`],
  ];

  for (const [method, path] of cases) {
    await t.test(`${method.toUpperCase()} ${path}`, async () => {
      await request(app)[method](path).expect(401);
    });
  }
});

test("normal users cannot access admin routes", async () => {
  mockAuthenticatedUser("user");
  await request(app)
    .get("/api/admin/dashboard")
    .set("Authorization", `Bearer ${tokenFor()}`)
    .expect(403);
});

test("expired JWTs return 401", async () => {
  const token = tokenFor(USER_ID, { expiresIn: "-1s" });
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(401);
});

test("banned users are rejected even with a valid access token", async () => {
  pool.query = async () => ({
    rows: [
      {
        id: USER_ID,
        username: "banned",
        role: "user",
        is_banned: true,
      },
    ],
  });
  await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${tokenFor()}`)
    .expect(403);
});

test("registration validates password length before querying the database", async () => {
  pool.query = async () => {
    throw new Error("database should not be queried");
  };
  await request(app)
    .post("/api/auth/register")
    .send({ email: "new@example.com", username: "new_user", password: "short" })
    .expect(400);
});

test("registration hashes passwords and never returns password_hash", async () => {
  let insertedPasswordHash;
  pool.query = async (sql, params) => {
    if (String(sql).includes("SELECT email, username")) return { rows: [] };
    if (String(sql).includes("INSERT INTO users")) {
      insertedPasswordHash = params[2];
      return {
        rows: [
          {
            id: USER_ID,
            email: params[0],
            username: params[1],
            role: "user",
            is_verified: false,
            is_banned: false,
          },
        ],
      };
    }
    throw new Error("Unexpected query");
  };

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      email: "new@example.com",
      username: "new_user",
      password: "correct-horse",
    })
    .expect(201);

  assert.equal(await bcrypt.compare("correct-horse", insertedPasswordHash), true);
  assert.equal("password_hash" in response.body.data.user, false);
});

test("login with an incorrect password returns 401 without tokens", async () => {
  const passwordHash = await bcrypt.hash("correct-password", 4);
  pool.query = async () => ({
    rows: [
      {
        id: USER_ID,
        email: "user@example.com",
        username: "tester",
        role: "user",
        is_banned: false,
        password_hash: passwordHash,
      },
    ],
  });
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "user@example.com", password: "wrong-password" })
    .expect(401);
  assert.equal(response.body.accessToken, undefined);
});

test("logout hashes and revokes the supplied refresh token", async () => {
  let paramsSeen;
  pool.query = async (sql, params) => {
    assert.match(String(sql), /UPDATE refresh_tokens/);
    paramsSeen = params;
    return { rowCount: 1, rows: [{ id: RESOURCE_ID }] };
  };
  await request(app)
    .post("/api/auth/logout")
    .send({ refreshToken: "plain-refresh-token" })
    .expect(200);
  assert.notEqual(paramsSeen[0], "plain-refresh-token");
  assert.equal(paramsSeen[0].length, 64);
});

test("notification updates are scoped to the authenticated user", async () => {
  let updateParams;
  pool.query = async (sql, params) => {
    if (String(sql).includes("FROM users")) {
      return {
        rows: [
          { id: USER_ID, username: "tester", role: "user", is_banned: false },
        ],
      };
    }
    updateParams = params;
    assert.match(String(sql), /user_id = \$2/);
    return { rows: [], rowCount: 0 };
  };
  await request(app)
    .patch(`/api/notifications/${RESOURCE_ID}/read`)
    .set("Authorization", `Bearer ${tokenFor()}`)
    .expect(404);
  assert.deepEqual(updateParams, [RESOURCE_ID, USER_ID]);
});

test("playlist ownership blocks another user with 403", async () => {
  pool.query = async () => ({
    rows: [{ id: RESOURCE_ID, user_id: OTHER_USER_ID }],
  });
  await assert.rejects(
    playlistService.updatePlaylist(RESOURCE_ID, USER_ID, { name: "Changed" }),
    (error) => error.statusCode === 403
  );
});

test("users cannot follow themselves", async () => {
  pool.query = async () => ({
    rows: [{ id: USER_ID, username: "tester" }],
  });
  await assert.rejects(
    followService.toggleFollow(USER_ID, USER_ID),
    (error) => error.statusCode === 400
  );
});

test("upload validation rejects spoofed MP3 content before Cloudinary", async () => {
  mockAuthenticatedUser("admin");
  const response = await request(app)
    .post("/api/upload/audio")
    .set("Authorization", `Bearer ${tokenFor(USER_ID, { role: "admin" })}`)
    .attach("file", Buffer.from("not-an-mp3"), {
      filename: "fake.mp3",
      contentType: "audio/mpeg",
    })
    .expect(400);
  assert.match(response.body.message, /signature/i);
});

test("error handler hides stack traces outside development", async () => {
  const response = await request(app).get("/api/not-a-route").expect(404);
  assert.equal(response.body.errors, undefined);
});
