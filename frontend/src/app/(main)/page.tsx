"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NowPlayingHero } from "@/components/NowPlayingHero";
import { HorizontalSongCarousel } from "@/components/song/HorizontalSongCarousel";
import { RecentlyPlayedList } from "@/components/song/RecentlyPlayedList";
import { getRecentlyPlayedRequest, getSongsRequest } from "@/lib/api";
import {
  getLocalRecentlyPlayed,
  RECENTLY_PLAYED_UPDATED_EVENT,
} from "@/lib/recently-played-storage";
import { usePlayerStore } from "@/stores/player-store";
import type { RecentlyPlayedSong, Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 9;

export default function Home() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const [songs, setSongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedSong[]>([]);
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentlyLoading, setRecentlyLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyError, setRecentlyError] = useState<string | null>(null);

  const loadSongs = async (page: number) => {
    const result = await getSongsRequest(page, SONG_LIMIT);

    setSongs((currentSongs) =>
      page === 1 ? result.items : [...currentSongs, ...result.items],
    );
    setPagination(result.pagination);
  };

  useEffect(() => {
    let isMounted = true;

    void getSongsRequest(1, SONG_LIMIT)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setSongs(result.items);
        setPagination(result.pagination);
        setError(null);
      })
      .catch((songsError) => {
        if (!isMounted) {
          return;
        }

        setError(
          songsError instanceof Error
            ? songsError.message
            : "Could not load songs.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let isMounted = true;

    const loadRecentlyPlayed = async () => {
      setRecentlyLoading(true);
      setRecentlyError(null);

      try {
        const items = accessToken
          ? await getRecentlyPlayedRequest(accessToken)
          : getLocalRecentlyPlayed();

        if (isMounted) {
          setRecentlyPlayed(items);
        }
      } catch (recentError) {
        if (!isMounted) {
          return;
        }

        setRecentlyPlayed([]);
        setRecentlyError(
          recentError instanceof Error
            ? recentError.message
            : "Could not load recently played songs.",
        );
      } finally {
        if (isMounted) {
          setRecentlyLoading(false);
        }
      }
    };

    void loadRecentlyPlayed();
    window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadRecentlyPlayed);

    return () => {
      isMounted = false;
      window.removeEventListener(
        RECENTLY_PLAYED_UPDATED_EVENT,
        loadRecentlyPlayed,
      );
    };
  }, [accessToken, authLoading]);

  const handleLoadMore = async () => {
    if (!pagination || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      await loadSongs(pagination.page + 1);
    } catch (loadMoreError) {
      setError(
        loadMoreError instanceof Error
          ? loadMoreError.message
          : "Could not load more songs.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const canLoadMore = pagination
    ? pagination.page < pagination.totalPages
    : false;

  return (
    <div className="space-y-8 page-fade-in">
      {currentSong ? (
        <NowPlayingHero song={currentSong} />
      ) : (
        <section className="hero-fade-in relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-6 shadow-2xl sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.1),transparent_45%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-500">
                Welcome back
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-5xl bg-clip-text">
                Listen to your favorite tracks
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                Discover, play, and save your music. Browse songs from the catalog, create playlists, and build your personal collection.
              </p>
            </div>
            {/* <Link
              href="/search"
              className="inline-flex w-fit items-center rounded-full bg-green-500 px-6 py-3 text-sm font-bold text-green-950 transition hover:bg-green-400 hover:scale-105 shadow-lg shadow-green-500/10"
            >
              Exploresongs
            </Link> */}
          </div>
        </section>
      )}

      {/* Conditionally Render Recently Played Section */}
      {!recentlyLoading && recentlyPlayed.length > 0 && (
        <section className="space-y-4">
          <div className="border-b border-zinc-900 pb-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Recently Played</h2>
            <p className="text-xs text-zinc-500">Your latest played songs, kept newest first.</p>
          </div>
          <RecentlyPlayedList
            songs={recentlyPlayed}
            loading={recentlyLoading || authLoading}
            error={recentlyError}
          />
        </section>
      )}

      <HorizontalSongCarousel
        title="Latest Songs"
        subtitle="Fresh songs loaded from the backend database."
        songs={songs}
        loading={loading}
        error={error}
        emptyTitle="No songs available yet."
        emptyDescription="Upload or add songs from the dashboard to see them here."
        canLoadMore={canLoadMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
      />
    </div>
  );

}
