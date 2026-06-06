"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/song/SearchBox";
import { SongList } from "@/components/song/SongList";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon, VerifiedBadge } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import {
  searchSongsRequest,
  searchRealtimeSuggestionsRequest,
} from "@/lib/api";
import {
  getArtistDisplayName,
  getArtistAvatarUrl,
} from "@/lib/song-format";
import type { ArtistRecord, Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 9;
const ARTIST_LIMIT = 8;

/* ---------- Artist card used in the search results ---------- */

function ArtistSearchCard({ artist }: { artist: ArtistRecord }) {
  const avatarUrl = getArtistAvatarUrl(artist);
  const displayName = getArtistDisplayName(artist);

  return (
    <Link
      href={`/artists/${artist.id}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/60 bg-[#121214]/40 p-4 transition duration-300 hover:border-orange-500/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-orange-500/5 w-full"
    >
      <div className="relative">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-20 w-20 rounded-full object-cover border-2 border-zinc-800 transition duration-300 group-hover:border-orange-500/50 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-orange-500/20 to-zinc-900 text-xl font-black text-orange-500 border-2 border-zinc-800 transition duration-300 group-hover:border-orange-500/50 group-hover:scale-105">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 text-center w-full">
        <span className="flex items-center justify-center gap-1 text-sm font-semibold text-zinc-100 transition duration-200 group-hover:text-orange-400">
          <span className="truncate">{displayName}</span>
          {artist.is_verified && <VerifiedBadge size={13} />}
        </span>
        <span className="block text-[11px] text-zinc-500 mt-0.5">
          {artist.followers_count && artist.followers_count > 0
            ? `${artist.followers_count} followers`
            : "Artist"}
        </span>
      </div>
    </Link>
  );
}




/* ---------- Page fallback / skeleton ---------- */

function SearchPageFallback() {
  return (
    <div className="space-y-6 page-fade-in">
      <PageHeader
        eyebrow="Search"
        title="Find your next song"
        description="Search songs and artists from the header."
      />
      <div className="grid min-h-40 place-items-center rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-sm text-zinc-500">
        Loading search...
      </div>
    </div>
  );
}

const GENRES = [
  { name: "Remix", query: "remix", color: "from-orange-600 to-red-650 hover:shadow-orange-500/10", icon: "💿" },
  { name: "Lofi Beats", query: "lofi", color: "from-purple-600 to-indigo-700 hover:shadow-purple-500/10", icon: "☕" },
  { name: "VinaHouse", query: "vinahouse", color: "from-cyan-600 to-blue-700 hover:shadow-cyan-500/10", icon: "🔥" },
  { name: "Nightcore", query: "nightcore", color: "from-rose-600 to-pink-700 hover:shadow-rose-500/10", icon: "⚡" },
  { name: "Pop Music", query: "pop", color: "from-emerald-600 to-teal-700 hover:shadow-emerald-500/10", icon: "🎵" },
  { name: "Chill", query: "chill", color: "from-fuchsia-600 to-purple-700 hover:shadow-fuchsia-500/10", icon: "🍃" },
];

/* ---------- Main search page content ---------- */

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  // Songs state (existing)
  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [songError, setSongError] = useState<string | null>(null);
  const [loadedKeyword, setLoadedKeyword] = useState("");

  // Artists state (new)
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [loadedArtistsKeyword, setLoadedArtistsKeyword] = useState("");

  // Search filter tabs
  const [activeTab, setActiveTab] = useState<"all" | "songs" | "artists">("all");
  const [prevQuery, setPrevQuery] = useState(query);

  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveTab("all");
  }

  const activeKeyword = query;
  const hasSearched = activeKeyword.length > 0;
  const isSearching = Boolean(query && query !== loadedKeyword);
  const artistsLoading = Boolean(query && query !== loadedArtistsKeyword);

  // Fetch songs (existing logic, unchanged)
  useEffect(() => {
    let isMounted = true;

    if (!query) {
      return () => {
        isMounted = false;
      };
    }

    void searchSongsRequest(query, 1, SONG_LIMIT)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setSongs(result.items);
        setPagination(result.pagination);
        setSongError(null);
        setLoadedKeyword(query);
      })
      .catch((searchError) => {
        if (!isMounted) {
          return;
        }

        setSongs([]);
        setPagination(null);
        setSongError(
          searchError instanceof Error
            ? searchError.message
            : "Could not search songs.",
        );
        setLoadedKeyword(query);
      });

    return () => {
      isMounted = false;
    };
  }, [query]);

  // Fetch artists (new — independent from songs)
  useEffect(() => {
    let isMounted = true;

    if (!query) {
      return () => {
        isMounted = false;
      };
    }

    void searchRealtimeSuggestionsRequest(query, ARTIST_LIMIT)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setArtists(data.artists ?? []);
        setLoadedArtistsKeyword(query);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        // Silently ignore — songs still display
        setArtists([]);
        setLoadedArtistsKeyword(query);
      });

    return () => {
      isMounted = false;
    };
  }, [query]);



  const handleSearch = (nextKeyword: string) => {
    router.push(`/search?q=${encodeURIComponent(nextKeyword.trim())}`);
  };

  const handleLoadMore = async () => {
    if (!pagination || !activeKeyword || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setSongError(null);

    try {
      const result = await searchSongsRequest(
        activeKeyword,
        pagination.page + 1,
        SONG_LIMIT,
      );

      setSongs((currentSongs) => [...currentSongs, ...result.items]);
      setPagination(result.pagination);
    } catch (loadMoreError) {
      setSongError(
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

  const noResults =
    hasSearched &&
    !isSearching &&
    !artistsLoading &&
    songs.length === 0 &&
    artists.length === 0 &&
    !songError;

  return (
    <div className="space-y-6 page-fade-in">
      <PageHeader
        eyebrow={hasSearched ? "Search Results" : "Explore"}
        title={hasSearched ? `Results for "${activeKeyword}"` : "Find your next song"}
        description={
          hasSearched
            ? `We found ${songs.length} song${songs.length === 1 ? "" : "s"} and ${artists.length} artist${artists.length === 1 ? "" : "s"}.`
            : "Search tracks and artists by entering keywords."
        }
        action={
          <SearchBox
            key={activeKeyword}
            onSearch={handleSearch}
            initialValue={activeKeyword}
            loading={isSearching}
            className="w-full sm:w-80 md:hidden"
          />
        }
      />

      {/* Explore Section when no keyword is entered */}
      {!hasSearched && (
        <div className="space-y-6 pt-2 animate-fade-in">
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
              Browse Genres & Categories
            </h3>
            <p className="text-xs text-zinc-400">
              Click on a card below to discover popular songs and matching content.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6">
            {GENRES.map((genre) => (
              <button
                key={genre.name}
                onClick={() => handleSearch(genre.query)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-5 text-left h-28 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg bg-gradient-to-br border border-white/5",
                  genre.color
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-85" />
                <span className="relative z-10 text-sm font-extrabold text-white tracking-tight leading-tight block">
                  {genre.name}
                </span>
                <div className="absolute bottom-3 right-4 text-3xl opacity-20 transition-all duration-300 group-hover:scale-110 group-hover:opacity-40 select-none">
                  {genre.icon}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs when query is loaded */}
      {hasSearched && !isSearching && !artistsLoading && !noResults && (
        <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-3">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold transition duration-200",
              activeTab === "all"
                ? "bg-orange-500 text-orange-950 shadow-md shadow-orange-500/10"
                : "border border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-white"
            )}
          >
            All Results
          </button>
          <button
            onClick={() => setActiveTab("songs")}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold transition duration-200",
              activeTab === "songs"
                ? "bg-orange-500 text-orange-950 shadow-md shadow-orange-500/10"
                : "border border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-white"
            )}
          >
            Songs
          </button>
          <button
            onClick={() => setActiveTab("artists")}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-bold transition duration-200",
              activeTab === "artists"
                ? "bg-orange-500 text-orange-950 shadow-md shadow-orange-500/10"
                : "border border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-white"
            )}
          >
            Artists
          </button>
        </div>
      )}

      {/* Loading state indicator */}
      {(isSearching || artistsLoading) && (
        <div className="grid min-h-40 place-items-center rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-sm text-zinc-500 animate-pulse">
          Searching for &quot;{activeKeyword}&quot;...
        </div>
      )}

      {/* Search Result Views */}
      {hasSearched && !isSearching && !artistsLoading && !noResults && (
        <div className="space-y-8">
          {/* TAB: ALL RESULTS */}
          {activeTab === "all" && (
            <>
              {/* Artists Preview */}
              {artists.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                      Artists
                    </h2>
                    {artists.length > 6 && (
                      <button
                        onClick={() => setActiveTab("artists")}
                        className="text-xs font-bold text-orange-500 hover:text-orange-450 transition"
                      >
                        See all ({artists.length})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {artists.slice(0, 6).map((artist) => (
                      <ArtistSearchCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                </section>
              )}

              {/* Songs Preview */}
              {songs.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                      Songs
                    </h2>
                    {songs.length > 6 && (
                      <button
                        onClick={() => setActiveTab("songs")}
                        className="text-xs font-bold text-orange-500 hover:text-orange-450 transition"
                      >
                        See all
                      </button>
                    )}
                  </div>
                  <SongList
                    songs={songs}
                    loading={false}
                    error={songError}
                    emptyMessage={`No songs found for "${activeKeyword}".`}
                    canLoadMore={canLoadMore}
                    loadingMore={loadingMore}
                    onLoadMore={handleLoadMore}
                    variant="list"
                  />
                </section>
              )}
            </>
          )}

          {/* TAB: SONGS ONLY */}
          {activeTab === "songs" && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                All Matching Songs
              </h2>
              <SongList
                songs={songs}
                loading={false}
                error={songError}
                emptyMessage={`No songs found for "${activeKeyword}".`}
                canLoadMore={canLoadMore}
                loadingMore={loadingMore}
                onLoadMore={handleLoadMore}
                variant="list"
              />
            </section>
          )}

          {/* TAB: ARTISTS ONLY */}
          {activeTab === "artists" && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                All Matching Artists
              </h2>
              {artists.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {artists.map((artist) => (
                    <ArtistSearchCard key={artist.id} artist={artist} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<SearchIcon size={24} />}
                  title="No artists found"
                  description={`We couldn't find any artists matching "${activeKeyword}".`}
                />
              )}
            </section>
          )}
        </div>
      )}

      {/* Global empty state when both artists and songs are empty */}
      {noResults && (
        <EmptyState
          icon={<SearchIcon size={24} />}
          title="No results found"
          description={`We couldn't find any songs or artists matching "${activeKeyword}". Try a different keyword.`}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}
