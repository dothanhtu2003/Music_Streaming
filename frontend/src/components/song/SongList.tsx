import { SongCard } from "@/components/song/SongCard";
import type { Song } from "@/types/music";

type SongListProps = {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

function SongSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-lg bg-zinc-800" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-2/3 rounded bg-zinc-800" />
          <div className="h-3 w-1/2 rounded bg-zinc-800" />
          <div className="h-3 w-3/4 rounded bg-zinc-800" />
          <div className="h-8 w-16 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export function SongList({
  songs,
  loading = false,
  error = null,
  emptyMessage = "No songs found.",
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
}: SongListProps) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SongSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
        <p className="text-sm font-medium text-white">{emptyMessage}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Try another keyword or add songs from the admin area.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {songs.map((song) => (
          <SongCard key={song.id} song={song} queue={songs} />
        ))}
      </div>

      {canLoadMore && onLoadMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
