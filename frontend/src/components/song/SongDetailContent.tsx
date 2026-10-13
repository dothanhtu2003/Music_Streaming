"use client";

import { useEffect, useState } from "react";
import { WaveformPlayer } from "@/components/song/WaveformPlayer";
import { SongComments } from "@/components/song/SongComments";
import { getSongRequest } from "@/lib/api";
import { getSongAudioUrl } from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

type SongDetailContentProps = {
  songId: string;
};

function DetailSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 sm:p-8 animate-pulse">
      <div className="flex flex-col md:flex-row items-center md:items-stretch gap-6 lg:gap-8">
        <div className="h-52 w-52 sm:h-56 sm:w-56 md:h-60 md:w-60 lg:h-64 lg:w-64 rounded-2xl bg-zinc-800 shrink-0 self-center md:self-auto" />
        <div className="flex flex-col justify-between flex-1 space-y-4 w-full">
          <div className="space-y-3">
            <div className="h-4 w-24 rounded bg-zinc-800" />
            <div className="h-8 w-2/3 rounded bg-zinc-800" />
            <div className="h-4 w-1/2 rounded bg-zinc-800" />
          </div>
          <div className="space-y-3 mt-4">
            <div className="h-10 w-36 rounded-full bg-zinc-800" />
            <div className="h-14 md:h-16 w-full rounded-xl bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SongDetailContent({ songId }: SongDetailContentProps) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playSong = usePlayerStore((state) => state.playSong);
  const currentSongId = usePlayerStore((state) => state.currentSong?.id ?? null);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
    });

    void getSongRequest(songId)
      .then((result) => {
        if (isMounted) {
          setSong(result);
        }
      })
      .catch((detailError) => {
        if (isMounted) {
          setError(
            detailError instanceof Error
              ? detailError.message
              : "Could not load song detail.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [songId]);

  useEffect(() => {
    if (song && typeof window !== "undefined" && window.innerWidth < 768) {
      if (currentSongId !== song.id) {
        playSong(song, [song]);
      }

      window.dispatchEvent(new Event("OPEN_MOBILE_PLAYER"));
    }
  }, [currentSongId, song, playSong]);

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!song) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
        <p className="text-sm font-medium text-white">Song not found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop View Content Only (Completely Hidden on Mobile) */}
      <div className="hidden md:block space-y-8">
        <WaveformPlayer
          song={song}
          audioUrl={getSongAudioUrl(song) ?? ""}
          queue={[song]}
          variant="soundcloud"
        />

        <SongComments
          songId={song.id}
          songOwnerId={song.artist?.user_id}
          artist={song.artist}
          song={song}
        />
      </div>
    </div>
  );
}
