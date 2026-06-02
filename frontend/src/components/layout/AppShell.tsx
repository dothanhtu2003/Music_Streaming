"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomPlayer } from "@/components/player/BottomPlayer";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return <div className="min-h-screen bg-black text-zinc-100">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Sidebar />
      <div className="min-h-screen pb-52 md:pb-36 lg:pl-64">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <BottomPlayer />
    </div>
  );
}
