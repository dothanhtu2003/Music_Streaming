"use client";

import { useCallback, useEffect, useState } from "react";
import { RankedTrackList } from "@/components/song/RankedTrackList";
import { getTrendingTracksRequest, resolveApiAssetUrl } from "@/lib/api";
import { formatPlayCount } from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import type { Song, TrendingTrack } from "@/types/music";

function trendingToSong(track: TrendingTrack): Song {
  return {
    id: track.id,
    title: track.title,
    description: null,
    file_url: track.fileUrl,
    cover_url: track.coverUrl,
    duration_sec: track.duration,
    play_count: track.playCount,
    likes_count: track.likeCount,
    is_active: true,
    created_at: track.createdAt,
    updated_at: track.createdAt,
    artist: {
      id: track.id,
      name: track.artistName,
      avatar_url: null,
    },
    album: null,
    genre: null,
  };
}

export default function TrendingPage() {
  const playSong = usePlayerStore((state) => state.playSong);
  const [tracks, setTracks] = useState<TrendingTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getTrendingTracksRequest(30);
      setTracks(result);
    } catch (trendingError) {
      setError(
        trendingError instanceof Error
          ? trendingError.message
          : "Could not load trending tracks.",
      );
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadTrending();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadTrending]);

  const topTrack = tracks[0] ?? null;
  const restTracks = tracks.slice(1);
  const topCoverUrl = resolveApiAssetUrl(topTrack?.coverUrl);
  const topTrendingSong = topTrack ? trendingToSong(topTrack) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Trending Now
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Fresh tracks gaining attention.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-400">
          Loading trending tracks...
        </div>
      )}

      {!loading && topTrack && (
        <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          <div className="grid gap-5 p-5 md:grid-cols-[180px_1fr] md:items-end">
            {topCoverUrl ? (
              <div
                className="aspect-square rounded-lg bg-zinc-900 bg-cover bg-center"
                style={{ backgroundImage: `url(${topCoverUrl})` }}
                aria-label={`${topTrack.title} cover`}
              />
            ) : (
              <div className="grid aspect-square place-items-center rounded-lg bg-zinc-900 text-5xl font-black text-orange-400">
                {topTrack.title.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-orange-400">
                #1 Trending
              </p>
              <h2 className="mt-2 truncate text-3xl font-extrabold text-white md:text-5xl">
                {topTrack.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {topTrack.artistName}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-zinc-400">
                <span>{formatPlayCount(topTrack.playCount)} plays</span>
                <span>{formatPlayCount(topTrack.likeCount)} likes</span>
                <span>Score {Math.round(topTrack.score)}</span>
              </div>
              <button
                type="button"
                disabled={!topTrendingSong}
                onClick={() => {
                  if (topTrendingSong) {
                    playSong(topTrendingSong, tracks.map(trendingToSong));
                  }
                }}
                className="mt-5 rounded-full bg-orange-500 px-6 py-3 text-xs font-bold text-orange-950 transition hover:bg-orange-400 disabled:opacity-50"
              >
                Play
              </button>
            </div>
          </div>
        </section>
      )}

      {!loading && (
        <RankedTrackList
          tracks={restTracks}
          showScore
          likeEnabled
          showRank={false}
        />
      )}
    </div>
  );
}
