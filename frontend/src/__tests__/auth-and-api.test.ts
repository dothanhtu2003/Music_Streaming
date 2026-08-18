import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  saveTokens,
} from "@/lib/auth-storage";
import {
  ApiRequestError,
  getCurrentUserRequest,
  loginRequest,
} from "@/lib/api";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authentication storage", () => {
  it("stores and clears both session tokens", () => {
    saveTokens("access", "refresh");
    expect(getStoredAccessToken()).toBe("access");
    expect(getStoredRefreshToken()).toBe("refresh");
    clearTokens();
    expect(getStoredAccessToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });
});

describe("API error handling", () => {
  it("returns a typed error without exposing an HTML server response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>internal details</html>", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      ),
    );

    await expect(
      loginRequest({ email: "user@example.com", password: "password" }),
    ).rejects.toEqual(
      expect.objectContaining<ApiRequestError>({
        name: "ApiRequestError",
        statusCode: 500,
        message: "Internal Server Error",
      }),
    );
  });

  it("refreshes once after 401 and retries the authenticated request", async () => {
    saveTokens("expired-access", "valid-refresh");
    const user = {
      id: "user-1",
      email: "user@example.com",
      username: "user",
      displayName: "User",
      role: "user",
      isVerified: false,
      isBanned: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "Expired" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          message: "Refreshed",
          data: {
            user,
            accessToken: "new-access",
            refreshToken: "new-refresh",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, message: "OK", data: { user } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCurrentUserRequest("expired-access")).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getStoredAccessToken()).toBe("new-access");
    expect(getStoredRefreshToken()).toBe("new-refresh");
  });
});
