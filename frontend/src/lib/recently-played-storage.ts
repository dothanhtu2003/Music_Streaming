import type { RecentlyPlayedSong, Song } from "@/types/music";

const RECENTLY_PLAYED_KEY = "music_recently_played";
export const RECENTLY_PLAYED_UPDATED_EVENT = "music_recently_played_updated";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeRecentlyPlayed(song: Song): RecentlyPlayedSong {
  return {
    ...song,
    played_at: new Date().toISOString(),
  };
}

export function getLocalRecentlyPlayed() {
  if (!canUseStorage()) {
    return [];
  }

  const rawValue = window.localStorage.getItem(RECENTLY_PLAYED_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as RecentlyPlayedSong[];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((song) => song?.id && song?.title && song?.file_url)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function saveLocalRecentlyPlayed(song: Song) {
  if (!canUseStorage()) {
    return [];
  }

  const nextSong = normalizeRecentlyPlayed(song);
  const nextSongs = [
    nextSong,
    ...getLocalRecentlyPlayed().filter((item) => item.id !== song.id),
  ].slice(0, 20);

  window.localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(nextSongs));
  window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));

  return nextSongs;
}
