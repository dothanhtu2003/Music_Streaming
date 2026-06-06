"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { LibraryTabs } from "@/components/library/LibraryTabs";
import { useLikes } from "@/components/like/LikeProvider";
import { SongList } from "@/components/song/SongList";
import { HeartIcon } from "@/components/ui/Icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePlayerStore } from "@/stores/player-store";

export default function LikedPage() {
  const { likedSongs, isLoading, error } = useLikes();
  const { accessToken, isLoading: authLoading } = useAuth();
  const playSong = usePlayerStore((state) => state.playSong);

  const isLoggedIn = Boolean(accessToken);
  const songCountText = authLoading
    ? "Checking login..."
    : isLoggedIn
      ? `${likedSongs.length} songs`
      : "Login required";

  const handlePlayAll = () => {
    if (likedSongs.length > 0) {
      playSong(likedSongs[0], likedSongs);
    }
  };

  return (
    <div className="space-y-8 page-fade-in pb-16">
      <LibraryTabs />

      {/* Premium Spotify-style Liked Songs Banner */}
      <section className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-emerald-950/40 via-zinc-950 to-black p-6 shadow-2xl sm:p-8 transition-all duration-300 hover:border-zinc-700/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.06),transparent_45%)]" />
        
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          {/* Glowing heart icon block */}
          <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-orange-600 shadow-xl shadow-emerald-500/30 md:h-36 md:w-36 transition-all duration-500 group-hover:scale-[1.03] group-hover:shadow-emerald-500/40">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-orange-600 opacity-55 blur-md -z-10 group-hover:opacity-80 transition-opacity" />
            <HeartIcon size={56} filled className="text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)] animate-pulse" />
          </div>
          
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">
              Library
            </span>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Liked Songs
            </h1>
            
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">Your collection</span>
              <span className="text-zinc-600">•</span>
              <span>{songCountText}</span>
            </div>
            
            {isLoggedIn && likedSongs.length > 0 && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handlePlayAll}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-xs font-bold text-orange-950 transition-all duration-200 hover:bg-orange-400 hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Play All
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {authLoading && (
          <SongList songs={[]} loading variant="list" emptyMessage="Loading liked songs..." />
        )}

        {!authLoading && !isLoggedIn && (
          <EmptyState
            icon={<HeartIcon size={24} />}
            title="Please login to view liked songs"
            description="You need to be logged in to view and play your liked tracks."
            actionLabel="Login"
            href="/login?redirect=%2Fliked"
          />
        )}

        {!authLoading && isLoggedIn && (
          <SongList
            songs={likedSongs}
            loading={isLoading}
            error={error}
            variant="list"
            emptyMessage="No liked songs yet"
            emptyDescription="Browse the library and start liking songs to populate your collection!"
          />
        )}
      </div>
    </div>
  );
}
