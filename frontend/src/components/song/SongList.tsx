"use client";

import { useRef, useState, type DragEvent, type PointerEvent } from "react";
import { SongCard } from "@/components/song/SongCard";
import { SongListItem } from "@/components/song/SongListItem";
import { SongCardSkeleton, ListItemSkeleton } from "@/components/ui/Skeletons";
import type { Song } from "@/types/music";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

type DropTarget = {
  songId: string;
  edge: "before" | "after";
};

type SongListProps = {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyDescription?: string;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  variant?: "grid" | "list";
  reorderable?: boolean;
  onReorder?: (songs: Song[]) => void;
};

export function reorderSongs(
  songs: Song[],
  draggedSongId: string,
  target: DropTarget,
) {
  if (draggedSongId === target.songId) {
    return songs;
  }

  const draggedIndex = songs.findIndex((song) => song.id === draggedSongId);

  if (draggedIndex === -1) {
    return songs;
  }

  const nextSongs = [...songs];
  const [draggedSong] = nextSongs.splice(draggedIndex, 1);
  const targetIndex = nextSongs.findIndex((song) => song.id === target.songId);

  if (!draggedSong || targetIndex === -1) {
    return songs;
  }

  const insertIndex = target.edge === "after" ? targetIndex + 1 : targetIndex;
  nextSongs.splice(insertIndex, 0, draggedSong);
  return nextSongs;
}

export function SongList({
  songs,
  loading = false,
  error = null,
  emptyMessage = "No songs found.",
  emptyDescription = "Try another search or explore new uploads.",
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
  variant = "grid",
  reorderable = false,
  onReorder,
}: SongListProps) {
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const canStartDragRef = useRef(true);

  const resetDragState = () => {
    setDraggedSongId(null);
    setDropTarget(null);
    canStartDragRef.current = true;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    canStartDragRef.current = !target.closest(
      "button, input, select, textarea, [role='button'], [data-no-drag]",
    );
  };

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    songId: string,
  ) => {
    if (!reorderable || !canStartDragRef.current) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", songId);
    setDraggedSongId(songId);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    songId: string,
  ) => {
    if (!reorderable || !draggedSongId || draggedSongId === songId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const bounds = event.currentTarget.getBoundingClientRect();
    const edge = event.clientY < bounds.top + bounds.height / 2
      ? "before"
      : "after";

    setDropTarget((currentTarget) =>
      currentTarget?.songId === songId && currentTarget.edge === edge
        ? currentTarget
        : { songId, edge },
    );
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const sourceSongId =
      draggedSongId || event.dataTransfer.getData("text/plain");

    if (sourceSongId && dropTarget && onReorder) {
      onReorder(reorderSongs(songs, sourceSongId, dropTarget));
    }

    resetDragState();
  };

  if (loading) {
    if (variant === "list") {
      return (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <ListItemSkeleton key={index} />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <SongCardSkeleton key={index} />
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
        title={emptyMessage}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      {variant === "list" ? (
        <div className="space-y-1">
          {/* Table Header */}
          <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-900/60 mb-2">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <span className="w-8 text-center hidden sm:inline-block">#</span>
              <span>Title</span>
            </div>
            <div className="hidden min-w-[200px] items-center gap-6 md:flex">
              <span className="w-24">Genre</span>
              <span className="w-28 flex items-center gap-1">Plays</span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 w-[110px] justify-end">
              <span className="mr-8">Duration</span>
            </div>
          </div>

          {/* List items */}
          <div className="space-y-1.5">
            {songs.map((song, index) => {
              const showDropLine = dropTarget?.songId === song.id;

              return (
                <div
                  key={song.id}
                  draggable={reorderable}
                  onPointerDownCapture={handlePointerDown}
                  onDragStart={(event) => handleDragStart(event, song.id)}
                  onDragOver={(event) => handleDragOver(event, song.id)}
                  onDrop={handleDrop}
                  onDragEnd={resetDragState}
                  title={
                    reorderable ? "Hold and drag to change play order" : undefined
                  }
                  className={cn(
                    "relative",
                    reorderable && "cursor-grab select-none active:cursor-grabbing",
                    draggedSongId === song.id && "opacity-45",
                  )}
                >
                  {showDropLine && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute inset-x-2 z-20 h-0.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]",
                        dropTarget.edge === "before" ? "-top-1" : "-bottom-1",
                      )}
                    />
                  )}
                  <SongListItem
                    song={song}
                    queue={songs}
                    index={index}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {songs.map((song) => (
            <SongCard key={song.id} song={song} queue={songs} />
          ))}
        </div>
      )}

      {canLoadMore && onLoadMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full border border-zinc-800 px-6 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load more songs"}
          </button>
        </div>
      )}
    </div>
  );
}
