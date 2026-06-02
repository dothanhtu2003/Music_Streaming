"use client";

import { useState } from "react";
import { SearchBox } from "@/components/song/SearchBox";
import { SongList } from "@/components/song/SongList";
import { PageHeader } from "@/components/ui/PageHeader";
import { searchSongsRequest } from "@/lib/api";
import type { Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 9;

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = async (nextKeyword: string, page: number) => {
    const result = await searchSongsRequest(nextKeyword, page, SONG_LIMIT);

    setSongs((currentSongs) =>
      page === 1 ? result.items : [...currentSongs, ...result.items],
    );
    setPagination(result.pagination);
  };

  const handleSearch = async (nextKeyword: string) => {
    setKeyword(nextKeyword);
    setHasSearched(true);
    setLoading(true);
    setError(null);

    try {
      await runSearch(nextKeyword, 1);
    } catch (searchError) {
      setSongs([]);
      setPagination(null);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Could not search songs.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!pagination || !keyword || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      await runSearch(keyword, pagination.page + 1);
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Search"
        title="Find your next song"
        description="Search calls GET /api/songs/search?q=keyword."
      />

      <SearchBox onSearch={handleSearch} loading={loading} />

      {!hasSearched && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <p className="text-sm font-medium text-white">Start with a keyword.</p>
          <p className="mt-2 text-xs text-zinc-500">
            Search by song title, artist, album, or genre.
          </p>
        </div>
      )}

      {hasSearched && (
        <SongList
          songs={songs}
          loading={loading}
          error={error}
          emptyMessage={`No songs found for "${keyword}".`}
          canLoadMore={canLoadMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
        />
      )}
    </div>
  );
}
