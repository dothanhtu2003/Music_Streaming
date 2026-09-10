import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("advanced player state", () => {
  it("starts the first queued song when play is toggled without a current song", () => {
    usePlayerStore.getState().setQueue([song("one"), song("two")]);
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().currentSong?.id).toBe("one");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("cycles through repeat modes", () => {
    expect(usePlayerStore.getState().repeatMode).toBe("off");
    usePlayerStore.getState().toggleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("one");
    usePlayerStore.getState().toggleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("all");
    usePlayerStore.getState().toggleRepeatMode();
    expect(usePlayerStore.getState().repeatMode).toBe("off");
  });

  it("wraps to the last queue item when previous is pressed on the first song", () => {
    const songs = [song("one"), song("two"), song("three")];
    usePlayerStore.getState().playSong(songs[0], songs);
    usePlayerStore.getState().previousSong();
    expect(usePlayerStore.getState().currentSong?.id).toBe("three");
  });

  it("restarts the queue after natural completion in repeat-all mode", () => {
    const songs = [song("one"), song("two")];
    usePlayerStore.getState().playSong(songs[1], songs);
    usePlayerStore.getState().setRepeatMode("all");
    usePlayerStore.getState().nextSongAfterEnd();
    expect(usePlayerStore.getState().currentSong?.id).toBe("one");
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it("ignores non-finite volume and time values", () => {
    usePlayerStore.getState().setVolume(0.4);
    usePlayerStore.getState().setCurrentTime(12);
    usePlayerStore.getState().setDuration(120);
    usePlayerStore.getState().setVolume(Number.NaN);
    usePlayerStore.getState().setCurrentTime(Number.POSITIVE_INFINITY);
    usePlayerStore.getState().setDuration(Number.NaN);
    expect(usePlayerStore.getState().volume).toBe(0.4);
    expect(usePlayerStore.getState().currentTime).toBe(12);
    expect(usePlayerStore.getState().duration).toBe(120);
  });

  it("clears player errors when playback is toggled", () => {
    usePlayerStore.getState().playSong(song("one"));
    usePlayerStore.getState().setPlayerError("Audio failed");
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().playerError).toBeNull();
  });

  it("creates a deterministic shuffle order without duplicates", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const songs = [song("one"), song("two"), song("two"), song("three")];
    usePlayerStore.getState().playSong(songs[0], songs);
    usePlayerStore.getState().toggleShuffle();
    const state = usePlayerStore.getState();
    expect(state.shuffle).toBe(true);
    expect(state.shuffleOrder[0].id).toBe("one");
    expect(new Set(state.shuffleOrder.map((item) => item.id)).size).toBe(3);
  });

  it("increments and clears seek requests", () => {
    usePlayerStore.getState().playSong(song("one", 100));
    const initialVersion = usePlayerStore.getState().seekVersion;
    usePlayerStore.getState().seek(40);
    expect(usePlayerStore.getState().seekTarget).toBe(40);
    expect(usePlayerStore.getState().seekVersion).toBe(initialVersion + 1);
    usePlayerStore.getState().clearSeekRequest();
    expect(usePlayerStore.getState().seekTarget).toBeNull();
  });
});
