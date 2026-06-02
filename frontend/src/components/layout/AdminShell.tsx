"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
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
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-green-500 text-green-950"
                : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-zinc-800 bg-zinc-950 px-4 py-5 lg:flex lg:flex-col">
        <Link href="/admin" className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-green-500 text-lg font-black text-green-950">
            A
          </span>
          <span>
            <span className="block text-base font-bold text-white">Admin</span>
            <span className="text-xs text-zinc-500">Music management</span>
          </span>
        </Link>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Admin navigation">
          <AdminNavLinks />
        </nav>

        <div className="mt-auto rounded-lg border border-zinc-800 bg-black p-3">
          <p className="truncate text-sm font-semibold text-white">
            {user?.username}
          </p>
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/admin" className="flex items-center gap-2 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-green-500 font-black text-green-950">
                A
              </span>
              <span className="text-sm font-semibold text-white">Admin</span>
            </Link>

            <nav
              className="flex min-w-0 flex-1 gap-2 overflow-x-auto lg:hidden"
              aria-label="Mobile admin navigation"
            >
              <AdminNavLinks />
            </nav>

            <Link
              href="/"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-white sm:block"
            >
              Back to app
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
