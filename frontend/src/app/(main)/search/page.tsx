"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/song/SearchBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  clearRecentSearchesRequest,
  deleteRecentSearchRequest,
  getSearchSuggestionsRequest,
  resolveApiAssetUrl,
  searchUniversalRequest,
} from "@/lib/api";
import {
  clearGuestRecentSearches,
  deleteGuestRecentSearch,
  getGuestRecentSearches,
  saveGuestRecentSearch,
} from "@/lib/search-storage";
import { cn } from "@/lib/utils";
import type {
  SearchHistoryItem,
  UniversalSearchItem,
  UniversalSearchResponse,
} from "@/types/music";

const RESULT_LIMIT = 12;

const emptySearchData: UniversalSearchResponse = {
  query: "",
  normalizedQuery: "",
  topResult: null,
  songs: [],
  artists: [],
  playlists: [],
  suggestions: [],
  recentSearches: [],
  trendingSearches: [],
};

type SearchTab = "all" | "songs" | "artists" | "playlists";

function SearchPageFallback() {
  return (
    <div className="space-y-6 page-fade-in">
      <PageHeader
        eyebrow="Search"
        title="Find your next song"
        description="Search songs, artists, and playlists."
      />
      <div className="grid min-h-40 place-items-center rounded-xl border border-zinc-900 bg-zinc-950/40 p-8 text-sm text-zinc-500">
        Loading search...
      </div>
    </div>
  );
}

function resultTypeLabel(type: UniversalSearchItem["type"]) {
  if (type === "song") {
    return "Song";
  }

  if (type === "artist") {
    return "Artist";
  }

  return "Playlist";
}

function ResultCard({
  item,
  compact = false,
}: {
  item: UniversalSearchItem;
  compact?: boolean;
}) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-zinc-800/70 bg-zinc-950/40 p-3 transition hover:border-orange-500/50 hover:bg-zinc-900/80",
        compact ? "min-h-20" : "min-h-24",
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "shrink-0 object-cover border border-zinc-800",
            item.type === "artist" ? "rounded-full" : "rounded",
            compact ? "h-12 w-12" : "h-16 w-16",
          )}
        />
      ) : (
        <div
          className={cn(
            "grid shrink-0 place-items-center border border-zinc-800 bg-zinc-900 text-lg font-black text-orange-500",
            item.type === "artist" ? "rounded-full" : "rounded",
            compact ? "h-12 w-12" : "h-16 w-16",
          )}
        >
          {item.title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="mb-1 inline-flex rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
          {resultTypeLabel(item.type)}
        </span>
        <h3 className="truncate text-sm font-semibold text-zinc-100 transition group-hover:text-orange-400">
          {item.title}
        </h3>
        <p className="truncate text-xs text-zinc-500">{item.subtitle}</p>
      </div>
    </Link>
  );
}

function TopResultCard({ item }: { item: UniversalSearchItem }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
        Top Result
      </h2>
      <div className="max-w-xl">
        <ResultCard item={item} />
      </div>
    </section>
  );
}

function ResultSection({
  title,
  items,
  emptyTitle,
}: {
  title: string;
  items: UniversalSearchItem[];
  emptyTitle?: string;
}) {
  if (items.length === 0) {
    if (!emptyTitle) {
      return null;
    }

    return (
      <EmptyState
        icon={<SearchIcon size={24} />}
        title={emptyTitle}
        description="Try another keyword."
      />
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
        {title}
      </h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ResultCard key={`${item.type}-${item.id}`} item={item} compact />
        ))}
      </div>
    </section>
  );
}

