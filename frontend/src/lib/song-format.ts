import { resolveApiAssetUrl } from "@/lib/api";
import type { Song } from "@/types/music";

type ArtistProfileSource = {
  name?: string | null;
  username?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
};

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Number.isFinite(totalSeconds) ? totalSeconds : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = Math.floor(safeSeconds % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPlayCount(playCount: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(playCount);
}

export function getSongCoverUrl(song: Song) {
  return resolveApiAssetUrl(song.cover_url ?? song.album?.cover_url);
}

export function getArtistDisplayName(artist?: ArtistProfileSource | null) {
  return (
    artist?.displayName ||
    artist?.display_name ||
    artist?.name ||
    artist?.username ||
    "Unknown artist"
  );
}

export function getArtistAvatarUrl(artist?: ArtistProfileSource | null) {
  return resolveApiAssetUrl(artist?.avatarUrl ?? artist?.avatar_url);
}

export function normalizeArtistProfile<T extends ArtistProfileSource>(
  artist: T,
): T & { avatarUrl: string | null; displayName: string } {
  const avatarUrl = getArtistAvatarUrl(artist);
  const displayName = getArtistDisplayName(artist);

  return {
    ...artist,
    avatar_url: artist.avatar_url ?? artist.avatarUrl ?? null,
    avatarUrl,
    display_name: artist.display_name ?? artist.displayName ?? artist.name ?? null,
    displayName,
  };
}

export function normalizeSongArtist(song: Song): Song {
  return {
    ...song,
    artist: normalizeArtistProfile(song.artist),
  };
}

export function normalizeSongs(songs: Song[]): Song[] {
  return songs.map(normalizeSongArtist);
}

export function normalizePlaylistDetail<T extends { songs?: Song[]; tracks?: Song[] }>(
  playlist: T,
): T {
  const songs = normalizeSongs(playlist.songs ?? playlist.tracks ?? []);

  return {
    ...playlist,
    songs,
    tracks: playlist.tracks ? normalizeSongs(playlist.tracks) : songs,
  };
}

export function getSongAudioUrl(song: Song) {
  return resolveApiAssetUrl(song.file_url);
}

export function getAlbumTitle(song: Song) {
  return song.album?.title ?? "Single";
}

export function getGenreName(song: Song) {
  return song.genre?.name ?? "Unknown genre";
}
