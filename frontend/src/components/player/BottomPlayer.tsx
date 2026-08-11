"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SongComments } from "@/components/song/SongComments";
import {
  ChevronDownIcon,
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlaylistIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "@/components/ui/Icons";
import { formatDuration, getSongAudioUrl, getSongCoverUrl } from "@/lib/song-format";
import { WaveformVisualizer } from "@/components/WaveformVisualizer";
import { usePlayerStore } from "@/stores/player-store";
import { useLikes } from "@/components/like/LikeProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSongCommentRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

const QUICK_COMMENTS = ["🔥", "👏", "🥺"] as const;

function CoverThumb() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const coverUrl = currentSong ? getSongCoverUrl(currentSong) : null;

  if (coverUrl) {
    return (
      <span
        className="h-9 w-9 shrink-0 rounded-md border border-zinc-800 bg-cover bg-center md:h-11 md:w-11 md:rounded-lg"
        style={{ backgroundImage: `url(${coverUrl})` }}
        aria-label={`${currentSong?.title} cover`}
      />
    );
  }

  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-800 bg-gradient-to-br from-orange-500 to-zinc-900 text-[10px] font-black text-white md:h-11 md:w-11 md:rounded-lg md:text-[11px]">
      {currentSong?.title.slice(0, 1) ?? "M"}
    </span>
  );
}

