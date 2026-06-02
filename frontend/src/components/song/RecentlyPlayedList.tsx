import { SongListItem } from "@/components/song/SongListItem";
import { ListItemSkeleton } from "@/components/ui/Skeletons";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentlyPlayedSong } from "@/types/music";

type RecentlyPlayedListProps = {
  songs: RecentlyPlayedSong[];
  loading?: boolean;
  error?: string | null;
};

export function RecentlyPlayedList({
  songs,
  loading = false,
  error = null,
}: RecentlyPlayedListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <ListItemSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <EmptyState
        title="No recently played tracks"
        description="Tracks you play will be listed here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {songs.map((song) => (
        <SongListItem
          key={`${song.id}-${song.played_at}`}
          song={song}
          queue={songs}
        />
      ))}
    </div>
  );
}

