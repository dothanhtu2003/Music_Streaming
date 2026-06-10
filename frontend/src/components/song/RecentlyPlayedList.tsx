"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ListItemSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import { MusicIcon, PlayIcon } from "@/components/ui/Icons";
import {
  getPlaylistRequest,
  getPublicPlaylistRequest,
  resolveApiAssetUrl,
  saveRecentlyPlayedPlaylist,
} from "@/lib/api";
import { RECENTLY_PLAYED_UPDATED_EVENT } from "@/lib/recently-played-storage";
import { getArtistDisplayName, getSongCoverUrl } from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import type { RecentlyPlayedEntry, RecentlyPlayedPlaylistItem, Song } from "@/types/music";

type RecentlyPlayedListProps = {
  items: RecentlyPlayedEntry[];
  loading?: boolean;
  error?: string | null;
};

function isSongItem(entry: RecentlyPlayedEntry): entry is RecentlyPlayedEntry & { item: Song } {
  return entry.itemType === "song" && "file_url" in entry.item;
}

function getPlaylistTitle(playlist: RecentlyPlayedPlaylistItem) {
  return playlist.title || playlist.name || "Untitled playlist";
}

function CoverImage({
  url,
  fallback,
}: {
  url: string | null;
  fallback: string;
}) {
  if (url) {
    return (
      <div
        role="img"
        aria-label={fallback}
        className="h-12 w-12 shrink-0 rounded-lg bg-zinc-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${url})` }}
      />
    );
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-500 to-zinc-950 text-sm font-black text-white">
      {fallback.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
      {children}
    </span>
  );
}

function RecentlyPlayedSongRow({
  entry,
  queue,
}: {
  entry: RecentlyPlayedEntry & { item: Song };
  queue: Song[];
}) {
  const playSong = usePlayerStore((state) => state.playSong);
  const song = entry.item;
  const artistName = getArtistDisplayName(song.artist);

  return (
    <article className="group flex items-center gap-3 rounded-xl border border-zinc-900/60 bg-zinc-950/20 p-2.5 transition hover:border-zinc-800 hover:bg-zinc-900/40">
      <button
        type="button"
        onClick={() => playSong(song, queue.length ? queue : [song])}
        className="relative shrink-0 focus:outline-none"
        aria-label={`Play ${song.title}`}
      >
        <CoverImage url={getSongCoverUrl(song)} fallback={song.title} />
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          <PlayIcon size={13} className="ml-0.5" />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/songs/${song.id}`}
          className="block truncate text-sm font-semibold text-zinc-100 transition hover:text-orange-400"
        >
          {song.title}
        </Link>
        <p className="truncate text-xs text-zinc-500">{artistName}</p>
      </div>

      <Badge>Song</Badge>
    </article>
  );
}

function RecentlyPlayedPlaylistRow({ entry }: { entry: RecentlyPlayedEntry }) {
  const { accessToken } = useAuth();
  const playSong = usePlayerStore((state) => state.playSong);
  const [isLoading, setIsLoading] = useState(false);
  const playlist = entry.item as RecentlyPlayedPlaylistItem;
  const title = getPlaylistTitle(playlist);
  const ownerName =
    playlist.owner?.displayName ||
    playlist.owner?.display_name ||
    playlist.owner_name ||
    playlist.owner?.username ||
    "Unknown owner";
  const trackCount = playlist.track_count ?? playlist.song_count ?? 0;
  const coverUrl = resolveApiAssetUrl(
    playlist.custom_cover_url ?? playlist.cover_url,
  );

  const handlePlayPlaylist = async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const detail = accessToken
        ? await getPlaylistRequest(playlist.id, accessToken)
        : await getPublicPlaylistRequest(playlist.id);

      if (detail.songs.length === 0) {
        return;
      }

      playSong(detail.songs[0], detail.songs, {
        type: "playlist",
        playlistId: playlist.id,
      });

      void saveRecentlyPlayedPlaylist(playlist.id, accessToken)
        .catch((saveError) => {
          console.warn("Failed to save recently played playlist", saveError);
        })
        .finally(() => {
          window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));
        });
    } catch (playError) {
      console.warn("Failed to play recently played playlist", playError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <article
      className="group flex items-center gap-3 rounded-xl border border-zinc-900/60 bg-zinc-950/20 p-2.5 transition hover:border-zinc-800 hover:bg-zinc-900/40"
    >
      <button
        type="button"
        onClick={() => {
          void handlePlayPlaylist();
        }}
        disabled={isLoading}
        className="relative shrink-0 focus:outline-none disabled:cursor-wait disabled:opacity-60"
        aria-label={`Play playlist ${title}`}
        title={`Play ${title}`}
      >
        <CoverImage url={coverUrl} fallback={title} />
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          {isLoading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <PlayIcon size={13} className="ml-0.5" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/playlists/${playlist.id}`}
          className="block truncate text-sm font-semibold text-zinc-100 transition hover:text-orange-400"
        >
          {title}
        </Link>
        <p className="truncate text-xs text-zinc-500">
          {ownerName}
          {trackCount > 0 ? ` - ${trackCount} tracks` : ""}
        </p>
      </div>

      <Badge>Playlist</Badge>
    </article>
  );
}

function uniqueEntries(entries: RecentlyPlayedEntry[]) {
  const seenKeys = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.itemType}:${entry.item.id}`;

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}

export function RecentlyPlayedList({
  items,
  loading = false,
  error = null,
}: RecentlyPlayedListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <ListItemSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  const safeItems = uniqueEntries(items);

  if (safeItems.length === 0) {
    return (
      <EmptyState
        icon={<MusicIcon size={24} />}
        title="No recently played items"
        description="Start listening to see your recently played songs and playlists."
      />
    );
  }

  const songQueue = safeItems.filter(isSongItem).map((entry) => entry.item);

  return (
    <div className="flex flex-col gap-2">
      {safeItems.map((entry) =>
        isSongItem(entry) ? (
          <RecentlyPlayedSongRow
            key={entry.recentlyPlayedId}
            entry={entry}
            queue={songQueue}
          />
        ) : (
          <RecentlyPlayedPlaylistRow key={entry.recentlyPlayedId} entry={entry} />
        ),
      )}
    </div>
  );
}
