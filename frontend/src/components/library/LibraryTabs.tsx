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
      className="flex w-full gap-3 overflow-x-auto pb-1"
    >
      {libraryTabs.map((tab) => {
        const isActive = isActivePath(pathname, tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200",
              isActive
                ? "bg-orange-500 text-orange-950 shadow-md shadow-orange-500/15"
                : "bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:scale-[1.03] active:scale-[0.97]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
