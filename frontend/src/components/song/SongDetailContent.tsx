"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlayer } from "@/components/player/PlayerProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { getSongRequest } from "@/lib/api";
import {
  formatDuration,
  formatPlayCount,
  getAlbumTitle,
  getGenreName,
  getSongCoverUrl,
} from "@/lib/song-format";
import type { Song } from "@/types/music";

type SongDetailContentProps = {
  songId: string;
};

function DetailSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <div className="h-40 w-40 rounded-lg bg-zinc-800" />
        <div className="flex-1 space-y-4">
          <div className="h-4 w-20 rounded bg-zinc-800" />
          <div className="h-10 w-2/3 rounded bg-zinc-800" />
          <div className="h-4 w-1/2 rounded bg-zinc-800" />
          <div className="h-10 w-24 rounded bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

function SongCover({ song }: { song: Song }) {
  const coverUrl = getSongCoverUrl(song);

  if (coverUrl) {
    return (
      <div
        className="h-40 w-40 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${song.title} cover`}
      />
    );
  }

  return (
    <div className="grid h-40 w-40 place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900">
      <span className="text-5xl font-black text-white/90">
        {song.title.slice(0, 1)}
      </span>
    </div>
  );
}

export function SongDetailContent({ songId }: SongDetailContentProps) {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const { openAddSongModal } = usePlaylists();
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
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          <SongCover song={song} />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-green-400">
              Song
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">
              {song.title}
            </h1>
            <p className="mt-3 text-zinc-400">
              <Link href={`/artists/${song.artist.id}`} className="hover:text-white">
                {song.artist.name}
              </Link>{" "}
              -{" "}
              {song.album ? (
                <Link href={`/albums/${song.album.id}`} className="hover:text-white">
                  {song.album.title}
                </Link>
              ) : (
                "Single"
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-zinc-400">
              <span className="rounded-full border border-zinc-700 px-3 py-1">
                {formatDuration(song.duration_sec)}
              </span>
              <span className="rounded-full border border-zinc-700 px-3 py-1">
                {getGenreName(song)}
              </span>
              <span className="rounded-full border border-zinc-700 px-3 py-1">
                {getAlbumTitle(song)}
              </span>
              <span className="rounded-full border border-zinc-700 px-3 py-1">
                {formatPlayCount(song.play_count)} plays
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => playSong(song, [song])}
                className="rounded-lg bg-green-500 px-5 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400"
              >
                {currentSong?.id === song.id && isPlaying ? "Playing" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => openAddSongModal(song)}
                className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
              >
                Add to playlist
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
