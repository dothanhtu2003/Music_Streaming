import { PlaylistDetailContent } from "@/components/playlist/PlaylistDetailContent";

type PlaylistDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlaylistDetailPage({
  params,
}: PlaylistDetailPageProps) {
  const { id } = await params;

  return <PlaylistDetailContent playlistId={id} />;
}
