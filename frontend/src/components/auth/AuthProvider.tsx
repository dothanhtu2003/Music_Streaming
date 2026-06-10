"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_TOKEN_CLEARED_EVENT,
  AUTH_TOKEN_UPDATED_EVENT,
  getStoredAccessToken,
  getStoredRefreshToken,
  saveTokens,
  clearTokens,
} from "@/lib/auth-storage";
import {
  getCurrentUserRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "@/lib/api";
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearAuthState = useCallback(() => {
    clearTokens();
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const handleTokenCleared = () => {
      clearAuthState();
      setError(null);
    };
    const handleTokenUpdated = () => {
      const token = getStoredAccessToken();

      if (token) {
        setAccessToken(token);
      }
    };

    window.addEventListener(AUTH_TOKEN_CLEARED_EVENT, handleTokenCleared);
    window.addEventListener(AUTH_TOKEN_UPDATED_EVENT, handleTokenUpdated);

    return () => {
      window.removeEventListener(AUTH_TOKEN_CLEARED_EVENT, handleTokenCleared);
      window.removeEventListener(AUTH_TOKEN_UPDATED_EVENT, handleTokenUpdated);
    };
  }, [clearAuthState]);

  const fetchCurrentUser = useCallback(async () => {
    const token = getStoredAccessToken();

    if (!token) {
      clearAuthState();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const currentUser = await getCurrentUserRequest(token);
      setAccessToken(getStoredAccessToken() ?? token);
      setUser(currentUser);
    } catch (currentUserError) {
      clearAuthState();
      setError(
        currentUserError instanceof Error
          ? currentUserError.message
          : "Could not fetch current user.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    let isMounted = true;
    const token = getStoredAccessToken();

    if (!token) {
      queueMicrotask(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

      return () => {
        isMounted = false;
      };
    }

    void getCurrentUserRequest(token)
      .then((currentUser) => {
        if (!isMounted) {
          return;
        }

        setAccessToken(getStoredAccessToken() ?? token);
        setUser(currentUser);
      })
      .catch((currentUserError) => {
        if (!isMounted) {
          return;
        }

        clearAuthState();
        setError(
          currentUserError instanceof Error
            ? currentUserError.message
            : "Could not fetch current user.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [clearAuthState]);

  const login = useCallback(async (payload: LoginPayload) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginRequest(payload);
      saveTokens(result.accessToken, result.refreshToken);
      setAccessToken(result.accessToken);
      setUser(result.user);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login failed.",
      );
      throw loginError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setIsLoading(true);
    setError(null);

    try {
      return await registerRequest(payload);
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Register failed.",
      );
      throw registerError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();

    setIsLoading(true);
    setError(null);

    try {
      if (refreshToken) {
        await logoutRequest(refreshToken);
      }
    } catch {
      // Even if the token is already expired/revoked, the browser session should end.
    } finally {
      clearAuthState();
      setIsLoading(false);
    }
  }, [clearAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isAdmin: user?.role === "admin",
      isLoading,
      error,
      login,
      register,
      logout,
      fetchCurrentUser,
      clearError: () => setError(null),
    }),
    [
      user,
      accessToken,
      isLoading,
      error,
      login,
      register,
      logout,
      fetchCurrentUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
