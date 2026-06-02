"use client";

import Link from "next/link";
import { usePlayer } from "@/components/player/PlayerProvider";
import {
  formatDuration,
  getGenreName,
  getSongCoverUrl,
} from "@/lib/song-format";
import type { RecentlyPlayedSong } from "@/types/music";

type RecentlyPlayedListProps = {
  songs: RecentlyPlayedSong[];
  loading?: boolean;
  error?: string | null;
};

function formatPlayedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RecentlyPlayedSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <div className="h-14 w-14 rounded-lg bg-zinc-800" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-zinc-800" />
        <div className="h-3 w-1/2 rounded bg-zinc-800" />
      </div>
      <div className="h-8 w-16 rounded bg-zinc-800" />
    </div>
  );
}

export function RecentlyPlayedList({
  songs,
  loading = false,
  error = null,
}: RecentlyPlayedListProps) {
  const { currentSong, isPlaying, playSong } = usePlayer();

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <RecentlyPlayedSkeleton key={index} />
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
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">
        Play a song to build your recently played list.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {songs.map((song) => {
        const coverUrl = getSongCoverUrl(song);
        const isCurrentSong = currentSong?.id === song.id;

        return (
          <article
            key={`${song.id}-${song.played_at}`}
            className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition hover:border-green-500/70 hover:bg-zinc-900"
          >
            <Link
              href={`/songs/${song.id}`}
              aria-label={`View ${song.title}`}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-zinc-900 bg-cover bg-center"
              style={
                coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined
              }
            >
              {!coverUrl && (
                <span className="text-base font-black text-white/90">
                  {song.title.slice(0, 1)}
                </span>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <Link href={`/songs/${song.id}`}>
                <h3 className="truncate text-sm font-semibold text-white hover:text-green-300">
                  {song.title}
                </h3>
              </Link>
              <p className="mt-1 truncate text-xs text-zinc-400">
                {song.artist.name} - {getGenreName(song)} -{" "}
                {formatDuration(song.duration_sec)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Played {formatPlayedAt(song.played_at)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => playSong(song, songs)}
              className="rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-green-950 transition hover:bg-green-400"
            >
              {isCurrentSong && isPlaying ? "Playing" : "Play"}
            </button>
          </article>
        );
      })}
    </div>
  );
}
