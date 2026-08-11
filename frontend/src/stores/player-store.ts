"use client";

import { create } from "zustand";
import type { Song } from "@/types/music";

export type RepeatMode = "off" | "one" | "all";
export type RecentlyPlayedContext =
  | {
      type: "playlist";
      playlistId: string;
    }
  | null;

type PlayerState = {
  currentSong: Song | null;
  recentlyPlayedContext: RecentlyPlayedContext;
  isPlaying: boolean;
  queue: Song[];
  allCatalogSongs: Song[];
  volume: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  shuffleOrder: Song[];
  shuffleIndex: number;
  currentTime: number;
  duration: number;
  playerError: string | null;
  seekTarget: number | null;
  seekVersion: number;
};

type PlayerActions = {
  playSong: (
    song: Song,
    queue?: Song[],
    recentlyPlayedContext?: RecentlyPlayedContext,
  ) => void;
  pauseSong: () => void;
  togglePlay: () => void;
  nextSong: () => void;
  nextSongAfterEnd: () => void;
  previousSong: () => void;
  setQueue: (queue: Song[]) => void;
  setAllCatalogSongs: (songs: Song[]) => void;
  setVolume: (volume: number) => void;
  setRepeatMode: (repeatMode: RepeatMode) => void;
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlayerError: (error: string | null) => void;
  seek: (time: number) => void;
  clearSeekRequest: () => void;
};

export type PlayerStore = PlayerState & PlayerActions;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uniqueSongs(songs: Song[]) {
  const seenIds = new Set<string>();
  const nextSongs: Song[] = [];

  songs.forEach((song) => {
    if (!seenIds.has(song.id)) {
      nextSongs.push(song);
      seenIds.add(song.id);
    }
  });

  return nextSongs;
}

function buildQueue(selectedSong: Song, songs?: Song[]) {
  const nextQueue = uniqueSongs(songs?.length ? songs : [selectedSong]);

  if (nextQueue.some((song) => song.id === selectedSong.id)) {
    return nextQueue;
  }

  return [selectedSong, ...nextQueue];
}

function selectSong(song: Song, shouldPlay = true) {
  return (state: PlayerStore): Partial<PlayerStore> => ({
    currentSong: song,
    isPlaying: shouldPlay,
    currentTime: 0,
    duration: song.duration_sec,
    playerError: null,
    seekTarget: 0,
    seekVersion: state.seekVersion + 1,
  });
}

function buildPlaybackPool(
  currentSong: Song | null,
  queue: Song[],
  allCatalogSongs: Song[],
  includeCatalog = false,
) {
  const pool = uniqueSongs(
    !includeCatalog && queue.length > 1
      ? queue
      : includeCatalog
        ? [...queue, ...allCatalogSongs]
        : allCatalogSongs.length > 0
          ? allCatalogSongs
          : queue,
  );

  if (currentSong && !pool.some((song) => song.id === currentSong.id)) {
    return [currentSong, ...pool];
  }

  return pool;
}

function getPlaybackPool(state: PlayerStore, includeCatalog = false) {
  return buildPlaybackPool(
    state.currentSong,
    state.queue,
    state.allCatalogSongs,
    includeCatalog,
  );
}

function shuffleSongs(songs: Song[]) {
  const shuffledSongs = [...songs];

  for (let index = shuffledSongs.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledSongs[index], shuffledSongs[randomIndex]] = [
      shuffledSongs[randomIndex],
      shuffledSongs[index],
    ];
  }

  return shuffledSongs;
}

function buildShuffleOrder(currentSong: Song | null, pool: Song[]) {
  if (!currentSong) {
    return shuffleSongs(pool);
  }

  return [
    currentSong,
    ...shuffleSongs(pool.filter((song) => song.id !== currentSong.id)),
  ];
}

function reconcileShuffleOrder(state: PlayerStore, pool: Song[]) {
  const poolById = new Map(pool.map((song) => [song.id, song]));
  const preservedOrder = state.shuffleOrder
    .map((song) => poolById.get(song.id))
    .filter((song): song is Song => Boolean(song));

  if (!state.currentSong) {
    const preservedIds = new Set(preservedOrder.map((song) => song.id));
    const addedSongs = shuffleSongs(
      pool.filter((song) => !preservedIds.has(song.id)),
    );

    return {
      order: [...preservedOrder, ...addedSongs],
      index: -1,
    };
  }

  const currentIndex = preservedOrder.findIndex(
    (song) => song.id === state.currentSong?.id,
  );

  if (currentIndex === -1) {
    return {
      order: buildShuffleOrder(state.currentSong, pool),
      index: 0,
    };
  }

  const preservedIds = new Set(preservedOrder.map((song) => song.id));
  const addedSongs = shuffleSongs(
    pool.filter((song) => !preservedIds.has(song.id)),
  );

  return {
    order: [...preservedOrder, ...addedSongs],
    index: currentIndex,
  };
}

