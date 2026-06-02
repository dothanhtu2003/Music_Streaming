"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { LatestSongCard } from "@/components/song/LatestSongCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { Song } from "@/types/music";

type HorizontalSongCarouselProps = {
  title: string;
  subtitle?: string;
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyDescription?: string;
  viewAllHref?: string;
  canLoadMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 6l6 6-6 6" />
      )}
    </svg>
  );
}

function LatestSongCardSkeleton() {
  return (
    <div className="w-[160px] flex-none snap-start animate-pulse">
      <div className="h-[160px] w-[160px] rounded-xl bg-zinc-900 shimmer" />
      <div className="mt-3 h-4 w-32 rounded bg-zinc-900 shimmer" />
      <div className="mt-2 h-3 w-24 rounded bg-zinc-900 shimmer" />
      <div className="mt-2 flex gap-2">
        <div className="h-8 w-8 rounded-full bg-zinc-900 shimmer" />
        <div className="h-8 w-8 rounded-full bg-zinc-900 shimmer" />
      </div>
    </div>
  );
}

function isInteractiveElement(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("button, a, input, textarea, select"))
  );
}

export function HorizontalSongCarousel({
  title,
  subtitle,
  songs,
  loading = false,
  error = null,
  emptyTitle,
  emptyDescription,
  viewAllHref,
  canLoadMore = false,
  loadingMore = false,
  onLoadMore,
}: HorizontalSongCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const element = scrollRef.current;

    if (!element) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;

    setCanScrollLeft(element.scrollLeft > 2);
    setCanScrollRight(element.scrollLeft < maxScrollLeft - 2);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element || loading || songs.length === 0) {
      updateScrollButtons();
      return;
    }

    updateScrollButtons();
    element.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      element.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [loading, songs.length, updateScrollButtons]);

  const scrollByDirection = (direction: "left" | "right") => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const scrollDistance = Math.max(220, Math.floor(element.clientWidth * 0.75));

    element.scrollBy({
      left: direction === "left" ? -scrollDistance : scrollDistance,
      behavior: "smooth",
    });

    window.setTimeout(updateScrollButtons, 350);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || isInteractiveElement(event.target)) {
      return;
    }

    const element = scrollRef.current;

    if (!element) {
      return;
    }

    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragScrollLeftRef.current = element.scrollLeft;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
      return;
    }

    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const dragDistance = event.clientX - dragStartXRef.current;

    if (Math.abs(dragDistance) > 4) {
      hasDraggedRef.current = true;
    }

    element.scrollLeft = dragScrollLeftRef.current - dragDistance;
    event.preventDefault();
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (hasDraggedRef.current) {
      window.setTimeout(() => {
        hasDraggedRef.current = false;
      }, 0);
    }
  };

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-zinc-900 pb-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-white">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="rounded-full border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-orange-500/40 hover:text-white"
            >
              View all
            </Link>
          )}
          {!loading && songs.length > 0 && (
            <>
              <button
                type="button"
                aria-label="Scroll latest songs left"
                disabled={!canScrollLeft}
                onClick={() => scrollByDirection("left")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 transition hover:border-orange-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                aria-label="Scroll latest songs right"
                disabled={!canScrollRight}
                onClick={() => scrollByDirection("right")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-300 transition hover:border-orange-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowIcon direction="right" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
          {error}
        </div>
      )}

      {!error && loading && (
        <div className="min-w-0 overflow-hidden">
          <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <LatestSongCardSkeleton key={index} />
            ))}
          </div>
        </div>
      )}

      {!error && !loading && songs.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}

      {!error && !loading && songs.length > 0 && (
        <>
          <div className="min-w-0 overflow-hidden">
            <div
              ref={scrollRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              onClickCapture={(event) => {
                if (!hasDraggedRef.current) {
                  return;
                }

                event.preventDefault();
                event.stopPropagation();
                hasDraggedRef.current = false;
              }}
              className={cn(
                "no-scrollbar flex min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 scroll-smooth touch-pan-x select-none",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
            >
              {songs.map((song) => (
                <LatestSongCard key={song.id} song={song} queue={songs} />
              ))}
            </div>
          </div>

          {canLoadMore && onLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="rounded-full border border-zinc-800 px-5 py-2 text-xs font-semibold text-zinc-300 transition hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more songs"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
