"use client";

import { SongCard } from "@/components/song/SongCard";
import { SongListItem } from "@/components/song/SongListItem";
import { SongCardSkeleton, ListItemSkeleton } from "@/components/ui/Skeletons";
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
  variant?: "grid" | "list";
};

export function SongList({
  songs,
  loading = false,
  error = null,
  emptyMessage = "No songs found.",
  emptyDescription = "Try another search or explore new uploads.",
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
  variant = "grid",
}: SongListProps) {
  if (loading) {
    if (variant === "list") {
      return (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <ListItemSkeleton key={index} />
          ))}
        </div>
      );
    }

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
      {variant === "list" ? (
        <div className="space-y-1">
          {/* Table Header */}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900/60 mb-2">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <span className="w-8 text-center hidden sm:inline-block">#</span>
              <span>Title</span>
            </div>
            <div className="hidden min-w-[200px] items-center gap-6 md:flex">
              <span className="w-24">Genre</span>
              <span className="w-28 flex items-center gap-1">Plays</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 w-[110px] justify-end">
              <span className="mr-8">Duration</span>
            </div>
          </div>

          {/* List items */}
          <div className="space-y-1.5">
            {songs.map((song, index) => (
              <SongListItem
                key={song.id}
                song={song}
                queue={songs}
                index={index}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} queue={songs} />
          ))}
        </div>
      )}

      {canLoadMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full border border-zinc-800 px-6 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more songs"}
          </button>
        </div>
      )}
    </div>
  );
}
