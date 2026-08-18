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
  viewAllLabel?: string;
  onViewAll?: () => void;
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
    <div className="w-[136px] sm:w-[160px] flex-none snap-start animate-pulse">
      <div className="h-[136px] w-[136px] sm:h-[160px] sm:w-[160px] rounded-xl bg-zinc-900 shimmer" />
      <div className="mt-3 h-4 w-28 sm:w-32 rounded bg-zinc-900 shimmer" />
      <div className="mt-2 h-3 w-20 sm:w-24 rounded bg-zinc-900 shimmer" />
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
  viewAllLabel = "View all",
  onViewAll,
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

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollLeft = 0;
      updateScrollButtons();
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = 0;
          updateScrollButtons();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [songs, loading, updateScrollButtons]);

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
      <div className="flex items-start justify-between gap-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-orange-500/10 border border-orange-500/20">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-orange-500" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <h2 className="text-base font-extrabold tracking-tight text-white truncate sm:text-lg">
              {title}
            </h2>
          </div>
          {subtitle && (
            <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500 font-medium">
              <span>•</span>
              <span>{subtitle}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 self-center">
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs font-semibold text-zinc-400 hover:text-[#ff5500] hover:brightness-110 active:scale-95 transition-all duration-200"
            >
              {viewAllLabel}
            </Link>
          )}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-zinc-400 hover:text-[#ff5500] hover:brightness-110 active:scale-95 transition-all duration-200"
            >
              {viewAllLabel}
            </button>
          )}
          {!loading && songs.length > 0 && (
            <div className="hidden items-center gap-1.5 md:flex">
              <button
                type="button"
                aria-label="Scroll latest songs left"
                disabled={!canScrollLeft}
                onClick={() => scrollByDirection("left")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-900/80 text-zinc-400 transition hover:border-orange-500/30 hover:text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                aria-label="Scroll latest songs right"
                disabled={!canScrollRight}
                onClick={() => scrollByDirection("right")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-900/80 text-zinc-400 transition hover:border-orange-500/30 hover:text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ArrowIcon direction="right" />
              </button>
            </div>
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
        </>
      )}
    </section>
  );
}
