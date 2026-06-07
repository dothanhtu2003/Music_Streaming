"use client";

import { useCallback, useEffect, useState } from "react";
import { RankedTrackList } from "@/components/song/RankedTrackList";
import { getChartTracksRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChartPeriod, ChartTrack } from "@/types/music";

const periods: Array<{ value: ChartPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

export default function ChartsPage() {
  const [period, setPeriod] = useState<ChartPeriod>("week");
  const [tracks, setTracks] = useState<ChartTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCharts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getChartTracksRequest(period, 50);
      setTracks(result.items);
    } catch (chartError) {
      setError(
        chartError instanceof Error
          ? chartError.message
          : "Could not load charts.",
      );
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadCharts();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadCharts]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Charts
        </h1>
        <div className="flex flex-wrap gap-2">
          {periods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              className={cn(
                "rounded-lg border px-4 py-2 text-xs font-bold transition",
                period === item.value
                  ? "border-orange-500 bg-orange-500 text-orange-950"
                  : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-400">
          Loading charts...
        </div>
      ) : (
        <RankedTrackList tracks={tracks} />
      )}
    </div>
  );
}
