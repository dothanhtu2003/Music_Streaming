"use client";

export function SongCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 animate-pulse">
      <div className="aspect-square w-full rounded-xl bg-zinc-900 shimmer" />
      <div className="mt-4 h-4 w-3/4 rounded bg-zinc-900 shimmer" />
      <div className="mt-2 h-3 w-1/2 rounded bg-zinc-900 shimmer" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-8 rounded-lg bg-zinc-900 shimmer" />
        <div className="h-8 rounded-lg bg-zinc-900 shimmer" />
        <div className="col-span-2 h-8 rounded-lg bg-zinc-900 shimmer" />
      </div>
    </div>
  );
}

export function PlaylistCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 animate-pulse flex flex-col justify-between h-[300px]">
      <div>
        <div className="aspect-square w-full rounded-xl bg-zinc-900 shimmer" />
        <div className="mt-4 h-4 w-2/3 rounded bg-zinc-900 shimmer" />
        <div className="mt-2 h-3 w-1/3 rounded bg-zinc-900 shimmer" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-900 pt-3">
        <div className="h-3 w-20 rounded bg-zinc-900 shimmer" />
        <div className="h-6 w-6 rounded-full bg-zinc-900 shimmer" />
      </div>
    </div>
  );
}

export function ArtistCardSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-950 p-4 animate-pulse">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-900 shimmer" />
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-zinc-900 shimmer" />
          <div className="h-3 w-12 rounded bg-zinc-900 shimmer" />
        </div>
      </div>
      <div className="h-7 w-20 rounded bg-zinc-900 shimmer" />
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-900/10 p-3 bg-zinc-950/20 animate-pulse">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="h-4 w-4 rounded bg-zinc-900 shimmer" />
        <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-900 shimmer" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-1/3 rounded bg-zinc-900 shimmer" />
          <div className="h-3 w-1/4 rounded bg-zinc-900 shimmer" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-4 w-8 rounded bg-zinc-900 shimmer" />
        <div className="h-4 w-12 rounded bg-zinc-900 shimmer" />
      </div>
    </div>
  );
}
