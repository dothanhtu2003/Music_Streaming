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

async function sharePath(path: string, title: string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = `${window.location.origin}${path}`;

  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    // Sharing is optional UI sugar. Ignore denied clipboard/share requests.
  }
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
        "group rounded-xl border border-zinc-900/80 bg-zinc-950/40 p-3 transition hover:border-zinc-700 hover:bg-zinc-900/50 sm:p-4",
        isCurrentSong && "border-orange-500/30 bg-orange-500/[0.04]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/songs/${song.id}`}
          className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 bg-cover bg-center sm:h-16 sm:w-16"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          aria-label={`Open ${songTitle}`}
          onClick={(event) => event.stopPropagation()}
        >
          {!coverUrl && (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-500/25 to-zinc-950 text-lg font-black text-orange-300">
              {getFallbackLetter(songTitle)}
            </span>
          )}
        </Link>

        <button
          type="button"
          onClick={handlePlay}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-black",
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

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              {artistId ? (
                <Link
                  href={`/artists/${artistId}`}
                  className="inline-flex items-center gap-1.5 max-w-full text-xs font-medium text-zinc-500 transition hover:text-orange-400"
                  onClick={(event) => event.stopPropagation()}
                >
                  <span className="truncate">{artistName}</span>
                  {isVerified && <VerifiedBadge size={12} />}
                  {isSelf && (
                    <span className="inline-flex items-center rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20" title="This is you">
                      Bạn
                    </span>
                  )}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 max-w-full text-xs font-medium text-zinc-500">
                  <span className="truncate">{artistName}</span>
                  {isVerified && <VerifiedBadge size={12} />}
                  {isSelf && (
                    <span className="inline-flex items-center rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20" title="This is you">
                      Bạn
                    </span>
                  )}
                </span>
              )}
              <Link
                href={`/songs/${song.id}`}
                className={cn(
                  "mt-0.5 block truncate text-base font-bold transition hover:text-orange-400",
                  isCurrentSong ? "text-orange-400" : "text-white",
                )}
                onClick={(event) => event.stopPropagation()}
              >
                {songTitle}
              </Link>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-zinc-500 sm:justify-end">
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

          <div className="mt-3 flex min-w-0 items-center gap-3">
            <WaveformPreview
              seed={`${song.id}-${songTitle}`}
              isActive={isCurrentSong}
            />
            <span className="shrink-0 text-xs font-medium text-zinc-500">
              {formatDuration(song.duration_sec ?? 0)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-pressed={isLiked}
            disabled={likeLoading}
            onClick={(event) => {
              stopAction(event);
              void toggleLike(song);
            }}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
              isLiked
                ? "bg-orange-500/10 text-orange-400"
                : "text-zinc-500 hover:bg-zinc-800 hover:text-white",
            )}
            title={isLiked ? "Unlike track" : "Like track"}
          >
            <HeartIcon size={16} filled={isLiked} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              stopAction(event);
              openAddSongModal(song);
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            title="Add to playlist"
          >
            <PlusIcon size={16} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              stopAction(event);
              void sharePath(`/songs/${song.id}`, songTitle);
            }}
            className="hidden h-9 items-center rounded-full px-3 text-xs font-bold text-zinc-500 transition hover:bg-zinc-800 hover:text-white md:inline-flex"
            title="Share track"
          >
            Share
          </button>

          <Link
            href={`/songs/${song.id}`}
            onClick={(event) => event.stopPropagation()}
            className="grid h-9 w-9 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
            title="More track details"
          >
            <MoreIcon size={17} />
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
