"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { usePlayerStore } from "@/stores/player-store";
import {
  HeartIcon,
  PlusIcon,
  UserIcon,
  CommentIcon,
  RepeatIcon,
  PaperPlaneIcon,
  CopyIcon,
  QRCodeIcon,
  SMSIcon,
  WhatsAppIcon,
  QueueNextIcon,
  QueueLastIcon,
  ThumbsDownIcon,
} from "@/components/ui/Icons";
import {
  getArtistDisplayName,
  getSongCoverUrl,
} from "@/lib/song-format";
import type { Song } from "@/types/music";
import { cn } from "@/lib/utils";

type SongMoreOptionsSheetProps = {
  song: Song;
  onClose: () => void;
  onOpenComments?: () => void;
};

export function SongMoreOptionsSheet({
  song,
  onClose,
  onOpenComments,
}: SongMoreOptionsSheetProps) {
  const router = useRouter();
  const { isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();

  const queue = usePlayerStore((state) => state.queue);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const setQueue = usePlayerStore((state) => state.setQueue);

  const [isClosing, setIsClosing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const liked = isSongLiked(song.id);
  const coverUrl = getSongCoverUrl(song);
  const artistName = getArtistDisplayName(song.artist);
  const artistId = song.artist?.id;
  const artistUserId = song.artist?.user_id || song.artist?.id;

  const handleDismiss = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/songs/${song.id}`;
    await navigator.clipboard.writeText(url);
    showToast("Copied link to clipboard!");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/songs/${song.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: song.title,
          text: `Listen to ${song.title} on Music Streaming`,
          url,
        });
      } catch {
        // Fallback
      }
    } else {
      await handleCopyLink();
    }
  };

  const handleGoToProfile = () => {
    handleDismiss();
    if (artistId) {
      router.push(`/artists/${artistId}`);
    } else if (artistUserId) {
      router.push(`/users/${artistUserId}`);
    }
  };

  const handlePlayNext = () => {
    const newQueue = [...queue];
    const currentIndex = newQueue.findIndex((s) => s.id === currentSong?.id);
    if (currentIndex >= 0) {
      newQueue.splice(currentIndex + 1, 0, song);
    } else {
      newQueue.unshift(song);
    }
    setQueue(newQueue);
    showToast("Added to play next queue");
    setTimeout(handleDismiss, 600);
  };

  const handlePlayLast = () => {
    setQueue([...queue, song]);
    showToast("Added to end of queue");
    setTimeout(handleDismiss, 600);
  };

  return (
    <div
      onClick={handleDismiss}
      className={cn(
        "fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end transition-opacity duration-300",
        isClosing ? "opacity-0 pointer-events-none" : "animate-in fade-in duration-300",
      )}
    >
      {/* Toast Notice */}
      {toastMessage && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl animate-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}

      {/* Sheet Container with smooth slide-in and slide-down transition */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md mx-auto max-h-[85vh] bg-[#191615] border-t border-zinc-800/80 rounded-t-3xl p-5 flex flex-col overflow-y-auto no-scrollbar shadow-2xl transition-transform duration-300 ease-out text-white select-none",
          isClosing ? "translate-y-full" : "animate-in slide-in-from-bottom duration-300 ease-out",
        )}
      >
        {/* Top Drag Handle Pill */}
        <div className="w-10 h-1 bg-zinc-700/80 rounded-full mx-auto mb-4 shrink-0 opacity-80" />

        {/* Header Track Card Banner with Vinyl Effect */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-r from-zinc-900/90 to-zinc-950/90 border border-white/10 p-3.5 flex items-center gap-4 mb-5 shadow-lg">
          {/* Background Blur Image */}
          {coverUrl && (
            <Image
              src={coverUrl}
              alt={song.title}
              fill
              className="object-cover opacity-15 blur-xl pointer-events-none"
            />
          )}

          {/* Vinyl Disk + Cover Image Container */}
          <div className="relative shrink-0 w-20 h-20 flex items-center">
            {/* Vinyl Record Disk sticking out */}
            <div className="absolute right-0 w-16 h-16 rounded-full bg-black border-4 border-zinc-900 flex items-center justify-center shadow-md animate-[spin_12s_linear_infinite]">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-black" />
              </div>
            </div>

            {/* Square Cover Artwork */}
            <div className="relative z-10 w-16 h-16 rounded-xl overflow-hidden shadow-xl border border-white/20">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={song.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-orange-500 flex items-center justify-center font-bold text-white text-lg">
                  {song.title.charAt(0)}
                </div>
              )}
            </div>
          </div>

          {/* Song Details Info */}
          <div className="relative z-10 min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-extrabold text-white leading-tight line-clamp-2">
              {song.title}
            </h3>
            <p className="text-xs font-medium text-zinc-300 flex items-center gap-1">
              <span>{artistName}</span>
              <span className="text-orange-400">✿</span>
            </p>
            <p className="text-[10px] text-zinc-400 truncate leading-tight">
              under exclusive license to distributed by {artistName} Music Group
            </p>
          </div>
        </div>

        {/* SHARE Section */}
        <div className="space-y-2.5 mb-2">
          <h4 className="text-[11px] font-extrabold text-zinc-400 tracking-wider uppercase px-1">
            SHARE
          </h4>

          {/* Horizontal Scrolling Share Buttons */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1 px-1">
            {/* Message */}
            <button
              onClick={() => void handleShare()}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-200 group-hover:bg-zinc-700 group-hover:text-white transition-colors">
                <PaperPlaneIcon size={20} />
              </div>
              <span className="text-[11px] font-medium text-zinc-300">Message</span>
            </button>

            {/* Copy link */}
            <button
              onClick={() => void handleCopyLink()}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-200 group-hover:bg-zinc-700 group-hover:text-white transition-colors">
                <CopyIcon size={20} />
              </div>
              <span className="text-[11px] font-medium text-zinc-300">Copy link</span>
            </button>

            {/* QR code */}
            <button
              onClick={() => void handleCopyLink()}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-200 group-hover:bg-zinc-700 group-hover:text-white transition-colors">
                <QRCodeIcon size={20} />
              </div>
              <span className="text-[11px] font-medium text-zinc-300">QR code</span>
            </button>

            {/* SMS */}
            <button
              onClick={() => void handleShare()}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700/70 flex items-center justify-center text-zinc-200 group-hover:bg-zinc-700 group-hover:text-white transition-colors">
                <SMSIcon size={20} />
              </div>
              <span className="text-[11px] font-medium text-zinc-300">SMS</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={() => void handleShare()}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-md">
                <WhatsAppIcon size={22} />
              </div>
              <span className="text-[11px] font-medium text-zinc-300">WhatsApp</span>
            </button>

            {/* Instagram Stories */}
            <button
              onClick={() => void handleShare()}
              className="flex flex-col items-center gap-1.5 shrink-0 group active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-md">
                <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-white">
                  <span className="text-xs font-black">Stories</span>
                </div>
              </div>
              <span className="text-[11px] font-medium text-zinc-300">Stories</span>
            </button>
          </div>
        </div>

        <div className="h-[1px] bg-zinc-800/80 my-2" />

        {/* Options List */}
        <div className="space-y-0.5">
          {/* Like */}
          <button
            onClick={() => void toggleLike(song)}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <HeartIcon
              size={22}
              filled={liked}
              className={cn(liked ? "text-orange-500 fill-orange-500" : "text-zinc-200")}
            />
            <span className="text-sm font-semibold text-zinc-100">
              {liked ? "Liked" : "Like"}
            </span>
          </button>

          {/* Play next */}
          <button
            onClick={handlePlayNext}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <QueueNextIcon size={22} className="text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-100">Play next</span>
          </button>

          {/* Play last */}
          <button
            onClick={handlePlayLast}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <QueueLastIcon size={22} className="text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-100">Play last</span>
          </button>

          {/* Add to playlist */}
          <button
            onClick={() => {
              handleDismiss();
              openAddSongModal(song);
            }}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <PlusIcon size={22} className="text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-100">Add to playlist</span>
          </button>

          <div className="h-[1px] bg-zinc-800/80 my-1" />

          {/* Go to profile */}
          <button
            onClick={handleGoToProfile}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <UserIcon size={22} className="text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-100">Go to profile</span>
          </button>

          <div className="h-[1px] bg-zinc-800/80 my-1" />

          {/* View comments */}
          {onOpenComments && (
            <button
              onClick={() => {
                handleDismiss();
                onOpenComments();
              }}
              className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
            >
              <CommentIcon size={22} className="text-zinc-200" />
              <span className="text-sm font-semibold text-zinc-100">View comments</span>
            </button>
          )}

          {/* Repost */}
          <button
            onClick={() => void handleShare()}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <RepeatIcon size={22} className="text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-100">Repost song</span>
          </button>

          <div className="h-[1px] bg-zinc-800/80 my-1" />

          {/* Show me fewer posts like that */}
          <button
            onClick={() => {
              showToast("We will show fewer tracks like this");
              setTimeout(handleDismiss, 800);
            }}
            className="w-full flex items-center gap-4 py-3 px-2 rounded-xl text-left hover:bg-zinc-800/50 active:bg-zinc-800 transition-colors"
          >
            <ThumbsDownIcon size={22} className="text-zinc-200" />
            <span className="text-sm font-semibold text-zinc-100">
              Show me fewer posts like that
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
