"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RecentlyPlayedList } from "@/components/song/RecentlyPlayedList";
import { SongList } from "@/components/song/SongList";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { getRecentlyPlayedRequest, getSongsRequest } from "@/lib/api";
import { playlists } from "@/lib/mock-data";
import {
  getLocalRecentlyPlayed,
  RECENTLY_PLAYED_UPDATED_EVENT,
} from "@/lib/recently-played-storage";
import type { RecentlyPlayedSong, Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 9;

export default function Home() {
  const { accessToken, isLoading: authLoading } = useAuth();
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
    <div className="space-y-8">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-green-400">
              Fresh picks
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Music Streaming
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
              Browse songs from the backend API, search the catalog, and play
              songs in the bottom player.
            </p>
          </div>
          <Link
            href="/search"
            className="inline-flex w-fit items-center rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400"
          >
            Explore songs
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Songs"
          value={pagination ? String(pagination.totalItems) : "..."}
          helper="Loaded from API"
        />
        <StatCard label="Page" value={String(pagination?.page ?? 1)} helper="Current page" />
        <StatCard
          label="Playlists"
          value={String(playlists.length)}
          helper="Personal collections"
        />
      </section>

      <section className="space-y-4">
        <PageHeader
          eyebrow="History"
          title="Recently Played"
          description="Your latest played songs are kept newest first."
        />
        <RecentlyPlayedList
          songs={recentlyPlayed}
          loading={recentlyLoading || authLoading}
          error={recentlyError}
        />
      </section>

      <section className="space-y-4">
        <PageHeader
          eyebrow="Catalog"
          title="Latest songs"
          description="Songs are loaded from GET /api/songs."
        />
        <SongList
          songs={songs}
          loading={loading}
          error={error}
          emptyMessage="No songs available yet."
          canLoadMore={canLoadMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
        />
      </section>
    </div>
  );
}
