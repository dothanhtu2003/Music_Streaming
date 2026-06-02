"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  SearchIcon,
  LibraryIcon,
  UserIcon,
} from "@/components/ui/Icons";

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

export function MiniSidebar() {
  const pathname = usePathname();

  const menuItems = [
    { label: "Home", href: "/", icon: HomeIcon },
    { label: "Feed", href: "/feed", icon: LibraryIcon },
    { label: "Search", href: "/search", icon: SearchIcon },
    { label: "Library", href: "/playlists", icon: LibraryIcon },
    { label: "Profile", href: "/profile", icon: UserIcon },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-2 md:hidden" aria-label="Mobile Navigation">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg transition-all duration-200",
              isActive
                ? "text-orange-500"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium tracking-wide">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
