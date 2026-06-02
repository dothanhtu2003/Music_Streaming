"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import {
  emptyPlaylistFormValue,
  PlaylistForm,
} from "@/components/playlist/PlaylistForm";
import {
  usePlaylists,
  type PlaylistFormPayload,
} from "@/components/playlist/PlaylistProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPlaylistRequest, resolveApiAssetUrl } from "@/lib/api";
import type { UserPlaylist } from "@/types/music";

function PlaylistSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="aspect-square rounded-lg bg-zinc-800" />
      <div className="mt-4 h-5 w-2/3 rounded bg-zinc-800" />
      <div className="mt-3 h-4 w-1/3 rounded bg-zinc-800" />
    </div>
  );
}

function PlaylistCover({ playlist }: { playlist: UserPlaylist }) {
  const coverUrl = resolveApiAssetUrl(playlist.cover_url);

  if (coverUrl) {
    return (
      <div
        className="aspect-square rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${playlist.title} cover`}
      />
    );
  }

  return (
    <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900">
      <span className="text-5xl font-black text-white/90">
        {playlist.title.slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}

type PlaylistModalProps = {
  title: string;
  submitLabel: string;
  loading: boolean;
  initialForm?: PlaylistFormPayload;
  onClose: () => void;
  onSubmit: (payload: PlaylistFormPayload) => Promise<void>;
};

function PlaylistModal({
  title,
  submitLabel,
  loading,
  initialForm = emptyPlaylistFormValue,
  onClose,
  onSubmit,
}: PlaylistModalProps) {
  const [form, setForm] = useState<PlaylistFormPayload>(initialForm);
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
          <h2 className="text-xl font-semibold text-white">{title}</h2>
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
            {loading ? "Saving..." : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PlaylistsPage() {
  const { accessToken } = useAuth();
  const { playSong } = usePlayer();
  const {
    playlists,
    pagination,
    isLoading,
    actionId,
    error,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    refreshPlaylists,
    showNotice,
  } = usePlaylists();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<UserPlaylist | null>(
    null,
  );

  const handleCreate = async (payload: PlaylistFormPayload) => {
    const playlist = await createPlaylist(payload);

    if (playlist) {
      setCreateOpen(false);
    }
  };

  const handleUpdate = async (payload: PlaylistFormPayload) => {
    if (!editingPlaylist) {
      return;
    }

    const playlist = await updatePlaylist(editingPlaylist.id, payload);

    if (playlist) {
      setEditingPlaylist(null);
    }
  };

  const handleDelete = async (playlist: UserPlaylist) => {
    const confirmed = window.confirm(`Delete playlist "${playlist.title}"?`);

    if (!confirmed) {
      return;
    }

    await deletePlaylist(playlist.id);
  };

  const handlePlay = async (playlist: UserPlaylist) => {
    if (!accessToken || playlist.track_count === 0) {
      return;
    }

    try {
      const detail = await getPlaylistRequest(playlist.id, accessToken);

      if (detail.songs.length === 0) {
        showNotice({ type: "error", text: "This playlist has no tracks." });
        return;
      }

      playSong(detail.songs[0], detail.songs);
    } catch (playError) {
      showNotice({
        type: "error",
        text:
          playError instanceof Error
            ? playError.message
            : "Could not play playlist.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Library"
          title="Playlists"
          description="Create SoundCloud-style sets from existing tracks."
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="w-fit rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400"
        >
          Create playlist
        </button>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <PlaylistSkeleton key={index} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              void refreshPlaylists();
            }}
            className="mt-3 rounded-lg border border-red-400/60 px-3 py-2 text-xs font-semibold transition hover:bg-red-500/10"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && playlists.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <p className="text-sm font-medium text-white">No playlists yet.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Create a playlist, then add tracks from Home or song details.
          </p>
        </div>
      )}

      {!isLoading && !error && playlists.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            {pagination?.totalItems ?? playlists.length} playlists
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {playlists.map((playlist) => (
              <article
                key={playlist.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:border-green-500/70 hover:bg-zinc-900"
              >
                <Link href={`/playlists/${playlist.id}`}>
                  <PlaylistCover playlist={playlist} />
                </Link>
                <div className="mt-4 min-w-0">
                  <Link href={`/playlists/${playlist.id}`}>
                    <h2 className="truncate text-lg font-semibold text-white hover:text-green-300">
                      {playlist.title}
                    </h2>
                  </Link>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    {playlist.owner_name || "You"}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {playlist.track_count} tracks -{" "}
                    {playlist.is_public ? "Public" : "Private"}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={playlist.track_count === 0}
                    onClick={() => {
                      void handlePlay(playlist);
                    }}
                    className="rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                  >
                    Play
                  </button>
                  <Link
                    href={`/playlists/${playlist.id}`}
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white"
                  >
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingPlaylist({
                        ...playlist,
                        cover_url: playlist.custom_cover_url ?? playlist.cover_url,
                      })
                    }
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={actionId === playlist.id}
                    onClick={() => {
                      void handleDelete(playlist);
                    }}
                    className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionId === playlist.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {createOpen && (
        <PlaylistModal
          title="Create playlist"
          submitLabel="Create playlist"
          loading={actionId === "create"}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingPlaylist && (
        <PlaylistModal
          title="Edit playlist"
          submitLabel="Save changes"
          loading={actionId === editingPlaylist.id}
          initialForm={{
            title: editingPlaylist.title,
            description: editingPlaylist.description ?? "",
            coverUrl: editingPlaylist.cover_url ?? "",
            isPublic: editingPlaylist.is_public,
          }}
          onClose={() => setEditingPlaylist(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  );
}
