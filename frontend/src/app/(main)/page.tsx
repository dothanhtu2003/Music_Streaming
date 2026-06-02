"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NowPlayingHero } from "@/components/NowPlayingHero";
import { RecentlyPlayedList } from "@/components/song/RecentlyPlayedList";
import { StreamTrackRow } from "@/components/song/StreamTrackRow";
import { getRecentlyPlayedRequest, getSongsRequest } from "@/lib/api";
import { getLocalRecentlyPlayed } from "@/lib/recently-played-storage";
import {
  SONG_CATALOG_UPDATED_EVENT,
  consumePendingUploadedSongId,
  type SongCatalogUpdatedDetail,
} from "@/lib/song-events";
import { usePlayerStore } from "@/stores/player-store";
import type { RecentlyPlayedSong, Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 10;

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

  const loadLatestSongs = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) {
        setLoading(true);
      }

      try {
        const result = await getSongsRequest(1, SONG_LIMIT);

        setSongs(result.items);
        setPagination(result.pagination);
        setError(null);
      } catch (songsError) {
        setError(
          songsError instanceof Error
            ? songsError.message
            : "Could not load songs.",
        );
      } finally {
        if (!quiet) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadLatestSongs();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadLatestSongs]);

  useEffect(() => {
    let isMounted = true;
    const pendingUploadedSongId = consumePendingUploadedSongId();

    if (pendingUploadedSongId) {
      queueMicrotask(() => {
        if (isMounted) {
          void loadLatestSongs({ quiet: true });
        }
      });
    }

    const handleSongCatalogUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SongCatalogUpdatedDetail>).detail;

      if (detail?.song) {
        setSongs((currentSongs) => [
          detail.song as Song,
          ...currentSongs.filter((song) => song.id !== detail.song?.id),
        ]);
      }

      void loadLatestSongs({ quiet: true });
    };

    window.addEventListener(
      SONG_CATALOG_UPDATED_EVENT,
      handleSongCatalogUpdated,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        SONG_CATALOG_UPDATED_EVENT,
        handleSongCatalogUpdated,
      );
    };
  }, [loadLatestSongs]);

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
          setRecentlyPlayed(items as RecentlyPlayedSong[]);
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

    return () => {
      isMounted = false;
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
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
              className="inline-flex w-fit items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-orange-950 transition hover:bg-orange-400 hover:scale-105 shadow-lg shadow-orange-500/10"
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

      <section className="space-y-4">
        <div className="border-b border-zinc-900 pb-2">
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Hear what’s trending in the community
          </h2>
          <p className="text-xs text-zinc-500">
            Fresh tracks and new vibes picked straight from the latest uploads.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
            {error}
          </div>
        )}

        {!error && loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col gap-4 rounded-xl border border-zinc-900 bg-zinc-950/20 p-4 animate-pulse md:flex-row md:gap-5"
              >
                <div className="h-[152px] w-[152px] shrink-0 rounded-lg bg-zinc-900 shimmer mx-auto md:mx-0" />
                <div className="flex-1 space-y-4 mt-2">
                  <div className="h-4 w-1/4 rounded bg-zinc-900 shimmer" />
                  <div className="h-6 w-1/2 rounded bg-zinc-900 shimmer" />
                  <div className="h-10 w-full rounded bg-zinc-900 shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!error && !loading && songs.length === 0 && (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-8 text-center text-zinc-500">
            <p className="font-semibold text-zinc-400">No songs available yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Upload a track or explore music to start building the catalog.</p>
          </div>
        )}

        {!error && !loading && songs.length > 0 && (
          <div className="space-y-4">
            {songs.map((song) => (
              <StreamTrackRow key={song.id} song={song} queue={songs} />
            ))}

            {canLoadMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-zinc-800 bg-zinc-950 px-6 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? "Loading more..." : "Load more tracks"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );

}
