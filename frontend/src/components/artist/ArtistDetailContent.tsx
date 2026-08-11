"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
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
  getArtistRequest,
  getArtistSongsRequest,
  getUserPlaylistsRequest,
  resolveApiAssetUrl,
} from "@/lib/api";
import {
  formatPlayCount,
  getArtistAvatarUrl,
  getArtistDisplayName,
} from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { SONG_CATALOG_UPDATED_EVENT, type SongCatalogUpdatedDetail } from "@/lib/song-events";
import type { ArtistRecord, Song, UserPlaylist } from "@/types/music";


type ArtistTab = "all" | "tracks" | "playlists";

type ArtistWithProfileFields = ArtistRecord & {
  banner_url?: string | null;
  cover_url?: string | null;
  follower_count?: number | string | null;
  followers_count?: number | string | null;
  followers?: number | string | null;
  following_count?: number | string | null;
  followings_count?: number | string | null;
  following?: number | string | null;
  track_count?: number | string | null;
  tracks_count?: number | string | null;
  song_count?: number | string | null;
};

const tabs: Array<{ id: ArtistTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "tracks", label: "Tracks" },
  { id: "playlists", label: "Playlists" },
];

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return null;
}

function getArtistStat(
  artist: ArtistWithProfileFields,
  keys: Array<keyof ArtistWithProfileFields>,
) {
  for (const key of keys) {
    const parsed = parseOptionalNumber(artist[key]);

    if (parsed !== null) {
      return parsed;
    }
  }

  return 0;
}

function getFallbackLetter(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "A";
}

async function sharePath(path: string, title: string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = `${window.location.origin}${path}`;

  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  } catch {
    // Users can deny share/clipboard permissions. The profile remains usable.
  }
}

function ProfileHeaderSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 animate-pulse">
      {/* Banner area skeleton */}
      <div className="h-36 sm:h-48 w-full bg-zinc-900 shimmer" />
      
      {/* Profile info area skeleton */}
      <div className="px-4 pb-6 sm:px-6 lg:px-8">
        {/* Avatar floating and buttons skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20 gap-4 mb-5">
          <div className="h-28 w-28 rounded-full bg-zinc-800 shimmer sm:h-36 sm:w-36 md:h-40 md:w-40" />
          <div className="flex gap-3">
            <div className="h-10 w-28 rounded-full bg-zinc-800 shimmer" />
            <div className="h-10 w-24 rounded-full bg-zinc-800 shimmer" />
          </div>
        </div>

        {/* Details list skeleton */}
        <div className="space-y-3">
          <div className="h-5 w-20 rounded-full bg-zinc-800 shimmer" />
          <div className="h-8 w-64 max-w-full rounded bg-zinc-800 shimmer" />
          <div className="h-4 w-80 max-w-full rounded bg-zinc-800 shimmer" />
          <div className="h-3 w-48 rounded bg-zinc-800 shimmer" />
        </div>
      </div>
    </div>
  );
}

