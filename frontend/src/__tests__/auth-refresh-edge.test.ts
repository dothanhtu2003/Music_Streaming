import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_TOKEN_CLEARED_EVENT,
  AUTH_TOKEN_UPDATED_EVENT,
  getStoredAccessToken,
  getStoredRefreshToken,
  saveTokens,
} from "@/lib/auth-storage";
import {
  ApiRequestError,
  getCurrentUserRequest,
  refreshAuthSession,
} from "@/lib/api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    statusText: status === 429 ? "Too Many Requests" : undefined,
    headers: { "Content-Type": "application/json" },
  });

const user = {
  id: "user-1",
  email: "user@example.com",
  username: "user",
  displayName: "User",
  role: "user" as const,
  isVerified: false,
  isBanned: false,
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authentication refresh edge cases", () => {
  it("rejects refresh immediately when no refresh token is stored", async () => {
    await expect(refreshAuthSession()).rejects.toEqual(
      expect.objectContaining<ApiRequestError>({
        statusCode: 401,
        message: "Refresh token is missing.",
      }),
    );
  });

  it("clears tokens and emits an event when refresh fails", async () => {
    saveTokens("expired-access", "invalid-refresh");
    const clearedListener = vi.fn();
    window.addEventListener(AUTH_TOKEN_CLEARED_EVENT, clearedListener);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ success: false, message: "Expired" }, 401))
        .mockResolvedValueOnce(jsonResponse({ success: false, message: "Invalid refresh" }, 401)),
    );

    await expect(getCurrentUserRequest("expired-access")).rejects.toEqual(
      expect.objectContaining({ statusCode: 401, message: "Expired" }),
    );
    expect(getStoredAccessToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
    expect(clearedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_TOKEN_CLEARED_EVENT, clearedListener);
  });

  it("shares one refresh request between simultaneous 401 responses", async () => {
    saveTokens("expired-access", "valid-refresh");
    const updatedListener = vi.fn();
    window.addEventListener(AUTH_TOKEN_UPDATED_EVENT, updatedListener);
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        await Promise.resolve();
        return jsonResponse({
          success: true,
          message: "Refreshed",
          data: {
            user,
            accessToken: "new-access",
            refreshToken: "new-refresh",
          },
        });
      }

      const headers = init?.headers as Headers;
      if (headers.get("Authorization") === "Bearer expired-access") {
        return jsonResponse({ success: false, message: "Expired" }, 401);
      }

      return jsonResponse({ success: true, message: "OK", data: { user } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      Promise.all([
        getCurrentUserRequest("expired-access"),
        getCurrentUserRequest("expired-access"),
      ]),
    ).resolves.toEqual([user, user]);
    expect(refreshCalls).toBe(1);
    expect(getStoredAccessToken()).toBe("new-access");
    expect(updatedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_TOKEN_UPDATED_EVENT, updatedListener);
  });
});
