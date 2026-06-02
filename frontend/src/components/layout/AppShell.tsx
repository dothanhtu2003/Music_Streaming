"use client";

import type { ReactNode } from "react";
import { BottomPlayer } from "@/components/player/BottomPlayer";
import { AppHeader } from "@/components/layout/AppHeader";
import { MiniSidebar } from "@/components/layout/MiniSidebar";
import { RightSidebar } from "@/components/layout/RightSidebar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-zinc-100">
      <div className="min-h-screen pb-36 md:pb-16">
        <AppHeader />
        <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <main className="min-w-0 flex-1">{children}</main>
          <RightSidebar />
        </div>
      </div>
      <MiniSidebar />
      <BottomPlayer />
    </div>
  );
}
