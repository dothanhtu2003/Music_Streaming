"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NowPlayingHero } from "@/components/NowPlayingHero";
import { HorizontalSongCarousel } from "@/components/song/HorizontalSongCarousel";
import { RecentlyPlayedList } from "@/components/song/RecentlyPlayedList";
import {
  getGenresRequest,
  getRecentlyPlayed,
  getSongsRequest,
} from "@/lib/api";
import {
  RECENTLY_PLAYED_UPDATED_EVENT,
  getLocalRecentlyPlayed,
} from "@/lib/recently-played-storage";
import {
  SONG_CATALOG_UPDATED_EVENT,
  consumePendingUploadedSongId,
  type SongCatalogUpdatedDetail,
} from "@/lib/song-events";
import { usePlayerStore } from "@/stores/player-store";
import type {
  GenreRecord,
  RecentlyPlayedEntry,
  Song,
  SongPagination,
} from "@/types/music";

const RECENTLY_PLAYED_DISPLAY_LIMIT = 5;
const GENRE_LIMIT = 12;
const GENRE_EXPANDED_DISPLAY_LIMIT = 10;
const GENRE_FETCH_LIMIT = GENRE_EXPANDED_DISPLAY_LIMIT;
const EQ_BAR_HEIGHTS = [42, 78, 55, 88, 36, 64, 94, 48, 72, 58];

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
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedEntry[]>([]);
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
          ? await getRecentlyPlayed(20, accessToken)
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

  return (
    <div className="space-y-10 page-fade-in relative pb-10">
      {/* Dynamic Background Glow representing the Vibe */}
      <div 
        className="absolute top-0 right-0 w-[40vw] h-[40vw] rounded-full blur-[140px] pointer-events-none opacity-60"
        style={{ background: "radial-gradient(circle at top right, rgba(249,115,22,0.08), transparent 50%)" }}
      />

      {/* Quick Vibe Filter Chips (Spotify Style) */}
      <div className="hidden">
        <span className="rounded-full bg-orange-500 px-4 py-1.5 text-xs font-black text-orange-950 shadow-md shadow-orange-500/20 shrink-0 cursor-pointer">
          🎵 All
        </span>
        {["🔥 Remix", "🎹 Chill", "⚡ Pop", "🎸 Rock", "🌙 Lofi", "🎤 R&B"].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-700 hover:text-white shrink-0 cursor-pointer active:scale-95"
          >
            {chip}
          </span>
        ))}
      </div>

      {/* Main Hero Section */}
      {currentSong ? (
        <div className="relative group rounded-2xl overflow-hidden transition-all duration-300 block">
          <NowPlayingHero song={currentSong} />
            {isPlaying && (
              <div className="absolute inset-0 border-[2px] rounded-2xl pointer-events-none opacity-40 border-orange-500 glow-cyber-orange" />
            )}
        </div>
      ) : (
        <section className="hero-fade-in relative overflow-hidden rounded-2xl md:rounded-[2rem] border border-zinc-900 bg-[#09090b]/80 p-5 sm:p-10 shadow-2xl backdrop-blur-sm">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top right, rgba(249,115,22,0.08), transparent 50%)" }} />
          {/* Cyber scanline backplate overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.002)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] pointer-events-none" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 sm:px-3.5 sm:py-1 text-[9px] font-black uppercase tracking-[0.2em] shadow-sm text-orange-500 border-orange-500/20 bg-orange-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                VIBE CHANNEL: ACTIVE
              </span>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-5xl uppercase italic text-stroke-cyber hover:text-white transition-all duration-300">
                Listen to your favorite tracks
              </h1>
              <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-zinc-400 font-medium">
                Discover, play, and save your music. Browse songs from the catalog, create playlists, and build your personal collection.
              </p>
            </div>

            {/* Dynamic visual monitor block inside Hero - Visible on Desktop only */}
            <div className="hidden md:flex items-center gap-4 bg-black/40 border border-zinc-900 p-4 rounded-2xl shrink-0 font-mono text-[9px] text-zinc-500 max-w-xs">
              <div className="flex gap-1 items-end h-8">
                {EQ_BAR_HEIGHTS.map((height, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-t transition-all duration-300 eq-bar bg-orange-500"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${0.1 * (i % 4)}s`,
                      animationDuration: "0.8s"
                    }}
                  />
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-white font-bold tracking-widest text-[10px]">MONITOR DECK</p>
                <p>SIGNAL: ONLINE</p>
                <p>BUFFER: LOCKED</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recently Played Section */}
      {!authLoading && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-900/80 pb-2.5">
            <div>
              <h2 className="text-base sm:text-xl font-extrabold tracking-tight text-white uppercase italic">Recently Played</h2>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">Songs and playlists you played recently</p>
            </div>
            {isPlaying && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <RecentlyPlayedList
            items={recentlyPlayed}
            limit={RECENTLY_PLAYED_DISPLAY_LIMIT}
            loading={recentlyLoading || authLoading}
            error={recentlyError}
          />
        </section>
      )}

      {/* Main Music Stream Section */}
      <section className="space-y-6 pt-2">
        <div className="flex flex-col gap-1 border-b border-zinc-900/80 pb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-500 uppercase tracking-widest">
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            Trending Catalog
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-3xl">
            Hear what’s trending in the community
          </h2>
        </div>

        {genreRowsError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
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
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/20 py-12 text-center text-zinc-500 font-mono text-xs">
            <p className="font-bold text-zinc-400">NO FREQUENCIES FOUND</p>
            <p className="mt-2 text-zinc-650 max-w-sm mx-auto leading-relaxed">
              Upload a new track under this genre or explore other songs to build the catalog.
            </p>
          </div>
        )}

        {!genreRowsError && !genreRowsLoading && genreRows.length > 0 && (
          <div className="space-y-8">
            {genreRows.map((row) => {
              return (
                <div key={row.genre.id} className="space-y-3 group">
                  <HorizontalSongCarousel
                    title={row.genre.name}
                    subtitle={`${row.pagination.totalItems} tracks`}
                    songs={row.songs}
                    error={row.error}
                    emptyTitle={`No ${row.genre.name} tracks`}
                    emptyDescription="Tracks in this genre will appear here."
                    viewAllHref={`/genres/${row.genre.id}`}
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
