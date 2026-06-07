import type { Metadata } from "next";
import { ArtistDetailContent } from "@/components/artist/ArtistDetailContent";
import { getArtistMetadata } from "@/lib/metadata";

type ArtistDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ArtistDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  return getArtistMetadata(id);
}

export default function ArtistDetailPage() {
  return <ArtistDetailContent />;
}
