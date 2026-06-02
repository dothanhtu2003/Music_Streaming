"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import { PlaylistForm } from "@/components/playlist/PlaylistForm";
import {
  usePlaylists,
  type PlaylistFormPayload,
} from "@/components/playlist/PlaylistProvider";
import {
  getPlaylistRequest,
  removeSongFromPlaylistRequest,
  reorderPlaylistSongsRequest,
  resolveApiAssetUrl,
  uploadTrackToPlaylistRequest,
} from "@/lib/api";
import {
  formatDuration,
  formatPlayCount,
  getGenreName,
  getSongCoverUrl,
} from "@/lib/song-format";
import type { PlaylistDetail, PlaylistSong } from "@/types/music";

type PlaylistDetailContentProps = {
  playlistId: string;
};

type UploadTrackFormState = {
  title: string;
  genre: string;
  description: string;
};

const emptyUploadForm: UploadTrackFormState = {
  title: "",
  genre: "",
  description: "",
};

function isMp3File(file: File) {
  return file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3");
}

function isCoverFile(file: File) {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const lowerName = file.name.toLowerCase();

  return (
    validTypes.includes(file.type) ||
    validExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

function SongCover({ song }: { song: PlaylistSong }) {
  const coverUrl = getSongCoverUrl(song);

  if (coverUrl) {
    return (
      <div
        className="h-14 w-14 shrink-0 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${song.title} cover`}
      />
    );
  }

  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900">
      <span className="text-sm font-black text-white/90">
        {song.title.slice(0, 1)}
      </span>
    </div>
  );
}

function PlaylistCover({ playlist }: { playlist: PlaylistDetail }) {
  const coverUrl = resolveApiAssetUrl(playlist.cover_url);

  if (coverUrl) {
    return (
      <div
        className="h-36 w-36 shrink-0 rounded-lg bg-cover bg-center md:h-44 md:w-44"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${playlist.title} cover`}
      />
    );
  }

  return (
    <div className="grid h-36 w-36 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900 md:h-44 md:w-44">
      <span className="text-5xl font-black text-white/90">
        {playlist.title.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex gap-6">
          <div className="h-36 w-36 rounded-lg bg-zinc-800" />
          <div className="flex-1 space-y-4">
            <div className="h-4 w-24 rounded bg-zinc-800" />
            <div className="h-10 w-1/2 rounded bg-zinc-800" />
            <div className="h-4 w-32 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
        >
          <div className="flex gap-4">
            <div className="h-14 w-14 rounded-lg bg-zinc-800" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-1/2 rounded bg-zinc-800" />
              <div className="h-3 w-1/3 rounded bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type EditPlaylistModalProps = {
  playlist: PlaylistDetail;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: PlaylistFormPayload) => Promise<void>;
};

function EditPlaylistModal({
  playlist,
  loading,
  onClose,
  onSubmit,
}: EditPlaylistModalProps) {
  const [form, setForm] = useState<PlaylistFormPayload>({
    title: playlist.title,
    description: playlist.description ?? "",
    coverUrl: playlist.custom_cover_url ?? "",
    isPublic: playlist.is_public,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.title.trim().length < 2) {
      setFormError("Playlist title must be at least 2 characters.");
      return;
    }

    setFormError(null);
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">Edit playlist</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white"
          >
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <PlaylistForm form={form} onChange={setForm} />
          {formError && <p className="text-sm text-red-300">{formError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

type UploadTrackModalProps = {
  loading: boolean;
  onClose: () => void;
  onSubmit: (
    form: UploadTrackFormState,
    audioFile: File,
    coverFile: File | null,
  ) => Promise<void>;
};

function UploadTrackModal({
  loading,
  onClose,
  onSubmit,
}: UploadTrackModalProps) {
  const [form, setForm] = useState<UploadTrackFormState>(emptyUploadForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const updateForm = (key: keyof UploadTrackFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = form.title.trim();

    if (!title) {
      setFormError("Track title is required.");
      return;
    }

    if (!audioFile) {
      setFormError("MP3 file is required.");
      return;
    }

    if (!isMp3File(audioFile)) {
      setFormError("Only MP3 audio files are allowed.");
      return;
    }

    if (coverFile && !isCoverFile(coverFile)) {
      setFormError("Cover must be JPG, PNG, or WebP.");
      return;
    }

    setFormError(null);
    await onSubmit({ ...form, title }, audioFile, coverFile);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-white">
            Upload track to playlist
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white"
          >
            Close
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <label className="block text-sm font-medium text-zinc-300">
            Track title
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              maxLength={200}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
              placeholder="Track title"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Genre
            <input
              value={form.genre}
              onChange={(event) => updateForm("genre", event.target.value)}
              maxLength={100}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
              placeholder="Pop, Lo-fi, Rock..."
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300 md:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={4}
              maxLength={5000}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
              placeholder="Short note about this track"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            MP3 file
            <input
              type="file"
              accept=".mp3,audio/mpeg,audio/mp3"
              onChange={(event) =>
                setAudioFile(event.target.files ? event.target.files[0] : null)
              }
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-green-950"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Cover image
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setCoverFile(event.target.files ? event.target.files[0] : null)
              }
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
          </label>

          {formError && (
            <p className="text-sm text-red-300 md:col-span-2">{formError}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 md:w-fit"
          >
            {loading ? "Uploading..." : "Upload and add"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function PlaylistDetailContent({
  playlistId,
}: PlaylistDetailContentProps) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { playSong } = usePlayer();
  const {
    refreshPlaylists,
    showNotice,
    updatePlaylist,
    deletePlaylist,
    actionId,
  } = usePlaylists();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionSongId, setActionSongId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlaylist = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getPlaylistRequest(playlistId, accessToken);
      setPlaylist({
        ...result,
        title: result.title || result.name,
        tracks: result.tracks ?? result.songs,
      });
    } catch (playlistError) {
      setError(
        playlistError instanceof Error
          ? playlistError.message
          : "Could not load playlist.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, playlistId]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadPlaylist();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadPlaylist]);

  const handlePlayAll = () => {
    if (!playlist || playlist.songs.length === 0) {
      return;
    }

    playSong(playlist.songs[0], playlist.songs);
  };

  const handleRemoveSong = async (songId: string) => {
    if (!accessToken || !playlist?.is_owner) {
      return;
    }

    setActionSongId(songId);
    setError(null);

    try {
      await removeSongFromPlaylistRequest(playlist.id, songId, accessToken);
      setPlaylist((currentPlaylist) =>
        currentPlaylist
          ? {
              ...currentPlaylist,
              song_count: Math.max(currentPlaylist.song_count - 1, 0),
              track_count: Math.max(currentPlaylist.track_count - 1, 0),
              songs: currentPlaylist.songs.filter((song) => song.id !== songId),
              tracks: currentPlaylist.songs.filter((song) => song.id !== songId),
            }
          : currentPlaylist,
      );
      await refreshPlaylists();
      showNotice({ type: "success", text: "Track removed from playlist." });
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : "Could not remove track.";

      setError(message);
      showNotice({ type: "error", text: message });
    } finally {
      setActionSongId(null);
    }
  };

  const moveSong = async (songId: string, direction: "up" | "down") => {
    if (!accessToken || !playlist?.is_owner) {
      return;
    }

    const currentIndex = playlist.songs.findIndex((song) => song.id === songId);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= playlist.songs.length) {
      return;
    }

    const nextSongs = [...playlist.songs];
    const currentSong = nextSongs[currentIndex];
    nextSongs[currentIndex] = nextSongs[nextIndex];
    nextSongs[nextIndex] = currentSong;

    setActionSongId(songId);
    setError(null);

    try {
      const updatedPlaylist = await reorderPlaylistSongsRequest(
        playlist.id,
        nextSongs.map((song, index) => ({
          songId: song.id,
          position: index,
        })),
        accessToken,
      );

      setPlaylist({
        ...updatedPlaylist,
        title: updatedPlaylist.title || updatedPlaylist.name,
        tracks: updatedPlaylist.tracks ?? updatedPlaylist.songs,
      });
      showNotice({ type: "success", text: "Playlist order updated." });
    } catch (reorderError) {
      const message =
        reorderError instanceof Error
          ? reorderError.message
          : "Could not reorder playlist.";

      setError(message);
      showNotice({ type: "error", text: message });
    } finally {
      setActionSongId(null);
    }
  };

  const handleUpdate = async (payload: PlaylistFormPayload) => {
    if (!playlist) {
      return;
    }

    const updatedPlaylist = await updatePlaylist(playlist.id, payload);

    if (updatedPlaylist) {
      setPlaylist((currentPlaylist) =>
        currentPlaylist
          ? {
              ...currentPlaylist,
              ...updatedPlaylist,
              is_owner: currentPlaylist.is_owner,
              song_count: currentPlaylist.song_count,
              track_count: currentPlaylist.track_count,
              songs: currentPlaylist.songs,
              tracks: currentPlaylist.songs,
            }
          : currentPlaylist,
      );
      setEditOpen(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) {
      return;
    }

    const confirmed = window.confirm(`Delete playlist "${playlist.title}"?`);

    if (!confirmed) {
      return;
    }

    const deleted = await deletePlaylist(playlist.id);

    if (deleted) {
      router.push("/playlists");
    }
  };

  const handleUploadTrack = async (
    form: UploadTrackFormState,
    audioFile: File,
    coverFile: File | null,
  ) => {
    if (!accessToken || !playlist) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await uploadTrackToPlaylistRequest(
        playlist.id,
        {
          title: form.title,
          genre: form.genre,
          description: form.description,
          audioFile,
          coverFile,
        },
        accessToken,
      );

      await loadPlaylist();
      await refreshPlaylists();
      setUploadOpen(false);
      showNotice({
        type: "success",
        text: "Track uploaded and added to playlist.",
      });
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload track to playlist.";

      setError(message);
      showNotice({ type: "error", text: message });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error && !playlist) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            void loadPlaylist();
          }}
          className="mt-3 rounded-lg border border-red-400/60 px-3 py-2 text-xs font-semibold transition hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
        <p className="text-sm font-medium text-white">Playlist not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <Link href="/playlists" className="text-sm text-green-400 hover:text-green-300">
          Back to playlists
        </Link>
        <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-end">
          <PlaylistCover playlist={playlist} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-green-400">
              Playlist
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">
              {playlist.title}
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              By {playlist.owner_name || "Unknown owner"} -{" "}
              {playlist.track_count} tracks -{" "}
              {playlist.is_public ? "Public" : "Private"}
            </p>
            {playlist.description && (
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
                {playlist.description}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={playlist.songs.length === 0}
                onClick={handlePlayAll}
                className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                Play all
              </button>
              {playlist.is_owner && (
                <>
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="rounded-lg border border-green-500/70 px-4 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/10"
                  >
                    Upload new track
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={actionId === playlist.id}
                    onClick={() => {
                      void handleDeletePlaylist();
                    }}
                    className="rounded-lg border border-red-500/50 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionId === playlist.id ? "Deleting..." : "Delete"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {playlist.songs.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <p className="text-sm font-medium text-white">
            No tracks in this playlist yet.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Use Add to playlist from any track card or upload a new track here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {playlist.songs.map((song, index) => (
            <article
              key={song.id}
              className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center"
            >
              <Link
                href={`/songs/${song.id}`}
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                <SongCover song={song} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {song.title}
                  </span>
                  <span className="block truncate text-xs text-zinc-400">
                    {song.artist.name} - {getGenreName(song)} -{" "}
                    {formatDuration(song.duration_sec)} -{" "}
                    {formatPlayCount(song.play_count)} plays
                  </span>
                </span>
              </Link>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => playSong(song, playlist.songs)}
                  className="rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-green-950 transition hover:bg-green-400"
                >
                  Play
                </button>
                {playlist.is_owner && (
                  <>
                    <button
                      type="button"
                      disabled={index === 0 || actionSongId === song.id}
                      onClick={() => {
                        void moveSong(song.id, "up");
                      }}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={
                        index === playlist.songs.length - 1 ||
                        actionSongId === song.id
                      }
                      onClick={() => {
                        void moveSong(song.id, "down");
                      }}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      disabled={actionSongId === song.id}
                      onClick={() => {
                        void handleRemoveSong(song.id);
                      }}
                      className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionSongId === song.id ? "Removing..." : "Remove"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editOpen && (
        <EditPlaylistModal
          playlist={playlist}
          loading={actionId === playlist.id}
          onClose={() => setEditOpen(false)}
          onSubmit={handleUpdate}
        />
      )}

      {uploadOpen && (
        <UploadTrackModal
          loading={uploading}
          onClose={() => setUploadOpen(false)}
          onSubmit={handleUploadTrack}
        />
      )}
    </div>
  );
}