function getValidShufflePosition(state: PlayerStore, pool: Song[]) {
  const poolIds = new Set(pool.map((song) => song.id));
  const hasSameSongs =
    state.shuffleOrder.length === pool.length &&
    state.shuffleOrder.every((song) => poolIds.has(song.id));
  const currentMatches =
    state.currentSong?.id === state.shuffleOrder[state.shuffleIndex]?.id;

  if (hasSameSongs && currentMatches) {
    return {
      order: state.shuffleOrder,
      index: state.shuffleIndex,
    };
  }

  return reconcileShuffleOrder(state, pool);
}

function getNextShuffledSong(state: PlayerStore, startNewCycle: boolean) {
  const pool = getPlaybackPool(state, true);

  if (!state.currentSong) {
    const order = buildShuffleOrder(null, pool);
    return order[0]
      ? { song: order[0], order, index: 0 }
      : null;
  }

  const position = getValidShufflePosition(state, pool);
  const nextSong = position.order[position.index + 1];

  if (nextSong) {
    return {
      song: nextSong,
      order: position.order,
      index: position.index + 1,
    };
  }

  if (!startNewCycle) {
    return null;
  }

  const nextOrder = buildShuffleOrder(state.currentSong, pool);
  const nextIndex = nextOrder.length > 1 ? 1 : 0;
  const firstSongOfNextCycle = nextOrder[nextIndex];

  return firstSongOfNextCycle
    ? { song: firstSongOfNextCycle, order: nextOrder, index: nextIndex }
    : null;
}

function getNextSong(state: PlayerStore, wrapAtEnd: boolean) {
  const { currentSong } = state;
  const pool = getPlaybackPool(state);

  if (!currentSong) {
    return pool[0] ?? null;
  }

  if (pool.length <= 1) {
    return wrapAtEnd ? currentSong : null;
  }

  const currentIndex = pool.findIndex((song) => song.id === currentSong.id);

  if (currentIndex === -1) {
    return pool[0] ?? null;
  }

  return pool[currentIndex + 1] ?? (wrapAtEnd ? pool[0] : null);
}

