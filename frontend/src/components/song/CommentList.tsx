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
      <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-8 text-center space-y-1">
        <p className="text-sm font-semibold text-white">No comments yet.</p>
        <p className="text-xs text-zinc-500">Be the first to comment.</p>
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
