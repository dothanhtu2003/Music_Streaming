"use client";

import Image from "next/image";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  addSongToPlaylistRequest,
  createPlaylistRequest,
  getMyPlaylistsRequest,
  resolveApiAssetUrl,
  updatePlaylistRequest,
  deletePlaylistRequest,
} from "@/lib/api";
import type { Pagination, Song, UserPlaylist } from "@/types/music";
import { getSongCoverUrl, getArtistDisplayName } from "@/lib/song-format";
import { cn } from "@/lib/utils";

type PlaylistNotice = {
  type: "success" | "error";
  text: string;
};

export type PlaylistFormPayload = {
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
};

type PlaylistContextValue = {
  playlists: UserPlaylist[];
  pagination: Pagination | null;
  isLoading: boolean;
  actionId: string | null;
  error: string | null;
  notice: PlaylistNotice | null;
  selectedSong: Song | null;
  refreshPlaylists: () => Promise<void>;
  createPlaylist: (payload: PlaylistFormPayload) => Promise<UserPlaylist | null>;
  updatePlaylist: (
    playlistId: string,
    payload: PlaylistFormPayload,
  ) => Promise<UserPlaylist | null>;
  deletePlaylist: (playlistId: string) => Promise<boolean>;
  openAddSongModal: (song: Song) => void;
  closeAddSongModal: () => void;
  addSongToPlaylist: (playlistId: string, song: Song) => Promise<boolean>;
  showNotice: (notice: PlaylistNotice) => void;
  clearNotice: () => void;
};

const PlaylistContext = createContext<PlaylistContextValue | null>(null);
const PLAYLIST_LIMIT = 50;

type PlaylistProviderProps = {
  children: ReactNode;
};

