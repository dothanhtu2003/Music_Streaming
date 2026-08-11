"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/notification/NotificationBell";
import {
  AdminIcon,
  ChevronDownIcon,
  LogoutIcon,
  MusicIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/Icons";
import {
  clearRecentSearchesRequest,
  deleteRecentSearchRequest,
  getSearchSuggestionsRequest,
  resolveApiAssetUrl,
} from "@/lib/api";
import {
  clearGuestRecentSearches,
  deleteGuestRecentSearch,
  getGuestRecentSearches,
  saveGuestRecentSearch,
} from "@/lib/search-storage";
import type {
  SearchHistoryItem,
  UniversalSearchItem,
  UniversalSearchResponse,
} from "@/types/music";
import { cn } from "@/lib/utils";

const headerNavItems = [
  { label: "Home", href: "/home" },
  { label: "Feed", href: "/feed" },
  { label: "Library", href: "/playlists" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/home") {
    return pathname === "/home";
  }

  if (href === "/playlists") {
    return (
      pathname === "/playlists" ||
      pathname.startsWith("/playlists/") ||
      pathname === "/liked"
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SearchInput({ accessToken }: { accessToken: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  return <SearchInputInner key={q} q={q} router={router} accessToken={accessToken} />;
}

type SearchInputInnerProps = {
  q: string;
  router: ReturnType<typeof useRouter>;
  accessToken: string | null;
};

type SearchOption =
  | { key: string; label: string; href: string; kind: "result"; item: UniversalSearchItem }
  | { key: string; label: string; href: string; kind: "suggestion" | "recent" | "trending"; id?: string };

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

function resultTypeLabel(type: UniversalSearchItem["type"]) {
  if (type === "song") {
    return "Song";
  }

  if (type === "artist") {
    return "Artist";
  }

  return "Playlist";
}

function ResultRow({
  item,
  active,
  onSelect,
}: {
  item: UniversalSearchItem;
  active: boolean;
  onSelect: () => void;
}) {
  const imageUrl = resolveApiAssetUrl(item.imageUrl);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition",
        active ? "bg-zinc-900 text-white" : "text-zinc-200 hover:bg-zinc-900",
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className={cn(
            "h-9 w-9 shrink-0 object-cover border border-zinc-800",
            item.type === "artist" ? "rounded-full" : "rounded",
          )}
        />
      ) : (
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center border border-zinc-800 bg-zinc-900 text-xs font-black text-orange-500",
            item.type === "artist" ? "rounded-full" : "rounded",
          )}
        >
          {item.title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{item.title}</span>
        <span className="block truncate text-[10px] text-zinc-500">
          {item.subtitle || resultTypeLabel(item.type)}
        </span>
      </div>
      <span className="shrink-0 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[8px] font-medium uppercase text-zinc-500">
        {resultTypeLabel(item.type)}
      </span>
    </button>
  );
}

function SearchInputInner({ q, router, accessToken }: SearchInputInnerProps) {
  const [query, setQuery] = useState(q);
  const [searchData, setSearchData] = useState<UniversalSearchResponse>(emptySearchData);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const recentSearches = accessToken
    ? searchData.recentSearches ?? []
    : getGuestRecentSearches();
  const trendingSearches = searchData.trendingSearches ?? [];
  const trimmedQuery = query.trim();

  const options: SearchOption[] = [
    ...(searchData.topResult
      ? [
          {
            key: `top-${searchData.topResult.type}-${searchData.topResult.id}`,
            label: searchData.topResult.title,
            href: searchData.topResult.href,
            kind: "result" as const,
            item: searchData.topResult,
          },
        ]
      : []),
    ...searchData.songs.map((item) => ({
      key: `song-${item.id}`,
      label: item.title,
      href: item.href,
      kind: "result" as const,
      item,
    })),
    ...searchData.artists.map((item) => ({
      key: `artist-${item.id}`,
      label: item.title,
      href: item.href,
      kind: "result" as const,
      item,
    })),
    ...searchData.playlists.map((item) => ({
      key: `playlist-${item.id}`,
      label: item.title,
      href: item.href,
      kind: "result" as const,
      item,
    })),
    ...searchData.suggestions.map((suggestion) => ({
      key: `suggestion-${suggestion}`,
      label: suggestion,
      href: `/search?q=${encodeURIComponent(suggestion)}`,
      kind: "suggestion" as const,
    })),
    ...recentSearches.map((item) => ({
      key: `recent-${item.id}`,
      label: item.query,
      href: `/search?q=${encodeURIComponent(item.query)}`,
      kind: "recent" as const,
      id: item.id,
    })),
    ...trendingSearches.map((item) => ({
      key: `trending-${item}`,
      label: item,
      href: `/search?q=${encodeURIComponent(item)}`,
      kind: "trending" as const,
    })),
  ];

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const trimmed = query.trim();

    timerRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      try {
        const data = await getSearchSuggestionsRequest(trimmed, 5, {
          accessToken,
          signal: controller.signal,
        });
        setSearchData(data);
        setActiveIndex(-1);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        console.error("Suggestions fetch error:", err);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      abortRef.current?.abort();
    };
  }, [accessToken, query]);

  const goToSearch = (value: string) => {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      router.push("/search");
      return;
    }

    if (!accessToken) {
      saveGuestRecentSearch(normalizedValue);
    }

    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(normalizedValue)}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (activeIndex >= 0 && options[activeIndex]) {
      handleOptionSelect(options[activeIndex]);
      return;
    }

    goToSearch(query);
  };

  const handleOptionSelect = (option: SearchOption) => {
    if (option.kind !== "result" && !accessToken) {
      saveGuestRecentSearch(option.label);
    }

    setShowDropdown(false);
    router.push(option.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowDropdown(true);
      setActiveIndex((current) => (options.length ? (current + 1) % options.length : -1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setShowDropdown(true);
      setActiveIndex((current) => {
        if (!options.length) {
          return -1;
        }

        return current <= 0 ? options.length - 1 : current - 1;
      });
    }
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleDeleteRecent = async (item: SearchHistoryItem) => {
    if (!accessToken) {
      deleteGuestRecentSearch(item.id);
      setSearchData((current) => ({ ...current }));
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
    } catch (error) {
      console.error("Delete recent search error:", error);
    }
  };

  const handleClearRecent = async () => {
    if (!accessToken) {
      clearGuestRecentSearches();
      setSearchData((current) => ({ ...current }));
      return;
    }

    try {
      await clearRecentSearchesRequest(accessToken);
      setSearchData((current) => ({ ...current, recentSearches: [] }));
    } catch (error) {
      console.error("Clear recent searches error:", error);
    }
  };

  const hasQueryResults =
    Boolean(searchData.topResult) ||
    searchData.songs.length > 0 ||
    searchData.artists.length > 0 ||
    searchData.playlists.length > 0 ||
    searchData.suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
          <SearchIcon size={18} />
        </div>
        <input
          type="search"
          value={query}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onChange={(event) => {
            setQuery(event.target.value);
            setShowDropdown(true);
          }}
          placeholder="Search songs, artists..."
          className="h-9 w-full rounded border border-zinc-700 bg-[#303030] py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-400 outline-none transition focus:border-[#ff5500] focus:bg-[#303030] focus:ring-1 focus:ring-[#ff5500]/30"
        />
      </form>

      {/* Suggestions Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[min(520px,calc(100vh-120px))] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200">
          {loading && !hasQueryResults && recentSearches.length === 0 && trendingSearches.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-zinc-500 font-medium">
              Searching suggestions...
            </div>
          ) : (
            <>
              {searchData.topResult &&
                trimmedQuery.length >= 2 &&
                (() => {
                  const topResult = searchData.topResult;

                  return (
                    <div className="space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
                        Top Result
                      </div>
                      <ResultRow
                        item={topResult}
                        active={
                          activeIndex ===
                          options.findIndex((option) => option.key.startsWith("top-"))
                        }
                        onSelect={() =>
                          handleOptionSelect({
                            key: `top-${topResult.type}-${topResult.id}`,
                            label: topResult.title,
                            href: topResult.href,
                            kind: "result",
                            item: topResult,
                          })
                        }
                      />
                    </div>
                  );
                })()}

              {[
                ["Songs", searchData.songs],
                ["Artists", searchData.artists],
                ["Playlists", searchData.playlists],
              ].map(([title, items]) => {
                const typedItems = items as UniversalSearchItem[];

                if (typedItems.length === 0 || trimmedQuery.length < 2) {
                  return null;
                }

                return (
                  <div key={title as string} className="mt-2.5 space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
                      {title as string}
                    </div>
                    {typedItems.map((item) => {
                      const optionIndex = options.findIndex(
                        (option) => option.kind === "result" && option.href === item.href,
                      );

                      return (
                        <ResultRow
                          key={`${item.type}-${item.id}`}
                          item={item}
                          active={activeIndex === optionIndex}
                          onSelect={() =>
                            handleOptionSelect({
                              key: `${item.type}-${item.id}`,
                              label: item.title,
                              href: item.href,
                              kind: "result",
                              item,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}

              {searchData.suggestions.length > 0 && trimmedQuery.length >= 2 && (
                <div className="mt-2.5 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
                    Suggestions
                  </div>
                  {searchData.suggestions.map((suggestion) => {
                    const optionIndex = options.findIndex(
                      (option) => option.kind === "suggestion" && option.label === suggestion,
                    );

                    return (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => goToSearch(suggestion)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition",
                          activeIndex === optionIndex
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-300 hover:bg-zinc-900",
                        )}
                      >
                        <SearchIcon size={14} className="shrink-0 text-zinc-500" />
                        <span className="truncate">Search for &quot;{suggestion}&quot;</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {recentSearches.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center justify-between border-b border-zinc-900 px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRecent}
                      className="text-[10px] font-semibold text-zinc-500 transition hover:text-orange-500"
                    >
                      Clear
                    </button>
                  </div>
                  {recentSearches.map((item) => {
                    const optionIndex = options.findIndex(
                      (option) => option.kind === "recent" && option.id === item.id,
                    );

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center rounded-lg transition",
                          activeIndex === optionIndex ? "bg-zinc-900" : "hover:bg-zinc-900",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => goToSearch(item.query)}
                          className="min-w-0 flex-1 px-2.5 py-2 text-left text-xs text-zinc-300"
                        >
                          <span className="block truncate">{item.query}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecent(item)}
                          className="px-2.5 py-2 text-xs text-zinc-500 transition hover:text-orange-500"
                          aria-label={`Remove ${item.query}`}
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {trendingSearches.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
                    Trending Searches
                  </div>
                  {trendingSearches.map((item) => {
                    const optionIndex = options.findIndex(
                      (option) => option.kind === "trending" && option.label === item,
                    );

                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => goToSearch(item)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition",
                          activeIndex === optionIndex
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-300 hover:bg-zinc-900",
                        )}
                      >
                        <SearchIcon size={14} className="shrink-0 text-zinc-500" />
                        <span className="truncate">{item}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!hasQueryResults &&
                recentSearches.length === 0 &&
                trendingSearches.length === 0 &&
                !loading && (
                <div className="flex items-center justify-center py-6 text-xs text-zinc-500">
                  No results found
                </div>
              )}

              {trimmedQuery.length > 0 && (
                <div className="mt-2 border-t border-zinc-900 pt-1">
                <button
                  onClick={handleSubmit}
                  className="flex w-full items-center justify-center py-1.5 text-[11px] font-semibold text-zinc-500 hover:text-[#ff5500] transition duration-150"
                >
                  Press Enter to see all results
                </button>
              </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, isLoading, logout, isAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isAboutPage = pathname === "/" || pathname === "/about";
  const accountName = user?.displayName || user?.username || "User";

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header className={cn(
      "z-30 h-14 px-4 transition-all duration-300",
      isAboutPage
        ? "absolute top-0 left-0 right-0 border-b-0 bg-transparent"
        : "sticky top-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md"
    )}>
      <div className="relative mx-auto grid h-14 w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 lg:gap-4">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-orange-500 font-black text-black">
              M
            </span>
            <span className="hidden text-sm font-bold text-white sm:inline">
              Music
            </span>
          </Link>

          {!isAboutPage && (
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Main navigation"
            >
              {headerNavItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-14 items-center border-x border-transparent px-3 text-sm font-medium transition lg:px-4",
                      isActive
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="hidden min-w-0 justify-self-stretch md:block lg:justify-self-center lg:w-full lg:max-w-md xl:max-w-lg">
          {!isAboutPage && (
            <Suspense
              fallback={
                <div className="h-9 w-full animate-pulse rounded border border-zinc-800 bg-[#303030]" />
              }
            >
              <SearchInput accessToken={accessToken} />
            </Suspense>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {!isAboutPage && (
            <Link
              href="/upload"
              className="hidden h-9 items-center rounded px-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 hover:text-white sm:inline-flex"
            >
              Upload
            </Link>
          )}

          {!isAboutPage && (
            <Link
              href="/search"
              className="inline-flex h-9 items-center rounded px-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white md:hidden"
              aria-label="Search"
            >
              <SearchIcon size={18} />
            </Link>
          )}

          {user && <NotificationBell />}

          <div className="relative">
            {isLoading ? (
              <div className="h-9 w-20 animate-pulse rounded border border-zinc-800 bg-zinc-900" />
            ) : user ? (
              <div>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex h-9 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 hover:text-white"
                >
                  {user.avatarUrl ? (
                    <div
                      className="h-7 w-7 shrink-0 rounded-full bg-cover bg-center border border-zinc-800 shadow-inner"
                      style={{ backgroundImage: `url(${resolveApiAssetUrl(user.avatarUrl)})` }}
                    />
                  ) : (
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-bold text-black">
                      {accountName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden max-w-28 truncate lg:inline">
                    {accountName}
                  </span>
                  <ChevronDownIcon size={14} className="text-zinc-500" />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      onClick={() => setDropdownOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />

                    <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-2xl ring-1 ring-black ring-opacity-5">
                      <Link
                        href="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                      >
                        <UserIcon size={16} />
                        My Profile
                      </Link>

                      <Link
                        href="/studio"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                      >
                        <MusicIcon size={16} />
                        Artist Studio
                      </Link>

                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
                        >
                          <AdminIcon size={16} />
                          Admin Area
                        </Link>
                      )}

                      <hr className="my-1 border-zinc-900" />

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition hover:bg-zinc-900 hover:text-red-300"
                      >
                        <LogoutIcon size={16} />
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="hidden rounded bg-orange-500 px-3.5 py-1.5 text-sm font-semibold text-black transition hover:bg-orange-400 sm:inline-flex"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
}
