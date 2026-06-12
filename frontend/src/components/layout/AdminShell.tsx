"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getAdminUserDisplayName, getAdminUserInitials } from "@/lib/admin-format";
import { adminNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: ReactNode;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNavItemIcon(href: string) {
  const baseClass = "h-4 w-4 shrink-0 transition-colors";
  switch (href) {
    case "/admin": // Dashboard
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      );
    case "/admin/songs": // Songs
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case "/admin/upload": // Upload
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      );
    case "/admin/artists": // Artists
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "/admin/albums": // Albums
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "/admin/genres": // Genres
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "/admin/playlists": // Playlists
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      );
    case "/admin/users": // Users
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "/admin/notifications": // Notifications
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
      );
    default:
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      );
  }
}

function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {adminNav.map((item) => {
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-emerald-500/15 text-emerald-400 font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200",
            )}
          >
            {getNavItemIcon(item.href)}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const accountName = getAdminUserDisplayName(user);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-zinc-900/80 bg-black px-4 py-5 lg:flex lg:flex-col">
        <Link href="/admin" className="flex items-center gap-3 px-2 pb-5 border-b border-zinc-900">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg font-black text-zinc-950 shadow-md shadow-emerald-500/20">
            M
          </span>
          <span>
            <span className="block text-base font-bold text-white tracking-tight">Music Admin</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-550">Dashboard Panel</span>
          </span>
        </Link>

        <nav className="mt-6 flex flex-col gap-1.5" aria-label="Admin navigation">
          <AdminNavLinks />
        </nav>

        <div className="mt-auto pt-5 border-t border-zinc-900">
          <div className="flex flex-col gap-3 rounded-xl bg-zinc-900/35 border border-zinc-900/80 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-sm font-bold text-emerald-450 border border-zinc-700/50 uppercase">
                {getAdminUserInitials(user)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {accountName}
                </p>
                <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-rose-400 transition hover:border-rose-500/40 hover:text-rose-350 active:scale-95 cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-zinc-900/80 bg-zinc-950/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-6 sm:px-8">
            <Link href="/admin" className="flex items-center gap-2.5 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 font-black text-zinc-950 shadow-sm shadow-emerald-500/15">
                M
              </span>
              <span className="text-sm font-bold text-white tracking-tight">Music Admin</span>
            </Link>

            <nav
              className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto lg:hidden px-2 py-1 scrollbar-none"
              aria-label="Mobile admin navigation"
            >
              <AdminNavLinks />
            </nav>

            <Link
              href="/"
              className="hidden rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:text-white sm:flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to app</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
