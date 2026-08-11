"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { PlayIcon, UsersIcon, MusicIcon, VerifiedBadge } from "@/components/ui/Icons";
import {
  getRecentlyPlayed,
  getSongsRequest,
  resolveApiAssetUrl,
} from "@/lib/api";
import { SONG_CATALOG_UPDATED_EVENT } from "@/lib/song-events";
import {
  RECENTLY_PLAYED_UPDATED_EVENT,
  getLocalRecentlyPlayed,
} from "@/lib/recently-played-storage";
import {
  formatPlayCount,
  getArtistAvatarUrl,
  getArtistDisplayName,
  getSongCoverUrl,
} from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import type {
  RecentlyPlayedEntry,
  RecentlyPlayedPlaylistItem,
  Song,
  UserPlaylist,
} from "@/types/music";

type DiscoveryArtist = {
  id: string;
  name: string;
  avatarUrl: string | null;
  userId: string | null;
  songCount: number;
  playCount: number;
  followersCount: number;
  isVerified: boolean;
};

type SidebarSectionProps = {
  title: string;
  href?: string;
  children: React.ReactNode;
};

function SidebarSection({ title, href, children }: SidebarSectionProps) {
  return (
    <section className="space-y-2.5 border-b border-zinc-900/70 pb-5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="text-[11px] font-semibold text-zinc-500 transition hover:text-orange-400"
          >
            View all
          </Link>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function CoverImage({
  url,
  fallback,
  rounded = "rounded-lg",
}: {
  url: string | null;
  fallback: string;
  rounded?: string;
}) {
  if (url) {
    return (
      <div
        role="img"
        aria-label={fallback}
        className={`h-10 w-10 shrink-0 bg-zinc-900 bg-cover bg-center ${rounded}`}
        style={{ backgroundImage: `url(${url})` }}
      />
    );
  }

  return (
    <div
      className={`grid h-10 w-10 shrink-0 place-items-center bg-gradient-to-br from-orange-500 to-zinc-900 text-sm font-black text-white ${rounded}`}
    >
      {fallback.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrackItem({
  song,
  queue,
  meta,
}: {
  song: Song;
  queue: Song[];
  meta?: string;
}) {
  const playSong = usePlayerStore((state) => state.playSong);
  const coverUrl = getSongCoverUrl(song);
  const artistName = getArtistDisplayName(song.artist);

  return (
    <div className="group flex items-center gap-3 rounded-lg p-1.5 transition-all duration-200 hover:bg-zinc-900/40 hover:scale-[1.02] hover:translate-x-1 active:scale-[0.98]">
      <button
        type="button"
        onClick={() => playSong(song, queue)}
        className="relative shrink-0 focus:outline-none"
        aria-label={`Play ${song.title}`}
      >
        <CoverImage url={coverUrl} fallback={song.title} />
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          <PlayIcon size={13} className="ml-0.5" />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <Link href={`/songs/${song.id}`}>
          <h3 className="truncate text-sm font-semibold text-zinc-100 transition hover:text-orange-400">
            {song.title}
          </h3>
        </Link>
        <p className="truncate text-xs text-zinc-500">{artistName}</p>
        {meta ? (
          <p className="text-[11px] text-zinc-600">{meta}</p>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-zinc-600 mt-0.5" title={`${formatPlayCount(song.play_count)} plays`}>
            <MusicIcon size={11} className="text-zinc-600 shrink-0" />
            <span>{formatPlayCount(song.play_count)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtistItem({ artist }: { artist: DiscoveryArtist }) {
  const { user } = useAuth();
  const { actionId, isFollowing, toggleFollow } = useFollow();
  const followed = isFollowing(artist.id);
  const loading = actionId === artist.id;
  const isSelf =
    Boolean(user?.id && artist.userId && user.id === artist.userId) ||
    user?.username?.toLowerCase() === artist.name.toLowerCase();

  return (
    <div className="group/artist flex items-center gap-3 rounded-lg p-1.5 transition-all duration-200 hover:bg-zinc-900/40 hover:scale-[1.02] hover:translate-x-1">
      <Link href={`/artists/${artist.id}`} className="shrink-0">
        <CoverImage
          url={artist.avatarUrl}
          fallback={artist.name}
          rounded="rounded-full"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/artists/${artist.id}`}>
          <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100 transition hover:text-orange-400">
            <span className="truncate">{artist.name}</span>
            {artist.isVerified && <VerifiedBadge size={12} />}
            {isSelf && (
              <span className="inline-flex items-center rounded bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold text-orange-400 border border-orange-500/20" title="This is you">
                Bạn
              </span>
            )}
          </h3>
        </Link>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
          <span className="flex items-center gap-1" title={`${artist.followersCount} followers`}>
            <UsersIcon size={12} className="text-zinc-500 shrink-0" />
            <span>{artist.followersCount}</span>
          </span>
          <span className="flex items-center gap-1" title={`${artist.songCount} songs`}>
            <MusicIcon size={12} className="text-zinc-500 shrink-0" />
            <span>{artist.songCount}</span>
          </span>
        </div>
      </div>

      {!isSelf && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void toggleFollow(artist.id, artist.name)}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
            followed
              ? "border border-zinc-800 bg-zinc-900/40 text-zinc-350 hover:bg-zinc-800 hover:text-white"
              : "bg-orange-500 text-zinc-950 hover:bg-orange-400 font-bold"
          }`}
        >
          {loading ? "..." : followed ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
}

function PlaylistItem({ playlist }: { playlist: UserPlaylist }) {
  const coverUrl = resolveApiAssetUrl(
    playlist.custom_cover_url ?? playlist.cover_url,
  );
  const trackCount = playlist.track_count ?? playlist.song_count ?? 0;

  return (
    <Link
      href={`/playlists/${playlist.id}`}
      className="group flex items-center gap-3 rounded-lg p-1.5 transition-all duration-200 hover:bg-zinc-900/40 hover:scale-[1.02] hover:translate-x-1 active:scale-[0.98]"
    >
      <CoverImage url={coverUrl} fallback={playlist.title || playlist.name} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-zinc-100 transition hover:text-orange-400">
          {playlist.title || playlist.name}
        </h3>
        <p className="truncate text-xs text-zinc-500">
          {trackCount} tracks - {playlist.is_public ? "Public" : "Private"}
        </p>
      </div>
    </Link>
  );
}

function RecentlyPlayedSidebarItem({
  entry,
  songQueue,
}: {
  entry: RecentlyPlayedEntry;
  songQueue: Song[];
}) {
  if (entry.itemType === "song" && "file_url" in entry.item) {
    return (
      <TrackItem
        song={entry.item}
        queue={songQueue.length ? songQueue : [entry.item]}
        meta="Song"
      />
    );
  }

  const playlist = entry.item as RecentlyPlayedPlaylistItem;
  const title = playlist.title || playlist.name || "Untitled playlist";
  const ownerName =
    playlist.owner?.displayName ||
    playlist.owner?.display_name ||
    playlist.owner_name ||
    playlist.owner?.username ||
    "Unknown owner";
  const coverUrl = resolveApiAssetUrl(
    playlist.custom_cover_url ?? playlist.cover_url,
  );

  return (
    <Link
      href={`/playlists/${playlist.id}`}
      className="group flex items-center gap-3 rounded-lg p-1.5 transition-all duration-200 hover:bg-zinc-900/40 hover:scale-[1.02] hover:translate-x-1 active:scale-[0.98]"
    >
      <CoverImage url={coverUrl} fallback={title} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-zinc-100 transition group-hover:text-orange-400">
          {title}
        </h3>
        <p className="truncate text-xs text-zinc-500">Playlist - {ownerName}</p>
      </div>
    </Link>
  );
}

function DiscoverySkeleton() {
  return (
    <aside className="hidden w-72 shrink-0 xl:block" aria-label="Discovery">
      <div
        data-right-sidebar-scroll
        className="sticky top-20 space-y-5 pb-[120px]"
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-3 w-32 rounded bg-zinc-900" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((__, itemIndex) => (
                <div
                  key={itemIndex}
                  className="flex items-center gap-3 rounded-lg p-1.5"
                >
                  <div className="h-10 w-10 rounded-lg bg-zinc-900" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-zinc-900" />
                    <div className="h-2 w-1/2 rounded bg-zinc-900" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function buildArtists(songs: Song[]) {
  const artists = new Map<string, DiscoveryArtist>();

  songs.forEach((song) => {
    const currentArtist = artists.get(song.artist.id);
    const artistName = getArtistDisplayName(song.artist);
    const avatarUrl = getArtistAvatarUrl(song.artist) ?? getSongCoverUrl(song);
    const followersCount = song.artist.followers_count ?? 0;
    const isVerified = song.artist.is_verified ?? false;

    if (!currentArtist) {
      artists.set(song.artist.id, {
        id: song.artist.id,
        name: artistName,
        avatarUrl,
        userId: song.artist.user_id ?? null,
        songCount: 1,
        playCount: song.play_count,
        followersCount,
        isVerified,
      });
      return;
    }

    currentArtist.songCount += 1;
    currentArtist.playCount += song.play_count;
    currentArtist.avatarUrl = currentArtist.avatarUrl ?? avatarUrl;
    currentArtist.followersCount = Math.max(currentArtist.followersCount, followersCount);
    currentArtist.isVerified = currentArtist.isVerified || isVerified;
  });

  return Array.from(artists.values()).sort(
    (firstArtist, secondArtist) =>
      secondArtist.playCount - firstArtist.playCount ||
      secondArtist.songCount - firstArtist.songCount,
  );
}

export function RightSidebar() {
  const pathname = usePathname();
  const isSearchPage = pathname === "/search" || pathname.startsWith("/search");
  const { accessToken, isLoading: authLoading } = useAuth();
  const { likedSongs } = useLikes();
  const { playlists } = usePlaylists();
  const [songs, setSongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedEntry[]>(
    [],
  );
  const [loadingSongs, setLoadingSongs] = useState(true);

  const loadDiscoverySongs = useCallback(() => {
    getSongsRequest(1, 24)
      .then((result) => {
        setSongs(result.items);
      })
      .catch(() => {
        setSongs([]);
      })
      .finally(() => {
        setLoadingSongs(false);
      });
  }, []);

  useEffect(() => {
    loadDiscoverySongs();
  }, [loadDiscoverySongs]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    const handleCatalogUpdated = () => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        loadDiscoverySongs();
      }, 500);
    };

    window.addEventListener(SONG_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener(SONG_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    };
  }, [loadDiscoverySongs]);

  useEffect(() => {
    let isMounted = true;

    const loadRecentlyPlayed = () => {
      if (isMounted) {
        if (!accessToken) {
          setRecentlyPlayed(getLocalRecentlyPlayed());
          return;
        }

        void getRecentlyPlayed(20, accessToken)
          .then((items) => {
            if (isMounted) {
              setRecentlyPlayed(items);
            }
          })
          .catch(() => {
            if (isMounted) {
              setRecentlyPlayed(getLocalRecentlyPlayed());
            }
          });
      }
    };

    if (authLoading) {
      return () => {
        isMounted = false;
      };
    }

    if (!accessToken) {
      loadRecentlyPlayed();
      window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadRecentlyPlayed);

      return () => {
        isMounted = false;
        window.removeEventListener(
          RECENTLY_PLAYED_UPDATED_EVENT,
          loadRecentlyPlayed,
        );
      };
    }

    loadRecentlyPlayed();
    window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadRecentlyPlayed);

    return () => {
      isMounted = false;
      window.removeEventListener(
        RECENTLY_PLAYED_UPDATED_EVENT,
        loadRecentlyPlayed,
      );
    };
  }, [accessToken, authLoading]);

  const artists = useMemo(() => buildArtists(songs).slice(0, 4), [songs]);
  const popularTracks = useMemo(
    () =>
      [...songs]
        .sort((firstSong, secondSong) => secondSong.play_count - firstSong.play_count)
        .slice(0, 4),
    [songs],
  );
  const recentLiked = likedSongs.slice(0, 3);
  const recentHistory = recentlyPlayed.slice(0, 3);
  const recentHistorySongs = recentHistory
    .filter((entry): entry is RecentlyPlayedEntry & { item: Song } => {
      return entry.itemType === "song" && "file_url" in entry.item;
    })
    .map((entry) => entry.item);
  const userPlaylists = playlists.slice(0, 3);
  const hasContent =
    artists.length > 0 ||
    recentLiked.length > 0 ||
    recentHistory.length > 0 ||
    userPlaylists.length > 0 ||
    popularTracks.length > 0;

  if (loadingSongs && !hasContent) {
    return <DiscoverySkeleton />;
  }

  return (
    <aside className="hidden w-72 shrink-0 xl:block" aria-label="Discovery">
      <div
        data-right-sidebar-scroll
        className="sticky top-20 space-y-5 pb-[120px]"
      >
        {!isSearchPage && artists.length > 0 && (
          <SidebarSection title="Artists you should follow">
            {artists.map((artist) => (
              <ArtistItem key={artist.id} artist={artist} />
            ))}
          </SidebarSection>
        )}

        {recentLiked.length > 0 && (
          <SidebarSection title="Recently Liked" href="/liked">
            {recentLiked.map((song) => (
              <TrackItem
                key={song.id}
                song={song}
                queue={recentLiked}
              />
            ))}
          </SidebarSection>
        )}

        {recentHistory.length > 0 && (
          <SidebarSection title="Recently Played">
            {recentHistory.map((entry) => (
              <RecentlyPlayedSidebarItem
                key={entry.recentlyPlayedId}
                entry={entry}
                songQueue={recentHistorySongs}
              />
            ))}
          </SidebarSection>
        )}

        {userPlaylists.length > 0 && (
          <SidebarSection title="Your playlists" href="/playlists">
            {userPlaylists.map((playlist) => (
              <PlaylistItem key={playlist.id} playlist={playlist} />
            ))}
          </SidebarSection>
        )}

        {popularTracks.length > 0 && (
          <SidebarSection title="Popular tracks" href="/popular">
            {popularTracks.map((song) => (
              <TrackItem key={song.id} song={song} queue={popularTracks} />
            ))}
          </SidebarSection>
        )}

        {!hasContent && (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/50 p-4 text-sm text-zinc-500">
            Discovery updates as you play, like, and create playlists.
          </div>
        )}
      </div>
    </aside>
  );
}
