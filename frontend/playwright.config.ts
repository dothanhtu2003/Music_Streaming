import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "..");
const databaseName =
  process.env.E2E_DB_NAME || "music_streaming_test_codex_20260813";

if (!databaseName.includes("_test_")) {
  throw new Error("E2E_DB_NAME must explicitly identify a test database");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm start",
      cwd: repositoryRoot,
      url: "http://127.0.0.1:5100/api/health/readiness",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: "test",
        PORT: "5100",
        DB_NAME: databaseName,
        FRONTEND_URL: "http://127.0.0.1:3200",
      },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3200",
      cwd: __dirname,
      url: "http://127.0.0.1:3200/login",
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:5100/api",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3200",
      },
    },
  ],
});
