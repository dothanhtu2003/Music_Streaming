"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { StaticWaveform } from "@/components/song/StaticWaveform";
import { HeartIcon, PauseIcon, PlayIcon, PlusIcon } from "@/components/ui/Icons";
import {
  getSongWaveformRequest,
  saveSongWaveformRequest,
} from "@/lib/api";
import {
  formatDuration,
  formatPlayCount,
  getArtistDisplayName,
  getSongAudioUrl,
  getSongCoverUrl,
  getGenreName,
} from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores/player-store";
import type { Song, SongWaveform } from "@/types/music";

export type StreamTrackRowProps = {
  song: Song;
  queue: Song[];
};

type WaveformStatus = "idle" | "loading-peaks" | "loading-ws" | "ready" | "error" | "empty";

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

function formatRelativeTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (isNaN(date.getTime())) return "Trending";
    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;

    return `${Math.floor(diffMonths / 12)}y ago`;
  } catch {
    return "Trending";
  }
}

/** Generate a simple placeholder peaks array for tracks without cached waveform */
function generatePlaceholderPeaks(count: number): number[] {
  const peaks: number[] = [];

  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random pattern based on index
    const value =
      0.15 +
      0.3 * Math.abs(Math.sin(i * 0.4)) +
      0.2 * Math.abs(Math.cos(i * 0.7)) +
      0.1 * Math.abs(Math.sin(i * 1.3));
    peaks.push(Math.min(value, 1));
  }

  return peaks;
}

const PLACEHOLDER_PEAKS = generatePlaceholderPeaks(200);

