import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSongCommentRequest, resolveApiAssetUrl } from "@/lib/api";
import type { SongComment } from "@/types/music";

type CommentComposerProps = {
  songId: string;
  onCommentAdded: (comment: SongComment) => void;
};

export function CommentComposer({ songId, onCommentAdded }: CommentComposerProps) {
  const { user, accessToken } = useAuth();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    const trimmed = content.trim();
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

  if (!user) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center text-sm text-zinc-500">
        Please <a href="/login" className="text-[#ff5500] hover:underline font-semibold">login</a> to write a comment.
      </div>
    );
  }

  const avatarUrl = resolveApiAssetUrl(user.avatarUrl);

  return (
    <form onSubmit={handleSubmit} className="group relative">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/30 p-2 transition-all duration-300 hover:border-zinc-700/80 focus-within:border-[#ff5500] focus-within:ring-2 focus-within:ring-[#ff5500]/10">
        {/* Avatar */}
        {avatarUrl ? (
          <div
            className="h-8 w-8 shrink-0 rounded-full bg-cover bg-center border border-zinc-800 shadow-inner"
            style={{ backgroundImage: `url(${avatarUrl})` }}
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-400 uppercase tracking-wider">
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
          className="h-8 flex-1 bg-transparent px-1 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none border-none focus:ring-0"
          placeholder="Write a comment..."
          maxLength={500}
        />

        {/* Send button (Paper plane icon) */}
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff5500] text-white transition-all duration-200 hover:bg-[#e04b00] active:scale-90 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer shadow-md"
          aria-label="Post comment"
        >
          {submitting ? (
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 transform rotate-45 -translate-x-0.5 translate-y-0.5"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500 pl-2">{error}</p>
      )}
    </form>
  );
}
