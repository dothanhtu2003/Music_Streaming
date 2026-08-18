"use client";

import { create } from "zustand";
import type { Song } from "@/types/music";

export type FeedTab = "discover" | "following";

type MobileFeedState = {
  activeTab: FeedTab;
  discoverSongs: Song[];
  followingSongs: Song[];
  discoverExcludeIds: string[];
  followingExcludeIds: string[];
  activeSongIndex: number;
  hasLoadedDiscover: boolean;
  hasLoadedFollowing: boolean;
};

type MobileFeedActions = {
  setActiveTab: (tab: FeedTab) => void;
  setDiscoverSongs: (songs: Song[]) => void;
  appendDiscoverSongs: (songs: Song[]) => void;
  setFollowingSongs: (songs: Song[]) => void;
  appendFollowingSongs: (songs: Song[]) => void;
  setDiscoverExcludeIds: (ids: string[]) => void;
  setFollowingExcludeIds: (ids: string[]) => void;
  setActiveSongIndex: (index: number) => void;
  resetTab: (tab: FeedTab) => void;
  resetAll: () => void;
};

export type MobileFeedStore = MobileFeedState & MobileFeedActions;

export const useMobileFeedStore = create<MobileFeedStore>((set) => ({
  activeTab: "discover",
  discoverSongs: [],
  followingSongs: [],
  discoverExcludeIds: [],
  followingExcludeIds: [],
  activeSongIndex: 0,
  hasLoadedDiscover: false,
  hasLoadedFollowing: false,

  setActiveTab: (activeTab) => set({ activeTab }),

  setDiscoverSongs: (discoverSongs) =>
    set({ discoverSongs, hasLoadedDiscover: true }),

  appendDiscoverSongs: (newSongs) =>
    set((state) => {
      const existingIds = new Set(state.discoverSongs.map((s) => s.id));
      const filtered = newSongs.filter((s) => !existingIds.has(s.id));
      return {
        discoverSongs: [...state.discoverSongs, ...filtered],
        discoverExcludeIds: [
          ...state.discoverExcludeIds,
          ...newSongs.map((s) => s.id),
        ],
        hasLoadedDiscover: true,
      };
    }),

  setFollowingSongs: (followingSongs) =>
    set({ followingSongs, hasLoadedFollowing: true }),

  appendFollowingSongs: (newSongs) =>
    set((state) => {
      const existingIds = new Set(state.followingSongs.map((s) => s.id));
      const filtered = newSongs.filter((s) => !existingIds.has(s.id));
      return {
        followingSongs: [...state.followingSongs, ...filtered],
        followingExcludeIds: [
          ...state.followingExcludeIds,
          ...newSongs.map((s) => s.id),
        ],
        hasLoadedFollowing: true,
      };
    }),

  setDiscoverExcludeIds: (discoverExcludeIds) => set({ discoverExcludeIds }),
  setFollowingExcludeIds: (followingExcludeIds) => set({ followingExcludeIds }),

  setActiveSongIndex: (activeSongIndex) => set({ activeSongIndex }),

  resetTab: (tab) =>
    set((state) =>
      tab === "discover"
        ? { discoverSongs: [], discoverExcludeIds: [], hasLoadedDiscover: false, activeSongIndex: 0 }
        : { followingSongs: [], followingExcludeIds: [], hasLoadedFollowing: false, activeSongIndex: 0 },
    ),

  resetAll: () =>
    set({
      discoverSongs: [],
      followingSongs: [],
      discoverExcludeIds: [],
      followingExcludeIds: [],
      activeSongIndex: 0,
      hasLoadedDiscover: false,
      hasLoadedFollowing: false,
    }),
}));
