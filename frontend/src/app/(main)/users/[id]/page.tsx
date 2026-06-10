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
  const fallbackLetter = getFallbackLetter(name);

  return (
    <div className="group relative h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 shrink-0 select-none">
      {/* Outer Rotating Glowing Ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-600 p-[2px] opacity-70 blur-[8px] transition-all duration-700 group-hover:opacity-100 group-hover:blur-[12px] animate-spin-slow" />
      
      {/* Inner Border Ring */}
      <div className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-600 p-[3px] transition-all duration-500 group-hover:scale-[1.02]">
        <div className="h-full w-full rounded-full bg-zinc-950 p-[2px]">
          {avatarUrl ? (
            <div
              className="h-full w-full rounded-full bg-zinc-900 bg-cover bg-center border border-black/60 shadow-inner"
              style={{ backgroundImage: `url(${avatarUrl})` }}
              role="img"
              aria-label={`${name} avatar`}
            />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-zinc-900 to-zinc-950 text-orange-400 border border-black/60">
              <span className="text-5xl font-black tracking-tight sm:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-400 drop-shadow">
                {fallbackLetter}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaylistCover({ playlist }: { playlist: UserPlaylist }) {
  const [imageError, setImageError] = useState(false);
  const coverUrl = resolveApiAssetUrl(playlist.cover_url);
  const title = playlist.title || playlist.name || "Playlist";

  if (coverUrl && !imageError) {
    return (
      <div className="relative aspect-square w-full">
        <img
          src={coverUrl}
          alt=""
          className="hidden"
          onError={() => setImageError(true)}
        />
        <div
          className="aspect-square rounded-lg bg-zinc-900 bg-cover bg-center w-full h-full"
          style={{ backgroundImage: `url(${coverUrl})` }}
          role="img"
          aria-label={`${title} cover`}
        />
      </div>
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
        {/* Banner area */}
        <div className="relative h-44 sm:h-60 w-full bg-[#08080f] overflow-hidden border-b border-white/5 select-none">
          {/* Animated gradient mesh bubbles */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] rounded-full bg-gradient-to-br from-orange-600/20 to-pink-600/5 blur-[80px] animate-ambient-1" />
          <div className="absolute top-[30%] right-[-10%] w-[50%] h-[90%] rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/5 blur-[95px] animate-ambient-2" />
          <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[80%] rounded-full bg-gradient-to-tr from-pink-600/15 to-orange-500/5 blur-[85px] animate-ambient-3" />
          
          {/* Cyber grid and scanlines */}
          <div className="absolute inset-0 cyber-grid opacity-[0.4]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.001)_50%,rgba(0,0,0,0.08)_50%)] bg-[size:100%_4px]" />
          
          {/* Subtle gradient vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-black/30 z-10" />
        </div>

        <div className="px-4 pb-6 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20 gap-4 mb-5">
            <ProfileAvatar name={displayName} avatarUrl={avatarUrl} />

            <div className="flex flex-wrap items-center gap-2 select-none">
              {!isSelf && followTargetId && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(followTargetId, displayName)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-4.5 py-2 text-xs font-bold transition-all duration-300 cursor-pointer active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                    isProfileFollowed
                      ? "bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/40"
                      : "bg-gradient-to-r from-orange-500 to-pink-600 text-zinc-950 shadow-md shadow-orange-500/10 hover:opacity-90 hover:scale-[1.01]"
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
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
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-900/40 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/40 transition-all duration-300 cursor-pointer active:scale-95 select-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0"><path d="M2 21a8 8 0 0 1 13.292-6M3 9a9 9 0 0 1 17.892-2M16 11a5 5 0 0 1-5 5"/></svg>
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
              {bio && (
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-300">
                  {bio}
                </p>
              )}
            </div>

            {/* Profile Stats with premium styling and responsive wrapping */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 max-w-xl select-none">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-orange-500/40 p-4 rounded-xl text-left transition-all duration-300 cursor-pointer focus:outline-none hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(249,115,22,0.1)] flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-orange-400">Followers</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{profile.followers_count}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-orange-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>

              <button
                type="button"
                onClick={() => setActiveFollowModal("following")}
                className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-purple-500/40 p-4 rounded-xl text-left transition-all duration-300 cursor-pointer focus:outline-none hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(168,85,247,0.1)] flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-purple-400">Following</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{profile.following_count}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-purple-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              </button>

              <div className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-cyan-500/40 p-4 rounded-xl text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(6,182,212,0.1)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-cyan-400">Tracks</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{profile.track_count}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-cyan-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/50">
        <nav className="overflow-x-auto no-scrollbar p-2 bg-[#09090b]/80 border-b border-zinc-900/80 select-none">
          <div className="flex min-w-max items-center gap-2 px-2">
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
                    "relative px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-xl cursor-pointer select-none flex items-center gap-2",
                    isActive
                      ? "bg-gradient-to-r from-orange-500 to-pink-600 text-zinc-950 shadow-md shadow-orange-500/10 scale-[1.02]"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-850"
                  )}
                >
                  <span className="relative z-10">{tab.label}</span>
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black border transition duration-300",
                    isActive
                      ? "bg-black/10 border-black/10 text-zinc-950"
                      : "bg-zinc-900/85 border-zinc-800 text-zinc-550"
                  )}>
                    {formatPlayCount(tab.count)}
                  </span>
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
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
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
