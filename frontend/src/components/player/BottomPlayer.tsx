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
import { useLikes } from "@/components/like/LikeProvider";
import { cn } from "@/lib/utils";

function CoverThumb() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const coverUrl = currentSong ? getSongCoverUrl(currentSong) : null;

  if (coverUrl) {
    return (
      <span
        className="h-9 w-9 shrink-0 rounded-md border border-zinc-800 bg-cover bg-center md:h-11 md:w-11 md:rounded-lg"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${currentSong?.title} cover`}
      />
    );
  }

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-800 bg-gradient-to-br from-orange-500 to-zinc-900 text-[10px] font-black text-white md:h-11 md:w-11 md:rounded-lg md:text-[11px]">
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

  const { isSongLiked, toggleLike, actionSongId } = useLikes();
  const isLiked = currentSong ? isSongLiked(currentSong.id) : false;
  const likeLoading = currentSong ? actionSongId === currentSong.id : false;

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
    <footer
      className={cn(
        "fixed z-50 left-1/2 -translate-x-1/2 transition-all duration-500 ease-out transform",
        "w-[calc(100%-24px)] h-14 rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl shadow-lg",
        "md:bottom-5 md:w-[calc(100%-32px)] md:max-w-5xl lg:max-w-6xl md:h-16 md:rounded-2xl md:bg-zinc-950/85 md:shadow-[0_20px_50px_rgba(0,0,0,0.6)]",
        currentSong
          ? "bottom-[80px] translate-y-0 opacity-100 pointer-events-auto"
          : "bottom-0 translate-y-32 opacity-0 pointer-events-none"
      )}
    >
      {/* Mobile Top Progress Bar */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-zinc-800/50 rounded-t-xl overflow-hidden md:hidden">
        <div
          className="h-full bg-orange-500 transition-[width] duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="relative w-full h-full px-4 md:px-6">
        {/* MOBILE LAYOUT */}
        <div className="flex h-full w-full items-center justify-between gap-3 md:hidden">
          {currentSong ? (
            <Link
              href={`/songs/${currentSong.id}`}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <CoverThumb />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold leading-tight text-white">
                  {currentSong.title}
                </span>
                <span className="block truncate text-[10px] leading-tight text-zinc-400">
                  {currentSong.artist.name}
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <CoverThumb />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold leading-tight text-white">
                  No song selected
                </span>
                <span className="block truncate text-[10px] leading-tight text-zinc-500">
                  Select a song to play
                </span>
              </div>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!canControl}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon size={12} className="text-black" />
              ) : (
                <PlayIcon size={12} className="ml-0.5 text-black" />
              )}
            </button>
          </div>
        </div>

        {/* DESKTOP LAYOUT */}
        <div className="hidden h-full w-full grid-cols-[1fr_2fr_1fr] items-center gap-6 md:grid">
          
          {/* CỘT TRÁI: Song info + Like */}
          <div className="flex min-w-0 items-center gap-3">
            {currentSong ? (
              <>
                <Link href={`/songs/${currentSong.id}`} className="shrink-0 transition hover:scale-105">
                  <CoverThumb />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/songs/${currentSong.id}`}
                    className="block truncate text-xs font-extrabold text-white hover:text-orange-500 transition-colors leading-tight"
                  >
                    {currentSong.title}
                  </Link>
                  <Link
                    href={`/artists/${currentSong.artist.id}`}
                    className="block truncate text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors mt-0.5"
                  >
                    {currentSong.artist.name}
                  </Link>
                </div>
                
                {/* Nút Like thực tế */}
                <button
                  type="button"
                  disabled={!canControl || likeLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void toggleLike(currentSong);
                  }}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition active:scale-90",
                    isLiked && "text-orange-500 hover:text-orange-400"
                  )}
                  title={isLiked ? "Unlike" : "Like"}
                >
                  <HeartIcon size={13} filled={isLiked} />
                </button>
              </>
            ) : (
              <div className="flex min-w-0 items-center gap-2.5">
                <CoverThumb />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-bold text-zinc-500">
                    No song selected
                  </span>
                  <span className="block truncate text-[10px] text-zinc-600">
                    Choose a track
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* CỘT GIỮA: Playback Controls & Progress Seek bar */}
          <div className="flex flex-col items-center gap-0.5 py-0.5">
            {/* Playback Buttons */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={toggleShuffle}
                disabled={!canControl}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-zinc-800/40 active:scale-95 disabled:opacity-30",
                  shuffle ? "text-orange-500" : "text-zinc-400 hover:text-white"
                )}
                title="Shuffle"
              >
                <ShuffleIcon size={13} />
              </button>

              <button
                type="button"
                onClick={previousSong}
                disabled={!canControl}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800/40 hover:text-white active:scale-95 disabled:opacity-30"
                title="Previous"
              >
                <PrevIcon size={13} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!canControl}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 shadow-md shadow-black/10 disabled:opacity-30"
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
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800/40 hover:text-white active:scale-95 disabled:opacity-30"
                title="Next"
              >
                <NextIcon size={13} />
              </button>

              <button
                type="button"
                onClick={toggleRepeatMode}
                disabled={!canControl}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-zinc-800/40 active:scale-95 disabled:opacity-30",
                  repeatActive ? "text-orange-500" : "text-zinc-400 hover:text-white"
                )}
                title={`Repeat: ${repeatMode}`}
              >
                <RepeatIcon size={13} />
              </button>
            </div>

            {/* Seek bar */}
            <div className="flex w-full items-center gap-2.5">
              <span className="w-9 text-right text-[9px] font-semibold text-zinc-500 tabular-nums">
                {formatDuration(progressValue)}
              </span>
              <div className="relative flex-1 py-1">
                <input
                  type="range"
                  min={0}
                  max={totalDuration || 0}
                  step={1}
                  value={totalDuration ? progressValue : 0}
                  disabled={!canControl || totalDuration === 0}
                  onInput={(event) => seek(Number(event.currentTarget.value))}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="slider-premium block w-full focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${progressPercent}%, #27272a ${progressPercent}%, #27272a 100%)`
                  }}
                  aria-label="Seek song"
                />
              </div>
              <span className="w-9 text-left text-[9px] font-semibold text-zinc-500 tabular-nums">
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: Extra controls (Queue, Mute, Volume) */}
          <div className="flex items-center justify-end gap-3">
            {playerError && (
              <span className="max-w-24 truncate text-[9px] font-semibold text-red-400" title={playerError}>
                {playerError}
              </span>
            )}

            <button
              type="button"
              disabled={!canControl}
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/40 hover:text-white transition active:scale-95 disabled:opacity-30"
              title="Queue"
            >
              <PlaylistIcon size={13} />
            </button>

            {/* Volume section */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                disabled={!canControl}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/40 hover:text-white transition active:scale-95 disabled:opacity-30"
                title={volume === 0 ? "Unmute" : "Mute"}
              >
                {volume === 0 ? (
                  <VolumeMuteIcon size={13} />
                ) : (
                  <VolumeIcon size={13} />
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
                className="slider-premium w-0 opacity-0 group-hover/volume:w-14 group-hover/volume:opacity-100 transition-all duration-300 ease-out focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${volume * 100}%, #27272a ${volume * 100}%, #27272a 100%)`
                }}
                aria-label="Volume"
              />
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
