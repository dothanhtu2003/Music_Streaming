import { SongCard } from "@/components/song/SongCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistIcon } from "@/components/ui/Icons";
import { getAlbumById, songs } from "@/lib/mock-data";

type AlbumDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params;
  const album = getAlbumById(id);
  const albumSongs = songs.filter((song) => song.album?.id === album.id);
  const visibleSongs = albumSongs.length ? albumSongs : songs.slice(0, 3);

  return (
    <div className="space-y-8 page-fade-in">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-green-400">
          Album
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">
          {album.title}
        </h1>
        <p className="mt-3 text-zinc-400">
          {album.artist} - {album.year} - {album.songCount} songs
        </p>
      </section>

      <section className="space-y-4">
        <PageHeader title="Track list" description="Static album track preview." />
        {visibleSongs.length === 0 ? (
          <EmptyState
            icon={<PlaylistIcon size={24} />}
            title="Empty Album"
            description="There are no songs in this album."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleSongs.map((song) => (
              <SongCard key={song.id} song={song} queue={visibleSongs} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
