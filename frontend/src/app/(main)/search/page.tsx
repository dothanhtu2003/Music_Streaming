"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/song/SearchBox";
import { SongList } from "@/components/song/SongList";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { searchSongsRequest } from "@/lib/api";
import type { Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 9;

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

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKeyword, setLoadedKeyword] = useState("");
  const activeKeyword = query;
  const hasSearched = activeKeyword.length > 0;
  const isSearching = Boolean(query && query !== loadedKeyword);

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
        setError(null);
        setLoadedKeyword(query);
      })
      .catch((searchError) => {
        if (!isMounted) {
          return;
        }

        setSongs([]);
        setPagination(null);
        setError(
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

  const handleSearch = (nextKeyword: string) => {
    router.push(`/search?q=${encodeURIComponent(nextKeyword.trim())}`);
  };

  const handleLoadMore = async () => {
    if (!pagination || !activeKeyword || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const result = await searchSongsRequest(
        activeKeyword,
        pagination.page + 1,
        SONG_LIMIT,
      );

      setSongs((currentSongs) => [...currentSongs, ...result.items]);
      setPagination(result.pagination);
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

      {hasSearched && (
        <SongList
          songs={songs}
          loading={isSearching}
          error={error}
          emptyMessage={`No songs found for "${activeKeyword}".`}
          canLoadMore={canLoadMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
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
