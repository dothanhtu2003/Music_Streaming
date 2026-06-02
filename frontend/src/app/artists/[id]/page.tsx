"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { SongCard } from "@/components/song/SongCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getArtistRequest, getSongsRequest, resolveApiAssetUrl } from "@/lib/api";
import type { ArtistRecord, Song } from "@/types/music";

function DetailSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 animate-pulse">
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

export default function ArtistDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { isFollowing, toggleFollow, actionId } = useFollow();
  const [artist, setArtist] = useState<ArtistRecord | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
    });

    Promise.all([
      getArtistRequest(id),
      getSongsRequest(1, 10, { artist_id: id })
    ])
      .then(([artistData, songsData]) => {
        if (!isMounted) return;
        setArtist(artistData);
        setSongs(songsData.items);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Could not load artist detail.");
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

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

  if (!artist) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
        <p className="text-sm font-medium text-white">Artist not found.</p>
      </div>
    );
  }

  const isSelf =
    Boolean(user?.id && artist.user_id && user.id === artist.user_id) ||
    user?.username?.toLowerCase() === artist.name.toLowerCase();
  const isArtistFollowed = isFollowing(artist.id);
  const followLoading = actionId === artist.id;

  const coverUrl = resolveApiAssetUrl(artist.avatar_url);

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end">
          {coverUrl ? (
            <div
              className="h-32 w-32 shrink-0 rounded-lg bg-cover bg-center border border-zinc-800 md:h-40 md:w-40"
              style={{ backgroundImage: `url(${coverUrl})` }}
              aria-label={`${artist.name} avatar`}
            />
          ) : (
            <div className="grid h-32 w-32 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-green-500 to-zinc-900 border border-zinc-800 md:h-40 md:w-40">
              <span className="text-5xl font-black text-white/90">
                {artist.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-green-400">
              Artist
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">
              {artist.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
              {artist.bio || "No biography available for this artist."}
            </p>
            
            <div className="mt-6 flex items-center gap-4">
              {!isSelf && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(artist.id, artist.name)}
                  className={`rounded-lg px-6 py-2.5 text-sm font-bold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isArtistFollowed
                      ? "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700"
                      : "bg-green-500 text-green-950 hover:bg-green-400 font-extrabold"
                  }`}
                >
                  {followLoading ? "Loading..." : isArtistFollowed ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <PageHeader title="Latest songs" description={`Browse songs by ${artist.name}`} />
        {songs.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500 text-sm">
            No songs published by this artist yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} queue={songs} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
