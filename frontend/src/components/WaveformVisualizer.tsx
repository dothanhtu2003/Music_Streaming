"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { usePlayer } from "@/components/player/PlayerProvider";
import {
  getSongWaveformRequest,
  saveSongWaveformRequest,
} from "@/lib/api";
import { formatDuration } from "@/lib/song-format";
import { cn } from "@/lib/utils";
import type { Song, SongWaveform } from "@/types/music";

type WaveformVisualizerProps = {
  song: Song;
  audioUrl: string | null;
  height?: number;
};

type WaveformStatus = "loading" | "ready" | "error";

const fallbackPeakCount = 420;
const maxCachedPeakCount = 2000;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getUsableDuration(...values: Array<number | null | undefined>) {
  return values.find((value) => {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }) ?? 0;
}

function isValidPeaks(peaks: unknown): peaks is number[][] {
  if (!Array.isArray(peaks) || peaks.length === 0 || peaks.length > 2) {
    return false;
  }

  return peaks.every((channel) => {
    return (
      Array.isArray(channel) &&
      channel.length > 0 &&
      channel.length <= maxCachedPeakCount &&
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

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function buildFallbackPeaks(seed: string) {
  let state = hashString(seed) || 1;
  const peaks = Array.from({ length: fallbackPeakCount }, (_, index) => {
    state = Math.imul(state, 1664525) + 1013904223;

    const noise = ((state >>> 0) / 4294967295) * 0.55;
    const wave = Math.abs(Math.sin(index * 0.11)) * 0.35;
    const pulse = index % 17 === 0 ? 0.22 : 0;
    const amplitude = clamp(0.16 + noise + wave + pulse, 0.12, 0.95);

    return Number((index % 2 === 0 ? amplitude : -amplitude).toFixed(4));
  });

  return [peaks];
}

function exportPeaksFromAudioBuffer(audioBuffer: AudioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  const sampleSize = channelData.length / maxCachedPeakCount;
  const peaks = Array.from({ length: maxCachedPeakCount }, (_, index) => {
    const start = Math.floor(index * sampleSize);
    const end = Math.min(
      channelData.length,
      Math.ceil((index + 1) * sampleSize),
    );
    let peak = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const sample = channelData[sampleIndex] ?? 0;

      if (Math.abs(sample) > Math.abs(peak)) {
        peak = sample;
      }
    }

    return Number(clamp(peak, -1, 1).toFixed(4));
  });

  return [peaks];
}

async function generateWaveformFromAudio(audioUrl: string) {
  const response = await fetch(audioUrl);

  if (!response.ok) {
    throw new Error("Audio file could not be loaded.");
  }

  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(
      await response.arrayBuffer(),
    );
    const peaks = exportPeaksFromAudioBuffer(audioBuffer);

    if (!isValidPeaks(peaks) || audioBuffer.duration <= 0) {
      throw new Error("Audio waveform data is invalid.");
    }

    return {
      peaks,
      duration: audioBuffer.duration,
    };
  } finally {
    void audioContext.close().catch(() => undefined);
  }
}

export function WaveformVisualizer({
  song,
  audioUrl,
  height = 96,
}: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const seekToRef = useRef<(time: number) => void>(() => undefined);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const { audioRef, currentTime, duration, isPlaying, seekTo } = usePlayer();
  const [status, setStatus] = useState<WaveformStatus>("loading");
  const [waveformDuration, setWaveformDuration] = useState(song.duration_sec);
  const [loadMessage, setLoadMessage] = useState("Loading waveform...");
  const safeAudioUrl = audioUrl?.trim() || null;
  const displayDuration = getUsableDuration(
    duration,
    waveformDuration,
    song.duration_sec,
  );

  const fallbackSeed = useMemo(() => {
    return `${song.id}:${song.title}:${song.artist.name}`;
  }, [song.artist.name, song.id, song.title]);

  useEffect(() => {
    seekToRef.current = seekTo;
  }, [seekTo]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;

    if (!wavesurfer || status !== "ready" || displayDuration <= 0) {
      return;
    }

    const nextTime = clamp(currentTime, 0, displayDuration);

    try {
      wavesurfer
        .getRenderer()
        .renderProgress(nextTime / displayDuration, isPlaying);
    } catch {
      // The instance can be destroyed while React is switching songs.
    }
  }, [currentTime, displayDuration, isPlaying, status]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!containerRef.current || !audio) {
      setStatus("error");
      setLoadMessage("Waveform is not ready yet.");
      return;
    }

    let isActive = true;
    let wavesurfer: WaveSurfer | null = null;
    const unsubscribeCallbacks: Array<() => void> = [];

    setStatus("loading");
    setLoadMessage("Loading waveform...");
    setWaveformDuration(song.duration_sec);

    const initializeWaveform = async () => {
      let cachedWaveform: { peaks: number[][]; duration: number } | null = null;
      const decodeAudioUrl = safeAudioUrl || audio.currentSrc || audio.src || null;

      try {
        cachedWaveform = getCachedWaveform(
          await getSongWaveformRequest(song.id),
        );
      } catch {
        cachedWaveform = null;
      }

      if (!cachedWaveform && decodeAudioUrl) {
        try {
          cachedWaveform = await generateWaveformFromAudio(decodeAudioUrl);

          if (isActive) {
            void saveSongWaveformRequest(song.id, cachedWaveform).catch(
              () => undefined,
            );
          }
        } catch {
          cachedWaveform = null;
        }
      }

      if (!isActive || !containerRef.current || !audioRef.current) {
        return;
      }

      const mediaElement = audioRef.current;
      const mediaUrl =
        mediaElement.currentSrc || mediaElement.src || safeAudioUrl || "";
      const nextDuration = getUsableDuration(
        cachedWaveform?.duration,
        duration,
        song.duration_sec,
      );
      const renderDuration = nextDuration || 1;
      const nextPeaks =
        cachedWaveform?.peaks ?? buildFallbackPeaks(fallbackSeed);
      const canSeek = Boolean(mediaUrl) && nextDuration > 0;

      const nextWaveSurfer = WaveSurfer.create({
        container: containerRef.current,
        media: mediaElement,
        ...(mediaUrl ? { url: mediaUrl } : {}),
        peaks: nextPeaks,
        duration: renderDuration,
        waveColor: "#52525b",
      progressColor: "#ff5500",
      cursorColor: "#ff5500",
        cursorWidth: 2,
        height,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        backend: "MediaElement",
        autoplay: false,
        dragToSeek: true,
        hideScrollbar: true,
        interact: canSeek,
        normalize: true,
      });

      wavesurfer = nextWaveSurfer;
      wavesurferRef.current = nextWaveSurfer;

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("ready", (readyDuration) => {
          if (!isActive) {
            return;
          }

          const readyWaveformDuration = getUsableDuration(
            readyDuration,
            renderDuration,
          );

          setStatus("ready");
          setLoadMessage(canSeek ? "" : "Audio file is not available.");
          setWaveformDuration(readyWaveformDuration);

          if (readyWaveformDuration > 0) {
            nextWaveSurfer
              .getRenderer()
              .renderProgress(
                clamp(currentTimeRef.current, 0, readyWaveformDuration) /
                  readyWaveformDuration,
                isPlayingRef.current,
              );
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("interaction", (newTime) => {
          if (Number.isFinite(newTime)) {
            seekToRef.current(newTime);
          }
        }),
      );

      unsubscribeCallbacks.push(
        nextWaveSurfer.on("error", () => {
          if (isActive) {
            setStatus("error");
            setLoadMessage("Could not load this waveform.");
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
  }, [
    audioRef,
    duration,
    fallbackSeed,
    height,
    safeAudioUrl,
    song.duration_sec,
    song.id,
  ]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-400">
        <span>{formatDuration(currentTime)}</span>
        <span>{formatDuration(displayDuration)}</span>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70",
          status === "ready" && "cursor-pointer",
        )}
        aria-busy={status === "loading"}
        aria-label="Now playing waveform"
      >
        <div ref={containerRef} className="w-full" style={{ height }} />

        {status !== "ready" && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-950/80 px-4 text-center text-xs text-zinc-400">
            {loadMessage}
          </div>
        )}

        {status === "ready" && loadMessage && (
          <div className="absolute inset-x-0 bottom-0 bg-zinc-950/80 px-3 py-2 text-center text-xs text-zinc-500">
            {loadMessage}
          </div>
        )}
      </div>
    </div>
  );
}
