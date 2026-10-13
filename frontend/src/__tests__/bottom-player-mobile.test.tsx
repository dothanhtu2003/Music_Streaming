import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BottomPlayer } from "@/components/player/BottomPlayer";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ accessToken: null }),
}));

vi.mock("@/components/like/LikeProvider", () => ({
  useLikes: () => ({
    actionSongId: null,
    isSongLiked: () => false,
    toggleLike: vi.fn(),
  }),
}));

vi.mock("@/components/WaveformVisualizer", () => ({
  WaveformVisualizer: () => <div data-testid="waveform-content" />,
}));

vi.mock("@/components/song/CommentComposer", () => ({
  CommentComposer: () => null,
}));

vi.mock("@/components/song/SongComments", () => ({
  SongComments: () => null,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createSongCommentRequest: vi.fn(),
}));

const song = (id: string): Song => ({
  id,
  title: `Song ${id}`,
  file_url: `https://media.example/${id}.mp3`,
  cover_url: null,
  duration_sec: 180,
  play_count: 0,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  artist: { id: `artist-${id}`, name: "Artist", avatar_url: null },
  album: null,
  genre: null,
});

const songs = [song("one"), song("two")];

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => false),
  });

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
  usePlayerStore.getState().playSong(songs[0], songs);
});

afterEach(() => {
  cleanup();
});

function openMobilePlayer() {
  render(<BottomPlayer />);
  act(() => {
    window.dispatchEvent(new Event("OPEN_MOBILE_PLAYER"));
  });

  return document.querySelector<HTMLElement>("[data-mobile-player]");
}

describe("mobile bottom player navigation", () => {
  it("changes tracks with the Previous and Next buttons", () => {
    openMobilePlayer();

    fireEvent.click(screen.getByTitle("Next track"));
    expect(usePlayerStore.getState().currentSong?.id).toBe("two");

    fireEvent.click(screen.getByTitle("Previous track"));
    expect(usePlayerStore.getState().currentSong?.id).toBe("one");
  });

  it("changes track after a horizontal swipe outside the waveform", () => {
    const player = openMobilePlayer();
    expect(player).not.toBeNull();

    fireEvent.pointerDown(player!, {
      clientX: 320,
      clientY: 300,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerMove(player!, {
      clientX: 220,
      clientY: 304,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerUp(player!, {
      clientX: 180,
      clientY: 304,
      isPrimary: true,
      pointerId: 1,
    });

    expect(usePlayerStore.getState().currentSong?.id).toBe("two");
  });

  it("does not change track when dragging inside the waveform", () => {
    openMobilePlayer();
    const waveform = screen.getByTestId("waveform-content");

    fireEvent.pointerDown(waveform, {
      clientX: 320,
      clientY: 700,
      isPrimary: true,
      pointerId: 2,
    });
    fireEvent.pointerMove(waveform, {
      clientX: 180,
      clientY: 702,
      isPrimary: true,
      pointerId: 2,
    });
    fireEvent.pointerUp(waveform, {
      clientX: 140,
      clientY: 702,
      isPrimary: true,
      pointerId: 2,
    });

    expect(usePlayerStore.getState().currentSong?.id).toBe("one");
  });
});
