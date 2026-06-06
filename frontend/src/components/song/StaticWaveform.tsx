"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  drawSoundCloudWaveform,
  WAVEFORM_BAR,
  WAVEFORM_COLORS,
} from "@/lib/waveform";

export type StaticWaveformProps = {
  /** Normalized peak values (-1 to 1 or 0 to 1) */
  peaks: number[];
  /** Current playback progress from 0 to 1 */
  progress: number;
  /** Canvas height in CSS pixels */
  height?: number;
  /** Color for the unplayed portion of the waveform */
  waveColor?: string;
  /** Color for the played portion of the waveform */
  progressColor?: string;
  /** Bar width in pixels */
  barWidth?: number;
  /** Gap between bars in pixels */
  barGap?: number;
  /** Bar border radius */
  barRadius?: number;
  /** Called with a value 0-1 when user clicks to seek */
  onSeek?: (progress: number) => void;
  /** Additional CSS class */
  className?: string;
};

/**
 * Lightweight canvas waveform with SoundCloud-style asymmetric mirroring.
 */
export function StaticWaveform({
  peaks,
  progress,
  height = 60,
  waveColor = WAVEFORM_COLORS.staticWave,
  progressColor = WAVEFORM_COLORS.progress,
  barWidth = WAVEFORM_BAR.width,
  barGap = WAVEFORM_BAR.gap,
  barRadius = WAVEFORM_BAR.radius,
  onSeek,
  className,
}: StaticWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    canvas.width = canvasWidth * pixelRatio;
    canvas.height = canvasHeight * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!peaks?.length) {
      return;
    }

    drawSoundCloudWaveform(ctx, {
      peaks,
      width: canvasWidth,
      height: canvasHeight,
      waveColor,
      progressColor,
      progress,
      pixelRatio: 1,
      barWidth,
      barGap,
      barRadius,
    });
  }, [
    peaks,
    progress,
    barWidth,
    barGap,
    barRadius,
    waveColor,
    progressColor,
  ]);

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [draw]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !canvasRef.current) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const nextProgress = Math.max(0, Math.min(1, clickX / rect.width));

    onSeek(nextProgress);
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, position: "relative" }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: onSeek ? "pointer" : "default",
        }}
      />
    </div>
  );
}
