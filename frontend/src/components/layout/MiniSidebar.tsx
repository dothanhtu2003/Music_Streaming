"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  HomeIcon,
  SearchIcon,
  LibraryIcon,
  UserIcon,
  MusicIcon,
} from "@/components/ui/Icons";
import { useAuth } from "@/components/auth/AuthProvider";

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

export function MiniSidebar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const menuItems = [
    { label: "Home", href: "/home", icon: HomeIcon },
    { label: "Feed", href: "/feed", icon: LibraryIcon },
    { label: "Search", href: "/search", icon: SearchIcon },
    ...(isAuthenticated
      ? [{ label: "Studio", href: "/studio", icon: MusicIcon }]
      : []),
    { label: "Library", href: "/playlists", icon: LibraryIcon },
    { label: "Profile", href: "/profile", icon: UserIcon },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-2xl px-1 pb-safe md:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.8)]"
      aria-label="Mobile Navigation"
    >
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            onClick={(e) => {
              if (isActive && item.href === "/feed") {
                e.preventDefault();
                window.dispatchEvent(new Event("REFRESH_MOBILE_FEED"));
              }
            }}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-90 touch-target",
              isActive
                ? "text-orange-500 font-bold"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {isActive && (
              <span className="absolute top-0 h-1 w-7 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.9)] transition-all duration-300" />
            )}
            <Icon size={20} className={cn("transition-all duration-200", isActive && "scale-115 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]")} />
            <span className={cn("text-[10px] tracking-tight transition-colors", isActive ? "text-orange-400 font-extrabold" : "text-zinc-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
