"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SongCard } from "@/components/song/SongCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistIcon } from "@/components/ui/Icons";
import { getAlbumRequest, getSongsRequest, resolveApiAssetUrl } from "@/lib/api";
import type { AlbumRecord, Song } from "@/types/music";

type AlbumDetailPageProps = {
  params: Promise<{ id: string }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getReleaseYear(dateString: string | null) {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).getFullYear().toString();
  } catch {
    return "N/A";
  }
}

function AlbumDetailContent({ albumId }: { albumId: string }) {
  const [album, setAlbum] = useState<AlbumRecord | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [albumResult, songsResult] = await Promise.all([
          getAlbumRequest(albumId),
          getSongsRequest(1, 100, { album_id: albumId }),
        ]);

        if (!isMounted) return;

        setAlbum(albumResult);
        setSongs(songsResult.items);
      } catch (loadError) {
        if (!isMounted) return;
        setError(getErrorMessage(loadError, "Could not load album details."));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [albumId]);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse pb-28">
        <div className="h-40 rounded-xl bg-zinc-950" />
        <div className="space-y-4">
          <div className="h-8 w-48 rounded bg-zinc-950" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="aspect-square rounded-xl bg-zinc-950" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="grid min-h-[50vh] place-items-center pb-28">
        <div className="max-w-md rounded-xl border border-rose-500/20 bg-rose-500/5 px-6 py-5 text-center">
          <p className="text-sm font-bold text-rose-300">{error || "Album not found."}</p>
          <Link
            href="/home"
            className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-orange-950 transition hover:bg-orange-400"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const coverUrl = resolveApiAssetUrl(album.cover_url);
  const artistName = album.artist?.name ?? "Unknown artist";
  const releaseYear = getReleaseYear(album.release_date);

  return (
    <div className="space-y-8 page-fade-in pb-28">
      <section className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 p-6 md:p-8 shadow-xl">
        {/* Glow effect */}
        <div 
          className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-40"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.1), transparent 70%)" }}
        />
        
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`${album.title} cover`}
              width={144}
              height={144}
              unoptimized
              className="h-32 w-32 rounded-xl border border-zinc-800 object-cover shadow-lg sm:h-36 sm:w-36"
            />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-600 sm:h-36 sm:w-36">
              <PlaylistIcon size={40} />
            </div>
          )}
          
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">
              Album
            </p>
            <h1 className="text-2xl font-black text-white sm:text-4xl tracking-tight uppercase italic">
              {album.title}
            </h1>
            <p className="text-sm text-zinc-400 font-medium">
              {artistName} • {releaseYear} • {songs.length} {songs.length === 1 ? "track" : "tracks"}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <PageHeader title="Track list" description="All tracks in this album." />
        {songs.length === 0 ? (
          <EmptyState
            icon={<PlaylistIcon size={24} />}
            title="Empty Album"
            description="There are no songs in this album yet."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} queue={songs} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const [albumId, setAlbumId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void params.then(({ id }) => {
      if (isMounted) {
        setAlbumId(id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [params]);

  return (
    <ProtectedRoute loginPath="/login">
      {albumId ? (
        <AlbumDetailContent albumId={albumId} />
      ) : (
        <div className="grid min-h-40 place-items-center text-sm text-zinc-500">
          Loading album...
        </div>
      )}
    </ProtectedRoute>
  );
}
