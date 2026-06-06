"use client";

import Link from "next/link";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { MoreIcon, PlayIcon, TrashIcon, UserIcon, PlaylistIcon } from "@/components/ui/Icons";
import { useAuth } from "@/components/auth/AuthProvider";
import { LibraryTabs } from "@/components/library/LibraryTabs";
import { PlaylistCardSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
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
import { usePlayerStore } from "@/stores/player-store";
import type { UserPlaylist } from "@/types/music";

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
    <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-zinc-900">
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
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-orange-500 hover:text-white"
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
            className="rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {loading ? "Saving..." : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

type PlaylistCardProps = {
  playlist: UserPlaylist;
  onPlay: (playlist: UserPlaylist) => void;
  onEdit: (playlist: UserPlaylist) => void;
  onDelete: (playlist: UserPlaylist) => void;
  actionId: string | null;
};

function PlaylistCard({
  playlist,
  onPlay,
  onEdit,
  onDelete,
  actionId,
}: PlaylistCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <article
      className="group relative rounded-xl bg-zinc-900/40 p-4 transition-all duration-300 hover:bg-zinc-900 border border-zinc-900/10 hover:border-zinc-800 shadow-lg flex flex-col justify-between"
    >
      <div className="relative">
        {/* Cover image wrapper */}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg shadow-md">
          <Link href={`/playlists/${playlist.id}`} className="block w-full h-full">
            <PlaylistCover playlist={playlist} />
          </Link>
          {playlist.track_count > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPlay(playlist);
              }}
              className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-orange-500 text-orange-950 opacity-0 shadow-xl transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105 hover:bg-orange-400 focus:outline-none"
              title="Play playlist"
            >
              <PlayIcon size={16} className="ml-0.5" />
            </button>
          )}
        </div>

        {/* Playlist metadata */}
        <div className="mt-4 min-w-0">
          <h3 className="truncate text-sm font-bold text-white hover:text-orange-400 transition">
            <Link href={`/playlists/${playlist.id}`}>{playlist.title}</Link>
          </h3>
          <p className="mt-1 truncate text-xs text-zinc-400">
            By {playlist.owner_name || "You"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-900 pt-3">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          {playlist.track_count} tracks • {playlist.is_public ? "Public" : "Private"}
        </span>

        {/* 3-dots actions dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition focus:outline-none"
            title="Playlist Actions"
          >
            <MoreIcon size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-1 z-50 w-44 origin-bottom-right rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl ring-1 ring-black ring-opacity-5">
              <Link
                href={`/playlists/${playlist.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
              >
                <UserIcon size={14} />
                View Tracks
              </Link>
              
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(playlist);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Edit Details
              </button>
              
              <hr className="my-1 border-zinc-900" />
              
              <button
                type="button"
                disabled={actionId === playlist.id}
                onClick={() => {
                  setMenuOpen(false);
                  void onDelete(playlist);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 transition hover:bg-zinc-900 hover:text-red-300 disabled:opacity-50"
              >
                <TrashIcon size={14} />
                {actionId === playlist.id ? "Deleting..." : "Delete playlist"}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PlaylistsPage() {
  const { accessToken } = useAuth();
  const playSong = usePlayerStore((state) => state.playSong);
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
    <div className="space-y-6 page-fade-in">
      <LibraryTabs />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Library"
          title="Playlists"
          description="Create SoundCloud-style sets from existing tracks."
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="w-fit rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-orange-950 transition hover:bg-orange-400"
        >
          Create playlist
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <PlaylistCardSkeleton key={index} />
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
        <EmptyState
          icon={<PlaylistIcon size={24} />}
          title="No playlists yet"
          description="Create a playlist, then add tracks from Home or song details."
          actionLabel="Create playlist"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {!isLoading && !error && playlists.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            {pagination?.totalItems ?? playlists.length} playlists
          </p>
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {playlists.map((playlist) => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onPlay={handlePlay}
                onEdit={(p) => setEditingPlaylist({
                  ...p,
                  cover_url: p.custom_cover_url ?? p.cover_url,
                })}
                onDelete={handleDelete}
                actionId={actionId}
              />
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
