"use client";

import Link from "next/link";
import { useState } from "react";
import {
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlaylistIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "@/components/ui/Icons";
import { formatDuration, getSongCoverUrl } from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";

function CoverThumb() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const coverUrl = currentSong ? getSongCoverUrl(currentSong) : null;

  if (coverUrl) {
    return (
      <span
        className="h-10 w-10 shrink-0 rounded-lg border border-zinc-800 bg-cover bg-center md:h-8 md:w-8 md:rounded"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${currentSong?.title} cover`}
      />
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-gradient-to-br from-green-500 to-zinc-900 text-xs font-black text-white md:h-8 md:w-8 md:rounded md:text-[10px]">
      {currentSong?.title.slice(0, 1) ?? "M"}
    </span>
  );
}

export function BottomPlayer() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const playerError = usePlayerStore((state) => state.playerError);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextSong = usePlayerStore((state) => state.nextSong);
  const previousSong = usePlayerStore((state) => state.previousSong);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleRepeatMode = usePlayerStore((state) => state.toggleRepeatMode);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const [prevVolume, setPrevVolume] = useState(0.5);

  const totalDuration = duration || currentSong?.duration_sec || 0;
  const canControl = Boolean(currentSong);
  const progressValue = Math.min(currentTime, totalDuration || currentTime);
  const progressPercent = totalDuration
    ? Math.min((progressValue / totalDuration) * 100, 100)
    : 0;
  const repeatActive = repeatMode !== "off";

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      return;
    }

    setVolume(prevVolume);
  };

  return (
    <footer className="fixed inset-x-0 bottom-16 z-50 h-16 border-y border-zinc-800 bg-zinc-950 text-zinc-100 md:bottom-0 md:h-14 md:border-t md:border-b-0">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-zinc-800 md:hidden">
        <div
          className="h-full bg-green-500 transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 md:grid-cols-[auto_minmax(160px,1fr)_auto] md:px-4 lg:px-6">
        <Link
          href={currentSong ? `/songs/${currentSong.id}` : "/search"}
          className="flex min-w-0 items-center gap-3 md:hidden"
        >
          <CoverThumb />
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight text-white">
              {currentSong?.title ?? "No song selected"}
            </span>
            <span className="block truncate text-xs leading-tight text-zinc-500">
              {currentSong?.artist.name ?? "Select a song to play"}
            </span>
          </div>
        </Link>

        <div className="hidden h-full items-center gap-1.5 md:flex">
          <button
            type="button"
            onClick={previousSong}
            disabled={!canControl}
            className="grid h-8 w-8 place-items-center text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none"
            title="Previous"
          >
            <PrevIcon size={14} />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!canControl}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:bg-zinc-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <PauseIcon size={14} className="text-black" />
            ) : (
              <PlayIcon size={14} className="ml-0.5 text-black" />
            )}
          </button>

          <button
            type="button"
            onClick={nextSong}
            disabled={!canControl}
            className="grid h-8 w-8 place-items-center text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none"
            title="Next"
          >
            <NextIcon size={14} />
          </button>

          <button
            type="button"
            onClick={toggleShuffle}
            disabled={!canControl}
            className={`grid h-8 w-8 place-items-center rounded-full transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-30 ${
              shuffle ? "text-green-500" : "text-zinc-400 hover:text-white"
            }`}
            title="Shuffle"
          >
            <ShuffleIcon size={14} />
          </button>

          <button
            type="button"
            onClick={toggleRepeatMode}
            disabled={!canControl}
            className={`grid h-8 w-8 place-items-center rounded-full transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-30 ${
              repeatActive ? "text-green-500" : "text-zinc-400 hover:text-white"
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            <RepeatIcon size={14} />
          </button>
        </div>

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="w-9 text-right text-[10px] font-medium leading-none text-zinc-500">
            {formatDuration(progressValue)}
          </span>
          <div className="relative flex-1 py-2">
            <input
              type="range"
              min={0}
              max={totalDuration || 0}
              step={1}
              value={totalDuration ? progressValue : 0}
              disabled={!canControl || totalDuration === 0}
              onInput={(event) => seek(Number(event.currentTarget.value))}
              onChange={(event) => seek(Number(event.target.value))}
              className="slider-premium block w-full disabled:cursor-not-allowed focus:outline-none"
              aria-label="Seek song"
            />
          </div>
          <span className="w-9 text-left text-[10px] font-medium leading-none text-zinc-500">
            {formatDuration(totalDuration)}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canControl}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 md:hidden"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <PauseIcon size={15} className="text-black" />
            ) : (
              <PlayIcon size={15} className="ml-0.5 text-black" />
            )}
          </button>

          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            {currentSong ? (
              <Link
                href={`/songs/${currentSong.id}`}
                className="group flex min-w-0 items-center gap-2"
              >
                <CoverThumb />
                <div className="min-w-0 sm:w-28 lg:w-40">
                  <span className="block truncate text-[11px] font-semibold leading-tight text-white group-hover:text-green-400">
                    {currentSong.title}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-zinc-500">
                    {currentSong.artist.name}
                  </span>
                </div>
              </Link>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <CoverThumb />
                <div className="min-w-0 sm:w-28 lg:w-40">
                  <span className="block truncate text-[11px] font-semibold leading-tight text-white">
                    No song selected
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-zinc-500">
                    Select a song to play
                  </span>
                </div>
              </div>
            )}
          </div>

          {playerError && (
            <span className="hidden max-w-32 truncate text-[10px] font-semibold text-red-400 lg:inline">
              {playerError}
            </span>
          )}

          <button
            type="button"
            disabled={!canControl}
            className="hidden h-8 w-8 place-items-center text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30 md:grid"
            title="Like"
          >
            <HeartIcon size={14} />
          </button>

          <button
            type="button"
            disabled={!canControl}
            className="hidden h-8 w-8 place-items-center text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30 md:grid"
            title="Queue"
          >
            <PlaylistIcon size={14} />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            disabled={!canControl}
            className="hidden h-8 w-8 place-items-center text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none md:grid"
            title={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? (
              <VolumeMuteIcon size={14} />
            ) : (
              <VolumeIcon size={14} />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            disabled={!canControl}
            onInput={(event) => setVolume(Number(event.currentTarget.value))}
            onChange={(event) => setVolume(Number(event.target.value))}
            className="slider-premium hidden w-16 disabled:cursor-not-allowed md:block"
            aria-label="Volume"
          />
        </div>
      </div>
    </footer>
  );
}
