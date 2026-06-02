"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const libraryTabs = [
  { label: "Playlists", href: "/playlists" },
  { label: "Liked Songs", href: "/liked" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function LibraryTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Library sections"
      className="flex w-full gap-2 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1"
    >
      {libraryTabs.map((tab) => {
        const isActive = isActivePath(pathname, tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-green-500 text-green-950"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
