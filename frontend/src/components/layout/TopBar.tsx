"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { authNav, mainNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const navItems = user ? [...mainNav, ...authNav] : mainNav;

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500 font-black text-orange-950">
            M
          </span>
          <span className="text-sm font-semibold text-white">Music App</span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 gap-2 overflow-x-auto lg:flex"
          aria-label="Top navigation"
        >
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <nav
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto lg:hidden"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isLoading ? (
          <div className="hidden rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-500 sm:block">
            Loading...
          </div>
        ) : user ? (
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/profile"
              className="max-w-36 truncate rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            >
              {user.username}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
