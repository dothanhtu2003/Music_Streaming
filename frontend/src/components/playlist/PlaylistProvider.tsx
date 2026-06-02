"use client";

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
  const coverUrl = resolveApiAssetUrl(playlist.cover_url);

  if (coverUrl) {
    return (
      <div
        className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${playlist.title} cover`}
      />
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
  const [form, setForm] = useState<PlaylistFormPayload>(emptyPlaylistForm);
  const [formError, setFormError] = useState<string | null>(null);

  if (!selectedSong) {
    return null;
  }

  const updateForm = (
    key: keyof PlaylistFormPayload,
    value: string | boolean,
  ) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.title.trim().length < 2) {
      setFormError("Playlist title must be at least 2 characters.");
      return;
    }

    setFormError(null);

    const playlist = await createPlaylist(form);

    if (playlist) {
      const added = await addSongToPlaylist(playlist.id, selectedSong);

      if (added) {
        setForm(emptyPlaylistForm);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-orange-400">
              Add to playlist
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {selectedSong.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Choose an existing playlist or create a new one.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAddSongModal}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-orange-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {isLoading && <p className="text-sm text-zinc-500">Loading...</p>}

          {!isLoading && playlists.length === 0 && (
            <div className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-400">
              You do not have playlists yet. Create one below.
            </div>
          )}

          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              disabled={actionId === playlist.id}
              onClick={() => {
                void addSongToPlaylist(playlist.id, selectedSong);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-black px-4 py-3 text-left transition hover:border-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-3">
                <PlaylistAvatar playlist={playlist} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {playlist.title}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {playlist.track_count} tracks
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold text-orange-400">
                {actionId === playlist.id ? "Adding..." : "Add"}
              </span>
            </button>
          ))}
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 md:grid-cols-2"
        >
          <label className="block text-sm font-medium text-zinc-300">
            Create new playlist
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              maxLength={150}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-500"
              placeholder="My Favorite Set"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Cover URL
            <input
              value={form.coverUrl}
              onChange={(event) => updateForm("coverUrl", event.target.value)}
              maxLength={1000}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-500"
              placeholder="Optional"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-300 md:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={3}
              maxLength={5000}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-500"
              placeholder="Short note about this set"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={Boolean(form.isPublic)}
              onChange={(event) => updateForm("isPublic", event.target.checked)}
              className="accent-orange-500"
            />
            Public playlist
          </label>
          {formError && (
            <p className="text-sm text-red-300 md:col-span-2">{formError}</p>
          )}
          <button
            type="submit"
            disabled={actionId === "create"}
            className="rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 md:w-fit"
          >
            {actionId === "create" ? "Creating..." : "Create and add"}
          </button>
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
          className={`fixed right-4 top-36 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-xl ${
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
