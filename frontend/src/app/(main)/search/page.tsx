"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBox } from "@/components/song/SearchBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchIcon, HeartIcon, CommentIcon, MoreIcon } from "@/components/ui/Icons";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlayerStore } from "@/stores/player-store";
import {
  clearRecentSearchesRequest,
  deleteRecentSearchRequest,
  getGenresRequest,
  getSongRequest,
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

function formatCount(num?: number | null) {
  if (!num) return null;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return num.toString();
}

function formatTimeAgo(dateStr?: string | null) {
  if (!dateStr) return "recently";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "recently";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 3600 * 24) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 3600 * 24 * 30) {
    const days = Math.floor(diffSec / (3600 * 24));
    return days <= 1 ? "1 day ago" : `${days} days ago`;
  }
  if (diffSec < 3600 * 24 * 365) {
    const months = Math.floor(diffSec / (3600 * 24 * 30));
    return months <= 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.floor(diffSec / (3600 * 24 * 365));
  return years <= 1 ? "1 year ago" : `${years} years ago`;
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
      <div className="text-xl font-bold text-white">Search results for &quot;...&quot;</div>
      <div className="grid min-h-40 place-items-center rounded-xl border border-zinc-900 bg-zinc-950/40 p-8 text-sm text-zinc-500">
        Loading search...
      </div>
    </div>
  );
}

