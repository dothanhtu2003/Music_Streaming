import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const USER_EMAIL = "e2e-user@example.com";
const PASSWORD = "TestPassword123!";
const SONG_ID = "55555555-5555-4555-8555-555555555555";
const API_URL = "http://127.0.0.1:5100/api";

const createWavBuffer = () => {
  const sampleRate = 8000;
  const sampleCount = sampleRate;
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate);
    buffer.writeInt16LE(Math.round(sample * 8000), 44 + index * 2);
  }

  return buffer;
};

const installAudioRoute = async (page: Page) => {
  const wav = createWavBuffer();
  await page.route("http://media.test/e2e-tone.wav", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: wav,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
};

const login = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(USER_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
};

test("login creates an authenticated browser session", async ({ page }) => {
  await login(page);
  await expect(page.getByText("E2E Track").first()).toBeVisible();
});

test("expired access token is refreshed and the request is retried", async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    window.localStorage.setItem("music_access_token", "expired-e2e-token");
  });
  const refreshResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/refresh") && response.status() === 200
  );
  await page.reload();
  await refreshResponse;
  await expect(page.getByText("E2E Track").first()).toBeVisible();
});

test("audio playback switches the player to pause state", async ({ page }) => {
  await installAudioRoute(page);
  await page.goto(`/songs/${SONG_ID}`);
  await expect(page.getByText("E2E Track").first()).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }).first()
  ).toBeVisible();
});

test("mobile layout has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByText("E2E Track").first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("login page has no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact || "")
  );
  expect(blocking).toEqual([]);
});

test("normal users are redirected away from admin pages", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin(?:\/|$)/);
  await expect(page.getByText("Music Admin")).toHaveCount(0);
});

test("unauthorized and forbidden flows return 401/403", async ({
  page,
  request,
}) => {
  await page.goto("/liked");
  await expect(
    page.getByRole("heading", { name: "Please login to view liked songs" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Login", exact: true }).last()).toHaveAttribute(
    "href",
    "/login?redirect=%2Fliked"
  );

  const unauthorized = await request.get(`${API_URL}/likes/me`);
  expect(unauthorized.status()).toBe(401);

  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: { email: USER_EMAIL, password: PASSWORD },
  });
  expect(loginResponse.status()).toBe(200);
  const body = await loginResponse.json();
  const forbidden = await request.get(`${API_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${body.data.accessToken}` },
  });
  expect(forbidden.status()).toBe(403);
});
