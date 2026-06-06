"use client";

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
  resolveApiAssetUrl,
} from "@/lib/api";
import {
  formatPlayCount,
  getArtistAvatarUrl,
  getArtistDisplayName,
} from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { SONG_CATALOG_UPDATED_EVENT, type SongCatalogUpdatedDetail } from "@/lib/song-events";
import type { ArtistRecord, Song } from "@/types/music";


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

function ProfileTabs({
  activeTab,
  onChange,
  trackCount,
}: {
  activeTab: ArtistTab;
  onChange: (tab: ArtistTab) => void;
  trackCount: number;
}) {
  return (
    <nav className="overflow-x-auto no-scrollbar border-b border-zinc-900">
      <div className="flex min-w-max items-center gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const countLabel = tab.id === "tracks" ? trackCount : null;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative px-4 py-4 text-sm font-bold transition",
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              <span>{tab.label}</span>
              {countLabel !== null && (
                <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                  {formatPlayCount(countLabel)}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-orange-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function ArtistDetailPage() {
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
  const [totalTracks, setTotalTracks] = useState(0);
  const [activeTab, setActiveTab] = useState<ArtistTab>("all");
  const [artistLoading, setArtistLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(true);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [songsError, setSongsError] = useState<string | null>(null);
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

  useEffect(() => {
    let isMounted = true;

    if (!id) {
      queueMicrotask(() => {
        if (isMounted) {
          setArtist(null);
          setSongs([]);
          setTotalTracks(0);
          setArtistLoading(false);
          setSongsLoading(false);
          setArtistError("Artist id is missing.");
          setSongsError(null);
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
        setArtistError(null);
        setSongsError(null);
        setArtist(null);
        setSongs([]);
        setTotalTracks(0);
        setActiveTab("all");
        setInitialIsFollowing(null);
      }
    });

    void getArtistRequest(id)
      .then((artistData) => {
        if (!isMounted) return;
        setArtist(artistData);
      })
      .catch((err) => {
        if (!isMounted) return;
        setArtistError(
          err instanceof Error ? err.message : "Could not load artist detail.",
        );
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
  }, [id, loadArtistSongs]);

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

  return (
    <div className="space-y-6 page-fade-in">
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
        {/* Banner area */}
        <div
          className={cn(
            "relative h-36 sm:h-48 w-full bg-cover bg-center",
            !headerData.bannerUrl &&
              "bg-gradient-to-r from-zinc-800 via-zinc-900 to-orange-950/40",
          )}
          style={
            headerData.bannerUrl
              ? { backgroundImage: `url(${headerData.bannerUrl})` }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        {/* Profile info area */}
        <div className="px-4 pb-6 sm:px-6 lg:px-8 relative z-10">
          {/* Avatar floating and buttons */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20 gap-4 mb-5">
            <ArtistAvatar name={artistName} avatarUrl={headerData.avatarUrl} />

            <div className="flex flex-wrap items-center gap-3">
              {!isSelf && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(artist.id, artistName)}
                  className={cn(
                    "rounded-full px-6 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                    isArtistFollowed
                      ? "border border-zinc-600 bg-black/40 text-white hover:bg-zinc-800"
                      : "bg-orange-500 text-orange-950 hover:bg-orange-400",
                  )}
                >
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
                className="rounded-full border border-zinc-700 bg-black/35 px-5 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 hover:bg-black/60 hover:text-white"
              >
                Share
              </button>
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
                Artist
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                {artistName}
              </h1>
              {bio && (
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-300">
                  {bio}
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400 select-none">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="hover:text-white transition cursor-pointer focus:outline-none"
              >
                {headerData.followersCount}{" "}
                {headerData.followersCount === 1 ? "follower" : "followers"}
              </button>
              <span className="text-zinc-700 select-none">&middot;</span>
              <button
                type="button"
                onClick={() => setActiveFollowModal("following")}
                className="hover:text-white transition cursor-pointer focus:outline-none"
              >
                {headerData.followingCount} following
              </button>
              <span className="text-zinc-700 select-none">&middot;</span>
              <span>
                {headerData.trackCount}{" "}
                {headerData.trackCount === 1 ? "track" : "tracks"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/50">
        <ProfileTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          trackCount={headerData.trackCount}
        />

        <div className="p-4 sm:p-5">
          {activeTab === "playlists" ? (
            <EmptyState
              icon={<PlaylistIcon size={24} />}
              title="No public playlists"
              description="Artist playlists are not available yet."
            />
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