{/* SoundCloud-Style Song Card */}
function SoundCloudSongCard({ item }: { item: UniversalSearchItem }) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore();
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playLoading, setPlayLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  const isCurrentTrack =
    currentSong?.id === item.id &&
    Boolean(currentSong.artist && currentSong.file_url);
  const isCurrentlyPlaying = isCurrentTrack && isPlaying;

  const handlePlayToggle = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (isCurrentTrack) {
      togglePlay();
      return;
    }

    if (playLoading) {
      return;
    }

    setPlayLoading(true);
    setPlayError(null);

    try {
      const song = await getSongRequest(item.id);
      playSong(song);
    } catch (error) {
      setPlayError(
        error instanceof Error ? error.message : "Could not load this song.",
      );
    } finally {
      setPlayLoading(false);
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const fullUrl = `${window.location.origin}${item.href}`;
    navigator.clipboard.writeText(fullUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex flex-col sm:flex-row gap-4 rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 transition-all duration-200 hover:border-zinc-800 hover:bg-zinc-900/40">
      {/* Cover Artwork */}
      <div className="relative h-32 w-32 sm:h-36 sm:w-36 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-md">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-zinc-900 text-2xl font-black text-orange-500">
            {item.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      {/* Track Content Right Side */}
      <div className="flex flex-1 flex-col justify-between min-w-0 space-y-3">
        {/* Top Header Line: Uploader Name & Time */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href={item.href}
            className="truncate text-xs text-zinc-400 hover:text-zinc-200 hover:underline transition"
          >
            {item.subtitle || "Artist"}
          </Link>
          <span className="shrink-0 text-xs text-zinc-500">
            {formatTimeAgo(item.createdAt)}
          </span>
        </div>

        {/* Title Line & Large Circular Play Button */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={(event) => void handlePlayToggle(event)}
            disabled={playLoading}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95",
              isCurrentlyPlaying
                ? "bg-orange-500 text-black"
                : "bg-white text-black hover:bg-orange-400",
            )}
            aria-label={isCurrentlyPlaying ? "Pause" : "Play"}
            title={playError ?? undefined}
          >
            {playLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isCurrentlyPlaying ? (
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm sm:text-base font-semibold text-zinc-100 transition hover:text-orange-400">
              <Link href={item.href}>{item.title}</Link>
            </h3>
          </div>
        </div>

        {/* Lightweight Audio Visualizer Line (without heavy waveform canvas) */}
        <div className="relative flex items-center gap-2 py-1">
          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden flex items-center">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isCurrentTrack ? "bg-orange-500 w-1/3" : "bg-zinc-700 w-0 group-hover:w-1/4",
              )}
            />
          </div>
          <span className="text-[11px] font-medium text-zinc-500">
            {item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, "0")}` : "3:45"}
          </span>
        </div>

        {/* Bottom Action & Stats Bar (SoundCloud Style) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            {/* Like button */}
            <button
              type="button"
              onClick={() => setLiked(!liked)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition",
                liked
                  ? "border-orange-500/50 bg-orange-500/10 text-orange-500"
                  : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:text-white",
              )}
            >
              <HeartIcon size={12} filled={liked} />
              <span>{formatCount((item.likeCount ?? 0) + (liked ? 1 : 0)) || 0}</span>
            </button>

            {/* Repost button */}
            <button
              type="button"
              onClick={() => setReposted(!reposted)}
              className={cn(
                "flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition",
                reposted
                  ? "border-green-500/50 bg-green-500/10 text-green-400"
                  : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:text-white",
              )}
            >
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
              </svg>
              <span>{formatCount((item.repostCount ?? 0) + (reposted ? 1 : 0)) || 0}</span>
            </button>

            {/* Copy Link button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-xs transition hover:border-zinc-700 hover:text-white"
              title="Copy Link"
            >
              <svg className="h-3 w-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>{copied ? "Copied!" : "Share"}</span>
            </button>

            {/* More menu */}
            <button
              type="button"
              className="rounded border border-zinc-800 bg-zinc-900/80 p-1 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
            >
              <MoreIcon size={12} />
            </button>
          </div>

          {/* Right Stats: Plays & Comments */}
          <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-medium">
            <span className="flex items-center gap-1" title="Plays">
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {formatCount(item.playCount) || 0}
            </span>
            <span className="flex items-center gap-1" title="Comments">
              <CommentIcon size={11} />
              {formatCount(item.commentCount) || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

{/* SoundCloud-Style People / Artist Card */}
function SoundCloudArtistCard({ item }: { item: UniversalSearchItem }) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);
  const [following, setFollowing] = useState(false);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 transition hover:border-zinc-800">
      <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 shadow">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xl font-black text-orange-500">
            {item.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between min-w-0">
        <div className="min-w-0 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500">
            Artist
          </span>
          <h3 className="truncate text-base font-bold text-zinc-100 hover:text-orange-400 transition">
            <Link href={item.href}>{item.title}</Link>
          </h3>
          <p className="truncate text-xs text-zinc-400">{item.subtitle || "500+ followers"}</p>
        </div>

        <button
          type="button"
          onClick={() => setFollowing(!following)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-semibold transition shrink-0",
            following
              ? "border-orange-500 bg-orange-500 text-black"
              : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white",
          )}
        >
          {following ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}

{/* SoundCloud-Style Playlist Card */}
function SoundCloudPlaylistCard({ item }: { item: UniversalSearchItem }) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 transition hover:border-zinc-800">
      <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xl font-black text-orange-500">
            {item.title.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center min-w-0 space-y-1">
        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-orange-500">
          Playlist
        </span>
        <h3 className="truncate text-base font-bold text-zinc-100 hover:text-orange-400 transition">
          <Link href={item.href}>{item.title}</Link>
        </h3>
        <p className="truncate text-xs text-zinc-400">{item.subtitle || "Playlist • 9 tracks"}</p>
      </div>
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
    { value: "all", label: "Everything" },
    { value: "songs", label: "Tracks" },
    { value: "artists", label: "People" },
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

      {/* Main SoundCloud Layout: Left Sidebar + Right Main Area */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] gap-8 items-start">
        
        {/* Left Sidebar (SoundCloud Style Navigation) */}
        <aside className="space-y-6 md:sticky md:top-20">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {hasQuery ? `Search results for "${query}"` : "Search"}
            </h1>
          </div>

          {/* SoundCloud Vertical Tab Navigation Menu */}
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto scrollbar-none border-b md:border-b-0 border-zinc-800 pb-2 md:pb-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm font-semibold transition text-left shrink-0",
                    isActive
                      ? "bg-white text-black font-bold shadow"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Footer Policy & Legal Links (SoundCloud Style) */}
          <div className="hidden md:block pt-6 border-t border-zinc-900 text-[11px] text-zinc-500 leading-relaxed space-y-2">
            <p>
              Legal • Privacy • Cookie Policy • Cookie Manager • Imprint • Artist Resources • Newsroom • Topics • Charts • Transparency Reports
            </p>
            <p className="font-semibold text-zinc-400">
              Language: <span className="text-orange-400">English (US)</span>
            </p>
          </div>
        </aside>

        {/* Right Main Results Section */}
        <main className="space-y-6 min-w-0">
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
                      <div
                        key={item.id}
                        className="inline-flex max-w-full items-center overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 transition hover:border-orange-500/40"
                      >
                        <button
                          type="button"
                          onClick={() => handleSearch(item.query)}
                          className="px-3 py-1.5 font-medium hover:text-orange-400 truncate"
                        >
                          🕒 {item.query}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecent(item)}
                          className="border-l border-zinc-800 px-2 py-1.5 text-zinc-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
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
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleSearch(item)}
                        className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-orange-500/40 hover:text-orange-400"
                      >
                        🔥 {item}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Explore Categories */}
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
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {hasQuery && (
            <div className="space-y-6">
              {/* Counter Subtitle like SoundCloud */}
              <div className="text-sm text-zinc-400 font-medium">
                Found {searchData.playlists.length ? "500+" : "0"} playlists, {searchData.songs.length ? "500+" : "0"} tracks, {searchData.artists.length ? "500+" : "0"} people
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
                <div className="space-y-4">
                  {/* Everything Tab (All) */}
                  {activeTab === "all" && (
                    <>
                      {/* Top Result Card if available */}
                      {searchData.topResult && (
                        <div className="space-y-2">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Top Result
                          </h2>
                          {searchData.topResult.type === "song" ? (
                            <SoundCloudSongCard item={searchData.topResult} />
                          ) : searchData.topResult.type === "artist" ? (
                            <SoundCloudArtistCard item={searchData.topResult} />
                          ) : (
                            <SoundCloudPlaylistCard item={searchData.topResult} />
                          )}
                        </div>
                      )}

                      {/* Songs List */}
                      {searchData.songs.length > 0 && (
                        <div className="space-y-3">
                          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Tracks
                          </h2>
                          <div className="space-y-3">
                            {searchData.songs.map((item) => (
                              <SoundCloudSongCard key={item.id} item={item} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Tracks Tab */}
                  {activeTab === "songs" && (
                    <div className="space-y-3">
                      {searchData.songs.length > 0 ? (
                        searchData.songs.map((item) => (
                          <SoundCloudSongCard key={item.id} item={item} />
                        ))
                      ) : (
                        <EmptyState
                          icon={<SearchIcon size={24} />}
                          title={`No tracks found for "${query}"`}
                        />
                      )}
                    </div>
                  )}

                  {/* People Tab */}
                  {activeTab === "artists" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchData.artists.length > 0 ? (
                        searchData.artists.map((item) => (
                          <SoundCloudArtistCard key={item.id} item={item} />
                        ))
                      ) : (
                        <div className="col-span-2">
                          <EmptyState
                            icon={<SearchIcon size={24} />}
                            title={`No people found for "${query}"`}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Playlists Tab */}
                  {activeTab === "playlists" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {searchData.playlists.length > 0 ? (
                        searchData.playlists.map((item) => (
                          <SoundCloudPlaylistCard key={item.id} item={item} />
                        ))
                      ) : (
                        <div className="col-span-2">
                          <EmptyState
                            icon={<SearchIcon size={24} />}
                            title={`No playlists found for "${query}"`}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
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
