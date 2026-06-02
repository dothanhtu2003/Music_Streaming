"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
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
import { SongListItem } from "@/components/song/SongListItem";
import { WaveformPlayer } from "@/components/song/WaveformPlayer";
import { getSongAudioUrl } from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import type { PlaylistDetail } from "@/types/music";

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
  const currentSong = usePlayerStore((state) => state.currentSong);
  const playSong = usePlayerStore((state) => state.playSong);
  const {
    refreshPlaylists,
    showNotice,
    updatePlaylist,
    deletePlaylist,
    actionId,
  } = usePlaylists();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
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

  const playlistWaveformSong =
    playlist.songs.find((song) => song.id === currentSong?.id) ??
    playlist.songs[0] ??
    null;

  return (
    <div className="space-y-8">
      {/* Premium Spotify-style Playlist Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 via-zinc-950 to-black p-6 shadow-2xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_40%)]" />
        
        <div className="relative">
          <Link
            href="/playlists"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-500 hover:text-green-400 transition"
          >
            ← Back to playlists
          </Link>
          
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end">
            <div className="transition-transform duration-300 hover:scale-[1.02]">
              <PlaylistCover playlist={playlist} />
            </div>
            
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-500">
                Playlist
              </span>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl truncate">
                {playlist.title}
              </h1>
              
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-200">
                  {playlist.owner_name || "Unknown owner"}
                </span>
                <span className="text-zinc-600">•</span>
                <span>{playlist.track_count} tracks</span>
                <span className="text-zinc-600">•</span>
                <span className="rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                  {playlist.is_public ? "Public" : "Private"}
                </span>
              </div>
              
              {playlist.description && (
                <p className="mt-4 max-w-2xl text-xs leading-relaxed text-zinc-400 sm:text-sm">
                  {playlist.description}
                </p>
              )}
              
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={playlist.songs.length === 0}
                  onClick={handlePlayAll}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-6 py-3 text-xs font-bold text-green-950 transition hover:bg-green-400 hover:scale-105 shadow-lg shadow-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Play All
                </button>
                
                {playlist.is_owner && (
                  <>
                    <button
                      type="button"
                      onClick={() => setUploadOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-green-500/30 px-5 py-3 text-xs font-bold text-green-400 transition hover:bg-green-500/10 hover:border-green-500/50"
                    >
                      Upload new track
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="inline-flex items-center justify-center rounded-full border border-zinc-800 px-5 py-3 text-xs font-bold text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={actionId === playlist.id}
                      onClick={() => {
                        void handleDeletePlaylist();
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-red-500/20 px-5 py-3 text-xs font-bold text-red-400 transition hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-50"
                    >
                      {actionId === playlist.id ? "Deleting..." : "Delete"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {playlistWaveformSong && (
            <div className="mt-6 border-t border-zinc-800/80 pt-5">
              <WaveformPlayer
                song={playlistWaveformSong}
                audioUrl={getSongAudioUrl(playlistWaveformSong) ?? ""}
                queue={playlist.songs}
              />
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {playlist.songs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-10 text-center">
          <p className="text-sm font-medium text-white">
            No tracks in this playlist yet.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Use Add to playlist from any track card or upload a new track here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Column Headers (Spotify style, desktop only) */}
          <div className="hidden items-center justify-between gap-4 px-16 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900 md:flex">
            <div className="flex-1 pl-4">Title</div>
            <div className="min-w-[200px] flex gap-6">
              <span className="w-24">Genre</span>
              <span className="w-28">Plays</span>
            </div>
            <div className="flex items-center gap-4 shrink-0 pr-12">
              <span>Time</span>
            </div>
          </div>

          {/* Row List */}
          <div className="flex flex-col gap-1">
            {playlist.songs.map((song, index) => (
              <SongListItem
                key={song.id}
                song={song}
                queue={playlist.songs}
                index={index}
                isPlaylistOwner={playlist.is_owner}
                canReorder={playlist.is_owner}
                onRemove={handleRemoveSong}
                onMoveUp={() => moveSong(song.id, "up")}
                onMoveDown={() => moveSong(song.id, "down")}
              />
            ))}
          </div>
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
