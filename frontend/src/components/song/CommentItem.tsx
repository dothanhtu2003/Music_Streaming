import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteSongCommentRequest, resolveApiAssetUrl } from "@/lib/api";
import { ReplyForm } from "@/components/song/ReplyForm";
import type { SongComment } from "@/types/music";

type CommentItemProps = {
  comment: SongComment;
  songId: string;
  songOwnerId?: string | null;
  isReply?: boolean;
  onCommentDeleted: (commentId: string) => void;
  onReplyAdded?: (parentId: string, reply: SongComment) => void;
};

function timeAgo(dateString: string) {
  try {
    const now = new Date();
    const past = new Date(dateString);
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;
    const msPerYear = msPerDay * 365;

    const elapsed = now.getTime() - past.getTime();

    if (elapsed < msPerMinute) {
      return "just now";
    } else if (elapsed < msPerHour) {
      const mins = Math.round(elapsed / msPerMinute);
      return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    } else if (elapsed < msPerDay) {
      const hours = Math.round(elapsed / msPerHour);
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    } else if (elapsed < msPerMonth) {
      const days = Math.round(elapsed / msPerDay);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    } else if (elapsed < msPerYear) {
      const months = Math.round(elapsed / msPerDay / 30);
      return `${months} month${months === 1 ? "" : "s"} ago`;
    } else {
      const years = Math.round(elapsed / msPerYear);
      return `${years} year${years === 1 ? "" : "s"} ago`;
    }
  } catch {
    return "";
  }
}

export function CommentItem({
  comment,
  songId,
  songOwnerId,
  isReply = false,
  onCommentDeleted,
  onReplyAdded,
}: CommentItemProps) {
  const { user, accessToken, isAdmin } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canDelete =
    Boolean(user) &&
    (user?.id === comment.user.id || // Owner of comment
      user?.id === songOwnerId || // Owner of song
      isAdmin); // Admin

  const handleDelete = async () => {
    if (!accessToken || deleting) return;
    if (!window.confirm("Are you sure you want to delete this comment?")) return;

    setDeleting(true);
    try {
      await deleteSongCommentRequest(comment.id, accessToken);
      onCommentDeleted(comment.id);
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Failed to delete comment.");
    } finally {
      setDeleting(false);
    }
  };

  const avatarUrl = resolveApiAssetUrl(comment.user.avatar_url);

  return (
    <div className="space-y-2">
      <div className="group flex items-start gap-3 py-3 border-b border-zinc-900/80 last:border-b-0 transition duration-150">
        {/* Avatar */}
        <Link href={`/users/${comment.user.id}`} className="shrink-0 hover:opacity-90 transition">
          {avatarUrl ? (
            <div
              className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center border border-zinc-700/80 shadow-md ring-1 ring-zinc-800"
              style={{ backgroundImage: `url(${avatarUrl})` }}
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider shadow-md">
              {comment.user.username.slice(0, 2)}
            </div>
          )}
        </Link>

        {/* Content Area */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Metadata Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/users/${comment.user.id}`}
                className="text-xs sm:text-sm font-extrabold text-zinc-100 hover:text-orange-400 transition cursor-pointer"
              >
                {comment.user.username}
              </Link>

              <span className="rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 text-[10px] font-mono font-bold shadow-xs">
                at 0:00
              </span>

              {comment.isArtist && (
                <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-sm">
                  ARTIST
                </span>
              )}

              <span className="text-[10px] font-semibold text-zinc-500">
                • {timeAgo(comment.created_at)}
              </span>
            </div>
          </div>

          {/* Comment text */}
          <p className="text-xs sm:text-[13px] text-zinc-200 break-words leading-relaxed whitespace-pre-wrap font-normal">
            {comment.content}
          </p>

          {/* Action Row */}
          <div className="pt-1 flex items-center gap-3 text-xs font-semibold text-zinc-400 transition-opacity">
            {!isReply && user && (
              <button
                type="button"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="hover:text-orange-400 transition cursor-pointer text-[11px]"
              >
                Reply
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="hover:text-red-400 transition disabled:opacity-50 cursor-pointer text-[11px]"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && !isReply && (
        <ReplyForm
          songId={songId}
          parentId={comment.id}
          onCancel={() => setShowReplyForm(false)}
          onReplyAdded={(reply) => {
            setShowReplyForm(false);
            if (onReplyAdded) {
              onReplyAdded(comment.id, reply);
            }
          }}
        />
      )}

      {/* Replies list */}
      {!isReply && comment.replies && comment.replies.length > 0 && (
        <div className="ml-10 space-y-1">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              songId={songId}
              songOwnerId={songOwnerId}
              isReply={true}
              onCommentDeleted={onCommentDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
