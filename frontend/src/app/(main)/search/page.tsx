"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/song/SearchBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon } from "@/components/ui/Icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlayerStore } from "@/stores/player-store";
import {
  clearRecentSearchesRequest,
  deleteRecentSearchRequest,
  getGenresRequest,
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
  GenreRecord,
  SearchHistoryItem,
  UniversalSearchItem,
  UniversalSearchResponse,
} from "@/types/music";

const RESULT_LIMIT = 12;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCleanKeyword(query: string) {
  if (!query) return false;
  const trimmed = query.trim();
  return trimmed.length > 0 && !UUID_REGEX.test(trimmed);
}

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

const FEATURED_CATEGORIES = [
  { name: "V-Pop & Nhạc Trẻ", query: "V-Pop", color: "from-rose-600 to-amber-500", icon: "🎵" },
  { name: "TikTok Hits", query: "TikTok", color: "from-purple-600 to-pink-500", icon: "🔥" },
  { name: "Remix & EDM", query: "Remix", color: "from-amber-500 to-red-600", icon: "⚡" },
  { name: "Lofi Chill Beats", query: "Lofi", color: "from-teal-600 to-cyan-500", icon: "🎧" },
  { name: "Ballad Tâm Trạng", query: "Ballad", color: "from-blue-600 to-indigo-600", icon: "🌧️" },
  { name: "Hip-Hop & Rap", query: "Rap", color: "from-violet-600 to-purple-800", icon: "🎤" },
  { name: "R&B & Soul", query: "R&B", color: "from-fuchsia-600 to-rose-600", icon: "🎷" },
  { name: "Acoustic", query: "Acoustic", color: "from-yellow-600 to-amber-700", icon: "🎸" },
];

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

