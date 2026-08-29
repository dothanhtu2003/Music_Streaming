import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSongCommentRequest, resolveApiAssetUrl } from "@/lib/api";
import { usePlayerStore } from "@/stores/player-store";
import { formatDuration } from "@/lib/song-format";
import type { SongComment } from "@/types/music";

type CommentComposerProps = {
  songId: string;
  onCommentAdded: (comment: SongComment) => void;
  value?: string;
  onChange?: (val: string) => void;
  timestampText?: string;
  placeholder?: string;
};

const QUICK_EMOJIS = ["🔥", "👏", "❤️‍🔥", "🥺", "🎵"] as const;

export function CommentComposer({
  songId,
  onCommentAdded,
  value,
  onChange,
  timestampText,
  placeholder = "Add a comment...",
}: CommentComposerProps) {
  const { user, accessToken } = useAuth();
  const [internalContent, setInternalContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSong = usePlayerStore((state) => state.currentSong);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const isCurrentSong = currentSong?.id === songId;
  const currentFormattedTime = isCurrentSong ? formatDuration(currentTime) : null;
  const activeTimestampText = timestampText ?? currentFormattedTime ?? "0:00";

  const content = value !== undefined ? value : internalContent;
  const setContent = (val: string) => {
    if (onChange) onChange(val);
    else setInternalContent(val);
  };

  const handlePost = async (textToPost: string) => {
    if (!accessToken || submitting) return;

    const trimmed = textToPost.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      setError("Comment cannot exceed 500 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newComment = await createSongCommentRequest(
        songId,
        { content: trimmed, parentId: null },
        accessToken
      );
      setContent("");
      onCommentAdded(newComment);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post comment.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handlePost(content);
  };

  if (!user) {
    return (
      <div className="rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-2 text-center text-xs text-zinc-400">
        Please <a href="/login" className="text-orange-500 hover:underline font-bold">log in</a> to comment.
      </div>
    );
  }

  const avatarUrl = resolveApiAssetUrl(user.avatarUrl);

  return (
    <form onSubmit={handleSubmit} className="group relative w-full">
      <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 transition-all duration-200 focus-within:border-orange-500/70 focus-within:bg-zinc-900">
        {/* Avatar */}
        {avatarUrl ? (
          <div
            className="h-7 w-7 shrink-0 rounded-full bg-cover bg-center border border-zinc-700 shadow-sm"
            style={{ backgroundImage: `url(${avatarUrl})` }}
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-[10px] font-extrabold text-zinc-300 uppercase">
            {user.username.slice(0, 2)}
          </div>
        )}

        {/* Input */}
        <input
          type="text"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          disabled={submitting}
          className="h-7 min-w-0 flex-1 bg-transparent px-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none border-none focus:ring-0 font-medium"
          placeholder={placeholder}
          maxLength={500}
        />

        {/* Dynamic Timestamp */}
        <span
          className="shrink-0 rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-400"
          title="Comment timestamp"
        >
          at {activeTimestampText}
        </span>

        {/* Send Button */}
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-black transition-all duration-150 hover:bg-orange-400 active:scale-90 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer shadow-sm"
          aria-label="Post comment"
        >
          {submitting ? (
            <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 transform rotate-45 -translate-x-0.5 translate-y-0.5"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-1 text-[11px] font-semibold text-red-400 pl-3">{error}</p>
      )}
    </form>
  );
}
