"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/song/SearchBox";
import { SongList } from "@/components/song/SongList";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
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
      className="group flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 transition hover:border-orange-500/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-orange-500/5"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-20 w-20 rounded-full object-cover border-2 border-zinc-800 transition group-hover:border-orange-500/50 group-hover:scale-105"
        />
      ) : (
        <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-orange-500/20 to-zinc-900 text-xl font-black text-orange-500 border-2 border-zinc-800 transition group-hover:border-orange-500/50 group-hover:scale-105">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 text-center">
        <span className="block truncate text-sm font-semibold text-zinc-100 transition group-hover:text-orange-400">
          {displayName}
        </span>
        <span className="block text-[11px] text-zinc-500">Artist</span>
      </div>
    </Link>
  );
}

/* ---------- Skeleton for artist cards while loading ---------- */

function ArtistCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-4 animate-pulse">
      <div className="h-20 w-20 rounded-full bg-zinc-800" />
      <div className="space-y-1.5 w-full flex flex-col items-center">
        <div className="h-3.5 w-20 rounded bg-zinc-800" />
        <div className="h-2.5 w-10 rounded bg-zinc-800/60" />
      </div>
    </div>
  );
}

/* ---------- Artists section ---------- */

function ArtistResults({
  artists,
  loading,
}: {
  artists: ArtistRecord[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
          Artists
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <ArtistCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (artists.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
        Artists
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {artists.map((artist) => (
          <ArtistSearchCard key={artist.id} artist={artist} />
        ))}
      </div>
    </section>
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
        eyebrow="Search"
        title="Find your next song"
        description="Use the header search on desktop. On mobile, search here or tap the search icon."
      />

      <SearchBox
        key={activeKeyword}
        onSearch={handleSearch}
        initialValue={activeKeyword}
        loading={isSearching}
        className="md:hidden"
      />

      {!hasSearched && (
        <EmptyState
          icon={<SearchIcon size={24} />}
          title="Start with a keyword"
          description="Search by song title, artist, album, or genre to find your favorite tracks."
        />
      )}

      {/* Artists section — shown above songs */}
      {hasSearched && (
        <ArtistResults artists={artists} loading={isSearching || artistsLoading} />
      )}

      {/* Songs section — existing logic preserved */}
      {hasSearched && !noResults && (
        <section className="space-y-3">
          {(songs.length > 0 || isSearching || songError) && (
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
              Songs
            </h2>
          )}
          <SongList
            songs={songs}
            loading={isSearching}
            error={songError}
            emptyMessage={`No songs found for "${activeKeyword}".`}
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
          />
        </section>
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
