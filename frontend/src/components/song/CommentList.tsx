import React from "react";
import { CommentItem } from "@/components/song/CommentItem";
import type { SongComment } from "@/types/music";

type CommentListProps = {
  comments: SongComment[];
  songId: string;
  songOwnerId?: string | null;
  onCommentDeleted: (commentId: string) => void;
  onReplyAdded: (parentId: string, reply: SongComment) => void;
};

export function CommentList({
  comments,
  songId,
  songOwnerId,
  onCommentDeleted,
  onReplyAdded,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center space-y-1.5">
        <svg className="h-9 w-9 text-zinc-700 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm font-bold text-zinc-300">No comments yet</p>
        <p className="text-xs text-zinc-500">Be the first to share your thoughts on this track.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          songId={songId}
          songOwnerId={songOwnerId}
          onCommentDeleted={onCommentDeleted}
          onReplyAdded={onReplyAdded}
        />
      ))}
    </div>
  );
}
