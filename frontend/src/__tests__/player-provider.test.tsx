import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ accessToken: null }),
}));
vi.mock("@/lib/api", () => ({
  getSongsRequest: vi.fn().mockResolvedValue({ items: [], pagination: { totalPages: 1 } }),
  isUnauthorizedError: () => false,
  listenSongRequest: vi.fn().mockResolvedValue({}),
  saveRecentlyPlayedSong: vi.fn().mockResolvedValue({}),
  resolveApiAssetUrl: (url: string) => url,
}));
const song = {
  id: "one", title: "Track", file_url: "https://example.com/one.mp3",
  duration_sec: 180, artist: { id: "artist", name: "Artist" },
} as Song;

beforeEach(() => {
  usePlayerStore.setState(usePlayerStore.getInitialState());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(cleanup);

it("reports blocked playback before audio data is available", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
    new DOMException("Blocked", "NotAllowedError"),
  );
  render(<PlayerProvider><div /></PlayerProvider>);
  act(() => usePlayerStore.getState().playSong(song, [song]));
  await waitFor(() => expect(usePlayerStore.getState().isPlaying).toBe(false));
  expect(usePlayerStore.getState().playerError).toContain("blocked");
});

it("reports an unsupported source instead of leaving playback active", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
    new DOMException("Unsupported", "NotSupportedError"),
  );
  render(<PlayerProvider><div /></PlayerProvider>);
  act(() => usePlayerStore.getState().playSong(song, [song]));
  await waitFor(() => expect(usePlayerStore.getState().playerError).toContain("Could not play"));
  expect(usePlayerStore.getState().isPlaying).toBe(false);
});

it("ignores late playback failures from a previous song", async () => {
  let rejectOld!: (reason: unknown) => void;
  vi.spyOn(HTMLMediaElement.prototype, "play")
    .mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectOld = reject; }))
    .mockResolvedValue(undefined);
  render(<PlayerProvider><div /></PlayerProvider>);
  act(() => usePlayerStore.getState().playSong(song, [song]));
  const next = { ...song, id: "two", file_url: "https://example.com/two.mp3" };
  act(() => usePlayerStore.getState().playSong(next, [next]));
  await act(async () => rejectOld(new DOMException("Old failure", "NotSupportedError")));
  expect(usePlayerStore.getState().isPlaying).toBe(true);
  expect(usePlayerStore.getState().playerError).toBeNull();
});
