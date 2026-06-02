"use client";

import { useCallback, useEffect, useRef } from "react";

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
 * A lightweight, canvas-based waveform component.
 * Renders peaks data as vertical bars without WaveSurfer or Web Audio API.
 * Memory footprint: ~0.5KB vs ~10MB for a WaveSurfer instance.
 */
export function StaticWaveform({
  peaks,
  progress,
  height = 60,
  waveColor = "#3f3f46",
  progressColor = "#ff5500",
  barWidth = 2,
  barGap = 2,
  barRadius = 2,
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

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    // Set canvas resolution for sharp rendering on HiDPI screens
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!peaks || peaks.length === 0) {
      return;
    }

    const step = barWidth + barGap;
    const totalBars = Math.floor(canvasWidth / step);

    if (totalBars <= 0) {
      return;
    }

    // Resample peaks to fit the available width
    const sampledPeaks: number[] = [];

    for (let i = 0; i < totalBars; i++) {
      const startIndex = Math.floor((i / totalBars) * peaks.length);
      const endIndex = Math.floor(((i + 1) / totalBars) * peaks.length);
      let max = 0;

      for (let j = startIndex; j < endIndex && j < peaks.length; j++) {
        const value = Math.abs(peaks[j]);

        if (value > max) {
          max = value;
        }
      }

      sampledPeaks.push(max);
    }

    // Normalize so the tallest bar fills the height
    const peakMax = Math.max(...sampledPeaks, 0.01);

    const progressX = progress * canvasWidth;
    const minBarHeight = 2;
    const centerY = canvasHeight / 2;

    for (let i = 0; i < sampledPeaks.length; i++) {
      const normalizedValue = sampledPeaks[i] / peakMax;
      const barHeight = Math.max(normalizedValue * canvasHeight * 0.9, minBarHeight);
      const x = i * step;
      const y = centerY - barHeight / 2;

      ctx.fillStyle = x + barWidth <= progressX ? progressColor : waveColor;

      if (barRadius > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    }
  }, [peaks, progress, barWidth, barGap, barRadius, waveColor, progressColor]);

  // Draw on mount and when dependencies change
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

  // ResizeObserver for responsive resizing
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
