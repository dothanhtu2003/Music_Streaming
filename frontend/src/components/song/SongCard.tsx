"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlayer } from "@/components/player/PlayerProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  formatPlayCount,
  getAlbumTitle,
  getGenreName,
  getSongCoverUrl,
} from "@/lib/song-format";
import type { Song } from "@/types/music";

type SongCardProps = {
  song: Song;
  queue?: Song[];
  compact?: boolean;
};

function SongCover({ song }: { song: Song }) {
  const coverUrl = getSongCoverUrl(song);

  if (coverUrl) {
    return (
      <div
        className="h-20 w-20 shrink-0 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${song.title} cover`}
      />
    );
  }

  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900">
      <span className="text-lg font-black text-white/90">
        {song.title.slice(0, 1)}
      </span>
    </div>
  );
}

export function SongCard({ song, queue, compact = false }: SongCardProps) {
  const { user } = useAuth();
  const { currentSong, isPlaying, playSong } = usePlayer();
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

  return (
    <article className="group rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition hover:-translate-y-0.5 hover:border-green-500/70 hover:bg-zinc-900">
      <div className="flex gap-4">
        <Link href={`/songs/${song.id}`} aria-label={`View ${song.title}`}>
          <SongCover song={song} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link href={`/songs/${song.id}`}>
                <h3 className="truncate text-base font-semibold text-white hover:text-green-300">
                  {song.title}
                </h3>
              </Link>
              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                <span className="truncate">{song.artist.name}</span>
                {!isSelf && (
                  <>
                    <span className="text-zinc-600 shrink-0">-</span>
                    <button
                      type="button"
                      disabled={followLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleFollow(song.artist.id, song.artist.name);
                      }}
                      className={cn(
                        "text-xs font-semibold transition hover:underline focus:outline-none shrink-0",
                        isArtistFollowed
                          ? "text-green-400 hover:text-green-300"
                          : "text-zinc-500 hover:text-zinc-300",
                      )}
                    >
                      {followLoading ? "..." : isArtistFollowed ? "Following" : "Follow"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
              {formatDuration(song.duration_sec)}
            </span>
          </div>

          {!compact && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>{getAlbumTitle(song)}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span>{getGenreName(song)}</span>
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              <span>{formatPlayCount(song.play_count)} plays</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => playSong(song, queue)}
              className="rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-green-950 transition hover:bg-green-400"
            >
              {isCurrentSong && isPlaying ? "Playing" : "Play"}
            </button>
            <button
              type="button"
              aria-pressed={isLiked}
              disabled={likeLoading}
              onClick={() => {
                void toggleLike(song);
              }}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                isLiked
                  ? "border-green-500 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                  : "border-zinc-700 text-zinc-300 hover:border-green-500 hover:text-white",
              )}
            >
              {likeLoading ? "Saving..." : isLiked ? "Unlike" : "Like"}
            </button>
            <button
              type="button"
              onClick={() => openAddSongModal(song)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-green-500 hover:text-white"
            >
              Add to playlist
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
