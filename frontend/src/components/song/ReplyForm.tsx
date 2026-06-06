import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSongCommentRequest, resolveApiAssetUrl } from "@/lib/api";
import type { SongComment } from "@/types/music";

type ReplyFormProps = {
  songId: string;
  parentId: string;
  onReplyAdded: (reply: SongComment) => void;
  onCancel: () => void;
};

export function ReplyForm({ songId, parentId, onReplyAdded, onCancel }: ReplyFormProps) {
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
      setError("Reply cannot exceed 500 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newReply = await createSongCommentRequest(
        songId,
        { content: trimmed, parentId },
        accessToken
      );
      setContent("");
      onReplyAdded(newReply);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post reply.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const avatarUrl = resolveApiAssetUrl(user.avatarUrl);

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1.5 ml-10">
      <div className="flex items-center gap-3 bg-zinc-900/30 rounded-lg border border-zinc-800/80 p-2.5 transition-all duration-300 focus-within:border-[#ff5500] focus-within:ring-2 focus-within:ring-[#ff5500]/10">
        {/* Avatar */}
        {avatarUrl ? (
          <div
            className="h-8 w-8 shrink-0 rounded-full bg-cover bg-center border border-zinc-800"
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
          className="h-8 flex-1 bg-transparent px-1 text-xs text-zinc-100 placeholder:text-zinc-550 outline-none border-none focus:ring-0"
          placeholder="Write a reply..."
          maxLength={500}
          autoFocus
        />

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1 text-xs font-medium text-zinc-400 hover:text-white transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="inline-flex h-8 items-center justify-center rounded-md bg-[#ff5500] px-4 text-xs font-bold text-white transition-all duration-205 hover:bg-[#e04b00] active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer shadow-sm"
          >
            {submitting ? "Replying..." : "Reply"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-500 pl-3">{error}</p>
      )}
    </form>
  );
}