const emptyPlaylistForm: PlaylistFormPayload = {
  title: "",
  description: "",
  coverUrl: "",
  isPublic: true,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizePlaylist(playlist: UserPlaylist): UserPlaylist {
  return {
    ...playlist,
    title: playlist.title || playlist.name,
    description: playlist.description ?? null,
    cover_url: playlist.cover_url ?? null,
    custom_cover_url: playlist.custom_cover_url ?? playlist.cover_url ?? null,
    track_count: playlist.track_count ?? playlist.song_count,
    owner_name: playlist.owner_name ?? null,
  };
}

function buildPlaylistPayload(payload: PlaylistFormPayload) {
  return {
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    cover_url: payload.coverUrl?.trim() || null,
    is_public: payload.isPublic ?? true,
  };
}

function PlaylistAvatar({ playlist }: { playlist: UserPlaylist }) {
  const [imageError, setImageError] = useState(false);
  const coverUrl = resolveApiAssetUrl(playlist.cover_url);

  if (coverUrl && !imageError) {
    return (
      <div className="relative h-12 w-12 shrink-0">
        <Image
          src={coverUrl}
          alt={`${playlist.title} cover`}
          fill
          sizes="48px"
          unoptimized
          className="rounded-lg object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-zinc-900">
      <span className="text-sm font-black text-white">
        {playlist.title.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

function CoverThumbImage({ url, fallback }: { url: string | null; fallback: string }) {
  if (url) {
    return (
      <div
        className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center border border-zinc-700/80 shadow-sm"
        style={{ backgroundImage: `url(${url})` }}
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-zinc-900 text-xs font-black text-white uppercase shadow-sm">
      {fallback.slice(0, 2)}
    </div>
  );
}

function AddSongModal() {
  const {
    playlists,
    isLoading,
    actionId,
    selectedSong,
    closeAddSongModal,
    createPlaylist,
    addSongToPlaylist,
  } = usePlaylists();
  const [newTitle, setNewTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  if (!selectedSong) {
    return null;
  }

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      closeAddSongModal();
      setIsClosing(false);
      setNewTitle("");
      setFormError(null);
    }, 250);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = newTitle.trim();

    if (trimmedTitle.length < 2) {
      setFormError("Playlist name must be at least 2 characters.");
      return;
    }

    setFormError(null);

    const playlist = await createPlaylist({
      title: trimmedTitle,
      isPublic: true,
    });

    if (playlist) {
      const added = await addSongToPlaylist(playlist.id, selectedSong);
      if (added) {
        setNewTitle("");
        handleClose();
      }
    }
  };

  const coverUrl = getSongCoverUrl(selectedSong);
  const artistName = getArtistDisplayName(selectedSong.artist);

  return (
    <div
      onClick={handleClose}
      className={cn(
        "fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-xs transition-opacity duration-250",
        isClosing ? "opacity-0 pointer-events-none" : "animate-in fade-in duration-250",
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md rounded-2xl border border-zinc-800/90 bg-zinc-950 p-5 shadow-2xl transition-all duration-250 ease-out space-y-4",
          isClosing ? "scale-95 opacity-0" : "animate-in zoom-in-95 duration-250",
        )}
      >
        {/* Header: Track Info & Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <CoverThumbImage url={coverUrl} fallback={selectedSong.title} />
            <div className="min-w-0">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-orange-400">
                Save to Playlist
              </span>
              <h3 className="truncate text-sm font-bold text-white">
                {selectedSong.title}
              </h3>
              <p className="truncate text-xs font-medium text-zinc-400">
                {artistName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white transition active:scale-95 shrink-0 cursor-pointer text-xs"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Existing Playlists Section */}
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 px-0.5">
            Your Playlists
          </p>

          <div className="max-h-52 overflow-y-auto space-y-2 dark-scrollbar pr-1">
            {isLoading && (
              <p className="text-xs text-zinc-500 py-3 text-center font-medium">Loading playlists...</p>
            )}

            {!isLoading && playlists.length === 0 && (
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 text-center text-xs text-zinc-400">
                No playlists yet. Create your first one below!
              </div>
            )}

            {playlists.map((playlist) => {
              const isAdding = actionId === playlist.id;
              return (
                <button
                  key={playlist.id}
                  type="button"
                  disabled={isAdding}
                  onClick={() => {
                    void addSongToPlaylist(playlist.id, selectedSong);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-2.5 text-left transition hover:border-orange-500/60 hover:bg-zinc-900/90 active:scale-[0.99] cursor-pointer group disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlaylistAvatar playlist={playlist} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white group-hover:text-orange-400 transition">
                        {playlist.title}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-500">
                        {playlist.track_count} tracks
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-full transition shrink-0",
                      isAdding
                        ? "bg-zinc-800 text-zinc-400"
                        : "bg-orange-500/10 text-orange-400 border border-orange-500/30 group-hover:bg-orange-500 group-hover:text-black font-extrabold"
                    )}
                  >
                    {isAdding ? "Adding..." : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Create New Playlist Section (Clean 1-line inline form) */}
        <form onSubmit={handleCreate} className="pt-3 border-t border-zinc-800/80 space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 px-0.5">
            Create New Playlist
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              maxLength={150}
              placeholder="Playlist name..."
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-orange-500/80 transition font-medium"
            />
            <button
              type="submit"
              disabled={actionId === "create" || !newTitle.trim()}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:from-orange-400 hover:to-amber-400 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-md shadow-orange-500/10"
            >
              {actionId === "create" ? "Creating..." : "Create & Add"}
            </button>
          </div>
          {formError && (
            <p className="text-[11px] font-semibold text-red-400 px-1">{formError}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export function PlaylistProvider({ children }: PlaylistProviderProps) {
  const { accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<PlaylistNotice | null>(null);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  const showNotice = useCallback((nextNotice: PlaylistNotice) => {
    setNotice(nextNotice);
  }, []);

  const clearPlaylists = useCallback(() => {
    setPlaylists([]);
    setPagination(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const redirectToLogin = useCallback(() => {
    const redirectPath = pathname || "/";

    showNotice({ type: "error", text: "Please login to use playlists." });
    router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }, [pathname, router, showNotice]);

  const refreshPlaylists = useCallback(async () => {
    if (!accessToken) {
      clearPlaylists();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getMyPlaylistsRequest(
        accessToken,
        1,
        PLAYLIST_LIMIT,
      );

      setPlaylists(result.items.map(normalizePlaylist));
      setPagination(result.pagination);
    } catch (playlistError) {
      const message = getErrorMessage(
        playlistError,
        "Could not load playlists.",
      );

      setError(message);
      showNotice({ type: "error", text: message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, clearPlaylists, showNotice]);

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
          clearPlaylists();
        }
      });

      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        void refreshPlaylists();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [accessToken, authLoading, clearPlaylists, refreshPlaylists]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const createPlaylist = useCallback(
    async (payload: PlaylistFormPayload) => {
      const requestPayload = buildPlaylistPayload(payload);

      if (requestPayload.title.length < 2) {
        showNotice({
          type: "error",
          text: "Playlist title must be at least 2 characters.",
        });
        return null;
      }

      if (!accessToken) {
        redirectToLogin();
        return null;
      }

      setActionId("create");
      setError(null);

      try {
        const playlist = normalizePlaylist(
          await createPlaylistRequest(requestPayload, accessToken),
        );

        setPlaylists((currentPlaylists) => [playlist, ...currentPlaylists]);
        showNotice({ type: "success", text: "Playlist created." });
        return playlist;
      } catch (createError) {
        const message = getErrorMessage(
          createError,
          "Could not create playlist.",
        );

        setError(message);
        showNotice({ type: "error", text: message });
        return null;
      } finally {
        setActionId(null);
      }
    },
    [accessToken, redirectToLogin, showNotice],
  );

  const updatePlaylist = useCallback(
    async (playlistId: string, payload: PlaylistFormPayload) => {
      const requestPayload = buildPlaylistPayload(payload);

      if (requestPayload.title.length < 2) {
        showNotice({
          type: "error",
          text: "Playlist title must be at least 2 characters.",
        });
        return null;
      }

      if (!accessToken) {
        redirectToLogin();
        return null;
      }

      setActionId(playlistId);
      setError(null);

      try {
        const playlist = normalizePlaylist(
          await updatePlaylistRequest(playlistId, requestPayload, accessToken),
        );

        setPlaylists((currentPlaylists) =>
          currentPlaylists.map((item) =>
            item.id === playlist.id ? { ...item, ...playlist } : item,
          ),
        );
        showNotice({ type: "success", text: "Playlist updated." });
        return playlist;
      } catch (updateError) {
        const message = getErrorMessage(
          updateError,
          "Could not update playlist.",
        );

        setError(message);
        showNotice({ type: "error", text: message });
        return null;
      } finally {
        setActionId(null);
      }
    },
    [accessToken, redirectToLogin, showNotice],
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      if (!accessToken) {
        redirectToLogin();
        return false;
      }

      setActionId(playlistId);
      setError(null);

      try {
        await deletePlaylistRequest(playlistId, accessToken);
        setPlaylists((currentPlaylists) =>
          currentPlaylists.filter((playlist) => playlist.id !== playlistId),
        );
        showNotice({ type: "success", text: "Playlist deleted." });
        return true;
      } catch (deleteError) {
        const message = getErrorMessage(
          deleteError,
          "Could not delete playlist.",
        );

        setError(message);
        showNotice({ type: "error", text: message });
        return false;
      } finally {
        setActionId(null);
      }
    },
    [accessToken, redirectToLogin, showNotice],
  );

  const openAddSongModal = useCallback(
    (song: Song) => {
      if (authLoading) {
        showNotice({ type: "error", text: "Checking login status..." });
        return;
      }

      if (!accessToken) {
        redirectToLogin();
        return;
      }

      setSelectedSong(song);
    },
    [accessToken, authLoading, redirectToLogin, showNotice],
  );

  const closeAddSongModal = useCallback(() => {
    setSelectedSong(null);
  }, []);

  const addSongToPlaylist = useCallback(
    async (playlistId: string, song: Song) => {
      if (!accessToken) {
        redirectToLogin();
        return false;
      }

      setActionId(playlistId);
      setError(null);

      try {
        const result = await addSongToPlaylistRequest(
          playlistId,
          song.id,
          accessToken,
        );

        if (result.alreadyExists) {
          showNotice({
            type: "error",
            text: "Track already exists in this playlist.",
          });
          return false;
        }

        setPlaylists((currentPlaylists) =>
          currentPlaylists.map((playlist) =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  song_count: playlist.song_count + 1,
                  track_count: playlist.track_count + 1,
                }
              : playlist,
          ),
        );

        showNotice({ type: "success", text: "Track added to playlist." });
        setSelectedSong(null);
        return true;
      } catch (addError) {
        const message = getErrorMessage(
          addError,
          "Could not add track to playlist.",
        );

        setError(message);
        showNotice({ type: "error", text: message });
        return false;
      } finally {
        setActionId(null);
      }
    },
    [accessToken, redirectToLogin, showNotice],
  );

  const value = useMemo<PlaylistContextValue>(
    () => ({
      playlists,
      pagination,
      isLoading,
      actionId,
      error,
      notice,
      selectedSong,
      refreshPlaylists,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      openAddSongModal,
      closeAddSongModal,
      addSongToPlaylist,
      showNotice,
      clearNotice: () => setNotice(null),
    }),
    [
      playlists,
      pagination,
      isLoading,
      actionId,
      error,
      notice,
      selectedSong,
      refreshPlaylists,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      openAddSongModal,
      closeAddSongModal,
      addSongToPlaylist,
      showNotice,
    ],
  );

  return (
    <PlaylistContext.Provider value={value}>
      {children}
      <AddSongModal />
      {notice && (
        <div
          role="status"
          className={`hidden md:block fixed right-4 top-36 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-xl ${
            notice.type === "success"
              ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}
    </PlaylistContext.Provider>
  );
}

export function usePlaylists() {
  const context = useContext(PlaylistContext);

  if (!context) {
    throw new Error("usePlaylists must be used inside PlaylistProvider.");
  }

  return context;
}
