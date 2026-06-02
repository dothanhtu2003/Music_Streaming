import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FollowProvider } from "@/components/follow/FollowProvider";
import { LikeProvider } from "@/components/like/LikeProvider";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PlaylistProvider } from "@/components/playlist/PlaylistProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Music Streaming",
  description: "Frontend for a music streaming web app portfolio project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-zinc-100">
        <AuthProvider>
          <FollowProvider>
            <LikeProvider>
              <PlaylistProvider>
                <PlayerProvider>
                  <AppShell>{children}</AppShell>
                </PlayerProvider>
              </PlaylistProvider>
            </LikeProvider>
          </FollowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
