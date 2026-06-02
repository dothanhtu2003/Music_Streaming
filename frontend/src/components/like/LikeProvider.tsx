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
  getMyLikedSongsRequest,
  likeSongRequest,
  unlikeSongRequest,
} from "@/lib/api";
import type { Song, SongPagination } from "@/types/music";

type LikeNotice = {
  type: "success" | "error";
  text: string;
};

type LikeContextValue = {
  likedSongs: Song[];
  pagination: SongPagination | null;
  isLoading: boolean;
  actionSongId: string | null;
  error: string | null;
  notice: LikeNotice | null;
  isSongLiked: (songId: string) => boolean;
  toggleLike: (song: Song) => Promise<void>;
  refreshLikedSongs: () => Promise<void>;
  clearNotice: () => void;
};

const LikeContext = createContext<LikeContextValue | null>(null);
const LIKED_SONG_LIMIT = 100;

type LikeProviderProps = {
  children: ReactNode;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function LikeProvider({ children }: LikeProviderProps) {
  const { accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [likedSongIds, setLikedSongIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSongId, setActionSongId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<LikeNotice | null>(null);

  const showNotice = useCallback((nextNotice: LikeNotice) => {
    setNotice(nextNotice);
  }, []);

  const clearLikedState = useCallback(() => {
    setLikedSongs([]);
    setLikedSongIds(new Set());
    setPagination(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const refreshLikedSongs = useCallback(async () => {
    if (!accessToken) {
      clearLikedState();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const firstResult = await getMyLikedSongsRequest(
        accessToken,
        1,
        LIKED_SONG_LIMIT,
      );
      const allLikedSongs = [...firstResult.items];

      for (
        let page = 2;
        page <= firstResult.pagination.totalPages;
        page += 1
      ) {
        const nextResult = await getMyLikedSongsRequest(
          accessToken,
          page,
          LIKED_SONG_LIMIT,
        );

        allLikedSongs.push(...nextResult.items);
      }

      setLikedSongs(allLikedSongs);
      setLikedSongIds(new Set(allLikedSongs.map((song) => song.id)));
      setPagination(firstResult.pagination);
    } catch (likedError) {
      const message = getErrorMessage(
        likedError,
        "Could not load liked songs.",
      );

      setError(message);
      showNotice({ type: "error", text: message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, clearLikedState, showNotice]);

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
          clearLikedState();
        }
      });

      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        void refreshLikedSongs();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [accessToken, authLoading, clearLikedState, refreshLikedSongs]);

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

    showNotice({ type: "error", text: "Please login to like songs." });
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }, [pathname, router, showNotice]);

  const addLikedSong = useCallback((song: Song) => {
    setLikedSongIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(song.id);
      return nextIds;
    });
    setLikedSongs((currentSongs) => {
      if (currentSongs.some((currentSong) => currentSong.id === song.id)) {
        return currentSongs;
      }

      return [song, ...currentSongs];
    });
  }, []);

  const removeLikedSong = useCallback((songId: string) => {
    setLikedSongIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(songId);
      return nextIds;
    });
    setLikedSongs((currentSongs) =>
      currentSongs.filter((song) => song.id !== songId),
    );
  }, []);

  const likeSong = useCallback(
    async (song: Song) => {
      if (authLoading) {
        showNotice({ type: "error", text: "Checking login status..." });
        return;
      }

      if (!accessToken) {
        redirectToLogin();
        return;
      }

      setActionSongId(song.id);
      setError(null);
      addLikedSong(song);

      try {
        await likeSongRequest(song.id, accessToken);
        showNotice({ type: "success", text: "Song liked." });
      } catch (likeError) {
        const message = getErrorMessage(likeError, "Could not like song.");

        removeLikedSong(song.id);
        setError(message);
        showNotice({ type: "error", text: message });
      } finally {
        setActionSongId(null);
      }
    },
    [
      accessToken,
      addLikedSong,
      authLoading,
      redirectToLogin,
      removeLikedSong,
      showNotice,
    ],
  );

  const unlikeSong = useCallback(
    async (song: Song) => {
      if (authLoading) {
        showNotice({ type: "error", text: "Checking login status..." });
        return;
      }

      if (!accessToken) {
        redirectToLogin();
        return;
      }

      setActionSongId(song.id);
      setError(null);
      removeLikedSong(song.id);

      try {
        await unlikeSongRequest(song.id, accessToken);
        showNotice({ type: "success", text: "Song unliked." });
      } catch (unlikeError) {
        const message = getErrorMessage(
          unlikeError,
          "Could not unlike song.",
        );

        addLikedSong(song);
        setError(message);
        showNotice({ type: "error", text: message });
      } finally {
        setActionSongId(null);
      }
    },
    [
      accessToken,
      addLikedSong,
      authLoading,
      redirectToLogin,
      removeLikedSong,
      showNotice,
    ],
  );

  const isSongLiked = useCallback(
    (songId: string) => likedSongIds.has(songId),
    [likedSongIds],
  );

  const toggleLike = useCallback(
    async (song: Song) => {
      if (likedSongIds.has(song.id)) {
        await unlikeSong(song);
        return;
      }

      await likeSong(song);
    },
    [likedSongIds, likeSong, unlikeSong],
  );

  const value = useMemo<LikeContextValue>(
    () => ({
      likedSongs,
      pagination,
      isLoading,
      actionSongId,
      error,
      notice,
      isSongLiked,
      toggleLike,
      refreshLikedSongs,
      clearNotice: () => setNotice(null),
    }),
    [
      likedSongs,
      pagination,
      isLoading,
      actionSongId,
      error,
      notice,
      isSongLiked,
      toggleLike,
      refreshLikedSongs,
    ],
  );

  return (
    <LikeContext.Provider value={value}>
      {children}
      {notice && (
        <div
          role="status"
          className={`fixed right-4 top-20 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-xl ${
            notice.type === "success"
              ? "border-green-500/40 bg-green-500/10 text-green-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}
    </LikeContext.Provider>
  );
}

export function useLikes() {
  const context = useContext(LikeContext);

  if (!context) {
    throw new Error("useLikes must be used inside LikeProvider.");
  }

  return context;
}
