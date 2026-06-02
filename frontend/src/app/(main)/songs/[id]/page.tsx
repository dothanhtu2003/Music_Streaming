import { SongDetailContent } from "@/components/song/SongDetailContent";

type SongDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { id } = await params;

  return <SongDetailContent songId={id} />;
}
