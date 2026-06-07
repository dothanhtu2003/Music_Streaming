import type { SearchHistoryItem } from "@/types/music";

const RECENT_SEARCHES_KEY = "music_recent_searches";
const maxRecentSearches = 10;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export function getGuestRecentSearches(): SearchHistoryItem[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = storedValue ? (JSON.parse(storedValue) as SearchHistoryItem[]) : [];

    return Array.isArray(parsed) ? parsed.slice(0, maxRecentSearches) : [];
  } catch {
    return [];
  }
}

export function saveGuestRecentSearch(query: string) {
  const normalizedQuery = normalizeQuery(query);

  if (!canUseStorage() || normalizedQuery.length < 2) {
    return;
  }

  const lowerQuery = normalizedQuery.toLowerCase();
  const nextItems = [
    {
      id: lowerQuery,
      query: normalizedQuery,
      normalizedQuery: lowerQuery,
      createdAt: new Date().toISOString(),
    },
    ...getGuestRecentSearches().filter(
      (item) => item.query.trim().toLowerCase() !== lowerQuery,
    ),
  ].slice(0, maxRecentSearches);

  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextItems));
}

export function deleteGuestRecentSearch(idOrQuery: string) {
  if (!canUseStorage()) {
    return;
  }

  const key = idOrQuery.trim().toLowerCase();
  const nextItems = getGuestRecentSearches().filter((item) => {
    return item.id !== idOrQuery && item.query.trim().toLowerCase() !== key;
  });

  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextItems));
}

export function clearGuestRecentSearches() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(RECENT_SEARCHES_KEY);
}