function ResultRowItem({ item }: { item: UniversalSearchItem }) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);
  const playSong = usePlayerStore((state) => state.playSong);

  const handleItemPlay = (e: React.MouseEvent) => {
    if (item.type === "song") {
      e.preventDefault();
      e.stopPropagation();
      playSong({
        id: item.id,
        title: item.title,
        artist_name: item.subtitle,
        cover_image_url: item.imageUrl,
        audio_url: "",
      } as any);
    }
  };

  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3.5 px-3.5 py-3 transition hover:bg-zinc-900/80 active:bg-zinc-900"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "h-11 w-11 shrink-0 object-cover shadow-sm border border-zinc-800/80 transition group-hover:scale-105",
            item.type === "artist" ? "rounded-full" : "rounded-lg",
          )}
        />
      ) : (
        <div
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center border border-zinc-800 bg-zinc-900 text-sm font-black text-orange-500 shadow-sm",
            item.type === "artist" ? "rounded-full" : "rounded-lg",
          )}
        >
          {item.title.slice(0, 1).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-100 transition group-hover:text-orange-400">
            {item.title}
          </h3>
          <span className="shrink-0 rounded border border-zinc-800/80 bg-zinc-900 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-zinc-400">
            {resultTypeLabel(item.type)}
          </span>
        </div>
        <p className="truncate text-xs text-zinc-400 mt-0.5">{item.subtitle}</p>
      </div>

      {item.type === "song" && (
        <button
          type="button"
          onClick={handleItemPlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-orange-500 hover:text-orange-950 group-hover:opacity-100 sm:opacity-80"
          aria-label={`Play ${item.title}`}
        >
          <svg className="h-4 w-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </Link>
  );
}

function TopResultCard({ item }: { item: UniversalSearchItem }) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);
  const playSong = usePlayerStore((state) => state.playSong);

  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        Top Result
      </h2>
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-lg transition hover:border-orange-500/40">
        <div className="flex items-center gap-4">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={item.title}
              className={cn(
                "h-16 w-16 sm:h-20 sm:w-20 shrink-0 object-cover shadow-md border border-zinc-800",
                item.type === "artist" ? "rounded-full" : "rounded-xl",
              )}
            />
          ) : (
            <div
              className={cn(
                "grid h-16 w-16 sm:h-20 sm:w-20 shrink-0 place-items-center bg-zinc-900 border border-zinc-800 text-xl font-black text-orange-500 shadow-md",
                item.type === "artist" ? "rounded-full" : "rounded-xl",
              )}
            >
              {item.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <span className="inline-flex rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-400">
              {resultTypeLabel(item.type)}
            </span>
            <h3 className="truncate text-base sm:text-lg font-bold text-white transition hover:text-orange-400">
              <Link href={item.href}>{item.title}</Link>
            </h3>
            <p className="truncate text-xs text-zinc-400">{item.subtitle}</p>
          </div>
          {item.type === "song" && (
            <button
              type="button"
              onClick={() => {
                playSong({
                  id: item.id,
                  title: item.title,
                  artist_name: item.subtitle,
                  cover_image_url: item.imageUrl,
                  audio_url: "",
                } as any);
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-500 text-orange-950 shadow-md shadow-orange-500/20 transition hover:scale-105 active:scale-95"
              aria-label={`Play ${item.title}`}
            >
              <svg className="h-5 w-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
        </div>
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
    <section className="space-y-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/70 shadow-lg divide-y divide-zinc-900/80">
        {items.map((item) => (
          <ResultRowItem key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

function SearchChip({
  label,
  onClick,
  onDelete,
  variant = "recent",
}: {
  label: string;
  onClick: () => void;
  onDelete?: () => void;
  variant?: "recent" | "trending";
}) {
  return (
    <div className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-zinc-800/80 bg-zinc-900/60 text-xs text-zinc-300 backdrop-blur-sm transition hover:border-orange-500/40 hover:bg-zinc-850">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 min-w-0 truncate px-3 py-1.5 transition hover:text-orange-400 font-medium"
      >
        <span className="text-xs opacity-75">
          {variant === "recent" ? "🕒" : "🔥"}
        </span>
        <span className="truncate">{label}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="border-l border-zinc-800 px-2.5 py-1.5 text-zinc-500 transition hover:text-red-400"
          aria-label={`Remove ${label}`}
        >
          ×
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
  const [fetchedGenres, setFetchedGenres] = useState<GenreRecord[]>([]);
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getGenresRequest(1, 12)
      .then((data) => {
        if (data?.items) setFetchedGenres(data.items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError(null);
        setActiveTab("all");
      }
    });

    if (query.length >= 2 && !accessToken && isCleanKeyword(query)) {
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

  // Filter out raw UUID strings from search chips
  const rawRecent = accessToken
    ? searchData.recentSearches ?? []
    : guestRecent;
  const recentSearches = rawRecent.filter((item) => isCleanKeyword(item.query));

  const rawTrending = searchData.trendingSearches ?? [];
  const trendingSearches = rawTrending.filter((item) => isCleanKeyword(item));

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
    <div className="space-y-6 page-fade-in pb-12">
      {/* Mobile Search Header Bar */}
      <div className="md:hidden sticky top-0 z-20 -mx-4 px-4 py-3 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-900">
        <SearchBox
          key={query}
          onSearch={handleSearch}
          initialValue={query}
          loading={loading}
          className="w-full"
        />
      </div>

      <div className="hidden md:block">
        <PageHeader
          eyebrow={hasQuery ? "Search Results" : "Search"}
          title={hasQuery ? `Results for "${query}"` : "Find your next song"}
          description={
            hasQuery
              ? "Search across songs, artists, and playlists."
              : "Explore recent searches, trending topics, and genres."
          }
          action={
            <SearchBox
              key={query}
              onSearch={handleSearch}
              initialValue={query}
              loading={loading}
              className="w-full sm:w-80"
            />
          }
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {!hasQuery && (
        <div className="space-y-8">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
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
                    variant="recent"
                    onClick={() => handleSearch(item.query)}
                    onDelete={() => handleDeleteRecent(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Trending Searches */}
          {trendingSearches.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
                Trending Searches
              </h2>
              <div className="flex flex-wrap gap-2">
                {trendingSearches.map((item) => (
                  <SearchChip
                    key={item}
                    label={item}
                    variant="trending"
                    onClick={() => handleSearch(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Browse Categories & Genres Grid */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
                Explore Categories & Genres
              </h2>
              <Link href="/genres" className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition">
                View all →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {FEATURED_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleSearch(cat.query)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left shadow-lg transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]",
                    cat.color,
                  )}
                >
                  <div className="relative z-10 flex flex-col justify-between h-20 sm:h-24">
                    <span className="text-sm sm:text-base font-black text-white drop-shadow-md">
                      {cat.name}
                    </span>
                    <span className="self-end text-2xl sm:text-3xl opacity-80 group-hover:scale-125 transition-transform">
                      {cat.icon}
                    </span>
                  </div>
                  <div className="absolute -right-4 -bottom-4 h-16 w-16 rounded-full bg-white/10 blur-xl group-hover:bg-white/20 transition-all" />
                </button>
              ))}

              {fetchedGenres.map((genre) => (
                <Link
                  key={genre.id}
                  href={`/genres/${genre.id}`}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 p-4 text-left shadow-lg transition-all duration-300 hover:scale-[1.03] hover:border-orange-500/40"
                >
                  <div className="relative z-10 flex flex-col justify-between h-20 sm:h-24">
                    <span className="text-sm font-bold text-zinc-100 group-hover:text-orange-400 transition-colors">
                      {genre.name}
                    </span>
                    <span className="self-end text-xs font-semibold text-zinc-500 group-hover:text-zinc-400">
                      Genre →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {hasQuery && (
        <div className="space-y-6">
          {/* Tab Filters */}
          <div className="flex items-center gap-2 border-b border-zinc-900/80 pb-3 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0",
                  activeTab === tab.value
                    ? "bg-orange-500 text-orange-950 shadow-md shadow-orange-500/20"
                    : "border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-700",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="grid min-h-40 place-items-center rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-sm text-zinc-500">
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
            <div className="space-y-6">
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
        </div>
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
