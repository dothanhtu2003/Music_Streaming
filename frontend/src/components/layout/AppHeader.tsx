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
  SearchIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { searchRealtimeSuggestionsRequest, resolveApiAssetUrl } from "@/lib/api";
import {
  getSongCoverUrl,
  getArtistDisplayName,
  getArtistAvatarUrl,
  getGenreName,
} from "@/lib/song-format";
import type { Song, ArtistRecord } from "@/types/music";
import { cn } from "@/lib/utils";

const headerNavItems = [
  { label: "Home", href: "/" },
  { label: "Feed", href: "/feed" },
  { label: "Library", href: "/playlists" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
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

function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  return <SearchInputInner key={q} q={q} router={router} />;
}

type SearchInputInnerProps = {
  q: string;
  router: ReturnType<typeof useRouter>;
};

function SearchInputInner({ q, router }: SearchInputInnerProps) {
  const [query, setQuery] = useState(q);
  const [suggestions, setSuggestions] = useState<{ songs: Song[]; artists: ArtistRecord[] }>({
    songs: [],
    artists: [],
  });
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounced suggestion fetch
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      queueMicrotask(() => {
        setSuggestions({ songs: [], artists: [] });
        setLoading(false);
        setShowDropdown(false);
      });
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setShowDropdown(true);

      try {
        const data = await searchRealtimeSuggestionsRequest(trimmed, 5);
        setSuggestions({
          songs: data.songs.slice(0, 5),
          artists: data.artists.slice(0, 5),
        });
      } catch (err) {
        console.error("Suggestions fetch error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setShowDropdown(false);

    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      return;
    }

    router.push("/search");
  };

  const handleSelect = (path: string) => {
    setShowDropdown(false);
    router.push(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleFocus = () => {
    if (query.trim().length > 0) {
      setShowDropdown(true);
    }
  };

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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search songs, artists..."
          className="h-9 w-full rounded border border-zinc-700 bg-[#303030] py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-400 outline-none transition focus:border-[#ff5500] focus:bg-[#303030] focus:ring-1 focus:ring-[#ff5500]/30"
        />
      </form>

      {/* Suggestions Dropdown */}
      {showDropdown && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 max-h-[420px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200">
          {loading && suggestions.songs.length === 0 && suggestions.artists.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-zinc-500 font-medium">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-[#ff5500]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching suggestions...
            </div>
          ) : (
            <>
              {/* Songs Section */}
              {suggestions.songs.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
                    Songs
                  </div>
                  {suggestions.songs.map((song) => {
                    const coverUrl = getSongCoverUrl(song);
                    return (
                      <button
                        key={song.id}
                        onClick={() => handleSelect(`/songs/${song.id}`)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-900 transition duration-150 group"
                      >
                        {coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverUrl}
                            alt=""
                            className="h-8 w-8 rounded object-cover border border-zinc-800"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-orange-500/20 to-zinc-900 text-[10px] font-black text-orange-500">
                            {song.title.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-zinc-100 group-hover:text-[#ff5500] transition-colors">
                            {song.title}
                          </span>
                          <span className="block truncate text-[10px] text-zinc-500 group-hover:text-zinc-300">
                            by {getArtistDisplayName(song.artist)}
                          </span>
                        </div>
                        <span className="shrink-0 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[8px] font-medium text-zinc-500">
                          {getGenreName(song)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Artists Section */}
              {suggestions.artists.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900">
                    Artists
                  </div>
                  {suggestions.artists.map((artist) => {
                    const avatarUrl = getArtistAvatarUrl(artist);
                    return (
                      <button
                        key={artist.id}
                        onClick={() => handleSelect(`/artists/${artist.id}`)}
                        className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-900 transition duration-150 group"
                      >
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover border border-zinc-800"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-orange-500/20 to-zinc-900 text-[10px] font-black text-orange-500">
                            {getArtistDisplayName(artist).slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-zinc-100 group-hover:text-[#ff5500] transition-colors">
                            {getArtistDisplayName(artist)}
                          </span>
                          <span className="block text-[10px] text-zinc-500">
                            Artist
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {suggestions.songs.length === 0 && suggestions.artists.length === 0 && !loading && (
                <div className="flex items-center justify-center py-6 text-xs text-zinc-500">
                  No results found
                </div>
              )}

              {/* Dropdown footer view all */}
              <div className="mt-2 border-t border-zinc-900 pt-1">
                <button
                  onClick={handleSubmit}
                  className="flex w-full items-center justify-center py-1.5 text-[11px] font-semibold text-zinc-500 hover:text-[#ff5500] transition duration-150"
                >
                  Press Enter to see all results
                </button>
              </div>
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
  const { user, isLoading, logout, isAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-zinc-800 bg-zinc-950/95 px-4 backdrop-blur-md">
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
        </div>

        <div className="hidden min-w-0 justify-self-stretch md:block lg:justify-self-center lg:w-full lg:max-w-md xl:max-w-lg">
          <Suspense
            fallback={
              <div className="h-9 w-full animate-pulse rounded border border-zinc-800 bg-[#303030]" />
            }
          >
            <SearchInput />
          </Suspense>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <Link
            href="/upload"
            className="hidden h-9 items-center rounded px-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-900 hover:text-white sm:inline-flex"
          >
            Upload
          </Link>

          <Link
            href="/search"
            className="inline-flex h-9 items-center rounded px-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white md:hidden"
            aria-label="Search"
          >
            <SearchIcon size={18} />
          </Link>

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
                      {user.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden max-w-28 truncate lg:inline">
                    {user.username}
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
