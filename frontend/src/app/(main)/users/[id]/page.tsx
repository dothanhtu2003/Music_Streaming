"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { FollowListModal } from "@/components/follow/FollowListModal";
import {
  ArtistTrackRow,
  ArtistTrackRowSkeleton,
} from "@/components/song/ArtistTrackRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistIcon, UserIcon } from "@/components/ui/Icons";
import {
  getUserPlaylistsRequest,
  getUserProfileRequest,
  getUserSongsRequest,
  resolveApiAssetUrl,
} from "@/lib/api";
import {
  formatPlayCount,
  getArtistAvatarUrl,
  getArtistDisplayName,
} from "@/lib/song-format";
import { cn } from "@/lib/utils";
import type { PublicUserProfile, Song, UserPlaylist } from "@/types/music";

type UserTab = "tracks" | "playlists";

function getFallbackLetter(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "U";
}

function ProfileAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <div
        className="h-28 w-28 shrink-0 rounded-full border-4 border-black/70 bg-zinc-900 bg-cover bg-center shadow-2xl sm:h-36 sm:w-36 md:h-40 md:w-40"
        style={{ backgroundImage: `url(${avatarUrl})` }}
        role="img"
        aria-label={`${name} avatar`}
      />
    );
  }

  return (
    <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-black/70 bg-gradient-to-br from-orange-500 to-zinc-950 shadow-2xl sm:h-36 sm:w-36 md:h-40 md:w-40">
      <span className="text-5xl font-black text-white sm:text-6xl">
        {getFallbackLetter(name)}
      </span>
    </div>
  );
}

function PlaylistCover({ playlist }: { playlist: UserPlaylist }) {
  const coverUrl = resolveApiAssetUrl(playlist.cover_url);
  const title = playlist.title || playlist.name || "Playlist";

  if (coverUrl) {
    return (
      <div
        className="aspect-square rounded-lg bg-zinc-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        role="img"
        aria-label={`${title} cover`}
      />
    );
  }

  return (
    <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-orange-500/80 to-zinc-950">
      <span className="text-4xl font-black text-white">
        {getFallbackLetter(title)}
      </span>
    </div>
  );
}

