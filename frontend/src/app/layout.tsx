import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FollowProvider } from "@/components/follow/FollowProvider";
import { LikeProvider } from "@/components/like/LikeProvider";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { PlaylistProvider } from "@/components/playlist/PlaylistProvider";
import { NotificationStreamProvider } from "@/components/providers/NotificationStreamProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Music Streaming",
    template: "%s",
  },
  description: "Discover, upload, and stream music.",
  applicationName: "Music Streaming",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Music Streaming",
    description: "Discover, upload, and stream music.",
    siteName: "Music Streaming",
    type: "website",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Music Streaming",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Music Streaming",
    description: "Discover, upload, and stream music.",
    images: ["/icons/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Music Streaming",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff5500",
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
                <PlayerProvider>
                  <NotificationStreamProvider />
                  {children}
                </PlayerProvider>
              </PlaylistProvider>
            </LikeProvider>
          </FollowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
