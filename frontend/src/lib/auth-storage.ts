const ACCESS_TOKEN_KEY = "music_access_token";
const REFRESH_TOKEN_KEY = "music_refresh_token";
export const AUTH_TOKEN_CLEARED_EVENT = "music_auth_token_cleared";

function hasLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getStoredAccessToken() {
  if (!hasLocalStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  if (!hasLocalStorage()) {
    return null;
  }

  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(accessToken: string, refreshToken: string) {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function notifyAuthTokenCleared() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_TOKEN_CLEARED_EVENT));
  }
}
