import type { Metadata } from "next";
import { PlaylistDetailContent } from "@/components/playlist/PlaylistDetailContent";
import { getPlaylistMetadata } from "@/lib/metadata";

type PlaylistDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PlaylistDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  return getPlaylistMetadata(id);
}

export default async function PlaylistDetailPage({
  params,
}: PlaylistDetailPageProps) {
  const { id } = await params;

  return <PlaylistDetailContent playlistId={id} />;
}
