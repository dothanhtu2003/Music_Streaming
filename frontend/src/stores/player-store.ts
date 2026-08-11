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

function hasPlayableQueue(songs?: Song[]) {
  return Boolean(songs && songs.length > 1);
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

function getNextSong(state: PlayerStore) {
  const {
    currentSong,
    queue,
    shuffle,
    allCatalogSongs,
    recentlyPlayedContext,
  } = state;

  if (!currentSong) {
    return queue[0] ?? allCatalogSongs[0] ?? null;
  }

  const isPlayingPlaylist = recentlyPlayedContext?.type === "playlist";

  // Keep the playlist order only when playback actually started from a playlist.
  if (isPlayingPlaylist && queue.length > 1) {
    if (shuffle) {
      const currentIndex = queue.findIndex((song) => song.id === currentSong.id);
      let nextIndex = currentIndex;

      while (nextIndex === currentIndex && queue.length > 1) {
        nextIndex = Math.floor(Math.random() * queue.length);
      }

      return queue[nextIndex] ?? currentSong;
    }

    const currentIndex = queue.findIndex((song) => song.id === currentSong.id);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % queue.length;

    return queue[nextIndex] ?? currentSong;
  }

  // Outside a playlist, swiping left/pressing Next picks another random catalog song.
  const pool = allCatalogSongs.length > 0 ? allCatalogSongs : queue;
  const availableSongs = pool.filter((song) => song.id !== currentSong.id);

  if (availableSongs.length === 0) {
    return currentSong;
  }

  const randomIndex = Math.floor(Math.random() * availableSongs.length);
  return availableSongs[randomIndex] ?? currentSong;
}

function getPreviousSong(state: PlayerStore) {
  const { currentSong, queue } = state;

  if (!currentSong) {
    return queue[0] ?? null;
  }

  if (queue.length <= 1) {
    return currentSong;
  }

  const currentIndex = queue.findIndex((song) => song.id === currentSong.id);
  const previousIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;

  return queue[previousIndex] ?? currentSong;
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
  currentTime: 0,
  duration: 0,
  playerError: null,
  seekTarget: null,
  seekVersion: 0,

  playSong: (song, nextQueue, recentlyPlayedContext = null) => {
    set((state) => ({
      ...selectSong(song)(state),
      queue: buildQueue(song, nextQueue),
      recentlyPlayedContext,
      shuffle: hasPlayableQueue(nextQueue) ? false : state.shuffle,
    }));
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
    const nextSong = getNextSong(get());

    if (nextSong) {
      set(selectSong(nextSong));
    }
  },

  previousSong: () => {
    const state = get();
    const previousSong = getPreviousSong(state);

    if (previousSong) {
      set(selectSong(previousSong));
    }
  },

  setQueue: (queue) => {
    set({ queue: uniqueSongs(queue) });
  },

  setAllCatalogSongs: (songs) => {
    set({ allCatalogSongs: uniqueSongs(songs) });
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
    set((state) => ({ shuffle: !state.shuffle }));
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