function SearchChip({
  label,
  onClick,
  onDelete,
}: {
  label: string;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-950/60 text-xs text-zinc-300">
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 truncate px-3 py-1.5 transition hover:text-orange-400"
      >
        {label}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="border-l border-zinc-800 px-2 py-1.5 text-zinc-500 transition hover:text-orange-400"
          aria-label={`Remove ${label}`}
        >
          x
        </button>
      )}
    </div>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const { accessToken } = useAuth();
  const [searchData, setSearchData] = useState<UniversalSearchResponse>(emptySearchData);
  const [guestRecent, setGuestRecent] = useState<SearchHistoryItem[]>(() =>
    getGuestRecentSearches(),
  );
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError(null);
        setActiveTab("all");
      }
    });

    if (query.length >= 2 && !accessToken) {
      saveGuestRecentSearch(query);
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setGuestRecent(getGuestRecentSearches());
        }
      });
    }

    const request = query.length >= 2
      ? searchUniversalRequest(query, RESULT_LIMIT, {
          accessToken,
          signal: controller.signal,
          saveHistory: true,
        })
      : getSearchSuggestionsRequest("", 5, {
          accessToken,
          signal: controller.signal,
        });

    void request
      .then((data) => {
        if (!controller.signal.aborted) {
          setSearchData(data);
        }
      })
      .catch((searchError) => {
        if (searchError instanceof DOMException && searchError.name === "AbortError") {
          return;
        }

        setSearchData(emptySearchData);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Could not search right now.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, query]);

  const recentSearches = accessToken
    ? searchData.recentSearches ?? []
    : guestRecent;
  const trendingSearches = searchData.trendingSearches ?? [];
  const hasQuery = query.length > 0;
  const hasResults =
    Boolean(searchData.topResult) ||
    searchData.songs.length > 0 ||
    searchData.artists.length > 0 ||
    searchData.playlists.length > 0;

  const handleSearch = (nextKeyword: string) => {
    router.push(`/search?q=${encodeURIComponent(nextKeyword.trim())}`);
  };

  const handleDeleteRecent = async (item: SearchHistoryItem) => {
    if (!accessToken) {
      deleteGuestRecentSearch(item.id);
      setGuestRecent(getGuestRecentSearches());
      return;
    }

    try {
      await deleteRecentSearchRequest(item.id, accessToken);
      setSearchData((current) => ({
        ...current,
        recentSearches: (current.recentSearches ?? []).filter(
          (recent) => recent.id !== item.id,
        ),
      }));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete recent search.",
      );
    }
  };

  const handleClearRecent = async () => {
    if (!accessToken) {
      clearGuestRecentSearches();
      setGuestRecent([]);
      return;
    }

    try {
      await clearRecentSearchesRequest(accessToken);
      setSearchData((current) => ({ ...current, recentSearches: [] }));
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Could not clear recent searches.",
      );
    }
  };

  const tabs: Array<{ value: SearchTab; label: string }> = [
    { value: "all", label: "All" },
    { value: "songs", label: "Songs" },
    { value: "artists", label: "Artists" },
    { value: "playlists", label: "Playlists" },
  ];

  return (
    <div className="space-y-6 page-fade-in">
      <PageHeader
        eyebrow={hasQuery ? "Search Results" : "Search"}
        title={hasQuery ? `Results for "${query}"` : "Find your next song"}
        description={
          hasQuery
            ? "Search across songs, artists, and playlists."
            : "Explore recent searches and trending keywords."
        }
        action={
          <SearchBox
            key={query}
            onSearch={handleSearch}
            initialValue={query}
            loading={loading}
            className="w-full sm:w-80 md:hidden"
          />
        }
      />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!hasQuery && (
        <div className="space-y-6">
          {recentSearches.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Recent Searches
                </h2>
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="text-xs font-semibold text-zinc-500 transition hover:text-orange-400"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <SearchChip
                    key={item.id}
                    label={item.query}
                    onClick={() => handleSearch(item.query)}
                    onDelete={() => handleDeleteRecent(item)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">
              Trending Searches
            </h2>
            {trendingSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((item) => (
                  <SearchChip
                    key={item}
                    label={item}
                    onClick={() => handleSearch(item)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<SearchIcon size={24} />}
                title="No trending searches yet"
                description="Search activity will appear here after users start searching."
              />
            )}
          </section>
        </div>
      )}

      {hasQuery && (
        <>
          <div className="flex items-center gap-2 border-b border-zinc-900/60 pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-bold transition",
                  activeTab === tab.value
                    ? "bg-orange-500 text-orange-950"
                    : "border border-zinc-800 text-zinc-400 hover:text-white",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="grid min-h-40 place-items-center rounded-xl border border-zinc-900 bg-zinc-950/40 p-8 text-sm text-zinc-500">
              Searching for &quot;{query}&quot;...
            </div>
          )}

          {!loading && !hasResults && !error && (
            <EmptyState
              icon={<SearchIcon size={24} />}
              title={`No results found for "${query}"`}
              description="Try a different keyword or check the spelling."
            />
          )}

          {!loading && hasResults && (
            <div className="space-y-8">
              {activeTab === "all" && (
                <>
                  {searchData.topResult && <TopResultCard item={searchData.topResult} />}
                  <ResultSection title="Songs" items={searchData.songs.slice(0, 6)} />
                  <ResultSection title="Artists" items={searchData.artists.slice(0, 6)} />
                  <ResultSection title="Playlists" items={searchData.playlists.slice(0, 6)} />
                </>
              )}

              {activeTab === "songs" && (
                <ResultSection
                  title="Songs"
                  items={searchData.songs}
                  emptyTitle={`No songs found for "${query}"`}
                />
              )}

              {activeTab === "artists" && (
                <ResultSection
                  title="Artists"
                  items={searchData.artists}
                  emptyTitle={`No artists found for "${query}"`}
                />
              )}

              {activeTab === "playlists" && (
                <ResultSection
                  title="Playlists"
                  items={searchData.playlists}
                  emptyTitle={`No playlists found for "${query}"`}
                />
              )}
            </div>
          )}
        </>
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
