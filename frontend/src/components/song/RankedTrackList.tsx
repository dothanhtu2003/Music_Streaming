"use client";

import { useMemo } from "react";
import { useLikes } from "@/components/like/LikeProvider";
import { HeartIcon, PauseIcon, PlayIcon } from "@/components/ui/Icons";
import { resolveApiAssetUrl } from "@/lib/api";
import { formatDuration, formatPlayCount } from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import type { ChartTrack, Song, TrendingTrack } from "@/types/music";

type RankedTrack = (ChartTrack | TrendingTrack) & {
  rank?: number;
};

type RankedTrackListProps = {
  tracks: RankedTrack[];
  showScore?: boolean;
  showRank?: boolean;
  likeEnabled?: boolean;
};

function trackToSong(track: RankedTrack): Song {
  return {
    id: track.id,
    title: track.title,
    description: null,
    file_url: track.fileUrl,
    cover_url: track.coverUrl,
    duration_sec: track.duration,
    play_count: track.playCount,
    likes_count: track.likeCount,
    is_active: true,
    created_at: track.createdAt,
    updated_at: track.createdAt,
    artist: {
      id: track.id,
      name: track.artistName,
      avatar_url: null,
    },
    album: null,
    genre: null,
  };
}

function TrackCover({ track }: { track: RankedTrack }) {
  const coverUrl = resolveApiAssetUrl(track.coverUrl);

  if (coverUrl) {
    return (
      <div
        className="h-12 w-12 rounded-lg border border-zinc-800 bg-zinc-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${track.title} cover`}
      />
    );
  }

  return (
    <div className="grid h-12 w-12 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-black text-orange-400">
      {track.title.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function RankedTrackList({
  tracks,
  showScore = false,
  showRank = true,
  likeEnabled = false,
}: RankedTrackListProps) {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const queue = useMemo(() => tracks.map(trackToSong), [tracks]);

  if (tracks.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-400">
        No tracks found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
      <div className="hidden grid-cols-[64px_1fr_100px_90px_90px_80px] gap-4 border-b border-zinc-900 px-4 py-3 text-xs font-bold uppercase text-zinc-500 md:grid">
        <span>Rank</span>
        <span>Track</span>
        <span>Plays</span>
        <span>Likes</span>
        <span>{showScore ? "Score" : "Comments"}</span>
        <span className="text-right">Time</span>
      </div>

      <div className="divide-y divide-zinc-900">
        {tracks.map((track, index) => {
          const song = queue[index];
          const isCurrentSong = currentSong?.id === track.id;
          const isLiked = isSongLiked(track.id);
          const likeLoading = actionSongId === track.id;

          return (
            <div
              key={track.id}
              className={cn(
                "grid gap-3 px-4 py-3 transition hover:bg-zinc-900/60 md:grid-cols-[64px_1fr_100px_90px_90px_80px] md:items-center md:gap-4",
                isCurrentSong && "bg-orange-500/5",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-sm font-bold text-zinc-500">
                  {showRank ? track.rank ?? index + 1 : index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrentSong) {
                      togglePlay();
                      return;
                    }

                    playSong(song, queue);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-orange-950 transition hover:bg-orange-400"
                  aria-label={isCurrentSong && isPlaying ? "Pause" : "Play"}
                >
                  {isCurrentSong && isPlaying ? (
                    <PauseIcon size={12} />
                  ) : (
                    <PlayIcon size={12} className="ml-0.5" />
                  )}
                </button>
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <TrackCover track={track} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {track.artistName}
                  </p>
                </div>
              </div>

              <span className="text-xs font-medium text-zinc-400">
                {formatPlayCount(track.playCount)}
              </span>

              <div className="flex items-center gap-2">
                {likeEnabled && (
                  <button
                    type="button"
                    aria-pressed={isLiked}
                    disabled={likeLoading}
                    onClick={() => {
                      void toggleLike(song);
                    }}
                    className={cn(
                      "text-zinc-500 transition hover:text-orange-400 disabled:opacity-50",
                      isLiked && "text-orange-500",
                    )}
                  >
                    <HeartIcon size={15} filled={isLiked} />
                  </button>
                )}
                <span className="text-xs font-medium text-zinc-400">
                  {formatPlayCount(track.likeCount)}
                </span>
              </div>

              <span className="text-xs font-medium text-zinc-400">
                {showScore && "score" in track
                  ? Math.round(track.score)
                  : formatPlayCount(track.commentCount)}
              </span>

              <span className="text-right text-xs font-medium text-zinc-500">
                {formatDuration(track.duration)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
