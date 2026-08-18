import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

const song = (id: string, duration = 180): Song => ({
  id,
  title: `Song ${id}`,
  file_url: `https://media.example/${id}.mp3`,
  cover_url: null,
  duration_sec: duration,
  play_count: 0,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  artist: { id: `artist-${id}`, name: "Artist", avatar_url: null },
  album: null,
  genre: null,
});

beforeEach(() => {
  usePlayerStore.setState({
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
  });
});

describe("player state", () => {
  it("plays a selected song and removes duplicate queue entries", () => {
    const first = song("one");
    usePlayerStore.getState().playSong(first, [first, first, song("two")]);

    const state = usePlayerStore.getState();
    expect(state.currentSong?.id).toBe("one");
    expect(state.isPlaying).toBe(true);
    expect(state.queue.map((item) => item.id)).toEqual(["one", "two"]);
  });

  it("moves through the queue and wraps on manual next", () => {
    const songs = [song("one"), song("two")];
    usePlayerStore.getState().playSong(songs[0], songs);
    usePlayerStore.getState().nextSong();
    expect(usePlayerStore.getState().currentSong?.id).toBe("two");
    usePlayerStore.getState().nextSong();
    expect(usePlayerStore.getState().currentSong?.id).toBe("one");
  });

  it("stops at queue end when repeat-all is disabled", () => {
    const songs = [song("one"), song("two")];
    usePlayerStore.getState().playSong(songs[1], songs);
    usePlayerStore.getState().nextSongAfterEnd();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("clamps volume and seek position", () => {
    usePlayerStore.getState().playSong(song("one", 120));
    usePlayerStore.getState().setVolume(4);
    usePlayerStore.getState().seek(999);
    expect(usePlayerStore.getState().volume).toBe(1);
    expect(usePlayerStore.getState().currentTime).toBe(120);
  });
});
