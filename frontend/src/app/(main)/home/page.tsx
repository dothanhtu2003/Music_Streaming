"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NowPlayingHero } from "@/components/NowPlayingHero";
import { HorizontalSongCarousel } from "@/components/song/HorizontalSongCarousel";
import { RecentlyPlayedList } from "@/components/song/RecentlyPlayedList";
import {
  getGenresRequest,
  getRecentlyPlayedRequest,
  getSongsRequest,
} from "@/lib/api";
import { getLocalRecentlyPlayed } from "@/lib/recently-played-storage";
import {
  SONG_CATALOG_UPDATED_EVENT,
  consumePendingUploadedSongId,
  type SongCatalogUpdatedDetail,
} from "@/lib/song-events";
import { usePlayerStore } from "@/stores/player-store";
import type {
  GenreRecord,
  RecentlyPlayedSong,
  Song,
  SongPagination,
} from "@/types/music";

const RECENTLY_PLAYED_DISPLAY_LIMIT = 5;
const GENRE_LIMIT = 12;
const GENRE_EXPANDED_DISPLAY_LIMIT = 10;
const GENRE_FETCH_LIMIT = GENRE_EXPANDED_DISPLAY_LIMIT;

type GenreSongRow = {
  genre: GenreRecord;
  songs: Song[];
  pagination: SongPagination;
  loadingMore: boolean;
  error: string | null;
};

function HomeContent() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedSong[]>([]);
  const [genreRows, setGenreRows] = useState<GenreSongRow[]>([]);
  const [genreRowsLoading, setGenreRowsLoading] = useState(true);
  const [recentlyLoading, setRecentlyLoading] = useState(true);
  const [genreRowsError, setGenreRowsError] = useState<string | null>(null);
  const [recentlyError, setRecentlyError] = useState<string | null>(null);

  const loadGenreRows = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) {
        setGenreRowsLoading(true);
      }

      try {
        const genreResult = await getGenresRequest(1, GENRE_LIMIT);
        const rowResults = await Promise.all(
          genreResult.items.map(async (genre) => {
            const songResult = await getSongsRequest(1, GENRE_FETCH_LIMIT, {
              genre_id: genre.id,
              sort: "random",
            });

            return {
              genre,
              songs: songResult.items,
              pagination: songResult.pagination,
              loadingMore: false,
              error: null,
            } satisfies GenreSongRow;
          }),
        );

        setGenreRows(rowResults.filter((row) => row.songs.length > 0));
        setGenreRowsError(null);
      } catch (rowsError) {
        setGenreRowsError(
          rowsError instanceof Error
            ? rowsError.message
            : "Could not load genre songs.",
        );
      } finally {
        if (!quiet) {
          setGenreRowsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadGenreRows();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadGenreRows]);

  useEffect(() => {
    let isMounted = true;
    const pendingUploadedSongId = consumePendingUploadedSongId();

    if (pendingUploadedSongId) {
      queueMicrotask(() => {
        if (isMounted) {
          void loadGenreRows({ quiet: true });
        }
      });
    }

    const handleSongCatalogUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SongCatalogUpdatedDetail>).detail;

      if (detail?.song) {
        void loadGenreRows({ quiet: true });
      }
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
  }, [loadGenreRows]);

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

  const handleLoadMoreGenre = async (genreId: string) => {
    const row = genreRows.find((item) => item.genre.id === genreId);

    if (!row || row.loadingMore || row.pagination.page >= row.pagination.totalPages) {
      return;
    }

    setGenreRows((currentRows) =>
      currentRows.map((item) =>
        item.genre.id === genreId
          ? { ...item, loadingMore: true, error: null }
          : item,
      ),
    );

    try {
      const result = await getSongsRequest(
        row.pagination.page + 1,
        GENRE_EXPANDED_DISPLAY_LIMIT,
        { genre_id: genreId, sort: "random" },
      );

      setGenreRows((currentRows) =>
        currentRows.map((item) =>
          item.genre.id === genreId
            ? {
                ...item,
                songs: [...item.songs, ...result.items],
                pagination: result.pagination,
                loadingMore: false,
              }
            : item,
        ),
      );
    } catch (loadError) {
      setGenreRows((currentRows) =>
        currentRows.map((item) =>
          item.genre.id === genreId
            ? {
                ...item,
                loadingMore: false,
                error:
                  loadError instanceof Error
                    ? loadError.message
                    : "Could not load more songs.",
              }
            : item,
        ),
      );
    } finally {
      setGenreRows((currentRows) =>
        currentRows.map((item) =>
          item.genre.id === genreId ? { ...item, loadingMore: false } : item,
        ),
      );
    }
  };

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
            songs={recentlyPlayed.slice(0, RECENTLY_PLAYED_DISPLAY_LIMIT)}
            loading={recentlyLoading || authLoading}
            error={recentlyError}
          />
        </section>
      )}

      <section className="space-y-6">
        <div className="flex flex-col gap-2 border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">
              Community Hotspot
            </span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Hear what’s trending in the community
          </h2>
          <p className="text-xs text-zinc-400">
            Fresh tracks and new vibes picked straight from the latest uploads.
          </p>
        </div>

        {genreRowsError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
            {genreRowsError}
          </div>
        )}

        {!genreRowsError && genreRowsLoading && (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <HorizontalSongCarousel
                key={index}
                title="Loading genre"
                songs={[]}
                loading
                emptyTitle="No songs"
              />
            ))}
          </div>
        )}

        {!genreRowsError && !genreRowsLoading && genreRows.length === 0 && (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 p-8 text-center text-zinc-500">
            <p className="font-semibold text-zinc-400">No songs available yet.</p>
            <p className="mt-1 text-sm text-zinc-500">Upload a track or explore music to start building the catalog.</p>
          </div>
        )}

        {!genreRowsError && !genreRowsLoading && genreRows.length > 0 && (
          <div className="space-y-9">
            {genreRows.map((row) => {
              const canLoadMore = row.pagination.page < row.pagination.totalPages;

              return (
                <div key={row.genre.id} className="space-y-4">
                  <HorizontalSongCarousel
                    title={row.genre.name}
                    subtitle={`${row.pagination.totalItems} tracks`}
                    songs={row.songs}
                    error={row.error}
                    emptyTitle={`No ${row.genre.name} tracks`}
                    emptyDescription="Tracks in this genre will appear here."
                    canLoadMore={canLoadMore}
                    loadingMore={row.loadingMore}
                    onLoadMore={() => {
                      void handleLoadMoreGenre(row.genre.id);
                    }}
                    viewAllHref={`/search?q=${encodeURIComponent(row.genre.name)}`}
                    viewAllLabel="View all"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

}

export default function HomePage() {
  return (
    <ProtectedRoute loginPath="/login">
      <HomeContent />
    </ProtectedRoute>
  );
}
