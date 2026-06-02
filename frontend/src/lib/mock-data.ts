import type { Album, Artist, Playlist, Song } from "@/types/music";

const now = "2026-06-01T00:00:00.000Z";

export const songs: Song[] = [
  {
    id: "1",
    title: "Midnight Loop",
    file_url: "/uploads/demo-midnight-loop.mp3",
    cover_url: null,
    duration_sec: 222,
    play_count: 1200000,
    is_active: true,
    created_at: now,
    updated_at: now,
    artist: {
      id: "1",
      name: "Luna Park",
      avatar_url: null,
    },
    album: {
      id: "1",
      title: "Night Drive",
      cover_url: null,
      release_date: "2026-01-10",
    },
    genre: {
      id: "1",
      name: "Pop",
      slug: "pop",
    },
  },
  {
    id: "2",
    title: "City Lights",
    file_url: "/uploads/demo-city-lights.mp3",
    cover_url: null,
    duration_sec: 248,
    play_count: 840000,
    is_active: true,
    created_at: now,
    updated_at: now,
    artist: {
      id: "2",
      name: "The Echoes",
      avatar_url: null,
    },
    album: {
      id: "2",
      title: "After Hours",
      cover_url: null,
      release_date: "2025-08-20",
    },
    genre: {
      id: "2",
      name: "Indie",
      slug: "indie",
    },
  },
  {
    id: "3",
    title: "Soft Static",
    file_url: "/uploads/demo-soft-static.mp3",
    cover_url: null,
    duration_sec: 178,
    play_count: 512000,
    is_active: true,
    created_at: now,
    updated_at: now,
    artist: {
      id: "3",
      name: "Mira Vale",
      avatar_url: null,
    },
    album: {
      id: "3",
      title: "Room Tone",
      cover_url: null,
      release_date: "2026-03-05",
    },
    genre: {
      id: "3",
      name: "Lo-fi",
      slug: "lo-fi",
    },
  },
  {
    id: "4",
    title: "Low Frequency",
    file_url: "/uploads/demo-low-frequency.mp3",
    cover_url: null,
    duration_sec: 201,
    play_count: 390000,
    is_active: true,
    created_at: now,
    updated_at: now,
    artist: {
      id: "4",
      name: "Northline",
      avatar_url: null,
    },
    album: {
      id: "4",
      title: "Signals",
      cover_url: null,
      release_date: "2024-11-18",
    },
    genre: {
      id: "4",
      name: "Electronic",
      slug: "electronic",
    },
  },
];

export const likedSongs = songs.slice(0, 2);

export const artists: Artist[] = [
  {
    id: "1",
    name: "Luna Park",
    monthlyListeners: "2.4M",
    bio: "Dark pop artist with polished hooks and late-night synth textures.",
  },
  {
    id: "2",
    name: "The Echoes",
    monthlyListeners: "980K",
    bio: "Indie band focused on warm guitars, soft drums, and city stories.",
  },
  {
    id: "3",
    name: "Mira Vale",
    monthlyListeners: "640K",
    bio: "Producer making calm lo-fi instrumentals for focused listening.",
  },
  {
    id: "4",
    name: "Northline",
    monthlyListeners: "410K",
    bio: "Electronic duo mixing deep bass lines with clean melodic layers.",
  },
];

export const albums: Album[] = [
  {
    id: "1",
    title: "Night Drive",
    artist: "Luna Park",
    year: "2026",
    songCount: 12,
  },
  {
    id: "2",
    title: "After Hours",
    artist: "The Echoes",
    year: "2025",
    songCount: 10,
  },
  {
    id: "3",
    title: "Room Tone",
    artist: "Mira Vale",
    year: "2026",
    songCount: 8,
  },
  {
    id: "4",
    title: "Signals",
    artist: "Northline",
    year: "2024",
    songCount: 9,
  },
];

export const playlists: Playlist[] = [
  {
    id: "1",
    name: "Focus Mix",
    description: "Calm songs for coding and study sessions.",
    songCount: 24,
  },
  {
    id: "2",
    name: "Late Night",
    description: "Dark pop and electronic tracks for evening listening.",
    songCount: 18,
  },
  {
    id: "3",
    name: "New Uploads",
    description: "Songs recently added by the admin team.",
    songCount: 12,
  },
];

export function getArtistById(id: string) {
  return artists.find((artist) => artist.id === id) ?? artists[0];
}

export function getAlbumById(id: string) {
  return albums.find((album) => album.id === id) ?? albums[0];
}
