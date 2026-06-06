import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CommentComposer } from "@/components/song/CommentComposer";
import { CommentList } from "@/components/song/CommentList";
import { CommentSkeleton } from "@/components/song/CommentSkeleton";
import { getSongCommentsRequest, getArtistRequest } from "@/lib/api";
import { getArtistAvatarUrl, getArtistDisplayName, formatPlayCount } from "@/lib/song-format";
import { useFollow } from "@/components/follow/FollowProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { HeartIcon, PlaylistIcon } from "@/components/ui/Icons";
import type { SongComment, Song } from "@/types/music";
import { cn } from "@/lib/utils";

type SongCommentsProps = {
  songId: string;
  songOwnerId?: string | null;
  artist?: Song["artist"];
  song?: Song | null;
};

// Clean inline SVGs for professional SoundCloud style stats icons
const FollowersIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn("h-3.5 w-3.5", className)}
  >
    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
  </svg>
);

const TrackIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={cn("h-3.5 w-3.5", className)}
  >
    <path
      fillRule="evenodd"
      d="M17.721 1.599a.75.75 0 0 1 .49.71v13.567a4.125 4.125 0 1 1-2.25-3.69V6.012l-7.5 1.5v6.363a4.125 4.125 0 1 1-2.25-3.69V3.882a.75.75 0 0 1 .6-.736l9-1.8.01.003ZM4.5 15.75a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25Zm10.5-1.5a2.625 2.625 0 1 0 0-5.25 2.625 2.625 0 0 0 0 5.25Z"
      clipRule="evenodd"
    />
  </svg>
);

type ArtistDetail = {
  id: string;
  name: string;
  display_name?: string | null;
  displayName?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  user_id?: string | null;
  followers_count?: number | string | null;
  follower_count?: number | string | null;
  followers?: number | string | null;
  tracks_count?: number | string | null;
  track_count?: number | string | null;
  song_count?: number | string | null;
  tracks?: number | string | null;
};

