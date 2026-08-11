"use client";

import Link from "next/link";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { PauseIcon, PlayIcon, VerifiedBadge } from "@/components/ui/Icons";
import {
  getArtistDisplayName,
  getSongAudioUrl,
  getSongCoverUrl,
  getGenreName,
} from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import { cn } from "@/lib/utils";
import type { Song } from "@/types/music";

type NowPlayingHeroProps = {
  song: Song;
};

function HeroCover({ song }: { song: Song }) {
  const coverUrl = getSongCoverUrl(song);
  const fallbackLetter = song.title.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <Link
      href={`/songs/${song.id}`}
      className="relative grid aspect-square w-full max-w-[140px] sm:max-w-[260px] lg:w-60 shrink-0 place-items-center overflow-hidden rounded-xl sm:rounded-2xl border border-zinc-700/80 bg-gradient-to-br from-orange-500 to-zinc-950 shadow-2xl shadow-black/40"
      aria-label={`Open ${song.title}`}
    >
      <span className="text-4xl font-black text-white/90 sm:text-7xl">
        {fallbackLetter}
      </span>

      {coverUrl && (
        <span
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverUrl})` }}
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

export function NowPlayingHero({ song }: NowPlayingHeroProps) {
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const audioUrl = getSongAudioUrl(song);
  const artistName = getArtistDisplayName(song.artist);

  return (
    <section className="hero-fade-in relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900/60 p-4 sm:p-8 shadow-2xl">
      {/* Background glow gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,85,0,0.05),transparent_55%)] pointer-events-none" />

      <div className="relative flex flex-col-reverse gap-4 sm:gap-6 md:flex-row md:items-stretch justify-between h-full">
        {/* LEFT COLUMN: Controls, metadata & waveform */}
        <div className="flex flex-col justify-between flex-1 min-w-0">
          
          {/* Top Row: Play button + Title/Artist/Tags */}
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Circular Play Button */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={!audioUrl}
              className={cn(
                "flex h-11 w-11 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full bg-orange-500 text-orange-950 transition-all duration-200 hover:bg-orange-400 hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500",
                isPlaying && "bg-white text-black hover:bg-zinc-200",
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon size={18} className="sm:w-6 sm:h-6" />
              ) : (
                <PlayIcon size={18} className="ml-0.5 sm:w-6 sm:h-6" />
              )}
            </button>

            {/* Metadata (Title, Artist, Tags) */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="rounded bg-orange-500/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-orange-400 border border-orange-500/20">
                  {isPlaying ? "Now playing" : "Paused"}
                </span>
                <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-zinc-400">
                  {getGenreName(song) || "Track"}
                </span>
              </div>

              <Link href={`/songs/${song.id}`} className="group mt-1 block">
                <h1 className="line-clamp-2 whitespace-normal text-lg sm:text-3xl lg:text-4xl font-black text-white transition group-hover:text-orange-400 tracking-tight leading-tight">
                  {song.title}
                </h1>
              </Link>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Link href={`/artists/${song.artist.id}`} className="font-bold text-zinc-200 hover:text-orange-400 transition-colors inline-flex items-center gap-1 text-xs sm:text-sm">
                  <span>{artistName}</span>
                  {song.artist.is_verified && <VerifiedBadge size={12} />}
                </Link>
                <span className="text-zinc-700">•</span>
                <span className="text-zinc-500 font-semibold text-xs truncate max-w-[120px] sm:max-w-none">{song.album?.title ?? "Single"}</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Waveform container */}
          <div className="relative mt-4 md:mt-8 hidden md:block">
            <WaveformVisualizer song={song} audioUrl={audioUrl} height={90} />
          </div>
        </div>

        {/* RIGHT COLUMN: Cover Image */}
        <div className="flex flex-col items-center md:items-end justify-center shrink-0">
          <HeroCover song={song} />
        </div>
      </div>
    </section>
  );
}
