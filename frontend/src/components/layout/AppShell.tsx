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
    pathname.startsWith("/search") ||
    pathname.startsWith("/songs") ||
    pathname.startsWith("/playlists") ||
    pathname.startsWith("/liked");

  return (
    <div className="relative min-h-screen md:h-screen md:overflow-hidden bg-black text-zinc-100 flex flex-col">
      <div className={cn("shrink-0 z-30", pathname !== "/home" && "hidden md:block")}>
        <AppHeader />
      </div>
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {pathname === "/" || pathname === "/about" ? (
          <main className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">{children}</main>
        ) : (
          <div
            className={cn(
              "mx-auto flex w-full max-w-7xl flex-1 min-h-0 gap-6",
              isFeedPage
                ? "p-0 sm:px-6 lg:px-8 py-0 sm:py-5"
                : "px-4 py-4 sm:px-6 lg:px-8",
            )}
          >
            <main className="min-w-0 flex-1 h-full overflow-y-auto no-scrollbar pb-24">
              {children}
            </main>
            {!isFullWidthPage && <RightSidebar />}
          </div>
        )}
      </div>
      <MiniSidebar />
      <div className={cn("shrink-0 z-40", isFeedPage && "hidden md:block")}>
        <BottomPlayer />
      </div>
    </div>
  );
}