export default function PublicUserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";
  const { user: currentUser } = useAuth();
  const { isFollowing, toggleFollow, actionId } = useFollow();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [activeTab, setActiveTab] = useState<UserTab>("tracks");
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(true);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFollowModal, setActiveFollowModal] = useState<
    "followers" | "following" | null
  >(null);

  const followTargetId = profile?.artist_id || profile?.id || null;
  const isProfileFollowed =
    isFollowing(profile?.id) ||
    Boolean(profile?.artist_id && isFollowing(profile.artist_id));
  const followLoading =
    actionId === profile?.id ||
    Boolean(profile?.artist_id && actionId === profile.artist_id);
  const isSelf = Boolean(currentUser?.id && profile?.id === currentUser.id);

  useEffect(() => {
    if (isSelf && id) {
      router.replace("/profile");
    }
  }, [isSelf, id, router]);

  const loadSongs = useCallback((userId: string) => {
    setSongsLoading(true);
    getUserSongsRequest(userId, 1, 20)
      .then((result) => setSongs(result.items))
      .catch(() => setSongs([]))
      .finally(() => setSongsLoading(false));
  }, []);

  const loadPlaylists = useCallback((userId: string) => {
    setPlaylistsLoading(true);
    getUserPlaylistsRequest(userId, 1, 12)
      .then((result) => setPlaylists(result.items))
      .catch(() => setPlaylists([]))
      .finally(() => setPlaylistsLoading(false));
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      if (!id) {
        setError("User id is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setProfile(null);
      setSongs([]);
      setPlaylists([]);
      setActiveTab("tracks");

      void getUserProfileRequest(id)
        .then((userProfile) => {
          if (!isMounted) {
            return;
          }

          setProfile(userProfile as PublicUserProfile);
          loadSongs(id);
          loadPlaylists(id);
        })
        .catch((err) => {
          if (!isMounted) {
            return;
          }

          setError(
            err instanceof Error ? err.message : "Could not load user profile.",
          );
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    });

    return () => {
      isMounted = false;
    };
  }, [id, loadPlaylists, loadSongs]);

  const displayName = useMemo(() => {
    if (!profile) return "User";
    return getArtistDisplayName(profile);
  }, [profile]);

  const avatarUrl = useMemo(() => {
    if (!profile) return null;
    return getArtistAvatarUrl(profile);
  }, [profile]);

  if (loading || isSelf) {
    return (
      <div className="space-y-6 page-fade-in">
        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 animate-pulse">
          <div className="h-36 sm:h-48 w-full bg-zinc-900 shimmer" />
          <div className="px-4 pb-6 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20 gap-4 mb-5">
              <div className="h-28 w-28 rounded-full bg-zinc-800 shimmer sm:h-36 sm:w-36 md:h-40 md:w-40" />
              <div className="h-10 w-28 rounded-full bg-zinc-800 shimmer" />
            </div>
            <div className="space-y-3">
              <div className="h-8 w-64 max-w-full rounded bg-zinc-800 shimmer" />
              <div className="h-4 w-80 max-w-full rounded bg-zinc-800 shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-zinc-900 text-zinc-500">
          <UserIcon size={22} />
        </div>
        <p className="mt-4 text-sm font-medium text-white">
          {error || "User not found."}
        </p>
      </div>
    );
  }

  const bio = profile.bio?.trim() || "No biography available.";

  return (
    <div className="space-y-6 page-fade-in">
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
        <div className="relative h-36 sm:h-48 w-full bg-gradient-to-r from-zinc-800 via-zinc-900 to-orange-950/40">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        <div className="px-4 pb-6 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20 gap-4 mb-5">
            <ProfileAvatar name={displayName} avatarUrl={avatarUrl} />

            <div className="flex flex-wrap items-center gap-3">
              {!isSelf && followTargetId && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(followTargetId, displayName)}
                  className={cn(
                    "rounded-full px-6 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                    isProfileFollowed
                      ? "border border-zinc-600 bg-black/40 text-white hover:bg-zinc-800"
                      : "bg-orange-500 text-orange-950 hover:bg-orange-400",
                  )}
                >
                  {followLoading
                    ? "Loading..."
                    : isProfileFollowed
                      ? "Following"
                      : "Follow"}
                </button>
              )}

              {profile.artist_id && (
                <Link
                  href={`/artists/${profile.artist_id}`}
                  className="rounded-full border border-zinc-700 bg-black/35 px-5 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 hover:bg-black/60 hover:text-white"
                >
                  Artist page
                </Link>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
                {profile.artist_id ? "Artist" : "User"}
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                {displayName}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">@{profile.username}</p>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-300">
                {bio}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400 select-none">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="hover:text-white transition cursor-pointer focus:outline-none"
              >
                {profile.followers_count}{" "}
                {profile.followers_count === 1 ? "follower" : "followers"}
              </button>
              <span className="text-zinc-700 select-none">&middot;</span>
              <button
                type="button"
                onClick={() => setActiveFollowModal("following")}
                className="hover:text-white transition cursor-pointer focus:outline-none"
              >
                {profile.following_count} following
              </button>
              <span className="text-zinc-700 select-none">&middot;</span>
              <span>
                {profile.track_count}{" "}
                {profile.track_count === 1 ? "track" : "tracks"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/50">
        <nav className="overflow-x-auto no-scrollbar border-b border-zinc-900">
          <div className="flex min-w-max items-center gap-2">
            {(
              [
                { id: "tracks" as const, label: "Tracks", count: songs.length },
                {
                  id: "playlists" as const,
                  label: "Playlists",
                  count: playlists.length,
                },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative px-4 py-4 text-sm font-bold transition",
                    isActive
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  <span>{tab.label}</span>
                  <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                    {formatPlayCount(tab.count)}
                  </span>
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-orange-400" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 sm:p-5">
          {activeTab === "tracks" ? (
            songsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <ArtistTrackRowSkeleton key={index} />
                ))}
              </div>
            ) : songs.length === 0 ? (
              <EmptyState
                icon={<PlaylistIcon size={24} />}
                title="No public tracks"
                description="This user has not published any tracks yet."
              />
            ) : (
              <div className="space-y-3">
                {songs.map((song) => (
                  <ArtistTrackRow key={song.id} song={song} queue={songs} />
                ))}
              </div>
            )
          ) : playlistsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 animate-pulse"
                >
                  <div className="aspect-square rounded-lg bg-zinc-900/60 shimmer" />
                  <div className="mt-3 h-4 w-2/3 rounded bg-zinc-900/60 shimmer" />
                </div>
              ))}
            </div>
          ) : playlists.length === 0 ? (
            <EmptyState
              icon={<PlaylistIcon size={24} />}
              title="No public playlists"
              description="This user has not shared any playlists yet."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {playlists.map((playlist) => {
                const title = playlist.title || playlist.name || "Playlist";
                const trackCount = playlist.track_count ?? playlist.song_count ?? 0;

                return (
                  <Link
                    key={playlist.id}
                    href={`/playlists/${playlist.id}`}
                    className="group rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 transition hover:border-zinc-800 hover:bg-zinc-900/30"
                  >
                    <PlaylistCover playlist={playlist} />
                    <div className="mt-3 min-w-0">
                      <h3 className="truncate text-sm font-bold text-white transition group-hover:text-orange-400">
                        {title}
                      </h3>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {trackCount} tracks
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {activeFollowModal && (
        <FollowListModal
          userId={profile.id}
          type={activeFollowModal}
          title={activeFollowModal === "followers" ? "Followers" : "Following"}
          onClose={() => setActiveFollowModal(null)}
        />
      )}
    </div>
  );
}
