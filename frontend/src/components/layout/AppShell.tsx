"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomPlayer } from "@/components/player/BottomPlayer";
import { AppHeader } from "@/components/layout/AppHeader";
import { MiniSidebar } from "@/components/layout/MiniSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { usePlayerStore } from "@/stores/player-store";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isFeedPage = pathname === "/feed";
  const isFullWidthPage =
    pathname === "/" ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/popular") ||
    pathname.startsWith("/search");

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-zinc-100">
      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          isFeedPage
            ? "pb-16 md:pb-28"
            : currentSong
            ? "pb-40 md:pb-28"
            : "pb-24 md:pb-8",
        )}
      >
        <div className={cn(pathname !== "/home" && "hidden md:block")}>
          <AppHeader />
        </div>
        {pathname === "/" || pathname === "/about" ? (
          <main className="w-full">{children}</main>
        ) : (
          <div
            className={cn(
              "mx-auto flex w-full max-w-7xl gap-6",
              isFeedPage
                ? "p-0 sm:px-6 lg:px-8 py-0 sm:py-5"
                : "px-4 py-5 sm:px-6 lg:px-8",
            )}
          >
            <main className="min-w-0 flex-1">{children}</main>
            {!isFullWidthPage && <RightSidebar />}
          </div>
        )}
      </div>
      <MiniSidebar />
      <div className={cn(isFeedPage && "hidden md:block")}>
        <BottomPlayer />
      </div>
    </div>
  );
}