export function SongComments({ songId, songOwnerId, artist, song }: SongCommentsProps) {
  const { user } = useAuth();
  const { isFollowing, toggleFollow, actionId } = useFollow();
  const { isSongLiked, toggleLike, actionSongId } = useLikes();
  const { openAddSongModal } = usePlaylists();

  const [comments, setComments] = useState<SongComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [error, setError] = useState<string | null>(null);

  // Full artist details for stats
  const [fullArtist, setFullArtist] = useState<ArtistDetail | null>(null);
  const [initialIsFollowing, setInitialIsFollowing] = useState<boolean | null>(null);

  // Local likes count to reflect like status instantly
  const [localLikesCount, setLocalLikesCount] = useState<number>(() => song?.likes_count ?? 0);

  const artistName = artist ? getArtistDisplayName(artist) : "Artist";
  const artistAvatar = artist ? getArtistAvatarUrl(artist) : null;

  const isArtistFollowed =
    Boolean(artist?.id && isFollowing(artist.id)) ||
    Boolean(artist?.user_id && isFollowing(artist.user_id));

  const followLoading =
    Boolean(artist?.id && actionId === artist.id) ||
    Boolean(artist?.user_id && actionId === artist.user_id);

  const isSelf =
    Boolean(user?.id && artist?.user_id && user.id === artist.user_id) ||
    user?.username?.toLowerCase() === artistName.toLowerCase();

  const liked = song ? isSongLiked(song.id) : false;
  const togglingLike = song ? actionSongId === song.id : false;

  // Load comments
  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getSongCommentsRequest(songId, sort);
        if (isMounted) {
          setComments(data);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load comments.";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [songId, sort]);

  // Load artist details
  useEffect(() => {
    if (artist?.id) {
      getArtistRequest(artist.id)
        .then((data) => {
          setFullArtist(data);
        })
        .catch((err) => {
          console.error("Error loading artist details in comments section:", err);
        });
    }
  }, [artist?.id]);

  useEffect(() => {
    if (artist && initialIsFollowing === null) {
      const isFollowed = isArtistFollowed;
      queueMicrotask(() => {
        setInitialIsFollowing(isFollowed);
      });
    }
  }, [artist, isArtistFollowed, initialIsFollowing]);

  // Sync initial likes count from song prop
  useEffect(() => {
    if (song?.likes_count !== undefined) {
      const likesCount = song.likes_count;
      queueMicrotask(() => {
        setLocalLikesCount(likesCount);
      });
    }
  }, [song?.likes_count]);

  const handleToggleLike = async () => {
    if (!song || togglingLike) return;
    const isCurrentlyLiked = isSongLiked(song.id);
    // Optimistic UI update
    setLocalLikesCount((prev) => (isCurrentlyLiked ? Math.max(0, prev - 1) : prev + 1));
    try {
      await toggleLike(song);
    } catch (err) {
      // Revert if API fails
      setLocalLikesCount((prev) => (isCurrentlyLiked ? prev + 1 : Math.max(0, prev - 1)));
      console.error("Error toggling like:", err);
    }
  };

  const handleCommentAdded = (newComment: SongComment) => {
    setComments((prev) => {
      if (sort === "newest") {
        return [newComment, ...prev];
      } else {
        return [...prev, newComment];
      }
    });
  };

  const handleCommentDeleted = (commentId: string) => {
    setComments((prev) => {
      const filteredParents = prev.filter((c) => c.id !== commentId);
      return filteredParents.map((parent) => ({
        ...parent,
        replies: parent.replies.filter((r) => r.id !== commentId),
      }));
    });
  };

  const handleReplyAdded = (parentId: string, newReply: SongComment) => {
    setComments((prev) =>
      prev.map((parent) => {
        if (parent.id === parentId) {
          return {
            ...parent,
            replies: [...parent.replies, newReply],
          };
        }
        return parent;
      })
    );
  };

  const totalComments = comments.reduce(
    (acc, curr) => acc + 1 + (curr.replies?.length || 0),
    0
  );

  const getFollowersCount = () => {
    if (!fullArtist) return 0;
    const rawVal = fullArtist.followers_count ?? fullArtist.follower_count ?? fullArtist.followers;
    let baseCount = rawVal ? parseInt(rawVal.toString()) : 0;

    if (initialIsFollowing !== null) {
      if (isArtistFollowed && !initialIsFollowing) {
        baseCount += 1;
      } else if (!isArtistFollowed && initialIsFollowing) {
        baseCount = Math.max(0, baseCount - 1);
      }
    }
    return baseCount;
  };

  const getTracksCount = () => {
    if (!fullArtist) return 0;
    const rawVal = fullArtist.tracks_count ?? fullArtist.track_count ?? fullArtist.song_count ?? fullArtist.tracks;
    return rawVal ? parseInt(rawVal.toString()) : 0;
  };

  return (
    <div id="comments" className="space-y-6 pt-2">
      {/* Composer Input Area */}
      <div className="py-2">
        <CommentComposer songId={songId} onCommentAdded={handleCommentAdded} />
      </div>

      {/* Action Bar & Stats (SoundCloud Style) */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-sm">
        <div className="flex items-center gap-3">
          {/* Like button */}
          {song && (
            <button
              type="button"
              disabled={togglingLike}
              onClick={handleToggleLike}
              className={cn(
                "flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-semibold transition cursor-pointer select-none active:scale-95",
                liked
                  ? "border-[#ff5500] bg-[#ff5500]/10 text-[#ff5500]"
                  : "border-zinc-800 bg-transparent text-zinc-300 hover:border-zinc-700 hover:text-white"
              )}
            >
              <HeartIcon size={14} className={liked ? "fill-current" : ""} />
              <span>{liked ? "Liked" : "Like"}</span>
            </button>
          )}

          {/* Add to Playlist button */}
          {song && (
            <button
              type="button"
              onClick={() => openAddSongModal(song)}
              className="flex items-center gap-1.5 rounded border border-zinc-800 bg-transparent px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white cursor-pointer select-none active:scale-95"
            >
              <PlaylistIcon size={14} />
              <span>Add to playlist</span>
            </button>
          )}
        </div>

        {/* Play & Like stats counts */}
        <div className="flex items-center gap-4 text-xs font-semibold text-zinc-500 select-none">
          <span className="flex items-center gap-1.5" title="Plays">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 text-zinc-600"
            >
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.324-5.89a1.5 1.5 0 000-2.538L6.3 2.84Z" />
            </svg>
            <span>{song ? formatPlayCount(song.play_count) : 0}</span>
          </span>

          <span className="flex items-center gap-1.5" title="Likes">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5 text-zinc-600"
            >
              <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001z" />
            </svg>
            <span>{formatPlayCount(localLikesCount)}</span>
          </span>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Left Column: Artist Profile info (SoundCloud style) */}
        {artist && (
          <div className="col-span-12 md:col-span-4 lg:col-span-3 flex flex-col items-center md:items-stretch text-center md:text-left border-r border-zinc-900/60 pr-0 md:pr-8 space-y-4">
            <div className="flex flex-col items-center">
              {/* Big Avatar */}
              <Link href={`/artists/${artist.id}`}>
                {artistAvatar ? (
                  <div
                    className="h-28 w-28 rounded-full bg-cover bg-center border-2 border-zinc-800 transition duration-300 hover:scale-105 shadow-lg shadow-black/40 cursor-pointer"
                    style={{ backgroundImage: `url(${artistAvatar})` }}
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-zinc-900 border-2 border-zinc-800 text-3xl font-black text-white transition duration-300 hover:scale-105 shadow-lg shadow-black/40 cursor-pointer uppercase">
                    {artistName.slice(0, 2)}
                  </div>
                )}
              </Link>

              {/* Artist Name */}
              <Link href={`/artists/${artist.id}`}>
                <h4 className="mt-3 text-base font-bold text-zinc-200 hover:text-white cursor-pointer transition">
                  {artistName}
                </h4>
              </Link>

              {/* Stats */}
              <div className="mt-2.5 flex items-center gap-4 text-xs font-semibold text-zinc-500 select-none">
                <span className="flex items-center gap-1.5" title="Followers">
                  <FollowersIcon className="text-zinc-600" />
                  <span>{getFollowersCount()}</span>
                </span>
                <span className="flex items-center gap-1.5" title="Tracks">
                  <TrackIcon className="text-zinc-600" />
                  <span>{getTracksCount()}</span>
                </span>
              </div>

              {/* Follow Button */}
              {user && !isSelf && (
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={() => void toggleFollow(artist.id, artistName)}
                  className={cn(
                    "mt-4 w-28 rounded px-4 py-1.5 text-xs font-bold transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer border shadow-sm",
                    isArtistFollowed
                      ? "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500 hover:text-white"
                      : "bg-white text-zinc-950 border-white hover:bg-zinc-200"
                  )}
                >
                  {followLoading
                    ? "Loading..."
                    : isArtistFollowed
                      ? "Following"
                      : "Follow"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right Column: Header bar & Comment List */}
        <div className={cn("col-span-12 space-y-4", artist ? "md:col-span-8 lg:col-span-9" : "")}>
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h3 className="text-sm font-bold text-zinc-400 tracking-wide">
              {totalComments} {totalComments === 1 ? "comment" : "comments"}
            </h3>

            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
              <span>Sort by:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
                className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-400 outline-none transition focus:border-[#ff5500] cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Comment List */}
          {loading ? (
            <CommentSkeleton />
          ) : (
            <CommentList
              comments={comments}
              songId={songId}
              songOwnerId={songOwnerId}
              onCommentDeleted={handleCommentDeleted}
              onReplyAdded={handleReplyAdded}
            />
          )}
        </div>
      </div>
    </div>
  );
}
