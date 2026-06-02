import { resolveApiAssetUrl } from "@/lib/api";
import type { Song } from "@/types/music";

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

export function getSongAudioUrl(song: Song) {
  return resolveApiAssetUrl(song.file_url);
}

export function getAlbumTitle(song: Song) {
  return song.album?.title ?? "Single";
}

export function getGenreName(song: Song) {
  return song.genre?.name ?? "Unknown genre";
}