function getPreviousSong(state: PlayerStore) {
  const { currentSong } = state;
  const pool = getPlaybackPool(state);

  if (!currentSong) {
    return pool[0] ?? null;
  }

  if (pool.length <= 1) {
    return null;
  }

  const currentIndex = pool.findIndex((song) => song.id === currentSong.id);
  const previousIndex = currentIndex <= 0 ? pool.length - 1 : currentIndex - 1;

  return pool[previousIndex] ?? null;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  recentlyPlayedContext: null,
  isPlaying: false,
  queue: [],
  allCatalogSongs: [],
  volume: 0.8,
  repeatMode: "off",
  shuffle: false,
  shuffleOrder: [],
  shuffleIndex: -1,
  currentTime: 0,
  duration: 0,
  playerError: null,
  seekTarget: null,
  seekVersion: 0,

  playSong: (song, nextQueue, recentlyPlayedContext = null) => {
    set((state) => {
      const queue = buildQueue(song, nextQueue);
      const pool = buildPlaybackPool(
        song,
        queue,
        state.allCatalogSongs,
        true,
      );

      return {
        ...selectSong(song)(state),
        queue,
        recentlyPlayedContext,
        shuffleOrder: state.shuffle ? buildShuffleOrder(song, pool) : [],
        shuffleIndex: state.shuffle ? 0 : -1,
      };
    });
  },

  pauseSong: () => {
    set({ isPlaying: false });
  },

  togglePlay: () => {
    const state = get();

    if (!state.currentSong && state.queue.length > 0) {
      set(selectSong(state.queue[0]));
      return;
    }

    if (!state.currentSong) {
      return;
    }

    set({ isPlaying: !state.isPlaying, playerError: null });
  },

  nextSong: () => {
    const state = get();

    if (state.shuffle) {
      const selection = getNextShuffledSong(state, true);

      if (selection) {
        set({
          ...selectSong(selection.song)(state),
          shuffleOrder: selection.order,
          shuffleIndex: selection.index,
        });
      }

      return;
    }

    const nextSong = getNextSong(state, true);

    if (nextSong) {
      set(selectSong(nextSong));
    }
  },

  nextSongAfterEnd: () => {
    const state = get();

    if (state.shuffle) {
      const selection = getNextShuffledSong(
        state,
        state.repeatMode === "all",
      );

      if (selection) {
        set({
          ...selectSong(selection.song)(state),
          shuffleOrder: selection.order,
          shuffleIndex: selection.index,
        });
        return;
      }

      set({ isPlaying: false, currentTime: 0, seekTarget: 0 });
      return;
    }

    const nextSong = getNextSong(state, state.repeatMode === "all");

    if (nextSong) {
      set(selectSong(nextSong));
      return;
    }

    set({ isPlaying: false, currentTime: 0, seekTarget: 0 });
  },

  previousSong: () => {
    const state = get();

    if (state.shuffle) {
      const pool = getPlaybackPool(state, true);
      const position = getValidShufflePosition(state, pool);
      const previousIndex = position.index - 1;
      const previousSong = position.order[previousIndex];

      if (previousSong) {
        set({
          ...selectSong(previousSong)(state),
          shuffleOrder: position.order,
          shuffleIndex: previousIndex,
        });
      }

      return;
    }

    const previousSong = getPreviousSong(state);

    if (previousSong) {
      set(selectSong(previousSong));
    }
  },

  setQueue: (queue) => {
    set((state) => {
      const nextQueue = uniqueSongs(queue);
      const pool = buildPlaybackPool(
        state.currentSong,
        nextQueue,
        state.allCatalogSongs,
        true,
      );
      const shufflePosition = state.shuffle
        ? reconcileShuffleOrder(state, pool)
        : null;

      return {
        queue: nextQueue,
        shuffleOrder: shufflePosition?.order ?? [],
        shuffleIndex: shufflePosition?.index ?? -1,
      };
    });
  },

  setAllCatalogSongs: (songs) => {
    set((state) => {
      const allCatalogSongs = uniqueSongs(songs);

      if (!state.shuffle) {
        return { allCatalogSongs };
      }

      const pool = buildPlaybackPool(
        state.currentSong,
        state.queue,
        allCatalogSongs,
        true,
      );
      const shufflePosition = reconcileShuffleOrder(state, pool);

      return {
        allCatalogSongs,
        shuffleOrder: shufflePosition.order,
        shuffleIndex: shufflePosition.index,
      };
    });
  },

  setVolume: (volume) => {
    if (!Number.isFinite(volume)) {
      return;
    }

    set({ volume: clamp(volume, 0, 1) });
  },

  setRepeatMode: (repeatMode) => {
    set({ repeatMode });
  },

  toggleRepeatMode: () => {
    set((state) => ({
      repeatMode:
        state.repeatMode === "off"
          ? "one"
          : state.repeatMode === "one"
            ? "all"
            : "off",
    }));
  },

  toggleShuffle: () => {
    set((state) => {
      if (state.shuffle) {
        return {
          shuffle: false,
          shuffleOrder: [],
          shuffleIndex: -1,
        };
      }

      const pool = getPlaybackPool(state, true);

      return {
        shuffle: true,
        shuffleOrder: buildShuffleOrder(state.currentSong, pool),
        shuffleIndex: state.currentSong ? 0 : -1,
      };
    });
  },

  setCurrentTime: (time) => {
    if (Number.isFinite(time)) {
      set({ currentTime: Math.max(0, time) });
    }
  },

  setDuration: (duration) => {
    if (Number.isFinite(duration)) {
      set({ duration: Math.max(0, duration) });
    }
  },

  setIsPlaying: (isPlaying) => {
    set({ isPlaying });
  },

  setPlayerError: (error) => {
    set({ playerError: error });
  },

  seek: (time) => {
    const state = get();
    const duration = state.duration || state.currentSong?.duration_sec || 0;
    const nextTime = clamp(time, 0, duration || 0);

    set({
      currentTime: nextTime,
      seekTarget: nextTime,
      seekVersion: state.seekVersion + 1,
    });
  },

  clearSeekRequest: () => {
    set({ seekTarget: null });
  },
}));
