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
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  followUserRequest,
  getFollowingRequest,
  unfollowUserRequest,
} from "@/lib/api";
import type { FollowedArtist } from "@/types/music";

type FollowNotice = {
  type: "success" | "error";
  text: string;
};

type FollowContextValue = {
  following: FollowedArtist[];
  isLoading: boolean;
  actionId: string | null;
  error: string | null;
  notice: FollowNotice | null;
  isFollowing: (id: string | null | undefined) => boolean;
  toggleFollow: (id: string, name: string) => Promise<void>;
  refreshFollowing: () => Promise<void>;
  clearNotice: () => void;
};

const FollowContext = createContext<FollowContextValue | null>(null);

type FollowProviderProps = {
  children: ReactNode;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function FollowProvider({ children }: FollowProviderProps) {
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState<FollowedArtist[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<FollowNotice | null>(null);

  const showNotice = useCallback((nextNotice: FollowNotice) => {
    setNotice(nextNotice);
  }, []);

  const clearFollowState = useCallback(() => {
    setFollowing([]);
    setFollowingIds(new Set());
    setError(null);
    setIsLoading(false);
  }, []);

  const refreshFollowing = useCallback(async () => {
    if (!accessToken) {
      clearFollowState();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const items = await getFollowingRequest(accessToken);
      setFollowing(items);
      
      const ids = new Set<string>();
      items.forEach((item) => {
        ids.add(item.user_id);
        if (item.artist_id) {
          ids.add(item.artist_id);
        }
      });
      setFollowingIds(ids);
    } catch (followError) {
      const message = getErrorMessage(
        followError,
        "Could not load following list.",
      );
      setError(message);
      showNotice({ type: "error", text: message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, clearFollowState, showNotice]);

  useEffect(() => {
    let isMounted = true;

    if (authLoading) {
      return () => {
        isMounted = false;
      };
    }

    if (!accessToken) {
      queueMicrotask(() => {
        if (isMounted) {
          clearFollowState();
        }
      });

      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        void refreshFollowing();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [accessToken, authLoading, clearFollowState, refreshFollowing]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const redirectToLogin = useCallback(() => {
    const redirectPath = pathname || "/";
    showNotice({ type: "error", text: "Please login to follow artists." });
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }, [pathname, router, showNotice]);

  const isFollowing = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return followingIds.has(id);
    },
    [followingIds],
  );

  const follow = useCallback(
    async (id: string, name: string) => {
      if (authLoading) {
        showNotice({ type: "error", text: "Checking login status..." });
        return;
      }

      if (!accessToken) {
        redirectToLogin();
        return;
      }

      // Check if trying to follow oneself
      if (user?.id === id || user?.username?.toLowerCase() === name.toLowerCase()) {
        showNotice({ type: "error", text: "You cannot follow yourself." });
        return;
      }

      setActionId(id);
      setError(null);

      // Optimistic Update
      setFollowingIds((curr) => {
        const next = new Set(curr);
        next.add(id);
        return next;
      });

      try {
        const result = await followUserRequest(id, accessToken);
        // Refresh following list to get correct user_id / artist_id mapping
        await refreshFollowing();
        showNotice({ type: "success", text: result.message || `Followed ${name}.` });
      } catch (err) {
        const message = getErrorMessage(err, `Could not follow ${name}.`);
        // Rollback optimistic update
        setFollowingIds((curr) => {
          const next = new Set(curr);
          next.delete(id);
          return next;
        });
        setError(message);
        showNotice({ type: "error", text: message });
      } finally {
        setActionId(null);
      }
    },
    [accessToken, authLoading, user, redirectToLogin, refreshFollowing, showNotice],
  );

  const unfollow = useCallback(
    async (id: string, name: string) => {
      if (authLoading) {
        showNotice({ type: "error", text: "Checking login status..." });
        return;
      }

      if (!accessToken) {
        redirectToLogin();
        return;
      }

      setActionId(id);
      setError(null);

      // Optimistic Update: delete from Set
      setFollowingIds((curr) => {
        const next = new Set(curr);
        next.delete(id);
        // Find corresponding user/artist IDs and delete them too
        const match = following.find(item => item.user_id === id || item.artist_id === id);
        if (match) {
          next.delete(match.user_id);
          if (match.artist_id) next.delete(match.artist_id);
        }
        return next;
      });

      try {
        await unfollowUserRequest(id, accessToken);
        await refreshFollowing();
        showNotice({ type: "success", text: `Unfollowed ${name}.` });
      } catch (err) {
        const message = getErrorMessage(err, `Could not unfollow ${name}.`);
        // Refresh to restore proper state on failure
        await refreshFollowing();
        setError(message);
        showNotice({ type: "error", text: message });
      } finally {
        setActionId(null);
      }
    },
    [accessToken, authLoading, following, redirectToLogin, refreshFollowing, showNotice],
  );

  const toggleFollow = useCallback(
    async (id: string, name: string) => {
      if (isFollowing(id)) {
        await unfollow(id, name);
      } else {
        await follow(id, name);
      }
    },
    [isFollowing, follow, unfollow],
  );

  const value = useMemo<FollowContextValue>(
    () => ({
      following,
      isLoading,
      actionId,
      error,
      notice,
      isFollowing,
      toggleFollow,
      refreshFollowing,
      clearNotice: () => setNotice(null),
    }),
    [
      following,
      isLoading,
      actionId,
      error,
      notice,
      isFollowing,
      toggleFollow,
      refreshFollowing,
    ],
  );

  return (
    <FollowContext.Provider value={value}>
      {children}
      {notice && (
        <div
          role="status"
          className={`fixed right-4 top-36 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-xl ${
            notice.type === "success"
               ? "border-green-500/40 bg-green-500/10 text-green-300"
               : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}
    </FollowContext.Provider>
  );
}

export function useFollow() {
  const context = useContext(FollowContext);

  if (!context) {
    throw new Error("useFollow must be used inside FollowProvider.");
  }

  return context;
}
