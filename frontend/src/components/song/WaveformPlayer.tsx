"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { useAuth } from "@/components/auth/AuthProvider";
import { PauseIcon, PlayIcon, VerifiedBadge } from "@/components/ui/Icons";
import {
  getSongWaveformRequest,
  resolveApiAssetUrl,
  saveSongWaveformRequest,
} from "@/lib/api";
import {
  formatDuration,
  getSongCoverUrl,
  getGenreName,
  formatPlayCount,
  getArtistAvatarUrl,
} from "@/lib/song-format";
import {
  getWaveSurferBarOptions,
  preparePeaks,
} from "@/lib/waveform";
import { cn } from "@/lib/utils";
import { usePlayerStore, type RecentlyPlayedContext } from "@/stores/player-store";
import type { Song, SongWaveform } from "@/types/music";

export type WaveformMarker = {
  id: string;
  timeSeconds?: number;
  time_seconds?: number;
  label?: string;
  username?: string;
  content?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
};

export type WaveformPlayerProps = {
  song: Song;
  audioUrl: string;
  queue?: Song[];
  height?: number;
  markers?: WaveformMarker[];
  variant?: "player-only" | "soundcloud";
  recentlyPlayedContext?: RecentlyPlayedContext;
};

type WaveformStatus = "empty" | "loading" | "ready" | "error";

const waveformExportPeakCount = 2000;

function stopWaveSurferAudio(wavesurfer: WaveSurfer) {
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
  }
}

function isValidPeaks(peaks: unknown): peaks is number[][] {
  if (!Array.isArray(peaks) || peaks.length === 0 || peaks.length > 2) {
    return false;
  }

  return peaks.every((channel) => {
    return (
      Array.isArray(channel) &&
      channel.length > 0 &&
      channel.length <= waveformExportPeakCount &&
      channel.every((value) => {
        return (
          typeof value === "number" &&
          Number.isFinite(value) &&
          value >= -1 &&
          value <= 1
        );
      })
    );
  });
}

function getCachedWaveform(
  waveform: SongWaveform | null,
): { peaks: number[][]; duration: number } | null {
  if (
    !waveform ||
    !isValidPeaks(waveform.peaks) ||
    !waveform.duration ||
    !Number.isFinite(waveform.duration) ||
    waveform.duration <= 0
  ) {
    return null;
  }

  return {
    peaks: waveform.peaks,
    duration: waveform.duration,
  };
}

function getMarkerTime(marker: WaveformMarker) {
  return marker.timeSeconds ?? marker.time_seconds ?? 0;
}

function getMarkerAvatar(marker: WaveformMarker) {
  return resolveApiAssetUrl(marker.avatarUrl ?? marker.avatar_url);
}

