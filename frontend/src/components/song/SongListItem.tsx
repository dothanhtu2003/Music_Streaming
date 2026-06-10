"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatPlayCount,
  getArtistDisplayName,
  getSongCoverUrl,
  getGenreName,
} from "@/lib/song-format";
import {
  PlayIcon,
  PauseIcon,
  HeartIcon,
  MoreIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MusicIcon,
  VerifiedBadge,
} from "@/components/ui/Icons";
import { usePlayerStore, type RecentlyPlayedContext } from "@/stores/player-store";
import type { Song } from "@/types/music";

type SongListItemProps = {
  song: Song;
  queue?: Song[];
  index?: number;
  onRemove?: (songId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isPlaylistOwner?: boolean;
  canReorder?: boolean;
  recentlyPlayedContext?: RecentlyPlayedContext;
};

export function SongListItem({
  song,
  queue = [],
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  isPlaylistOwner = false,
  canReorder = false,
  recentlyPlayedContext = null,
}: SongListItemProps) {
  const { user } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentSong = currentSong?.id === song.id;
  const isLiked = isSongLiked(song.id);
  const likeLoading = actionSongId === song.id;
  const coverUrl = getSongCoverUrl(song);
  const artistName = getArtistDisplayName(song.artist);
  const isSelf = user?.id === song.artist.user_id || user?.username?.toLowerCase() === artistName.toLowerCase();
  const isVerified = song.artist.is_verified;

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

  const handlePlayClick = () => {
    if (isCurrentSong) {
      togglePlay();
      return;
    }

    playSong(song, queue.length > 0 ? queue : [song], recentlyPlayedContext);
  };

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 rounded-xl border border-transparent p-2.5 transition duration-200 hover:border-zinc-800 hover:bg-zinc-900/50",
        isCurrentSong && "bg-orange-500/5 border-orange-500/10"
      )}
    >
      {/* Left side: Play, cover, title, artist */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* Play/Pause circular button (always visible, orange when active) */}
        <button
          type="button"
          onClick={handlePlayClick}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-200",
            isCurrentSong
              ? "bg-orange-500 text-orange-950 hover:bg-orange-400 hover:scale-105"
              : "bg-zinc-800 text-zinc-300 hover:bg-orange-500 hover:text-orange-950 hover:scale-105"
          )}
        >
          {isCurrentSong && isPlaying ? (
            <PauseIcon size={12} />
          ) : (
            <PlayIcon size={12} className="ml-0.5" />
          )}
        </button>

        {/* Index number (optional, on desktop) */}
        {typeof index === "number" && (
          <span className="hidden w-5 text-center text-xs font-semibold text-zinc-500 sm:inline">
            {index + 1}
          </span>
        )}

        {/* Cover thumbnail */}
        <Link href={`/songs/${song.id}`} className="shrink-0">
          {coverUrl ? (
            <div
              className="h-10 w-10 rounded-lg bg-zinc-900 bg-cover bg-center border border-zinc-800/80"
              style={{ backgroundImage: `url(${coverUrl})` }}
              aria-label={`${song.title} cover`}
            />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-zinc-900 text-xs font-bold text-white border border-zinc-800/80">
              {song.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Song Info */}
        <div className="min-w-0 flex-1">
          <Link href={`/songs/${song.id}`}>
            <h4
              className={cn(
                "truncate text-sm font-semibold hover:text-orange-400",
                isCurrentSong ? "text-orange-400" : "text-white"
              )}
            >
              {song.title}
            </h4>
          </Link>
          <span className="flex items-center gap-1.5 truncate text-xs text-zinc-400">
            <span className="truncate">{artistName}</span>
            {isVerified && <VerifiedBadge size={12} />}
            {isSelf && (
              <span className="inline-flex items-center rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20" title="This is you">
                Bạn
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Middle side: Genre and Play count (desktop only) */}
      <div className="hidden min-w-[200px] items-center gap-6 md:flex">
        <span className="w-24 truncate text-xs font-medium text-zinc-400">
          {getGenreName(song)}
        </span>
        <span className="flex w-28 items-center gap-1.5 text-xs text-zinc-500" title={`${formatPlayCount(song.play_count)} plays`}>
          <MusicIcon size={13} className="text-zinc-500 shrink-0" />
          <span>{formatPlayCount(song.play_count)}</span>
        </span>
      </div>

      {/* Right side: Like, Duration, 3-dots actions */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Heart Like/Unlike Icon Button */}
        <button
          type="button"
          aria-pressed={isLiked}
          disabled={likeLoading}
          onClick={() => {
            void toggleLike(song);
          }}
          className={cn(
            "p-1.5 transition duration-150 hover:scale-110 focus:outline-none",
            isLiked
              ? "text-orange-500"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          title={isLiked ? "Unlike" : "Like"}
        >
          <HeartIcon size={16} filled={isLiked} />
        </button>

        {/* Duration (desktop & tablet) */}
        <span className="hidden text-xs text-zinc-500 sm:inline w-10 text-right">
          {formatDuration(song.duration_sec)}
        </span>

        {/* 3-Dots More Action Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <MoreIcon size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 z-50 w-52 origin-top-right rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl ring-1 ring-black ring-opacity-5">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openAddSongModal(song);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
              >
                <PlusIcon size={14} />
                Add to Playlist
              </button>

              <Link
                href={`/songs/${song.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
              >
                <UserIcon size={14} />
                View Details
              </Link>

              {isPlaylistOwner && (
                <>
                  <hr className="my-1 border-zinc-900" />
                  
                  {canReorder && onMoveUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onMoveUp();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                    >
                      <ChevronUpIcon size={14} />
                      Move Up
                    </button>
                  )}

                  {canReorder && onMoveDown && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onMoveDown();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                    >
                      <ChevronDownIcon size={14} />
                      Move Down
                    </button>
                  )}

                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onRemove(song.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 transition hover:bg-zinc-900 hover:text-red-300"
                    >
                      <TrashIcon size={14} />
                      Remove from Playlist
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
