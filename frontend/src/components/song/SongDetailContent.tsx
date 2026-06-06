"use client";

import { useEffect, useState } from "react";
import { WaveformPlayer } from "@/components/song/WaveformPlayer";
import { SongComments } from "@/components/song/SongComments";
import { getSongRequest } from "@/lib/api";
import { getSongAudioUrl } from "@/lib/song-format";
import type { Song } from "@/types/music";

type SongDetailContentProps = {
  songId: string;
};

function DetailSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:p-8 animate-pulse">
      <div className="flex flex-col-reverse gap-6 md:flex-row md:items-stretch justify-between">
        <div className="flex-1 space-y-6">
          <div className="space-y-3">
            <div className="h-4 w-24 rounded bg-zinc-800" />
            <div className="h-8 w-2/3 rounded bg-zinc-800" />
            <div className="h-4 w-1/2 rounded bg-zinc-800" />
          </div>
          <div className="h-20 w-full rounded-xl bg-zinc-800 mt-8" />
        </div>
        <div className="h-40 w-40 md:h-44 md:w-44 rounded-2xl bg-zinc-800 shrink-0" />
      </div>
    </div>
  );
}

export function SongDetailContent({ songId }: SongDetailContentProps) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-8">
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
  );
}