export function WaveformPlayer({
  song,
  audioUrl,
  queue,
  height,
  markers = [],
  variant = "player-only",
  recentlyPlayedContext = null,
}: WaveformPlayerProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const seekRef = useRef<(time: number) => void>(() => undefined);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const seek = usePlayerStore((state) => state.seek);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const safeAudioUrl = (audioUrl ?? "").trim();
  const safeSongId = song.id;
  const isCurrentSong = currentSong?.id === safeSongId;
  const isWaveformPlaying = isCurrentSong && isPlaying;
  const displayCurrentTime = isCurrentSong ? currentTime : 0;
  const [waveformDuration, setWaveformDuration] = useState(song.duration_sec);
  const displayDuration =
    isCurrentSong && duration > 0
      ? duration
      : waveformDuration > 0
        ? waveformDuration
        : song.duration_sec;
  const [status, setStatus] = useState<WaveformStatus>(
    safeAudioUrl ? "loading" : "empty",
  );
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const visibleMarkers = markers
    .map((marker) => {
      const time = getMarkerTime(marker);
      const percent = displayDuration > 0 ? (time / displayDuration) * 100 : 0;

      return { marker, time, percent };
    })
    .filter(({ time, percent }) => {
      return (
        displayDuration > 0 &&
        Number.isFinite(time) &&
        time >= 0 &&
        percent >= 0 &&
        percent <= 100
      );
    });

  useEffect(() => {
    currentSongIdRef.current = currentSong?.id ?? null;
  }, [currentSong?.id]);

  useEffect(() => {
    seekRef.current = seek;
  }, [seek]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;

    if (!wavesurfer || status !== "ready") {
      return;
    }

    stopWaveSurferAudio(wavesurfer);

    if (!isCurrentSong) {
      if (wavesurfer.getCurrentTime() !== 0) {
        wavesurfer.setTime(0);
      }

      return;
    }

    if (!Number.isFinite(currentTime)) {
      return;
    }

    const currentWaveformDuration = wavesurfer.getDuration();

    if (!currentWaveformDuration) {
      return;
    }

    const nextTime = Math.min(currentTime, currentWaveformDuration);

    if (Math.abs(wavesurfer.getCurrentTime() - nextTime) > 0.25) {
      wavesurfer.setTime(nextTime);
    }
  }, [currentTime, isCurrentSong, isPlaying, status]);

  useEffect(() => {
    if (!containerRef.current || !safeAudioUrl) {
      setStatus("empty");
      setLoadProgress(0);
      setErrorMessage(null);
      setWaveformDuration(song.duration_sec);
      return;
    }

    let isActive = true;
    let wavesurfer: WaveSurfer | null = null;
    let savedGeneratedPeaks = false;
    const unsubscribeCallbacks: Array<() => void> = [];

    setStatus("loading");
    setLoadProgress(0);
    setErrorMessage(null);
    setWaveformDuration(song.duration_sec);

    const saveGeneratedPeaks = async (targetWaveSurfer: WaveSurfer) => {
      if (savedGeneratedPeaks) {
        return;
      }

      savedGeneratedPeaks = true;

      try {
        const nextDuration = targetWaveSurfer.getDuration();

        if (!Number.isFinite(nextDuration) || nextDuration <= 0) {
          return;
        }

        const peaks = targetWaveSurfer.exportPeaks({
          channels: 1,
          maxLength: waveformExportPeakCount,
          precision: 10000,
        });

        if (!isValidPeaks(peaks)) {
          return;
        }

        await saveSongWaveformRequest(safeSongId, {
          peaks,
          duration: nextDuration,
        });
      } catch {
        // Waveform rendering still works without a persisted cache.
      }
    };

    const initializeWaveform = async () => {
      let cachedWaveform: { peaks: number[][]; duration: number } | null = null;

      try {
        cachedWaveform = getCachedWaveform(
          await getSongWaveformRequest(safeSongId),
        );
      } catch {
        cachedWaveform = null;
      }

      if (!isActive || !containerRef.current) {
        return;
      }

      const nextWaveSurfer = WaveSurfer.create({
        container: containerRef.current,
        ...getWaveSurferBarOptions({ height: height ?? 80 }),
        autoplay: false,
        dragToSeek: true,
        hideScrollbar: true,
        interact: true,
        url: safeAudioUrl,
        peaks: cachedWaveform?.peaks
          ? preparePeaks(cachedWaveform.peaks)
          : undefined,
        duration: cachedWaveform?.duration,
      });

      wavesurfer = nextWaveSurfer;
      nextWaveSurfer.setMuted(true);
      nextWaveSurfer.setVolume(0);
      stopWaveSurferAudio(nextWaveSurfer);
      wavesurferRef.current = nextWaveSurfer;

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("loading", (progress) => {
          if (isActive) {
            setLoadProgress(Math.round(progress));
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("ready", () => {
          if (!isActive) {
            return;
          }

          stopWaveSurferAudio(nextWaveSurfer);

          const nextDuration =
            nextWaveSurfer.getDuration() ||
            cachedWaveform?.duration ||
            song.duration_sec;

          setStatus("ready");
          setLoadProgress(100);
          setWaveformDuration(nextDuration);

          if (!cachedWaveform) {
            void saveGeneratedPeaks(nextWaveSurfer);
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("error", (waveformError) => {
          if (isActive) {
            setStatus("error");
            setErrorMessage(
              waveformError.message || "Could not load this audio waveform.",
            );
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("interaction", (newTime) => {
          stopWaveSurferAudio(nextWaveSurfer);

          if (
            safeSongId &&
            currentSongIdRef.current === safeSongId &&
            Number.isFinite(newTime)
          ) {
            seekRef.current(newTime);
            return;
          }

          if (nextWaveSurfer.getCurrentTime() !== 0) {
            nextWaveSurfer.setTime(0);
          }
        }),
      );
    };

    void initializeWaveform();

    return () => {
      isActive = false;
      unsubscribeCallbacks.forEach((unsubscribe) => unsubscribe());

      if (wavesurfer) {
        wavesurfer.destroy();
      }

      if (wavesurferRef.current === wavesurfer) {
        wavesurferRef.current = null;
      }
    };
  }, [height, safeAudioUrl, safeSongId, song.duration_sec]);

  const handleTogglePlay = () => {
    if (!safeAudioUrl) {
      return;
    }

    if (isCurrentSong) {
      togglePlay();
      return;
    }

    playSong(song, queue?.length ? queue : [song], recentlyPlayedContext);
  };

  if (variant === "soundcloud") {
    const coverUrl = getSongCoverUrl(song);
    const artistAvatar = getArtistAvatarUrl(song.artist);

    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl sm:p-8">
        {/* Subtle Ambient background glow from cover */}
        {coverUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-125 pointer-events-none transition-opacity duration-700"
            style={{ backgroundImage: `url(${coverUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,85,0,0.12),transparent_60%)] pointer-events-none" />
        )}

        {/* Dark contrast gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/85 to-zinc-950/60 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-stretch gap-6 lg:gap-8">
          {/* LEFT COLUMN: Large Cover Image with Depth & Glow */}
          <div className="relative group shrink-0 self-center md:self-auto">
            {coverUrl && (
              <div
                className="absolute -inset-1.5 rounded-2xl bg-cover bg-center blur-xl opacity-40 group-hover:opacity-60 transition duration-500"
                style={{ backgroundImage: `url(${coverUrl})` }}
                aria-hidden="true"
              />
            )}

            <div className="relative h-52 w-52 sm:h-56 sm:w-56 md:h-60 md:w-60 lg:h-64 lg:w-64 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20 border border-white/10 transition-transform duration-300 group-hover:scale-[1.02]">
              {coverUrl ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${coverUrl})` }}
                  aria-label={`${song.title} cover`}
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-500 to-zinc-900 text-6xl font-black text-white/90">
                  {song.title.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Metadata & Playback Area */}
          <div className="flex flex-col justify-between flex-1 min-w-0 w-full space-y-5">
            {/* Top section: Badges + Title + Artist */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-400 border border-orange-500/25 backdrop-blur-sm">
                  {getGenreName(song) || "Track"}
                </span>
                <span className="rounded-md bg-zinc-900/80 border border-white/10 px-2.5 py-0.5 text-[10px] font-medium text-zinc-300 backdrop-blur-sm">
                  {song.album ? song.album.title : "Single"}
                </span>
              </div>

              <h1 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl tracking-tight leading-tight line-clamp-2">
                {song.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400 pt-0.5">
                <Link
                  href={`/artists/${song.artist.id}`}
                  className="font-bold text-zinc-200 hover:text-orange-400 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  {artistAvatar && (
                    <span
                      className="h-5 w-5 rounded-full bg-cover bg-center ring-1 ring-white/20 inline-block"
                      style={{ backgroundImage: `url(${artistAvatar})` }}
                    />
                  )}
                  <span>{song.artist.name}</span>
                  {song.artist.is_verified && <VerifiedBadge size={13} />}
                </Link>
                {user && (user.id === song.artist.user_id || user.username?.toLowerCase() === song.artist.name?.toLowerCase()) && (
                  <span className="inline-flex items-center rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/25" title="This is you">
                    Bạn
                  </span>
                )}
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-400 font-medium">{formatPlayCount(song.play_count)} plays</span>
              </div>
            </div>

            {/* Bottom section: Play Button + Waveform side-by-side */}
            <div className="flex items-center gap-4 pt-2">
              {/* Circular Play Button */}
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!safeAudioUrl}
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-500 text-orange-950 transition-all duration-200 hover:bg-orange-400 hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/25 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 sm:h-16 sm:w-16",
                  isWaveformPlaying && "bg-white text-black hover:bg-zinc-200",
                )}
                aria-label={isWaveformPlaying ? "Pause" : "Play"}
              >
                {isWaveformPlaying ? (
                  <PauseIcon size={22} />
                ) : (
                  <PlayIcon size={22} className="ml-0.5" />
                )}
              </button>

              {/* Waveform Player */}
              <div className="relative flex-1 min-w-0">
                {/* Loading/Error overlays */}
                {status !== "ready" && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/70 rounded-xl backdrop-blur-sm">
                    {status === "loading" && (
                      <span className="text-xs font-medium text-zinc-400 animate-pulse">
                        Loading Waveform{loadProgress > 0 ? ` ${loadProgress}%` : "..."}
                      </span>
                    )}
                    {status === "error" && (
                      <span className="text-xs font-semibold text-red-400">
                        {errorMessage ?? "Waveform load failed"}
                      </span>
                    )}
                    {status === "empty" && (
                      <span className="text-xs font-semibold text-zinc-500">
                        Audio is not available.
                      </span>
                    )}
                  </div>
                )}

                {/* Waveform visualizer container */}
                <div
                  className={cn(
                    "relative overflow-hidden rounded-xl py-1 bg-zinc-900/30 border border-white/5 px-2",
                    status === "ready" && "cursor-pointer",
                  )}
                  aria-busy={status === "loading"}
                >
                  <div
                    ref={containerRef}
                    className="h-16 w-full md:h-20 min-h-[64px]"
                    style={height ? { height } : undefined}
                  />

                  {/* Float markers */}
                  {visibleMarkers.length > 0 && (
                    <div className="pointer-events-none absolute inset-x-2 top-2 bottom-2 z-10">
                      {visibleMarkers.map(({ marker, percent, time }) => {
                        const avatarUrl = getMarkerAvatar(marker);

                        return (
                          <div
                            key={marker.id}
                            className="group pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${percent}%` }}
                          >
                            {avatarUrl ? (
                              <span
                                className="block h-6 w-6 rounded-full border-2 border-orange-400 bg-zinc-950 bg-cover bg-center shadow-lg"
                                style={{ backgroundImage: `url(${avatarUrl})` }}
                                aria-label={marker.username ?? marker.label ?? "Marker"}
                              />
                            ) : (
                              <span className="block h-3 w-3 rounded-full border-2 border-orange-300 bg-orange-500 shadow-lg shadow-orange-500/30" />
                            )}

                            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-56 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-200 opacity-0 shadow-xl transition group-hover:opacity-100">
                              <span className="block font-semibold text-white">
                                {marker.username ?? marker.label ?? "Marker"}
                              </span>
                              <span className="mt-1 block text-zinc-400">
                                {formatDuration(time)}
                              </span>
                              {marker.content && (
                                <span className="mt-1 block whitespace-normal text-zinc-300">
                                  {marker.content}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="absolute left-2 bottom-1 z-10 rounded bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-bold text-orange-400 font-mono select-none border border-white/5">
                    {formatDuration(displayCurrentTime)}
                  </div>
                  <div className="absolute right-2 bottom-1 z-10 rounded bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-bold text-zinc-400 font-mono select-none border border-white/5">
                    {formatDuration(displayDuration)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT player-only VARIANT
  return (
    <div className="w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-400">
                {isCurrentSong ? "Now playing" : "Waveform"}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {song.title}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <span>{formatDuration(displayCurrentTime)}</span>
              <span className="text-zinc-600">/</span>
              <span>{formatDuration(displayDuration)}</span>
            </div>
          </div>

          {status !== "ready" && (
            <div className="mt-3 flex min-h-5 items-center justify-between gap-3">
              {status === "loading" && (
                <span className="text-xs text-zinc-500">
                  Loading{loadProgress > 0 ? ` ${loadProgress}%` : "..."}
                </span>
              )}
              {status === "error" && (
                <span className="text-xs font-medium text-red-400">
                  Waveform load failed
                </span>
              )}
              {status === "empty" && (
                <span className="text-xs text-zinc-500">
                  Audio file is not available.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative mt-3 overflow-hidden rounded-xl",
          status === "ready" && "cursor-pointer",
        )}
        aria-busy={status === "loading"}
      >
        <div
          ref={containerRef}
          className="h-16 w-full md:h-24"
          style={height ? { height } : undefined}
        />

        {visibleMarkers.length > 0 && (
          <div className="pointer-events-none absolute inset-x-2 top-2 bottom-2 z-10">
            {visibleMarkers.map(({ marker, percent, time }) => {
              const avatarUrl = getMarkerAvatar(marker);

              return (
                <div
                  key={marker.id}
                  className="group pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${percent}%` }}
                >
                  {avatarUrl ? (
                    <span
                      className="block h-6 w-6 rounded-full border-2 border-orange-400 bg-zinc-950 bg-cover bg-center shadow-lg"
                      style={{ backgroundImage: `url(${avatarUrl})` }}
                      aria-label={marker.username ?? marker.label ?? "Marker"}
                    />
                  ) : (
                    <span className="block h-3 w-3 rounded-full border-2 border-orange-300 bg-orange-500 shadow-lg shadow-orange-500/30" />
                  )}

                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-56 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-200 opacity-0 shadow-xl transition group-hover:opacity-100">
                    <span className="block font-semibold text-white">
                      {marker.username ?? marker.label ?? "Marker"}
                    </span>
                    <span className="mt-1 block text-zinc-400">
                      {formatDuration(time)}
                    </span>
                    {marker.content && (
                      <span className="mt-1 block whitespace-normal text-zinc-300">
                        {marker.content}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {status === "empty" && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 px-4 text-center text-sm text-zinc-500">
            Audio file is not available.
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-950/85 px-4 text-center text-sm text-red-300">
            {errorMessage ?? "Could not load this audio waveform."}
          </div>
        )}
      </div>
    </div>
  );
}
