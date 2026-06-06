import React from "react";

export function CommentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-lg border border-zinc-900 bg-zinc-950 p-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-900" />
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-28 rounded bg-zinc-900" />
              <div className="h-3.5 w-16 rounded bg-zinc-900" />
            </div>
            <div className="h-4 w-full rounded bg-zinc-900" />
            <div className="h-4 w-3/4 rounded bg-zinc-900" />
          </div>
        </div>
      ))}
    </div>
  );
}
