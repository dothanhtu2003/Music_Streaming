"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  AdminIcon,
  ChevronDownIcon,
  LogoutIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/Icons";
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      return;
    }

    router.push("/search");
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
        <SearchIcon size={18} />
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search songs, artists..."
        className="h-9 w-full rounded border border-zinc-700 bg-[#303030] py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-400 outline-none transition focus:border-orange-500 focus:bg-[#303030] focus:ring-1 focus:ring-orange-500/30"
      />
    </form>
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
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-bold text-black">
                    {user.username.slice(0, 1).toUpperCase()}
                  </div>
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
