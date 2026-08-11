"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { HeartIcon, PauseIcon, PlayIcon, PlusIcon } from "@/components/ui/Icons";
import { getSongCoverUrl } from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

type LatestSongCardProps = {
  song: Song;
  queue: Song[];
};

function LatestSongCover({
  song,
  isCurrentSong,
  isPlaying,
  onPlay,
}: {
  song: Song;
  isCurrentSong: boolean;
  isPlaying: boolean;
  onPlay: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const coverUrl = getSongCoverUrl(song);
  const safeCoverUrl =
    typeof coverUrl === "string" && coverUrl.length > 0 ? coverUrl : null;
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const fallbackLetter = song.title.trim().slice(0, 1).toUpperCase() || "M";
  const hasCover = safeCoverUrl !== null && failedCoverUrl !== safeCoverUrl;

  return (
    <div className={cn(
      "group/cover relative h-[160px] w-[160px] overflow-hidden rounded-xl bg-zinc-900 transition-all duration-300",
      isCurrentSong && "border-2 border-orange-500 shadow-lg shadow-orange-500/25 ring-2 ring-orange-500/20"
    )}>
      {hasCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeCoverUrl}
          alt={`${song.title} cover`}
          draggable={false}
          onError={() => setFailedCoverUrl(safeCoverUrl)}
          className="h-[160px] w-[160px] select-none object-cover transition-transform duration-500 group-hover/cover:scale-105"
        />
      ) : (
        <div className="grid h-[160px] w-[160px] place-items-center bg-gradient-to-br from-orange-500/20 to-zinc-950 transition-transform duration-500 group-hover/cover:scale-105">
          <span className="text-4xl font-black text-orange-500/70">
            {fallbackLetter}
          </span>
        </div>
      )}

      {/* Active Playing Equalizer Badge */}
      {isCurrentSong && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[9px] font-black text-orange-950 shadow-md backdrop-blur-sm">
          {isPlaying ? (
            <span className="flex items-end gap-[1.5px] h-2.5">
              <span className="w-[2px] bg-orange-950 h-full animate-[bounce_0.6s_infinite_100ms]" />
              <span className="w-[2px] bg-orange-950 h-2/3 animate-[bounce_0.6s_infinite_300ms]" />
              <span className="w-[2px] bg-orange-950 h-full animate-[bounce_0.6s_infinite_200ms]" />
            </span>
          ) : (
            <span>PLAYING</span>
          )}
        </div>
      )}

      {/* Center Play Overlay - Hidden on Mobile, shows on Desktop on hover */}
      <div className="pointer-events-none absolute inset-0 hidden md:flex items-center justify-center bg-black/35 opacity-0 md:group-hover/cover:opacity-100 md:group-focus-within/cover:opacity-100 transition-opacity duration-300">
        <button
          type="button"
          onClick={onPlay}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/15 text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-white/25 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30"
          aria-label={isCurrentSong && isPlaying ? "Pause song" : "Play song"}
        >
          {isCurrentSong && isPlaying ? (
            <PauseIcon size={16} />
          ) : (
            <PlayIcon size={16} className="ml-0.5" />
          )}
        </button>
      </div>

      {/* Corner Play Button - Visible only on Mobile */}
      <div className="absolute bottom-2 right-2 z-10 flex md:hidden">
        <button
          type="button"
          onClick={onPlay}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-all duration-200 active:scale-95 focus:outline-none",
            isCurrentSong ? "bg-white text-black" : "bg-orange-500 text-orange-950"
          )}
          aria-label={isCurrentSong && isPlaying ? "Pause song" : "Play song"}
        >
          {isCurrentSong && isPlaying ? (
            <PauseIcon size={12} className="text-black" />
          ) : (
            <PlayIcon size={12} className="ml-0.5 text-orange-950" />
          )}
        </button>
      </div>
    </div>
  );
}

export function LatestSongCard({ song, queue }: LatestSongCardProps) {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();

  const isCurrentSong = currentSong?.id === song.id;
  const isLiked = isSongLiked(song.id);
  const likeLoading = actionSongId === song.id;

  const handlePlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isCurrentSong) {
      togglePlay();
      return;
    }

    playSong(song, queue.length ? queue : [song]);
  };

  return (
    <article
      className={cn(
        "w-[160px] flex-none snap-start",
        isCurrentSong && "text-orange-400",
      )}
    >
      <LatestSongCover
        song={song}
        isCurrentSong={isCurrentSong}
        isPlaying={isPlaying}
        onPlay={handlePlay}
      />

      <div className="mt-3 min-w-0">
        <Link href={`/songs/${song.id}`} className="block min-w-0">
          <h3
            className={cn(
              "truncate text-sm font-semibold leading-5 text-white transition hover:text-orange-400",
              isCurrentSong && "text-orange-400",
            )}
          >
            {song.title}
          </h3>
        </Link>

        {song.artist?.name && (
          <Link
            href={`/artists/${song.artist.id}`}
            className="mt-0.5 block truncate text-xs leading-4 text-zinc-500 transition hover:text-zinc-300"
          >
            {song.artist.name}
          </Link>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={isLiked ? "Unlike song" : "Like song"}
          aria-pressed={isLiked}
          title={isLiked ? "Unlike song" : "Like song"}
          disabled={likeLoading}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void toggleLike(song);
          }}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 transition hover:border-orange-500/30 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",
            isLiked && "border-orange-500/30 bg-orange-500/10 text-orange-400",
          )}
        >
          <HeartIcon size={15} filled={isLiked} />
        </button>

        <button
          type="button"
          aria-label="Add to playlist"
          title="Add to playlist"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openAddSongModal(song);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 transition hover:border-orange-500/30 hover:text-white active:scale-95"
        >
          <PlusIcon size={15} />
        </button>
      </div>
    </article>
  );
}
