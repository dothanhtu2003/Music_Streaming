"use client";

import Link from "next/link";
import { usePlayer } from "@/components/player/PlayerProvider";
import {
  formatDuration,
  getSongCoverUrl,
} from "@/lib/song-format";

function CoverThumb() {
  const { currentSong } = usePlayer();
  const coverUrl = currentSong ? getSongCoverUrl(currentSong) : null;

  if (coverUrl) {
    return (
      <span
        className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${currentSong?.title} cover`}
      />
    );
  }

  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900 text-sm font-black text-white">
      {currentSong?.title.slice(0, 1) ?? "M"}
    </span>
  );
}

export function BottomPlayer() {
  const {
    currentSong,
    isPlaying,
    volume,
    repeat,
    shuffle,
    currentTime,
    duration,
    playerError,
    togglePlay,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleRepeat,
    toggleShuffle,
  } = usePlayer();
  const totalDuration = duration || currentSong?.duration_sec || 0;
  const canControl = Boolean(currentSong);
  const progressValue = Math.min(currentTime, totalDuration || currentTime);

  const controlClass =
    "rounded-full border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
  const activeToggleClass =
    "border-green-500 bg-green-500 text-green-950 hover:text-green-950";

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,1.5fr)_minmax(180px,0.8fr)] md:items-center lg:px-8">
        {currentSong ? (
          <Link
            href={`/songs/${currentSong.id}`}
            className="flex min-w-0 items-center gap-3"
          >
            <CoverThumb />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {currentSong.title}
              </span>
              <span className="block truncate text-xs text-zinc-400">
                {currentSong.artist.name}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <CoverThumb />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                No song selected
              </span>
              <span className="block truncate text-xs text-zinc-400">
                Press Play on any song
              </span>
            </span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={playPrevious}
              disabled={!canControl}
              className={controlClass}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!canControl}
              className="grid h-11 w-16 place-items-center rounded-full bg-green-500 text-sm font-bold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={playNext}
              disabled={!canControl}
              className={controlClass}
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-10 text-right text-xs text-zinc-500">
              {formatDuration(progressValue)}
            </span>
            <input
              type="range"
              min={0}
              max={totalDuration || 0}
              step={1}
              value={totalDuration ? progressValue : 0}
              disabled={!canControl || totalDuration === 0}
              onInput={(event) => seek(Number(event.currentTarget.value))}
              onChange={(event) => seek(Number(event.target.value))}
              className="h-1 flex-1 cursor-pointer accent-green-500 disabled:cursor-not-allowed"
              aria-label="Seek song"
            />
            <span className="w-10 text-xs text-zinc-500">
              {formatDuration(totalDuration)}
            </span>
          </div>
          {playerError && (
            <p className="text-center text-xs text-red-300">{playerError}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
          <button
            type="button"
            onClick={toggleRepeat}
            className={`${controlClass} ${repeat ? activeToggleClass : ""}`}
          >
            Repeat
          </button>
          <button
            type="button"
            onClick={toggleShuffle}
            className={`${controlClass} ${shuffle ? activeToggleClass : ""}`}
          >
            Shuffle
          </button>
          <label className="flex min-w-36 items-center gap-2 text-xs text-zinc-500">
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onInput={(event) => setVolume(Number(event.currentTarget.value))}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-1 w-24 cursor-pointer accent-green-500"
              aria-label="Volume"
            />
          </label>
        </div>
      </div>
    </footer>
  );
}
