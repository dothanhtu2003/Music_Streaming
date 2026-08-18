"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import {
  HeartIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  MusicIcon,
  VerifiedBadge,
} from "@/components/ui/Icons";
import {
  formatDuration,
  formatPlayCount,
  getArtistDisplayName,
  getSongCoverUrl,
} from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

type ArtistTrackRowProps = {
  song: Song;
  queue: Song[];
};

function getFallbackLetter(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "M";
}

function formatPostedAt(value: string | null | undefined) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  return date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function WaveformPreview({
  seed,
  isActive,
}: {
  seed: string;
  isActive: boolean;
}) {
  const safeSeed = seed || "music";
  const bars = Array.from({ length: 56 }, (_, index) => {
    const charCode = safeSeed.charCodeAt(index % safeSeed.length);
    return 20 + ((charCode + index * 13) % 58);
  });

  return (
    <div
      className="flex h-9 min-w-0 flex-1 items-center gap-[3px] overflow-hidden"
      aria-hidden="true"
    >
      {bars.map((height, index) => (
        <span
          key={`${safeSeed}-${index}`}
          className={cn(
            "w-[3px] rounded-full transition-colors",
            isActive ? "bg-orange-400/90" : "bg-zinc-700/80",
          )}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function ArtistTrackRow({ song, queue }: ArtistTrackRowProps) {
  const { user } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();

  const isCurrentSong = currentSong?.id === song.id;
  const isLiked = isSongLiked(song.id);
  const likeLoading = actionSongId === song.id;
  const coverUrl = getSongCoverUrl(song);
  const songTitle = song.title || "Untitled track";
  const artistId = song.artist?.id ?? "";
  const artistName = getArtistDisplayName(song.artist);
  const safeQueue = queue.length > 0 ? queue : [song];
  const isSelf = user?.id === song.artist.user_id || user?.username?.toLowerCase() === artistName.toLowerCase();
  const isVerified = song.artist.is_verified;

  const handlePlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (isCurrentSong) {
      togglePlay();
      return;
    }

    playSong(song, safeQueue);
  };

  const stopAction = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <article
      className={cn(
        "group rounded-xl border border-zinc-900/80 bg-zinc-950/40 p-2.5 sm:p-4 transition hover:border-zinc-700 hover:bg-zinc-900/50",
        isCurrentSong && "border-orange-500/30 bg-orange-500/[0.04]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {/* Cover image & Play overlay */}
        <div className="relative h-12 w-12 shrink-0 select-none sm:h-14 sm:w-14">
          <Link
            href={`/songs/${song.id}`}
            className="h-full w-full block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 bg-cover bg-center"
            style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
            aria-label={`Open ${songTitle}`}
            onClick={(event) => event.stopPropagation()}
          >
            {!coverUrl && (
              <span className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-500/25 to-zinc-950 text-base font-black text-orange-300">
                {getFallbackLetter(songTitle)}
              </span>
            )}
          </Link>

          {/* Overlay play button on mobile cover */}
          <button
            type="button"
            onClick={handlePlay}
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-white transition active:scale-95 sm:hidden",
              isCurrentSong && "bg-black/50 text-orange-400 opacity-100",
            )}
            aria-label={isCurrentSong && isPlaying ? "Pause track" : "Play track"}
          >
            {isCurrentSong && isPlaying ? (
              <PauseIcon size={16} />
            ) : (
              <PlayIcon size={16} className="ml-0.5" />
            )}
          </button>
        </div>

        {/* Desktop Play button */}
        <button
          type="button"
          onClick={handlePlay}
          className={cn(
            "hidden sm:grid h-10 w-10 shrink-0 place-items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-black",
            isCurrentSong
              ? "bg-orange-500 text-orange-950 hover:bg-orange-400"
              : "bg-zinc-100 text-black hover:bg-orange-500 hover:text-orange-950",
          )}
          aria-label={isCurrentSong && isPlaying ? "Pause track" : "Play track"}
        >
          {isCurrentSong && isPlaying ? (
            <PauseIcon size={15} />
          ) : (
            <PlayIcon size={15} className="ml-0.5" />
          )}
        </button>

        {/* Song metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Link
                href={`/songs/${song.id}`}
                className={cn(
                  "block truncate text-xs sm:text-base font-bold leading-tight transition hover:text-orange-400",
                  isCurrentSong ? "text-orange-400" : "text-white",
                )}
                onClick={(event) => event.stopPropagation()}
              >
                {songTitle}
              </Link>

              {artistId ? (
                <Link
                  href={`/artists/${artistId}`}
                  className="mt-0.5 inline-flex items-center gap-1 max-w-full text-[11px] sm:text-xs font-medium text-zinc-400 transition hover:text-orange-400"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="truncate">{artistName}</span>
                  {isVerified && <VerifiedBadge size={11} />}
                  {isSelf && (
                    <span className="inline-flex items-center rounded bg-orange-500/10 px-1 py-0.2 text-[8px] font-bold text-orange-400 border border-orange-500/20">
                      Bạn
                    </span>
                  )}
                </Link>
              ) : (
                <span className="mt-0.5 inline-flex items-center gap-1 max-w-full text-[11px] sm:text-xs font-medium text-zinc-400">
                  <span className="truncate">{artistName}</span>
                  {isVerified && <VerifiedBadge size={11} />}
                  {isSelf && (
                    <span className="inline-flex items-center rounded bg-orange-500/10 px-1 py-0.2 text-[8px] font-bold text-orange-400 border border-orange-500/20">
                      Bạn
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="hidden sm:flex shrink-0 items-center gap-2 text-[11px] font-medium text-zinc-500">
              <span className="hidden lg:inline">
                {formatPostedAt(song.created_at)}
              </span>
              <span className="hidden text-zinc-700 lg:inline">/</span>
              <span className="flex items-center gap-1" title={`${formatPlayCount(song.play_count ?? 0)} plays`}>
                <MusicIcon size={12} className="text-zinc-500 shrink-0" />
                <span>{formatPlayCount(song.play_count ?? 0)}</span>
              </span>
            </div>
          </div>

          {/* Desktop Waveform preview */}
          <div className="mt-2 hidden sm:flex min-w-0 items-center gap-3">
            <WaveformPreview
              seed={`${song.id}-${songTitle}`}
              isActive={isCurrentSong}
            />
            <span className="shrink-0 text-xs font-medium text-zinc-500 font-mono">
              {formatDuration(song.duration_sec ?? 0)}
            </span>
          </div>

          {/* Mobile sub-info duration & play count */}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500 font-mono sm:hidden">
            <span>{formatDuration(song.duration_sec ?? 0)}</span>
            <span>•</span>
            <span>{formatPlayCount(song.play_count ?? 0)} plays</span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            aria-pressed={isLiked}
            disabled={likeLoading}
            onClick={(event) => {
              stopAction(event);
              void toggleLike(song);
            }}
            className={cn(
              "grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              isLiked
                ? "bg-orange-500/10 text-orange-400"
                : "text-zinc-500 hover:bg-zinc-800 hover:text-white",
            )}
            title={isLiked ? "Unlike track" : "Like track"}
          >
            <HeartIcon size={15} filled={isLiked} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              stopAction(event);
              openAddSongModal(song);
            }}
            className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-white active:scale-95"
            title="Add to playlist"
          >
            <PlusIcon size={15} />
          </button>

          <Link
            href={`/songs/${song.id}`}
            onClick={(event) => event.stopPropagation()}
            className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            title="More track details"
          >
            <MoreIcon size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ArtistTrackRowSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-900/80 bg-zinc-950/40 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="hidden h-16 w-16 rounded-lg bg-zinc-900 shimmer sm:block" />
        <div className="h-11 w-11 rounded-full bg-zinc-900 shimmer" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-zinc-900 shimmer" />
            <div className="h-4 w-2/5 rounded bg-zinc-900 shimmer" />
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 32 }).map((_, index) => (
              <span
                key={index}
                className="h-6 w-[3px] rounded-full bg-zinc-900 shimmer"
              />
            ))}
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <div className="h-9 w-9 rounded-full bg-zinc-900 shimmer" />
          <div className="h-9 w-9 rounded-full bg-zinc-900 shimmer" />
        </div>
      </div>
    </div>
  );
}
