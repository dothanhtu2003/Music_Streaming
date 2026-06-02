"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import {
  ArtistTrackRow,
  ArtistTrackRowSkeleton,
} from "@/components/song/ArtistTrackRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistIcon, UserIcon } from "@/components/ui/Icons";
import {
  getRecentlyPlayedRequest,
  getSongsRequest,
  resolveApiAssetUrl,
} from "@/lib/api";
import {
  RECENTLY_PLAYED_UPDATED_EVENT,
  getLocalRecentlyPlayed,
} from "@/lib/recently-played-storage";
import { formatPlayCount } from "@/lib/song-format";
import { cn } from "@/lib/utils";
import type { FollowedArtist, RecentlyPlayedSong, Song, UserPlaylist } from "@/types/music";

type ProfileTab = "overview" | "tracks" | "playlists" | "following" | "liked";

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "tracks", label: "My tracks" },
  { id: "playlists", label: "Playlists" },
  { id: "following", label: "Following" },
  { id: "liked", label: "Liked songs" },
];

function getFallbackLetter(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "U";
}

function isOwnTrack(song: Song, userId: string, username: string) {
  const artistUserId = song.artist?.user_id;
  const artistName = song.artist?.name?.trim().toLowerCase();

  return (
    artistUserId === userId ||
    Boolean(artistName && artistName === username.trim().toLowerCase())
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate text-lg font-black text-white sm:text-xl">
        {typeof value === "number" ? formatPlayCount(value) : value}
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
  counts,
}: {
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  counts: Record<ProfileTab, number | null>;
}) {
  return (
    <nav className="overflow-x-auto no-scrollbar border-b border-zinc-900">
      <div className="flex min-w-max items-center gap-2">
        {profileTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const count = counts[tab.id];

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
              {count !== null && (
                <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                  {formatPlayCount(count)}
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

function ProfileAvatar({ username }: { username: string }) {
  return (
    <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-black/70 bg-gradient-to-br from-green-500 to-zinc-950 shadow-2xl sm:h-36 sm:w-36 md:h-40 md:w-40">
      <span className="text-5xl font-black text-white sm:text-6xl">
        {getFallbackLetter(username)}
      </span>
    </div>
  );
}

function TrackListSection({
  songs,
  loading,
  error,
  emptyTitle,
  emptyDescription,
}: {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <ArtistTrackRowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <EmptyState
        icon={<PlaylistIcon size={24} />}
        title={emptyTitle}
        description={emptyDescription}
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
}

function PlaylistCover({ playlist }: { playlist: UserPlaylist }) {
  const coverUrl = resolveApiAssetUrl(
    playlist.custom_cover_url ?? playlist.cover_url,
  );
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
    <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-green-500/80 to-zinc-950">
      <span className="text-4xl font-black text-white">
        {getFallbackLetter(title)}
      </span>
    </div>
  );
}

function PlaylistGrid({
  playlists,
  loading,
  error,
}: {
  playlists: UserPlaylist[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3"
          >
            <div className="aspect-square rounded-lg bg-zinc-900 shimmer" />
            <div className="mt-3 h-4 w-2/3 rounded bg-zinc-900 shimmer" />
            <div className="mt-2 h-3 w-1/2 rounded bg-zinc-900 shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <EmptyState
        icon={<PlaylistIcon size={24} />}
        title="No playlists yet"
        description="Create playlists from songs you like."
        actionLabel="Create playlist"
        href="/playlists"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {playlists.map((playlist) => {
        const title = playlist.title || playlist.name || "Playlist";
        const trackCount = playlist.track_count ?? playlist.song_count ?? 0;

        return (
          <Link
            key={playlist.id}
            href={`/playlists/${playlist.id}`}
            className="group rounded-xl border border-zinc-900 bg-zinc-950/50 p-3 transition hover:border-zinc-700 hover:bg-zinc-900/60"
          >
            <PlaylistCover playlist={playlist} />
            <div className="mt-3 min-w-0">
              <h3 className="truncate text-sm font-bold text-white transition group-hover:text-green-400">
                {title}
              </h3>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {trackCount} tracks - {playlist.is_public ? "Public" : "Private"}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function FollowingList({
  following,
  actionId,
  onToggleFollow,
}: {
  following: FollowedArtist[];
  actionId: string | null;
  onToggleFollow: (id: string, name: string) => void;
}) {
  if (following.length === 0) {
    return (
      <EmptyState
        icon={<UserIcon size={24} />}
        title="You are not following anyone yet"
        description="Explore artists and follow them to build your music profile."
        actionLabel="Explore music"
        href="/"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {following.map((artist) => {
        const targetId = artist.artist_id || artist.user_id;
        const artistName = artist.name || artist.username || "Artist";
        const avatarUrl = resolveApiAssetUrl(artist.avatar_url);
        const isActionLoading = actionId === targetId;

        return (
          <div
            key={`${artist.user_id}-${targetId}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-900 bg-zinc-950/50 p-3 transition hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <div className="flex min-w-0 items-center gap-3">
              {artist.artist_id ? (
                <Link href={`/artists/${artist.artist_id}`} className="shrink-0">
                  <FollowingAvatar name={artistName} avatarUrl={avatarUrl} />
                </Link>
              ) : (
                <FollowingAvatar name={artistName} avatarUrl={avatarUrl} />
              )}

              <div className="min-w-0">
                {artist.artist_id ? (
                  <Link href={`/artists/${artist.artist_id}`}>
                    <h3 className="truncate text-sm font-bold text-white transition hover:text-green-400">
                      {artistName}
                    </h3>
                  </Link>
                ) : (
                  <h3 className="truncate text-sm font-bold text-white">
                    {artistName}
                  </h3>
                )}
                <p className="truncate text-xs text-zinc-500">Artist</p>
              </div>
            </div>

            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => onToggleFollow(targetId, artistName)}
              className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActionLoading ? "..." : "Unfollow"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FollowingAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <div
        className="h-11 w-11 rounded-full bg-zinc-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${avatarUrl})` }}
        role="img"
        aria-label={`${name} avatar`}
      />
    );
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-green-500 to-zinc-950 text-sm font-black text-white">
      {getFallbackLetter(name)}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, accessToken, isLoading: authLoading, logout } = useAuth();
  const { following, toggleFollow, actionId } = useFollow();
  const {
    playlists,
    isLoading: playlistsLoading,
    error: playlistsError,
  } = usePlaylists();
  const {
    likedSongs,
    isLoading: likedLoading,
    error: likedError,
  } = useLikes();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [myTracks, setMyTracks] = useState<Song[]>([]);
  const [myTracksLoading, setMyTracksLoading] = useState(true);
  const [myTracksError, setMyTracksError] = useState<string | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedSong[]>(
    [],
  );
  const [recentlyPlayedLoading, setRecentlyPlayedLoading] = useState(true);
  const [recentlyPlayedError, setRecentlyPlayedError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      queueMicrotask(() => {
        if (isMounted) {
          setMyTracks([]);
          setMyTracksLoading(false);
          setMyTracksError(null);
        }
      });

      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        setMyTracksLoading(true);
        setMyTracksError(null);
      }
    });

    void getSongsRequest(1, 100)
      .then((result) => {
        if (!isMounted) return;

        setMyTracks(
          result.items.filter((song) =>
            isOwnTrack(song, user.id, user.username),
          ),
        );
      })
      .catch((tracksError) => {
        if (!isMounted) return;

        setMyTracks([]);
        setMyTracksError(
          tracksError instanceof Error
            ? tracksError.message
            : "Could not load your tracks.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setMyTracksLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadLocalHistory = () => {
      if (isMounted) {
        setRecentlyPlayed(getLocalRecentlyPlayed());
        setRecentlyPlayedLoading(false);
        setRecentlyPlayedError(null);
      }
    };

    if (authLoading) {
      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        setRecentlyPlayedLoading(true);
        setRecentlyPlayedError(null);
      }
    });

    if (!accessToken) {
      loadLocalHistory();
      window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadLocalHistory);

      return () => {
        isMounted = false;
        window.removeEventListener(
          RECENTLY_PLAYED_UPDATED_EVENT,
          loadLocalHistory,
        );
      };
    }

    void getRecentlyPlayedRequest(accessToken)
      .then((items) => {
        if (isMounted) {
          setRecentlyPlayed(items);
        }
      })
      .catch((historyError) => {
        if (!isMounted) return;

        setRecentlyPlayed(getLocalRecentlyPlayed());
        setRecentlyPlayedError(
          historyError instanceof Error
            ? historyError.message
            : "Could not load recently played tracks.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setRecentlyPlayedLoading(false);
        }
      });

    window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadLocalHistory);

    return () => {
      isMounted = false;
      window.removeEventListener(
        RECENTLY_PLAYED_UPDATED_EVENT,
        loadLocalHistory,
      );
    };
  }, [accessToken, authLoading]);

  const profileCounts = useMemo<Record<ProfileTab, number | null>>(
    () => ({
      overview: null,
      tracks: myTracks.length,
      playlists: playlists.length,
      following: following.length,
      liked: likedSongs.length,
    }),
    [following.length, likedSongs.length, myTracks.length, playlists.length],
  );

  if (!user) {
    return null;
  }

  const username = user.username || "User";
  const roleLabel = user.role || "user";
  const profileLabel = myTracks.length > 0 ? "Artist" : "Profile";
  const canShowArtistActions = roleLabel === "admin" || myTracks.length > 0;

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const renderTabContent = () => {
    if (activeTab === "tracks") {
      return (
        <ContentBlock
          title="My tracks"
          description="Tracks connected to your artist profile."
        >
          <TrackListSection
            songs={myTracks}
            loading={myTracksLoading}
            error={myTracksError}
            emptyTitle="You have not uploaded any tracks yet"
            emptyDescription="Upload a track to start building your music profile."
          />
        </ContentBlock>
      );
    }

    if (activeTab === "playlists") {
      return (
        <ContentBlock
          title="Playlists"
          description="Your public and private playlists."
        >
          <PlaylistGrid
            playlists={playlists}
            loading={playlistsLoading}
            error={playlistsError}
          />
        </ContentBlock>
      );
    }

    if (activeTab === "following") {
      return (
        <ContentBlock
          title="Following"
          description="Artists and profiles you follow."
        >
          <FollowingList
            following={following}
            actionId={actionId}
            onToggleFollow={(id, name) => {
              void toggleFollow(id, name);
            }}
          />
        </ContentBlock>
      );
    }

    if (activeTab === "liked") {
      return (
        <ContentBlock
          title="Liked songs"
          description="Tracks you recently liked."
        >
          <TrackListSection
            songs={likedSongs}
            loading={likedLoading}
            error={likedError}
            emptyTitle="No liked songs yet"
            emptyDescription="Like tracks to collect them here."
          />
        </ContentBlock>
      );
    }

    return (
      <div className="space-y-6">
        <ContentBlock
          title="Recent activity"
          description="Tracks you played recently."
        >
          <TrackListSection
            songs={recentlyPlayed.slice(0, 5)}
            loading={recentlyPlayedLoading}
            error={recentlyPlayedError}
            emptyTitle="No recently played tracks"
            emptyDescription="Tracks you play will appear here."
          />
        </ContentBlock>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ContentBlock title="Playlists" description="Your latest playlists.">
            <PlaylistGrid
              playlists={playlists.slice(0, 3)}
              loading={playlistsLoading}
              error={playlistsError}
            />
          </ContentBlock>

          <ContentBlock title="Following" description="Artists you follow.">
            <FollowingList
              following={following.slice(0, 4)}
              actionId={actionId}
              onToggleFollow={(id, name) => {
                void toggleFollow(id, name);
              }}
            />
          </ContentBlock>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 page-fade-in">
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
        <div className="relative min-h-[360px] bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.22),_transparent_32%),linear-gradient(135deg,_#18181b_0%,_#09090b_48%,_#020617_100%)]">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
          <div className="relative z-10 flex min-h-[360px] flex-col justify-end p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end">
                <ProfileAvatar username={username} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-green-300">
                      {profileLabel}
                    </span>
                    <span className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                      Role: {roleLabel}
                    </span>
                  </div>

                  <h1 className="mt-3 max-w-3xl truncate text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                    {username}
                  </h1>
                  <p className="mt-3 max-w-2xl truncate text-sm leading-6 text-zinc-300">
                    {user.email}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled
                      className="rounded-full border border-zinc-700 bg-black/35 px-5 py-2.5 text-sm font-bold text-zinc-500"
                      title="Profile editing is not available yet."
                    >
                      Edit profile
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-full border border-red-500/30 bg-black/35 px-5 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                    >
                      Log out
                    </button>

                    {canShowArtistActions && (
                      <Link
                        href="/upload"
                        className="rounded-full bg-green-500 px-5 py-2.5 text-sm font-black text-green-950 transition hover:bg-green-400"
                      >
                        Upload track
                      </Link>
                    )}

                    {roleLabel === "admin" && (
                      <Link
                        href="/admin/songs"
                        className="rounded-full border border-zinc-700 bg-black/35 px-5 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 hover:bg-black/60 hover:text-white"
                      >
                        Manage tracks
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 rounded-lg border border-white/10 bg-black/45 p-4 backdrop-blur-sm lg:w-[28rem]">
                <ProfileStat label="Following" value={following.length} />
                <ProfileStat label="Playlists" value={playlists.length} />
                <ProfileStat label="Tracks" value={myTracks.length} />
                <ProfileStat label="Role" value={roleLabel} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/50">
        <ProfileTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          counts={profileCounts}
        />

        <div className="p-4 sm:p-5">{renderTabContent()}</div>
      </section>
    </div>
  );
}

function ContentBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
      {children}
    </section>
  );
}