export function BottomPlayer() {
  const pathname = usePathname();
  const router = useRouter();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const playerError = usePlayerStore((state) => state.playerError);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const nextSong = usePlayerStore((state) => state.nextSong);
  const previousSong = usePlayerStore((state) => state.previousSong);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const toggleRepeatMode = usePlayerStore((state) => state.toggleRepeatMode);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const [prevVolume, setPrevVolume] = useState(0.5);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [showCommentsSheet, setShowCommentsSheet] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentFeedback, setCommentFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const closeAfterNavigationRef = useRef(false);

  useEffect(() => {
    const handleOpenPlayer = () => {
      setIsMobileExpanded(true);
    };
    window.addEventListener("OPEN_MOBILE_PLAYER", handleOpenPlayer);
    return () => {
      window.removeEventListener("OPEN_MOBILE_PLAYER", handleOpenPlayer);
    };
  }, []);

  useEffect(() => {
    if (closeAfterNavigationRef.current && pathname === "/home") {
      closeAfterNavigationRef.current = false;
      setShowCommentsSheet(false);
      setIsMobileExpanded(false);
    }
  }, [pathname]);

  const { accessToken } = useAuth();
  const { isSongLiked, toggleLike, actionSongId } = useLikes();
  const isLiked = currentSong ? isSongLiked(currentSong.id) : false;
  const likeLoading = currentSong ? actionSongId === currentSong.id : false;

  const totalDuration = duration || currentSong?.duration_sec || 0;
  const canControl = Boolean(currentSong);
  const progressValue = Math.min(currentTime, totalDuration || currentTime);
  const progressPercent = totalDuration
    ? Math.min((progressValue / totalDuration) * 100, 100)
    : 0;
  const repeatActive = repeatMode !== "off";

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      return;
    }

    setVolume(prevVolume);
  };

  const postComment = async (content: string) => {
    const trimmedContent = content.trim();

    if (!currentSong || commentSubmitting || !trimmedContent) {
      return;
    }

    if (!accessToken) {
      setCommentFeedback({
        type: "error",
        message: "Please log in to post a comment.",
      });
      return;
    }

    if (trimmedContent.length > 500) {
      setCommentFeedback({
        type: "error",
        message: "Comment cannot exceed 500 characters.",
      });
      return;
    }

    setCommentSubmitting(true);
    setCommentFeedback(null);

    try {
      await createSongCommentRequest(
        currentSong.id,
        { content: trimmedContent, parentId: null },
        accessToken,
      );
      setCommentContent("");
      setCommentFeedback({ type: "success", message: "Comment posted." });
    } catch (error) {
      setCommentFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Could not post comment.",
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void postComment(commentContent);
  };

  const handleCloseMobilePlayer = () => {
    setShowCommentsSheet(false);

    if (pathname.startsWith("/songs/")) {
      closeAfterNavigationRef.current = true;
      router.replace("/home", { scroll: false });
      return;
    }

    setIsMobileExpanded(false);
  };

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0].clientX;
    touchStartYRef.current = event.touches[0].clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        // Swiped Left -> Next Song
        nextSong();
      } else {
        // Swiped Right -> Previous Song
        previousSong();
      }
    }
  };

  return (
    <>
      {/* MOBILE FULLSCREEN SOUNDCLOUD PLAYER SHEET */}
      {isMobileExpanded && currentSong && (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-50 flex flex-col justify-between bg-black text-white md:hidden animate-in fade-in slide-in-from-bottom duration-300 overflow-hidden"
        >
          {/* Full-Screen Immersive Cover Background with Horizontal Panning */}
          <div
            className="absolute inset-0 z-0 overflow-hidden cursor-pointer"
            onClick={togglePlay}
            title="Tap to Play/Pause"
          >
            {getSongCoverUrl(currentSong) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getSongCoverUrl(currentSong)!}
                alt={currentSong.title}
                className="h-full min-w-[135%] max-w-none object-cover brightness-100"
                style={{
                  transform: `translate3d(${-(progressPercent / 100) * 25}%, 0, 0)`,
                  transition: isPlaying ? "transform 1s linear" : "transform 0.3s ease-out",
                  willChange: "transform",
                }}
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-orange-600 via-purple-900 to-zinc-950" />
            )}
            {/* Soft Edge Gradient Overlays for readability without darkening center */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />
          </div>

          {/* Center Play Button Overlay (Shows when paused, hides when playing) */}
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                togglePlay();
              }}
              className={cn(
                "pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full bg-black/75 backdrop-blur-xl border border-white/25 text-white shadow-2xl transition-all duration-300 active:scale-95",
                !isPlaying ? "opacity-100 scale-100 cursor-pointer" : "opacity-0 scale-75 pointer-events-none"
              )}
              aria-label={isPlaying ? "Pause song" : "Play song"}
            >
              <PlayIcon size={32} className="ml-1 text-white" />
            </button>
          </div>

          {/* Drag Indicator Pill */}
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-12 h-1 rounded-full bg-white/40 backdrop-blur-md cursor-pointer hover:bg-white/60 transition-colors"
            onClick={handleCloseMobilePlayer}
            title="Swipe down to dismiss"
          />

          {/* Top Bar Section (Floating Black Badges) */}
          <div className="relative z-10 flex items-start justify-between px-4 pt-10 pb-2 pointer-events-auto">
            {/* Left: Floating Title & Artist Badges */}
            <div className="min-w-0 flex-1 pr-4 space-y-1.5">
              <div className="inline-block rounded-lg bg-black/65 backdrop-blur-md border border-white/10 px-3 py-1.5 shadow-xl max-w-full">
                <h2 className="line-clamp-2 text-base font-extrabold text-white leading-tight tracking-tight">
                  {currentSong.title}
                </h2>
              </div>
              <div>
                <span className="inline-block rounded-md bg-black/65 backdrop-blur-md border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">
                  {currentSong.artist.name}
                </span>
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[10px] font-bold text-orange-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Behind this track
                </span>
              </div>
            </div>

            {/* Right: Close Button */}
            <button
              type="button"
              onClick={handleCloseMobilePlayer}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-xl transition active:scale-95"
              aria-label="Close player"
            >
              <ChevronDownIcon size={22} />
            </button>
          </div>

          {/* Middle & Waveform Section (Clickable to toggle Play/Pause) */}
          <div
            onClick={togglePlay}
            className="relative z-10 flex flex-col justify-end px-4 pb-2 flex-1 cursor-pointer select-none"
          >
            {/* SoundCloud-Style Interactive Waveform Overlay (Fully Transparent) */}
            <div
              className="relative px-1 py-1 space-y-2"
              onClick={(event) => event.stopPropagation()}
            >
              <WaveformVisualizer
                song={currentSong}
                audioUrl={getSongAudioUrl(currentSong) ?? ""}
                height={84}
              />
              <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-300 px-1">
                <span>{formatDuration(progressValue)}</span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
            </div>

            {/* Floating Glassmorphism Comment Bar with Quick Comments */}
            <form
              onSubmit={handleCommentSubmit}
              className="mt-3 flex items-center gap-2 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-white/10 px-4 py-2 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="text"
                value={commentContent}
                onChange={(event) => {
                  setCommentContent(event.target.value);
                  setCommentFeedback(null);
                }}
                disabled={commentSubmitting}
                maxLength={500}
                enterKeyHint="send"
                placeholder={accessToken ? "Comment..." : "Log in to comment"}
                aria-label="Write a comment"
                className="min-w-0 flex-1 bg-transparent text-xs font-medium text-white outline-none placeholder:text-zinc-400 disabled:opacity-60"
              />
              <div className="flex shrink-0 items-center gap-1.5 text-base">
                {QUICK_COMMENTS.map((reaction) => (
                  <button
                    key={reaction}
                    type="button"
                    disabled={commentSubmitting}
                    onClick={() => void postComment(reaction)}
                    className="rounded-full p-0.5 transition hover:scale-125 active:scale-95 disabled:opacity-40"
                    aria-label={`Post ${reaction} comment`}
                    title={`Post ${reaction}`}
                  >
                    {reaction}
                  </button>
                ))}
                <button
                  type="submit"
                  disabled={commentSubmitting || !commentContent.trim()}
                  className="grid h-7 w-7 place-items-center rounded-full bg-orange-500 text-white transition active:scale-90 disabled:bg-zinc-700 disabled:text-zinc-400"
                  aria-label="Post comment"
                >
                  {commentSubmitting ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <span aria-hidden="true" className="translate-x-px text-xs">➤</span>
                  )}
                </button>
              </div>
            </form>
            {commentFeedback && (
              <p
                role="status"
                className={cn(
                  "mt-1.5 px-3 text-[11px] font-medium",
                  commentFeedback.type === "success"
                    ? "text-emerald-400"
                    : "text-red-400",
                )}
              >
                {commentFeedback.message}
              </p>
            )}
          </div>

          {/* Bottom Action Toolbar (SoundCloud Style) */}
          <div className="relative z-10 flex items-center justify-between bg-black/90 backdrop-blur-2xl border-t border-white/10 px-6 py-4 pb-safe pointer-events-auto">
            {/* Like Button */}
            <button
              type="button"
              disabled={!canControl || likeLoading}
              onClick={() => void toggleLike(currentSong)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-bold transition active:scale-90 touch-target disabled:opacity-30",
                isLiked ? "text-orange-500" : "text-zinc-300 hover:text-white"
              )}
            >
              <HeartIcon size={22} filled={isLiked} />
              <span>{isLiked ? "1" : "0"}</span>
            </button>

            {/* Previous Song Button */}
            <button
              type="button"
              onClick={previousSong}
              disabled={!canControl}
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:text-white transition active:scale-90 disabled:opacity-30 touch-target"
              title="Previous track"
            >
              <PrevIcon size={20} />
            </button>

            {/* Next Song Button */}
            <button
              type="button"
              onClick={nextSong}
              disabled={!canControl}
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-300 hover:text-white transition active:scale-90 disabled:opacity-30 touch-target"
              title="Next track"
            >
              <NextIcon size={20} />
            </button>

            {/* View Comments Drawer Button */}
            <button
              type="button"
              disabled={!canControl}
              onClick={() => setShowCommentsSheet(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white transition active:scale-90 touch-target disabled:opacity-30"
              title="View comments"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Bình luận</span>
            </button>

            {/* Repeat Mode Button */}
            <button
              type="button"
              onClick={toggleRepeatMode}
              disabled={!canControl}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-30 touch-target",
                repeatActive ? "text-orange-500" : "text-zinc-400"
              )}
              title={`Repeat: ${repeatMode}`}
            >
              <RepeatIcon size={20} />
            </button>

            {/* Shuffle Button */}
            <button
              type="button"
              onClick={toggleShuffle}
              disabled={!canControl}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-30 touch-target",
                shuffle ? "text-orange-500" : "text-zinc-400"
              )}
              title="Shuffle"
            >
              <ShuffleIcon size={20} />
            </button>
          </div>
        </div>
      )}

      {/* COMMENTS BOTTOM SHEET DRAWER MODAL */}
      {showCommentsSheet && currentSong && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Song comments"
          className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/80 backdrop-blur-md animate-in fade-in duration-200 md:hidden"
          onClick={() => setShowCommentsSheet(false)}
        >
          <div
            className="relative flex flex-col w-full max-h-[82vh] rounded-t-3xl bg-zinc-950 border-t border-zinc-800 shadow-2xl p-4 sm:p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Handle & Title */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 px-1">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <span className="text-base font-extrabold text-white">Danh sách bình luận</span>
                <span className="truncate rounded-full bg-orange-500/10 text-orange-400 px-2.5 py-0.5 text-xs font-bold border border-orange-500/20">
                  {currentSong.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsSheet(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition active:scale-95 border border-zinc-800"
                aria-label="Close comments"
              >
                ✕
              </button>
            </div>

            {/* Scrollable SongComments List */}
            <div className="flex-1 overflow-y-auto max-h-[68vh] pr-1 space-y-4 no-scrollbar">
              <SongComments
                songId={currentSong.id}
                songOwnerId={currentSong.artist?.user_id}
                artist={currentSong.artist}
                song={currentSong}
              />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM PLAYER BAR */}
      <footer
        className={cn(
          "fixed z-40 left-1/2 -translate-x-1/2 transition-all duration-500 ease-out transform",
          "w-[calc(100%-16px)] h-[56px] rounded-xl border border-zinc-800/90 bg-zinc-950/95 backdrop-blur-xl shadow-xl",
          "md:w-[calc(100%-32px)] md:max-w-6xl md:h-[68px] md:rounded-2xl md:shadow-[0_8px_32px_rgba(0,0,0,0.7)]",
          currentSong
            ? "bottom-16 md:bottom-4 translate-y-0 opacity-100 pointer-events-auto"
            : "bottom-0 translate-y-32 opacity-0 pointer-events-none"
        )}
      >
        {/* Mobile Top Progress Line */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-zinc-800/60 rounded-t-xl overflow-hidden md:hidden">
          <div
            className="h-full bg-orange-500 transition-[width] duration-150"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="relative w-full h-full px-3 md:px-6">
          {/* COMPACT MOBILE MINI-PLAYER BAR */}
          <div className="flex h-full w-full items-center justify-between gap-3 md:hidden">
            {currentSong ? (
              <button
                type="button"
                onClick={() => setIsMobileExpanded(true)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none"
              >
                <CoverThumb />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold leading-tight text-white">
                    {currentSong.title}
                  </span>
                  <span className="block truncate text-[10px] leading-tight text-zinc-400 mt-0.5">
                    {currentSong.artist.name}
                  </span>
                </div>
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <CoverThumb />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold leading-tight text-zinc-400">
                    No song selected
                  </span>
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={!canControl || likeLoading}
                onClick={() => currentSong && void toggleLike(currentSong)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition active:scale-95 disabled:opacity-30",
                  isLiked ? "text-orange-500" : "hover:text-white",
                )}
                title={isLiked ? "Unlike" : "Like"}
              >
                <HeartIcon size={16} filled={isLiked} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!canControl}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition active:scale-95 disabled:opacity-30 shadow-md shadow-black/20"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <PauseIcon size={14} className="text-black" />
                ) : (
                  <PlayIcon size={14} className="ml-0.5 text-black" />
                )}
              </button>
            </div>
          </div>

          {/* DESKTOP LAYOUT */}
          <div className="hidden h-full w-full grid-cols-[1fr_2fr_1fr] items-center gap-6 md:grid">
            
            {/* CỘT TRÁI: Song info + Like */}
            <div className="flex min-w-0 items-center gap-3">
              {currentSong ? (
                <>
                  <Link href={`/songs/${currentSong.id}`} className="shrink-0 transition hover:scale-105">
                    <CoverThumb />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/songs/${currentSong.id}`}
                      className="block truncate text-xs font-extrabold text-white hover:text-orange-500 transition-colors leading-tight"
                    >
                      {currentSong.title}
                    </Link>
                    <Link
                      href={`/artists/${currentSong.artist.id}`}
                      className="block truncate text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors mt-0.5"
                    >
                      {currentSong.artist.name}
                    </Link>
                  </div>
                  
                  {/* Nút Like thực tế */}
                  <button
                    type="button"
                    disabled={!canControl || likeLoading}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void toggleLike(currentSong);
                    }}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/50 hover:text-white transition active:scale-90",
                      isLiked && "text-orange-500 hover:text-orange-400"
                    )}
                    title={isLiked ? "Unlike" : "Like"}
                  >
                    <HeartIcon size={13} filled={isLiked} />
                  </button>
                </>
              ) : (
                <div className="flex min-w-0 items-center gap-2.5">
                  <CoverThumb />
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-bold text-zinc-500">
                      No song selected
                    </span>
                  </div>
                </div>
              )}
            </div>

          {/* CỘT GIỮA: Playback Controls & Progress Seek bar */}
          <div className="flex flex-col items-center gap-0.5 py-0.5">
            {/* Playback Buttons */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={toggleShuffle}
                disabled={!canControl}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-zinc-800/40 active:scale-95 disabled:opacity-30",
                  shuffle ? "text-orange-500" : "text-zinc-400 hover:text-white"
                )}
                title="Shuffle"
              >
                <ShuffleIcon size={13} />
              </button>

              <button
                type="button"
                onClick={previousSong}
                disabled={!canControl}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800/40 hover:text-white active:scale-95 disabled:opacity-30"
                title="Previous"
              >
                <PrevIcon size={13} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={!canControl}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-white text-black transition hover:scale-105 active:scale-95 shadow-md shadow-black/10 disabled:opacity-30"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <PauseIcon size={14} className="text-black" />
                ) : (
                  <PlayIcon size={14} className="ml-0.5 text-black" />
                )}
              </button>

              <button
                type="button"
                onClick={nextSong}
                disabled={!canControl}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800/40 hover:text-white active:scale-95 disabled:opacity-30"
                title="Next"
              >
                <NextIcon size={13} />
              </button>

              <button
                type="button"
                onClick={toggleRepeatMode}
                disabled={!canControl}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-zinc-800/40 active:scale-95 disabled:opacity-30",
                  repeatActive ? "text-orange-500" : "text-zinc-400 hover:text-white"
                )}
                title={`Repeat: ${repeatMode}`}
              >
                <RepeatIcon size={13} />
              </button>
            </div>

            {/* Seek bar */}
            <div className="flex w-full items-center gap-2.5">
              <span className="w-9 text-right text-[9px] font-semibold text-zinc-500 tabular-nums">
                {formatDuration(progressValue)}
              </span>
              <div className="relative flex-1 py-1">
                <input
                  type="range"
                  min={0}
                  max={totalDuration || 0}
                  step={1}
                  value={totalDuration ? progressValue : 0}
                  disabled={!canControl || totalDuration === 0}
                  onInput={(event) => seek(Number(event.currentTarget.value))}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="slider-premium block w-full focus:outline-none"
                  style={{
                    background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${progressPercent}%, #27272a ${progressPercent}%, #27272a 100%)`
                  }}
                  aria-label="Seek song"
                />
              </div>
              <span className="w-9 text-left text-[9px] font-semibold text-zinc-500 tabular-nums">
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: Extra controls (Queue, Mute, Volume) */}
          <div className="flex items-center justify-end gap-3">
            {playerError && (
              <span className="max-w-24 truncate text-[9px] font-semibold text-red-400" title={playerError}>
                {playerError}
              </span>
            )}

            <button
              type="button"
              disabled={!canControl}
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/40 hover:text-white transition active:scale-95 disabled:opacity-30"
              title="Queue"
            >
              <PlaylistIcon size={13} />
            </button>

            {/* Volume section */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                disabled={!canControl}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800/40 hover:text-white transition active:scale-95 disabled:opacity-30"
                title={volume === 0 ? "Unmute" : "Mute"}
              >
                {volume === 0 ? (
                  <VolumeMuteIcon size={13} />
                ) : (
                  <VolumeIcon size={13} />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                disabled={!canControl}
                onInput={(event) => setVolume(Number(event.currentTarget.value))}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="slider-premium w-0 opacity-0 group-hover/volume:w-14 group-hover/volume:opacity-100 transition-all duration-300 ease-out focus:outline-none"
                style={{
                  background: `linear-gradient(to right, #ff5500 0%, #ff5500 ${volume * 100}%, #27272a ${volume * 100}%, #27272a 100%)`
                }}
                aria-label="Volume"
              />
            </div>
          </div>

        </div>
      </div>
    </footer>
    </>
  );
}
