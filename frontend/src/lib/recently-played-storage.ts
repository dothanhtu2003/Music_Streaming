import type { RecentlyPlayedEntry, RecentlyPlayedSong, Song } from "@/types/music";

const RECENTLY_PLAYED_KEY = "music_recently_played";
export const RECENTLY_PLAYED_UPDATED_EVENT = "music_recently_played_updated";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isRecentlyPlayedEntry(value: unknown): value is RecentlyPlayedEntry {
  const entry = value as RecentlyPlayedEntry;

  return Boolean(
    entry?.recentlyPlayedId &&
      entry?.itemType &&
      entry?.playedAt &&
      entry?.item &&
      entry.item.id,
  );
}

function normalizeRecentlyPlayed(song: Song): RecentlyPlayedEntry {
  const playedAt = new Date().toISOString();

  return {
    recentlyPlayedId: `local-song-${song.id}`,
    itemType: "song",
    playedAt,
    item: {
      ...song,
      type: "song",
    },
  };
}

function normalizeLegacySong(song: RecentlyPlayedSong): RecentlyPlayedEntry {
  return {
    recentlyPlayedId: song.recently_played_id ?? `local-song-${song.id}`,
    itemType: "song",
    playedAt: song.played_at,
    item: {
      ...song,
      type: "song",
    },
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
    const parsedValue = JSON.parse(rawValue) as unknown[];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((item) => {
        if (isRecentlyPlayedEntry(item)) {
          return item;
        }

        const song = item as RecentlyPlayedSong;

        if (song?.id && song?.title && song?.file_url) {
          return normalizeLegacySong(song);
        }

        return null;
      })
      .filter((item): item is RecentlyPlayedEntry => Boolean(item))
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
    ...getLocalRecentlyPlayed().filter(
      (item) => item.itemType !== "song" || item.item.id !== song.id,
    ),
  ].slice(0, 20);

  window.localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(nextSongs));
  window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));

  return nextSongs;
}
