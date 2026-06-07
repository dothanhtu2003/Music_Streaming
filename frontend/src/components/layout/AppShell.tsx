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
  const isFullWidthPage =
    pathname === "/" ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/about");

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-zinc-100">
      <div className={cn(
        "min-h-screen transition-all duration-300",
        currentSong ? "pb-40 md:pb-28" : "pb-20 md:pb-8"
      )}>
        <AppHeader />
        {pathname === "/" || pathname === "/about" ? (
          <main className="w-full">{children}</main>
        ) : (
          <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
            <main className="min-w-0 flex-1">{children}</main>
            {!isFullWidthPage && <RightSidebar />}
          </div>
        )}
      </div>
      <MiniSidebar />
      <BottomPlayer />
    </div>
  );
}
