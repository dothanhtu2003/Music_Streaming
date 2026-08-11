import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSongCommentRequest, resolveApiAssetUrl } from "@/lib/api";
import type { SongComment } from "@/types/music";

type CommentComposerProps = {
  songId: string;
  onCommentAdded: (comment: SongComment) => void;
  value?: string;
  onChange?: (val: string) => void;
  timestampText?: string;
  placeholder?: string;
};

export function CommentComposer({
  songId,
  onCommentAdded,
  value,
  onChange,
  timestampText,
  placeholder = "Add a comment at...",
}: CommentComposerProps) {
  const { user, accessToken } = useAuth();
  const [internalContent, setInternalContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = value !== undefined ? value : internalContent;
  const setContent = (val: string) => {
    if (onChange) onChange(val);
    else setInternalContent(val);
  };

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
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center text-xs text-zinc-400">
        Please <a href="/login" className="text-orange-500 hover:underline font-bold">login</a> to comment.
      </div>
    );
  }

  const avatarUrl = resolveApiAssetUrl(user.avatarUrl);

  return (
    <form onSubmit={handleSubmit} className="group relative">
      <div className="flex items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-900/90 p-1.5 pl-2 transition-all duration-300 focus-within:border-orange-500/80 focus-within:ring-1 focus-within:ring-orange-500/20">
        {/* Avatar */}
        {avatarUrl ? (
          <div
            className="h-8 w-8 shrink-0 rounded-full bg-cover bg-center border border-zinc-700 shadow-inner"
            style={{ backgroundImage: `url(${avatarUrl})` }}
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            {user.username.slice(0, 2)}
          </div>
        )}

        {/* Input & Timestamp */}
        <div className="flex flex-1 items-center gap-2 min-w-0 pr-1">
          <input
            type="text"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError(null);
            }}
            disabled={submitting}
            className="h-8 flex-1 bg-transparent px-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none border-none focus:ring-0"
            placeholder={placeholder}
            maxLength={500}
          />

          {timestampText && (
            <span className="shrink-0 rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-400">
              {timestampText}
            </span>
          )}
        </div>

        {/* Send button (Paper plane icon) */}
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-orange-950 transition-all duration-200 hover:bg-orange-400 active:scale-90 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer shadow-md"
          aria-label="Post comment"
        >
          {submitting ? (
            <svg className="animate-spin h-3.5 w-3.5 text-orange-950" fill="none" viewBox="0 0 24 24">
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
        <p className="mt-1 text-[11px] text-red-400 pl-3">{error}</p>
      )}
    </form>
  );
}
