import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FollowProvider } from "@/components/follow/FollowProvider";
import { LikeProvider } from "@/components/like/LikeProvider";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PlaylistProvider } from "@/components/playlist/PlaylistProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
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
      data-scroll-behavior="smooth"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-zinc-100">
        <AuthProvider>
          <FollowProvider>
            <LikeProvider>
              <PlaylistProvider>
                <PlayerProvider>{children}</PlayerProvider>
              </PlaylistProvider>
            </LikeProvider>
          </FollowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
