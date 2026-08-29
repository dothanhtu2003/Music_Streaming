import { describe, expect, it } from "vitest";
import { reorderSongs } from "@/components/song/SongList";
import type { Song } from "@/types/music";

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

describe("liked song reordering", () => {
  const songs = [song("one"), song("two"), song("three")];

  it("moves a song before the selected row", () => {
    const reorderedSongs = reorderSongs(songs, "three", {
      songId: "one",
      edge: "before",
    });

    expect(reorderedSongs.map((item) => item.id)).toEqual([
      "three",
      "one",
      "two",
    ]);
    expect(songs.map((item) => item.id)).toEqual(["one", "two", "three"]);
  });

  it("moves a song after the selected row", () => {
    const reorderedSongs = reorderSongs(songs, "one", {
      songId: "three",
      edge: "after",
    });

    expect(reorderedSongs.map((item) => item.id)).toEqual([
      "two",
      "three",
      "one",
    ]);
  });
});
