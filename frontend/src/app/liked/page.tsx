"use client";

import { useLikes } from "@/components/like/LikeProvider";
import { SongCard } from "@/components/song/SongCard";
import { PageHeader } from "@/components/ui/PageHeader";

function LikedSongSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-lg bg-zinc-800" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-2/3 rounded bg-zinc-800" />
          <div className="h-3 w-1/2 rounded bg-zinc-800" />
          <div className="h-8 w-28 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

export default function LikedPage() {
  const { likedSongs, pagination, isLoading, error, refreshLikedSongs } =
    useLikes();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Liked songs"
        description="Songs saved by the current user from GET /api/likes/me."
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <LikedSongSkeleton key={index} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              void refreshLikedSongs();
            }}
            className="mt-3 rounded-lg border border-red-400/60 px-3 py-2 text-xs font-semibold transition hover:bg-red-500/10"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && likedSongs.length === 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <p className="text-sm font-medium text-white">No liked songs yet.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Press Like on any song to add it here.
          </p>
        </div>
      )}

      {!isLoading && !error && likedSongs.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            {pagination?.totalItems ?? likedSongs.length} liked songs
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {likedSongs.map((song) => (
              <SongCard key={song.id} song={song} queue={likedSongs} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
