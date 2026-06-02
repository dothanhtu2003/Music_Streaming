"use client";

import Link from "next/link";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import {
  getArtistDisplayName,
  getSongAudioUrl,
  getSongCoverUrl,
  getGenreName,
} from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
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
      className="relative grid aspect-square w-full max-w-[220px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-br from-orange-500 to-zinc-950 shadow-2xl shadow-black/40 sm:max-w-[260px] lg:w-60"
      aria-label={`Open ${song.title}`}
    >
      <span className="text-6xl font-black text-white/90 sm:text-7xl">
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
  const audioUrl = getSongAudioUrl(song);
  const artistName = getArtistDisplayName(song.artist);

  return (
    <section className="hero-fade-in relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black p-5 shadow-2xl sm:p-8 lg:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_45%)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        <HeroCover song={song} />

        <div className="min-w-0 flex-1 space-y-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              {isPlaying ? "Now playing" : "Paused"}
            </p>
            <Link href={`/songs/${song.id}`} className="group mt-2 block">
              <h1 className="truncate text-3xl font-extrabold text-white transition group-hover:text-orange-400 sm:text-5xl">
                {song.title}
              </h1>
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400 sm:text-base">
              <Link
                href={`/artists/${song.artist.id}`}
                className="font-semibold text-zinc-200 transition hover:text-orange-400"
              >
                {artistName}
              </Link>
              <span className="text-zinc-600">/</span>
              <span>{song.album?.title ?? "Single"}</span>
              <span className="text-zinc-600">/</span>
              <span>{getGenreName(song)}</span>
            </div>
          </div>

          <WaveformVisualizer song={song} audioUrl={audioUrl} height={104} />
        </div>
      </div>
    </section>
  );
}