export function StreamTrackRow({ song, queue }: StreamTrackRowProps) {
  const wavesurferContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const seekRef = useRef<(time: number) => void>(() => undefined);

  const { user } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const seek = usePlayerStore((state) => state.seek);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();
  const { isFollowing, toggleFollow, actionId } = useFollow();

  const isCurrentSong = currentSong?.id === song.id;
  const isLiked = isSongLiked(song.id);
  const likeLoading = actionSongId === song.id;
  const artistName = getArtistDisplayName(song.artist);

  const isSelf =
    Boolean(user?.id && song.artist.user_id && user.id === song.artist.user_id) ||
    user?.username?.toLowerCase() === artistName.toLowerCase();
  const isArtistFollowed = isFollowing(song.artist.id);
  const followLoading = actionId === song.artist.id;

  const audioUrl = getSongAudioUrl(song);
  const safeAudioUrl = (audioUrl ?? "").trim();
  const coverUrl = getSongCoverUrl(song);
  const fallbackLetter = song.title.trim().slice(0, 1).toUpperCase() || "M";

  // --- State ---
  const [isVisible, setIsVisible] = useState(false);
  const [cachedPeaks, setCachedPeaks] = useState<number[] | null>(null);
  const [cachedDuration, setCachedDuration] = useState<number>(song.duration_sec);
  const [status, setStatus] = useState<WaveformStatus>("idle");
  const [hasWaveSurfer, setHasWaveSurfer] = useState(false);

  const displayCurrentTime = isCurrentSong ? currentTime : 0;
  const displayDuration =
    isCurrentSong && duration > 0
      ? duration
      : cachedDuration > 0
        ? cachedDuration
        : song.duration_sec;

  // --- Refs for store values ---
  useEffect(() => {
    currentSongIdRef.current = currentSong?.id ?? null;
  }, [currentSong?.id]);

  useEffect(() => {
    seekRef.current = seek;
  }, [seek]);

  // --- IntersectionObserver: detect when row enters viewport ---
  useEffect(() => {
    const row = rowRef.current;

    if (!row) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Only need to trigger once
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(row);

    return () => {
      observer.disconnect();
    };
  }, []);

  // --- Fetch cached peaks when visible ---
  useEffect(() => {
    if (!isVisible || !safeAudioUrl) {
      if (!safeAudioUrl) {
        queueMicrotask(() => setStatus("empty"));
      }
      return;
    }

    // Already have peaks or already loading
    if (cachedPeaks) {
      return;
    }

    let isActive = true;

    queueMicrotask(() => setStatus("loading-peaks"));

    const fetchPeaks = async () => {
      try {
        const waveformData = await getSongWaveformRequest(song.id);
        const cached = getCachedWaveform(waveformData);

        if (!isActive) {
          return;
        }

        if (cached) {
          // Flatten to single channel for StaticWaveform
          setCachedPeaks(cached.peaks[0]);
          setCachedDuration(cached.duration);
          setStatus("ready");
        } else {
          // No cached peaks — use placeholder
          setCachedPeaks(null);
          setStatus("ready");
        }
      } catch {
        if (isActive) {
          // Use placeholder on error
          setCachedPeaks(null);
          setStatus("ready");
        }
      }
    };

    void fetchPeaks();

    return () => {
      isActive = false;
    };
  }, [isVisible, safeAudioUrl, song.id, cachedPeaks]);

  // --- Lazy WaveSurfer: only create when this is the active/current song ---
  useEffect(() => {
    if (!isCurrentSong || !wavesurferContainerRef.current || !safeAudioUrl) {
      return;
    }

    // Already have a WaveSurfer for this song
    if (wavesurferRef.current) {
      return;
    }

    let isActive = true;
    let wavesurfer: WaveSurfer | null = null;
    let savedGeneratedPeaks = false;
    const unsubscribeCallbacks: Array<() => void> = [];

    setStatus("loading-ws");

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

        await saveSongWaveformRequest(song.id, {
          peaks,
          duration: nextDuration,
        });

        // Update cached peaks so StaticWaveform uses real data next time
        if (isActive && peaks[0]) {
          setCachedPeaks(peaks[0]);
        }
      } catch {
        // Peaks saving fails silently
      }
    };

    const initializeWaveform = async () => {
      // Dynamic import WaveSurfer — only loaded when needed
      const WaveSurferModule = (await import("wavesurfer.js")).default;

      if (!isActive || !wavesurferContainerRef.current) {
        return;
      }

      // Build peaks for WaveSurfer from cached data
      let wsPeaks: number[][] | undefined;
      let wsDuration: number | undefined;

      if (cachedPeaks) {
        wsPeaks = [cachedPeaks];
        wsDuration = cachedDuration > 0 ? cachedDuration : undefined;
      }

      const nextWaveSurfer = WaveSurferModule.create({
        container: wavesurferContainerRef.current,
        waveColor: "#3f3f46",
        progressColor: "#ff5500",
        cursorColor: "transparent",
        height: 60,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        autoplay: false,
        dragToSeek: true,
        hideScrollbar: true,
        interact: true,
        normalize: true,
        url: safeAudioUrl,
        peaks: wsPeaks,
        duration: wsDuration,
      });

      wavesurfer = nextWaveSurfer;
      nextWaveSurfer.setMuted(true);
      nextWaveSurfer.setVolume(0);
      stopWaveSurferAudio(nextWaveSurfer);
      wavesurferRef.current = nextWaveSurfer;
      setHasWaveSurfer(true);

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("ready", () => {
          if (!isActive) {
            return;
          }

          stopWaveSurferAudio(nextWaveSurfer);

          const nextDuration =
            nextWaveSurfer.getDuration() ||
            cachedDuration ||
            song.duration_sec;

          setStatus("ready");
          setCachedDuration(nextDuration);

          if (!cachedPeaks) {
            void saveGeneratedPeaks(nextWaveSurfer);
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("error", () => {
          if (isActive) {
            setStatus("error");
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("interaction", (newTime) => {
          stopWaveSurferAudio(nextWaveSurfer);

          if (
            song.id &&
            currentSongIdRef.current === song.id &&
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
        setHasWaveSurfer(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentSong, safeAudioUrl, song.id]);

  // --- Synchronize WaveSurfer seek head with player state ---
  useEffect(() => {
    const wavesurfer = wavesurferRef.current;

    if (!wavesurfer || !isCurrentSong) {
      return;
    }

    stopWaveSurferAudio(wavesurfer);

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
  }, [currentTime, isCurrentSong, isPlaying]);

  // --- Destroy WaveSurfer when song is no longer current ---
  useEffect(() => {
    if (!isCurrentSong && wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
      setHasWaveSurfer(false);
      // Reset status back to ready (static waveform)
      if (status === "loading-ws") {
        queueMicrotask(() => setStatus("ready"));
      }
    }
  }, [isCurrentSong, status]);

  const handlePlayToggle = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isCurrentSong) {
      togglePlay();
      return;
    }
    playSong(song, queue.length ? queue : [song]);
  };

  const handleStaticWaveformSeek = useCallback(
    (progress: number) => {
      if (isCurrentSong && displayDuration > 0) {
        // Seek in the active player
        seekRef.current(progress * displayDuration);
      } else {
        // Start playing the song from this position
        playSong(song, queue.length ? queue : [song]);
        // Seek after a small delay to let the player initialize
        setTimeout(() => {
          const dur = displayDuration > 0 ? displayDuration : song.duration_sec;
          if (dur > 0) {
            seekRef.current(progress * dur);
          }
        }, 300);
      }
    },
    [isCurrentSong, displayDuration, playSong, song, queue],
  );

  // Compute static waveform progress (0-1) for non-active tracks
  const staticProgress =
    isCurrentSong && displayDuration > 0
      ? displayCurrentTime / displayDuration
      : 0;

  // Should we show the real WaveSurfer container or the static fallback?
  const showWaveSurfer = isCurrentSong && hasWaveSurfer;

  return (
    <article
      ref={rowRef}
      className={cn(
        "group/row flex flex-col gap-4 rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/40 md:flex-row md:gap-5",
        isCurrentSong && "border-orange-500/20 bg-orange-500/[0.01]",
      )}
    >
      {/* Cover Art Left (Responsive) */}
      <div
        onClick={handlePlayToggle}
        className="relative mx-auto aspect-square w-full max-w-[160px] shrink-0 cursor-pointer overflow-hidden rounded-lg bg-zinc-900 md:mx-0 md:h-[152px] md:w-[152px]"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`${song.title} cover`}
            draggable={false}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover/row:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-500/10 to-zinc-950 transition-transform duration-500 group-hover/row:scale-105">
            <span className="text-4xl font-black text-orange-500/70">
              {fallbackLetter}
            </span>
          </div>
        )}

        {/* Center Hover Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover/row:opacity-100">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-orange-950 shadow-xl transition hover:scale-105 hover:bg-orange-400 active:scale-95"
            aria-label={isCurrentSong && isPlaying ? "Pause song" : "Play song"}
          >
            {isCurrentSong && isPlaying ? (
              <PauseIcon size={16} className="text-orange-950" />
            ) : (
              <PlayIcon size={16} className="ml-0.5 text-orange-950" />
            )}
          </button>
        </div>

        {/* Dynamic Mini Equalizer bars */}
        {isCurrentSong && isPlaying && (
          <div className="absolute bottom-2.5 left-2.5 flex items-end gap-[3px] bg-black/75 backdrop-blur-md px-2 py-1 rounded-md h-5 z-10 border border-white/5">
            <span className="eq-bar eq-bar-1 h-3.5" />
            <span className="eq-bar eq-bar-2 h-3.5" />
            <span className="eq-bar eq-bar-3 h-3.5" />
            <span className="eq-bar eq-bar-4 h-3.5" />
          </div>
        )}
      </div>

      {/* Main content right */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div>
          {/* Header Row: Artist and Upload Time */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/artists/${song.artist.id}`}
                className="truncate font-medium text-zinc-400 hover:text-orange-500"
              >
                {artistName}
              </Link>
              {!isSelf && (
                <>
                  <span className="text-zinc-700">•</span>
                  <button
                    type="button"
                    disabled={followLoading}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void toggleFollow(song.artist.id, artistName);
                    }}
                    className={cn(
                      "font-semibold text-zinc-500 transition hover:text-zinc-200",
                      isArtistFollowed && "text-orange-500 hover:text-orange-400",
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
            <span className="shrink-0 text-zinc-500">
              {formatRelativeTime(song.created_at)}
            </span>
          </div>

          {/* Title Row: Title + Genre */}
          <div className="mt-2 flex items-center justify-between gap-4">
            <Link href={`/songs/${song.id}`} className="min-w-0 flex-1">
              <h3
                className={cn(
                  "truncate text-base font-extrabold text-zinc-100 hover:text-orange-500 transition-colors duration-200 sm:text-lg",
                  isCurrentSong && "text-orange-500",
                )}
              >
                {song.title}
              </h3>
            </Link>

            <span className="hidden shrink-0 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400 sm:inline-block">
              #{getGenreName(song)}
            </span>
          </div>
        </div>

        {/* Waveform Visualization area */}
        <div className="relative">
          {/* Real WaveSurfer container — only mounted for active track */}
          <div
            ref={wavesurferContainerRef}
            className={cn(
              "h-[60px] w-full rounded-md transition-opacity duration-300",
              !showWaveSurfer && "hidden",
              status === "loading-ws" && "opacity-20 pointer-events-none",
            )}
          />

          {/* Static canvas waveform — shown for non-active tracks */}
          {!showWaveSurfer && (
            <>
              {status === "idle" || status === "loading-peaks" ? (
                <div className="h-[60px] w-full rounded-md flex items-center justify-center">
                  <div className="text-xs text-zinc-500 font-medium">
                    {status === "loading-peaks" ? "Loading waveform..." : ""}
                  </div>
                  {/* Show placeholder waveform during loading */}
                  <StaticWaveform
                    peaks={PLACEHOLDER_PEAKS}
                    progress={0}
                    height={60}
                    waveColor="#27272a"
                    progressColor="#ff5500"
                    className="absolute inset-0 rounded-md opacity-40"
                  />
                </div>
              ) : status === "empty" ? (
                <div className="h-[60px] w-full rounded-md flex items-center justify-center text-xs text-zinc-500 font-medium">
                  Audio source is missing
                </div>
              ) : status === "error" ? (
                <div className="h-[60px] w-full rounded-md flex items-center justify-center text-xs text-zinc-500 font-medium">
                  Waveform unavailable
                </div>
              ) : (
                <StaticWaveform
                  peaks={cachedPeaks ?? PLACEHOLDER_PEAKS}
                  progress={staticProgress}
                  height={60}
                  waveColor={cachedPeaks ? "#3f3f46" : "#27272a"}
                  progressColor="#ff5500"
                  onSeek={handleStaticWaveformSeek}
                  className="rounded-md"
                />
              )}
            </>
          )}

          {/* Loading state for WaveSurfer */}
          {isCurrentSong && status === "loading-ws" && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 font-medium">
              Initializing waveform...
            </div>
          )}

          {/* Scrub times shown on hover or when playing */}
          {(status === "ready" || showWaveSurfer) && (
            <div className="pointer-events-none absolute right-1.5 bottom-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold tracking-wider text-orange-500 border border-white/5 backdrop-blur-[2px]">
              {formatDuration(displayCurrentTime)} / {formatDuration(displayDuration)}
            </div>
          )}
        </div>

        {/* Footer Area: Actions bar and Stats */}
        <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Like button */}
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
                "inline-flex h-8 items-center gap-1.5 rounded border border-zinc-900 bg-zinc-950/20 px-3 text-xs font-semibold text-zinc-400 transition hover:border-zinc-800 hover:text-white active:scale-95 disabled:opacity-50",
                isLiked && "border-orange-500/20 bg-orange-500/5 text-orange-500 hover:text-orange-400",
              )}
              title={isLiked ? "Unlike" : "Like"}
            >
              <HeartIcon size={13} filled={isLiked} />
              <span>{isLiked ? "Liked" : "Like"}</span>
            </button>

            {/* Repost (SoundCloud vibe placeholder) */}
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-900 bg-zinc-950/20 px-3 text-xs font-semibold text-zinc-400 transition hover:border-zinc-800 hover:text-white active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="hidden sm:inline">Repost</span>
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void navigator.clipboard.writeText(`${window.location.origin}/songs/${song.id}`);
                alert("Link copied to clipboard!");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-900 bg-zinc-950/20 px-3 text-xs font-semibold text-zinc-400 transition hover:border-zinc-800 hover:text-white active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" x2="12" y1="2" y2="15" />
              </svg>
              <span>Share</span>
            </button>

            {/* Add to Playlist */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openAddSongModal(song);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-900 bg-zinc-950/20 px-3 text-xs font-semibold text-zinc-400 transition hover:border-zinc-800 hover:text-white active:scale-95"
              title="Add to playlist"
            >
              <PlusIcon size={12} />
              <span className="hidden sm:inline">Add to Playlist</span>
            </button>
          </div>

          {/* Stats count */}
          <div className="flex items-center gap-3.5 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              {formatPlayCount(song.play_count)}
            </span>
            <span className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>{Math.floor(song.play_count / 15) + (isLiked ? 1 : 0)}</span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
