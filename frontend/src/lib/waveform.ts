export const WAVEFORM_COLORS = {
  wave: "rgba(255, 255, 255, 0.88)",
  progress: "#ff5500",
  cursor: "transparent",
  staticWave: "rgba(255, 255, 255, 0.88)",
  placeholderWave: "rgba(255, 255, 255, 0.2)",
  centerLine: "#000000",
} as const;

export const WAVEFORM_BAR = {
  width: 2,
  gap: 1,
  radius: 1,
  minHeight: 2,
  /** Max top-bar height as a fraction of half the canvas. */
  heightScale: 0.92,
  /** Bottom reflection height relative to the top bar (SoundCloud shadow). */
  bottomReflectionRatio: 0.3,
  shapeExponent: 1.0,
  floor: 0.005,
  showCenterLine: true,
} as const;

export type SoundCloudWaveformDrawOptions = {
  peaks: number[];
  width: number;
  height: number;
  waveColor: string;
  progressColor: string;
  progress?: number;
  pixelRatio?: number;
  barWidth?: number;
  barGap?: number;
  barRadius?: number;
};

export function resolveWaveformHeight(
  height?: number | "auto",
  fallback = 64,
): number {
  return typeof height === "number" && Number.isFinite(height) ? height : fallback;
}

function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (height <= 0) {
    return;
  }

  if (radius > 0 && "roundRect" in ctx) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }

  ctx.fillRect(x, y, width, height);
}

export function samplePeaksForWidth(
  peaks: number[],
  width: number,
  barWidth: number,
  barGap: number,
): number[] {
  const step = barWidth + barGap;
  const totalBars = Math.floor(width / step);

  if (totalBars <= 0) {
    return [];
  }

  const sampledPeaks: number[] = [];

  for (let index = 0; index < totalBars; index += 1) {
    const startIndex = Math.floor((index / totalBars) * peaks.length);
    const endIndex = Math.floor(((index + 1) / totalBars) * peaks.length);
    let max = 0;

    for (
      let sampleIndex = startIndex;
      sampleIndex < endIndex && sampleIndex < peaks.length;
      sampleIndex += 1
    ) {
      max = Math.max(max, Math.abs(peaks[sampleIndex]));
    }

    sampledPeaks.push(max);
  }

  return sampledPeaks;
}

/** SoundCloud-style asymmetric mirrored bars from a center baseline. */
export function drawSoundCloudWaveform(
  ctx: CanvasRenderingContext2D,
  options: SoundCloudWaveformDrawOptions,
) {
  const {
    peaks,
    width,
    height,
    waveColor,
    progressColor,
    progress,
    pixelRatio = 1,
    barWidth = WAVEFORM_BAR.width,
    barGap = WAVEFORM_BAR.gap,
    barRadius = WAVEFORM_BAR.radius,
  } = options;

  if (!peaks.length || width <= 0 || height <= 0) {
    return;
  }

  const scaledBarWidth = barWidth * pixelRatio;
  const scaledBarGap = barGap * pixelRatio;
  const scaledRadius = barRadius * pixelRatio;
  const minBarHeight = WAVEFORM_BAR.minHeight * pixelRatio;
  const sampledPeaks = samplePeaksForWidth(
    peaks,
    width,
    scaledBarWidth,
    scaledBarGap,
  );

  if (!sampledPeaks.length) {
    return;
  }

  const peakMax = Math.max(...sampledPeaks, 0.01);
  const step = scaledBarWidth + scaledBarGap;
  const centerY = height * 0.7;
  const maxTopHeight = centerY * WAVEFORM_BAR.heightScale;
  const progressX =
    progress !== undefined ? progress * width : undefined;

  if (WAVEFORM_BAR.showCenterLine) {
    ctx.fillStyle = WAVEFORM_COLORS.centerLine;
    ctx.fillRect(0, Math.floor(centerY), width, Math.max(1, pixelRatio));
  }

  for (let index = 0; index < sampledPeaks.length; index += 1) {
    const normalized = sampledPeaks[index] / peakMax;
    const shaped = Math.pow(normalized, WAVEFORM_BAR.shapeExponent);
    const magnitude = Math.max(shaped, WAVEFORM_BAR.floor);
    const topHeight = Math.max(magnitude * maxTopHeight, minBarHeight);
    const bottomHeight = Math.max(
      topHeight * WAVEFORM_BAR.bottomReflectionRatio,
      minBarHeight * 0.6,
    );
    const x = index * step;
    const isPlayed =
      progressX !== undefined ? x + scaledBarWidth <= progressX : false;

    ctx.fillStyle = isPlayed ? progressColor : waveColor;

    drawRoundedBar(
      ctx,
      x,
      centerY - topHeight,
      scaledBarWidth,
      topHeight,
      scaledRadius,
    );

    // Draw bottom reflection bar with a lighter opacity (SoundCloud style shadow)
    ctx.save();
    ctx.globalAlpha = ctx.globalAlpha * 0.35;
    drawRoundedBar(
      ctx,
      x,
      centerY,
      scaledBarWidth,
      bottomHeight,
      scaledRadius,
    );
    ctx.restore();
  }
}

/** Shape peaks into positive magnitudes with preserved dynamics. */
export function preparePeakChannel(channel: number[]): number[] {
  let maxVal = 0;

  const magnitudes = channel.map((value) => {
    const abs = Math.abs(value);

    if (abs > maxVal) {
      maxVal = abs;
    }

    return abs;
  });

  if (maxVal === 0) {
    return magnitudes;
  }

  const softClip = (x: number) => x / (1 + Math.abs(x) * 0.1);

  return magnitudes.map((abs) => {
    const normalized = abs / maxVal;
    const expanded = Math.pow(normalized, 2.2);
    const clipped = softClip(expanded);
    const scaled = clipped * WAVEFORM_BAR.heightScale;

    return Number(Math.max(scaled, WAVEFORM_BAR.floor).toFixed(4));
  });
}

export function preparePeaks(peaks: number[][]): number[][] {
  return peaks.map(preparePeakChannel);
}

function getCanvasPixelRatio(canvas: HTMLCanvasElement) {
  const styleWidth = parseFloat(canvas.style.width);

  if (!styleWidth || !canvas.width) {
    return 1;
  }

  return canvas.width / styleWidth;
}

export function getWaveSurferBarOptions(options: {
  height?: number | "auto";
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  cursorWidth?: number;
}) {
  const waveColor = options.waveColor ?? WAVEFORM_COLORS.wave;
  const progressColor = options.progressColor ?? WAVEFORM_COLORS.progress;
  const height = options.height ?? 64;

  return {
    waveColor,
    progressColor,
    cursorColor: options.cursorColor ?? WAVEFORM_COLORS.cursor,
    cursorWidth: options.cursorWidth ?? 0,
    height,
    normalize: false,
    renderFunction: (
      channels: Array<Float32Array | number[]>,
      ctx: CanvasRenderingContext2D,
    ) => {
      const peaks = channels[0] ? Array.from(channels[0]) : [];

      drawSoundCloudWaveform(ctx, {
        peaks,
        width: ctx.canvas.width,
        height: ctx.canvas.height,
        waveColor,
        progressColor,
        pixelRatio: getCanvasPixelRatio(ctx.canvas),
      });
    },
  };
}
