"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { HeartIcon, PlayIcon, PauseIcon, PlusIcon } from "@/components/ui/Icons";
import {
  formatDuration,
  formatPlayCount,
  getAlbumTitle,
  getGenreName,
  getSongCoverUrl,
} from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

type SongCardProps = {
  song: Song;
  queue?: Song[];
  compact?: boolean;
};

function SongCover({ song, isCurrentSong, isPlaying, onPlay }: { song: Song; isCurrentSong: boolean; isPlaying: boolean; onPlay: (e: React.MouseEvent) => void }) {
  const coverUrl = getSongCoverUrl(song);
  const fallbackLetter = song.title.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-900 group-hover:shadow-lg transition-all duration-300">
      {coverUrl ? (
        <div
          className="aspect-square w-full rounded-xl bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${coverUrl})` }}
          aria-label={`${song.title} cover`}
        />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-gradient-to-br from-green-500/20 to-zinc-950 transition-transform duration-500 group-hover:scale-105">
          <span className="text-4xl font-black text-green-500/70">
            {fallbackLetter}
          </span>
        </div>
      )}

      {/* Center Play Overlay - Hidden on Desktop (shows on hover), always visible on Mobile/Touch */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-green-950 shadow-xl transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none hover:bg-green-400"
          aria-label={isCurrentSong && isPlaying ? "Pause song" : "Play song"}
        >
          {isCurrentSong && isPlaying ? (
            <PauseIcon size={18} className="text-green-950" />
          ) : (
            <PlayIcon size={18} className="ml-0.5 text-green-950" />
          )}
        </button>
      </div>

      {/* Mini Equalizer overlay for currently playing song */}
      {isCurrentSong && isPlaying && (
        <div className="absolute bottom-2.5 left-2.5 flex items-end gap-[3px] bg-black/60 backdrop-blur-md px-2 py-1 rounded-md h-5 z-10 border border-white/5">
          <span className="eq-bar eq-bar-1 h-3.5" />
          <span className="eq-bar eq-bar-2 h-3.5" />
          <span className="eq-bar eq-bar-3 h-3.5" />
          <span className="eq-bar eq-bar-4 h-3.5" />
        </div>
      )}
    </div>
  );
}

export function SongCard({ song, queue, compact = false }: SongCardProps) {
  const { user } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();
  const { isFollowing, toggleFollow, actionId } = useFollow();

  const isCurrentSong = currentSong?.id === song.id;
  const isLiked = isSongLiked(song.id);
  const likeLoading = actionSongId === song.id;
  const isSelf =
    Boolean(user?.id && song.artist.user_id && user.id === song.artist.user_id) ||
    user?.username?.toLowerCase() === song.artist.name.toLowerCase();
  const isArtistFollowed = isFollowing(song.artist.id);
  const followLoading = actionId === song.artist.id;

  const handlePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isCurrentSong) {
      togglePlay();
      return;
    }
    playSong(song, queue?.length ? queue : [song]);
  };

  return (
    <article
      className={cn(
        "group flex min-w-0 flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-3 transition-all duration-300 hover:-translate-y-1 hover:border-green-500/20 hover:bg-zinc-900/60 hover:shadow-2xl hover:shadow-green-500/[0.03]",
        isCurrentSong && "border-green-500/30 bg-green-500/[0.02]",
      )}
    >
      <div className="relative cursor-pointer" onClick={handlePlay}>
        <SongCover song={song} isCurrentSong={isCurrentSong} isPlaying={isPlaying} onPlay={handlePlay} />
      </div>

      <div className="mt-3.5 min-w-0 flex-1 flex flex-col justify-between">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href={`/songs/${song.id}`}>
                <h3
                  className={cn(
                    "truncate text-sm font-bold text-white hover:text-green-400 transition-colors duration-200",
                    isCurrentSong && "text-green-400",
                  )}
                >
                  {song.title}
                </h3>
              </Link>
            </div>
            
            <button
              type="button"
              aria-pressed={isLiked}
              disabled={likeLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void toggleLike(song);
              }}
              className={cn(
                "shrink-0 transition-all duration-200 focus:outline-none relative hover:scale-110 active:scale-95",
                isLiked ? "text-green-500" : "text-zinc-500 hover:text-zinc-300",
                likeLoading && "opacity-50"
              )}
              title={isLiked ? "Unlike song" : "Like song"}
            >
              <HeartIcon size={16} filled={isLiked} className={cn(isLiked && "like-bounce")} />
            </button>
          </div>

          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
            <Link href={`/artists/${song.artist.id}`} className="truncate hover:text-green-400 transition-colors">
              {song.artist.name}
            </Link>
            {!isSelf && (
              <>
                <span className="shrink-0 text-zinc-700">•</span>
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void toggleFollow(song.artist.id, song.artist.name);
                  }}
                  className={cn(
                    "shrink-0 font-medium transition hover:underline focus:outline-none text-[11px]",
                    isArtistFollowed
                      ? "text-green-400 hover:text-green-300"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {followLoading
                    ? "..."
                    : isArtistFollowed
                      ? "Following"
                      : "Follow"}
                </button>
              </>
            )}
          </div>
        </div>

        {!compact && (
          <div className="mt-3 space-y-1 text-[11px] text-zinc-500 border-t border-zinc-900/60 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate max-w-[70%]">{getAlbumTitle(song)}</span>
              <span className="shrink-0 rounded-full border border-zinc-800/80 px-2 py-0.5 text-[9px] font-medium text-zinc-500">
                {formatDuration(song.duration_sec)}
              </span>
            </div>
            <p className="truncate text-zinc-600">
              {getGenreName(song)} • {formatPlayCount(song.play_count)} plays
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openAddSongModal(song);
          }}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/20 py-2 text-xs font-semibold text-zinc-400 transition-all duration-200 hover:border-green-500/30 hover:bg-green-500/5 hover:text-white focus:outline-none flex items-center justify-center gap-1.5"
        >
          <PlusIcon size={12} />
          Add to playlist
        </button>
      </div>
    </article>
  );
}
