"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
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
import { formatPlayCount } from "@/lib/song-format";
import { cn } from "@/lib/utils";
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
      <div className="min-h-[340px] bg-zinc-900 shimmer p-5 sm:p-7">
        <div className="flex min-h-[300px] flex-col justify-end gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="h-28 w-28 rounded-full bg-zinc-800 shimmer sm:h-36 sm:w-36" />
            <div className="space-y-4">
              <div className="h-5 w-20 rounded-full bg-zinc-800 shimmer" />
              <div className="h-10 w-64 max-w-full rounded bg-zinc-800 shimmer" />
              <div className="h-4 w-80 max-w-full rounded bg-zinc-800 shimmer" />
              <div className="flex gap-3">
                <div className="h-10 w-28 rounded-full bg-zinc-800 shimmer" />
                <div className="h-10 w-24 rounded-full bg-zinc-800 shimmer" />
              </div>
            </div>
          </div>
          <div className="grid w-full grid-cols-3 gap-3 rounded-lg border border-zinc-800 bg-black/30 p-4 md:w-80">
            <div className="h-12 rounded bg-zinc-800 shimmer" />
            <div className="h-12 rounded bg-zinc-800 shimmer" />
            <div className="h-12 rounded bg-zinc-800 shimmer" />
          </div>
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
    <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-black/70 bg-gradient-to-br from-green-500 to-zinc-950 shadow-2xl sm:h-36 sm:w-36 md:h-40 md:w-40">
      <span className="text-5xl font-black text-white sm:text-6xl">
        {getFallbackLetter(name)}
      </span>
    </div>
  );
}

function ArtistStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate text-lg font-black text-white sm:text-xl">
        {formatPlayCount(value)}
      </p>
      <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
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
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-green-400" />
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

    void getArtistSongsRequest(id, 1, 20)
      .then((songsData) => {
        if (!isMounted) return;
        setSongs(songsData.items);
        setTotalTracks(
          songsData.pagination.totalItems ?? songsData.items.length,
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        setSongsError(
          err instanceof Error ? err.message : "Could not load artist songs.",
        );
        setTotalTracks(0);
      })
      .finally(() => {
        if (isMounted) {
          setSongsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

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

    return {
      avatarUrl: resolveApiAssetUrl(artist.avatar_url),
      bannerUrl: resolveApiAssetUrl(artist.banner_url ?? artist.cover_url),
      followersCount: getArtistStat(artist, [
        "followers_count",
        "follower_count",
        "followers",
      ]),
      followingCount: getArtistStat(artist, [
        "following_count",
        "followings_count",
        "following",
      ]),
      trackCount,
    };
  }, [artist, songs.length, totalTracks]);

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

  const artistName = artist.name || "Unknown artist";
  const isSelf =
    Boolean(user?.id && artist.user_id && user.id === artist.user_id) ||
    user?.username?.toLowerCase() === artistName.toLowerCase();
  const isArtistFollowed = isFollowing(artist.id);
  const followLoading = actionId === artist.id;
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
        <div
          className={cn(
            "relative min-h-[360px] bg-cover bg-center",
            !headerData.bannerUrl &&
              "bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.22),_transparent_32%),linear-gradient(135deg,_#18181b_0%,_#09090b_48%,_#020617_100%)]",
          )}
          style={
            headerData.bannerUrl
              ? { backgroundImage: `url(${headerData.bannerUrl})` }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
          <div className="relative z-10 flex min-h-[360px] flex-col justify-end p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
                <ArtistAvatar name={artistName} avatarUrl={headerData.avatarUrl} />

                <div className="min-w-0">
                  <span className="inline-flex rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-green-300">
                    Artist
                  </span>
                  <h1 className="mt-3 max-w-3xl truncate text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {artistName}
                  </h1>
                  <p className="mt-3 max-w-2xl line-clamp-3 text-sm leading-6 text-zinc-300">
                    {bio}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {!isSelf && (
                      <button
                        type="button"
                        disabled={followLoading}
                        onClick={() => void toggleFollow(artist.id, artistName)}
                        className={cn(
                          "rounded-full px-6 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                          isArtistFollowed
                            ? "border border-zinc-600 bg-black/40 text-white hover:bg-zinc-800"
                            : "bg-green-500 text-green-950 hover:bg-green-400",
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
              </div>

              <div className="grid grid-cols-3 gap-4 rounded-lg border border-white/10 bg-black/45 p-4 backdrop-blur-sm lg:w-80">
                <ArtistStat label="Followers" value={headerData.followersCount} />
                <ArtistStat label="Following" value={headerData.followingCount} />
                <ArtistStat label="Tracks" value={headerData.trackCount} />
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
    </div>
  );
}