function ArtistPageSkeleton() {
  return (
    <div className="space-y-6 page-fade-in">
      <ProfileHeaderSkeleton />
      <div className="h-12 rounded-xl border border-zinc-900 bg-zinc-950 shimmer" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <ArtistTrackRowSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function ArtistAvatar({
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

function ProfileTabs({
  activeTab,
  onChange,
  trackCount,
  playlistCount,
}: {
  activeTab: ArtistTab;
  onChange: (tab: ArtistTab) => void;
  trackCount: number;
  playlistCount: number;
}) {
  return (
    <nav className="overflow-x-auto no-scrollbar p-2 bg-[#09090b] border-b border-zinc-900/80 select-none">
      <div className="flex min-w-max items-center gap-2 px-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const countLabel =
            tab.id === "tracks"
              ? trackCount
              : tab.id === "playlists"
                ? playlistCount
                : null;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-xl cursor-pointer select-none flex items-center gap-2",
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-pink-600 text-zinc-950 shadow-md shadow-orange-500/10 scale-[1.02]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-850"
              )}
            >
              <span className="relative z-10">{tab.label}</span>
              {countLabel !== null && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black border transition duration-300",
                  isActive
                    ? "bg-black/10 border-black/10 text-zinc-950"
                    : "bg-zinc-900/85 border-zinc-800 text-zinc-550"
                )}>
                  {formatPlayCount(countLabel)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function ArtistDetailContent() {
  const params = useParams();
  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";
  const { user } = useAuth();
  const { isFollowing, toggleFollow, actionId } = useFollow();
  const [artist, setArtist] = useState<ArtistWithProfileFields | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [totalTracks, setTotalTracks] = useState(0);
  const [activeTab, setActiveTab] = useState<ArtistTab>("all");
  const [artistLoading, setArtistLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(true);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [songsError, setSongsError] = useState<string | null>(null);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [initialIsFollowing, setInitialIsFollowing] = useState<boolean | null>(null);
  const [activeFollowModal, setActiveFollowModal] = useState<"followers" | "following" | null>(null);

  const isArtistFollowed =
    isFollowing(artist?.id) ||
    Boolean(artist?.user_id && isFollowing(artist.user_id));

  useEffect(() => {
    if (artist && initialIsFollowing === null) {
      const isFollowed = isArtistFollowed;
      queueMicrotask(() => {
        setInitialIsFollowing(isFollowed);
      });
    }
  }, [artist, isArtistFollowed, initialIsFollowing]);

  const loadArtistSongs = useCallback((artistId: string) => {
    setSongsLoading(true);
    setSongsError(null);
    getArtistSongsRequest(artistId, 1, 20)
      .then((songsData) => {
        setSongs(songsData.items);
        setTotalTracks(
          songsData.pagination.totalItems ?? songsData.items.length,
        );
      })
      .catch((err) => {
        setSongsError(
          err instanceof Error ? err.message : "Could not load artist songs.",
        );
        setTotalTracks(0);
      })
      .finally(() => {
        setSongsLoading(false);
      });
  }, []);

  const loadArtistPlaylists = useCallback((userId: string | null | undefined) => {
    if (!userId) {
      setPlaylists([]);
      setPlaylistsLoading(false);
      setPlaylistsError(null);
      return;
    }

    setPlaylistsLoading(true);
    setPlaylistsError(null);
    getUserPlaylistsRequest(userId, 1, 12)
      .then((playlistData) => {
        setPlaylists(playlistData.items);
      })
      .catch((err) => {
        setPlaylists([]);
        setPlaylistsError(
          err instanceof Error ? err.message : "Could not load artist playlists.",
        );
      })
      .finally(() => {
        setPlaylistsLoading(false);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!id) {
      queueMicrotask(() => {
        if (isMounted) {
          setArtist(null);
          setSongs([]);
          setPlaylists([]);
          setTotalTracks(0);
          setArtistLoading(false);
          setSongsLoading(false);
          setPlaylistsLoading(false);
          setArtistError("Artist id is missing.");
          setSongsError(null);
          setPlaylistsError(null);
        }
      });

      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        setArtistLoading(true);
        setSongsLoading(true);
        setPlaylistsLoading(true);
        setArtistError(null);
        setSongsError(null);
        setPlaylistsError(null);
        setArtist(null);
        setSongs([]);
        setPlaylists([]);
        setTotalTracks(0);
        setActiveTab("all");
        setInitialIsFollowing(null);
      }
    });

    void getArtistRequest(id)
      .then((artistData) => {
        if (!isMounted) return;
        setArtist(artistData);
        loadArtistPlaylists(artistData.user_id);
      })
      .catch((err) => {
        if (!isMounted) return;
        setArtistError(
          err instanceof Error ? err.message : "Could not load artist detail.",
        );
        setPlaylistsLoading(false);
      })
      .finally(() => {
        if (isMounted) {
          setArtistLoading(false);
        }
      });

    queueMicrotask(() => {
      if (isMounted) {
        loadArtistSongs(id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [id, loadArtistPlaylists, loadArtistSongs]);

  useEffect(() => {
    if (!id) return;
    let timerId: NodeJS.Timeout | null = null;

    const handleCatalogUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<SongCatalogUpdatedDetail>;
      const newSong = customEvent.detail?.song;
      
      if (newSong) {
        const songArtistId = newSong.artist?.id;
        if (songArtistId && songArtistId !== id) {
          return;
        }
      }

      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        loadArtistSongs(id);
      }, 500);
    };

    window.addEventListener(SONG_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener(SONG_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    };
  }, [id, loadArtistSongs]);

  const headerData = useMemo(() => {
    if (!artist) {
      return null;
    }

    const apiTrackCount = getArtistStat(artist, [
      "track_count",
      "tracks_count",
      "song_count",
    ]);
    const trackCount = Math.max(apiTrackCount, totalTracks, songs.length);

    let followersCount = getArtistStat(artist, [
      "followers_count",
      "follower_count",
      "followers",
    ]);

    if (initialIsFollowing !== null) {
      if (isArtistFollowed && !initialIsFollowing) {
        followersCount += 1;
      } else if (!isArtistFollowed && initialIsFollowing) {
        followersCount = Math.max(0, followersCount - 1);
      }
    }

    return {
      avatarUrl: getArtistAvatarUrl(artist),
      bannerUrl: resolveApiAssetUrl(artist.banner_url ?? artist.cover_url),
      followersCount,
      followingCount: getArtistStat(artist, [
        "following_count",
        "followings_count",
        "following",
      ]),
      trackCount,
    };
  }, [artist, songs.length, totalTracks, isArtistFollowed, initialIsFollowing]);

  if (artistLoading) {
    return <ArtistPageSkeleton />;
  }

  if (artistError) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {artistError}
      </div>
    );
  }

  if (!artist || !headerData) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-zinc-900 text-zinc-500">
          <UserIcon size={22} />
        </div>
        <p className="mt-4 text-sm font-medium text-white">Artist not found.</p>
      </div>
    );
  }

  const artistName = getArtistDisplayName(artist);
  const isSelf =
    Boolean(user?.id && artist.user_id && user.id === artist.user_id) ||
    user?.username?.toLowerCase() === artistName.toLowerCase();
  const followLoading =
    actionId === artist.id ||
    Boolean(artist.user_id && actionId === artist.user_id);
  const bio = artist.bio?.trim() || "No biography available";

  const handleShareArtist = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void sharePath(`/artists/${artist.id}`, artistName);
  };

  const renderTrackContent = () => {
    if (songsLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ArtistTrackRowSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (songsError) {
      return (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
          {songsError}
        </div>
      );
    }

    if (songs.length === 0) {
      return (
        <EmptyState
          icon={<PlaylistIcon size={24} />}
          title="No tracks published"
          description="This artist has not uploaded any tracks yet."
        />
      );
    }

    return (
      <div className="space-y-3">
        {songs.map((song) => (
          <ArtistTrackRow key={song.id} song={song} queue={songs} />
        ))}
      </div>
    );
  };

  const renderPlaylistContent = () => {
    if (playlistsLoading) {
      return (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 animate-pulse"
            >
              <div className="aspect-square rounded-lg bg-zinc-900/60 shimmer" />
              <div className="mt-3 h-4 w-2/3 rounded bg-zinc-900/60 shimmer" />
              <div className="mt-2 h-3 w-1/2 rounded bg-zinc-900/60 shimmer" />
            </div>
          ))}
        </div>
      );
    }

    if (playlistsError) {
      return (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
          {playlistsError}
        </div>
      );
    }

    if (playlists.length === 0) {
      return (
        <EmptyState
          icon={<PlaylistIcon size={24} />}
          title="No public playlists"
          description="This artist has not shared any playlists yet."
        />
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {playlists.map((playlist) => {
          const title = playlist.title || playlist.name || "Playlist";
          const trackCount = playlist.track_count ?? playlist.song_count ?? 0;

          return (
            <Link
              key={playlist.id}
              href={`/playlists/${playlist.slug || playlist.id}`}
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
    );
  };

  return (
    <div className="space-y-6 page-fade-in">
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
        {/* Banner area */}
        <div className="relative h-44 sm:h-60 w-full bg-[#08080f] overflow-hidden border-b border-white/5 select-none">
          {/* Animated gradient mesh bubbles */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] rounded-full bg-gradient-to-br from-orange-600/20 to-pink-600/5 blur-[80px] animate-ambient-1" />
          <div className="absolute top-[30%] right-[-10%] w-[50%] h-[90%] rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/5 blur-[95px] animate-ambient-2" />
          <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[80%] rounded-full bg-gradient-to-tr from-pink-600/15 to-orange-500/5 blur-[85px] animate-ambient-3" />
          
          {/* Custom user banner cover if provided */}
          {headerData.bannerUrl && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-65 mix-blend-screen"
              style={{ backgroundImage: `url(${headerData.bannerUrl})` }}
            />
          )}

          {/* Cyber grid and scanlines */}
          <div className="absolute inset-0 cyber-grid opacity-[0.4]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.001)_50%,rgba(0,0,0,0.08)_50%)] bg-[size:100%_4px]" />
          
          {/* Subtle gradient vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-black/30 z-10" />
        </div>

        {/* Profile info area */}
        <div className="px-4 pb-6 sm:px-6 lg:px-8 relative z-10">
          {/* Avatar floating and buttons */}
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:justify-between sm:text-left -mt-12 sm:-mt-16 md:-mt-20 gap-4 mb-4">
            <ArtistAvatar name={artistName} avatarUrl={headerData.avatarUrl} />

            {/* Desktop Actions */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 select-none">
              {!isSelf && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(artist.id, artistName)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-4.5 py-2 text-xs font-bold transition-all duration-300 cursor-pointer active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                    isArtistFollowed
                      ? "bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/40"
                      : "bg-gradient-to-r from-orange-500 to-pink-600 text-zinc-950 shadow-md shadow-orange-500/10 hover:opacity-90 hover:scale-[1.01]"
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                  {followLoading
                    ? "Loading..."
                    : isArtistFollowed
                      ? "Following"
                      : "Follow"}
                </button>
              )}

              <button
                type="button"
                onClick={handleShareArtist}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900/40 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/40 transition-all duration-300 cursor-pointer active:scale-95 select-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                Share
              </button>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
                Artist
              </span>
            </div>

            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                {artistName}
              </h1>
              {bio && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-zinc-900/60 to-purple-500/10 px-4 py-1.5 text-xs font-medium italic text-zinc-200 backdrop-blur-md shadow-sm max-w-xs sm:max-w-md">
                  <span className="text-orange-400 font-serif font-black not-italic text-sm">“</span>
                  <span className="truncate">{bio}</span>
                  <span className="text-orange-400 font-serif font-black not-italic text-sm">”</span>
                </div>
              )}
            </div>

            {/* MOBILE 1-LINE STAT BAR */}
            <div className="flex sm:hidden items-center justify-center gap-6 py-2.5 border-y border-zinc-900/80 my-3 text-center">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="group/stat flex-1"
              >
                <span className="block text-base font-black text-white font-mono group-hover/stat:text-orange-400">{headerData.followersCount}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Followers</span>
              </button>
              <span className="h-5 w-px bg-zinc-850" />
              <button
                type="button"
                onClick={() => setActiveFollowModal("following")}
                className="group/stat flex-1"
              >
                <span className="block text-base font-black text-white font-mono group-hover/stat:text-purple-400">{headerData.followingCount}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Following</span>
              </button>
              <span className="h-5 w-px bg-zinc-850" />
              <div className="flex-1">
                <span className="block text-base font-black text-white font-mono">{headerData.trackCount}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Tracks</span>
              </div>
            </div>

            {/* MOBILE COMPACT FOLLOW BUTTON */}
            <div className="flex sm:hidden items-center justify-center pt-1 w-full">
              {!isSelf && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(artist.id, artistName)}
                  className={cn(
                    "inline-flex h-9 px-7 items-center justify-center gap-1.5 rounded-full text-xs font-black transition active:scale-95 disabled:opacity-60 shadow-md shadow-orange-500/10",
                    isArtistFollowed
                      ? "bg-zinc-900/90 text-zinc-300 border border-zinc-800"
                      : "bg-gradient-to-r from-orange-500 to-pink-600 text-zinc-950"
                  )}
                >
                  {followLoading
                    ? "Loading..."
                    : isArtistFollowed
                      ? "Following"
                      : "Follow"}
                </button>
              )}
            </div>

            {/* DESKTOP STATS GRID */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 max-w-xl select-none">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-orange-500/40 p-4 rounded-xl text-left transition-all duration-300 cursor-pointer focus:outline-none hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(249,115,22,0.1)] flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-orange-400">Followers</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{headerData.followersCount}</p>
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
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{headerData.followingCount}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-purple-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              </button>

              <div className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-cyan-500/40 p-4 rounded-xl text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(6,182,212,0.1)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-cyan-400">Tracks</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{headerData.trackCount}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-cyan-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/50">
        <ProfileTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          trackCount={headerData.trackCount}
          playlistCount={playlists.length}
        />

        <div className="p-4 sm:p-5">
          {activeTab === "playlists" ? (
            renderPlaylistContent()
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-white">
                    {activeTab === "all" ? "All tracks" : "Tracks"}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Latest uploads by {artistName}
                  </p>
                </div>
              </div>

              {renderTrackContent()}
            </div>
          )}
        </div>
      </section>

      {activeFollowModal && (
        <FollowListModal
          userId={artist.id}
          type={activeFollowModal}
          title={activeFollowModal === "followers" ? "Followers" : "Following"}
          onClose={() => setActiveFollowModal(null)}
        />
      )}
    </div>
  );
}
