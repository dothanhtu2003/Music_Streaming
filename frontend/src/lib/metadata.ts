import type { Metadata } from "next";
import type { ArtistRecord, PlaylistDetail, Song } from "@/types/music";

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const fallbackImagePath = "/icons/icon-512.png";

function absoluteUrl(value: string | null | undefined) {
  if (!value) {
    return `${appUrl}${fallbackImagePath}`;
  }

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    if (value.startsWith("/uploads")) {
      return `${apiUrl.replace(/\/api\/?$/, "")}${value}`;
    }

    return `${appUrl}${value}`;
  }

  return `${appUrl}/${value}`;
}

function getArtistName(song: Song) {
  return song.artist.displayName || song.artist.display_name || song.artist.name;
}

function getSongCover(song: Song) {
  return song.cover_url || song.album?.cover_url || null;
}

function getArtistAvatar(artist: ArtistRecord) {
  return artist.avatarUrl || artist.avatar_url || null;
}

async function publicApiFetch<T>(path: string) {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as ApiResponse<T>;

    return result.success ? result.data ?? null : null;
  } catch {
    return null;
  }
}

function buildMetadata({
  title,
  description,
  image,
  path,
}: {
  title: string;
  description: string;
  image?: string | null;
  path: string;
}): Metadata {
  const imageUrl = absoluteUrl(image);
  const url = `${appUrl}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Music Streaming",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export async function getSongMetadata(id: string): Promise<Metadata> {
  const song = await publicApiFetch<Song>(`/songs/${encodeURIComponent(id)}`);

  if (!song) {
    return buildMetadata({
      title: "Song | Music Streaming",
      description: "Listen to music on Music Streaming.",
      path: `/songs/${id}`,
    });
  }

  const artistName = getArtistName(song);
  const title = `${song.title} by ${artistName} | Music Streaming`;

  return buildMetadata({
    title,
    description: `Listen to ${song.title} by ${artistName} on Music Streaming.`,
    image: getSongCover(song),
    path: `/songs/${id}`,
  });
}

export async function getArtistMetadata(id: string): Promise<Metadata> {
  const artist = await publicApiFetch<ArtistRecord>(
    `/artists/${encodeURIComponent(id)}`,
  );

  if (!artist) {
    return buildMetadata({
      title: "Artist | Music Streaming",
      description: "Listen to artists on Music Streaming.",
      path: `/artists/${id}`,
    });
  }

  const artistName = artist.displayName || artist.display_name || artist.name;

  return buildMetadata({
    title: `${artistName} | Music Streaming`,
    description: `Listen to tracks by ${artistName} on Music Streaming.`,
    image: getArtistAvatar(artist),
    path: `/artists/${id}`,
  });
}

export async function getPlaylistMetadata(slugOrId: string): Promise<Metadata> {
  const privateMetadata = buildMetadata({
    title: "Private Playlist | Music Streaming",
    description: "This playlist is private or unavailable.",
    path: `/playlists/${slugOrId}`,
  });
  const playlist = await publicApiFetch<PlaylistDetail>(
    `/playlists/public/${encodeURIComponent(slugOrId)}`,
  );

  if (!playlist?.is_public) {
    return privateMetadata;
  }

  const ownerName =
    playlist.owner?.displayName ||
    playlist.owner?.username ||
    playlist.owner_name ||
    "Music Streaming";
  const title = `${playlist.name} by ${ownerName} | Music Streaming`;
  const firstTrackCover =
    playlist.songs?.[0]?.cover_url || playlist.songs?.[0]?.album?.cover_url;

  return buildMetadata({
    title,
    description: "Listen to this playlist on Music Streaming.",
    image: playlist.cover_url || firstTrackCover,
    path: `/playlists/${slugOrId}`,
  });
}
