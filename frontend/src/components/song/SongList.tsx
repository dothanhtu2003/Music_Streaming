"use client";

import { SongCard } from "@/components/song/SongCard";
import { SongCardSkeleton } from "@/components/ui/Skeletons";
import type { Song } from "@/types/music";

import { EmptyState } from "@/components/ui/EmptyState";

type SongListProps = {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyDescription?: string;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export function SongList({
  songs,
  loading = false,
  error = null,
  emptyMessage = "No songs found.",
  emptyDescription = "Try another search or add songs from the dashboard.",
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
}: SongListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <SongCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} queue={songs} />
        ))}
      </div>

      {canLoadMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full border border-zinc-800 px-6 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more songs"}
          </button>
        </div>
      )}
    </div>
  );
}
