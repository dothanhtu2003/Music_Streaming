import type { Metadata } from "next";
import { SongDetailContent } from "@/components/song/SongDetailContent";
import { getSongMetadata } from "@/lib/metadata";

type SongDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: SongDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  return getSongMetadata(id);
}

export default async function SongDetailPage({ params }: SongDetailPageProps) {
  const { id } = await params;

  return <SongDetailContent songId={id} />;
}
