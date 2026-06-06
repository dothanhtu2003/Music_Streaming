"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { getFollowersRequest, getFollowingForUserRequest, resolveApiAssetUrl } from "@/lib/api";
import { getUserProfilePath } from "@/lib/paths";
import { getArtistAvatarUrl, getArtistDisplayName } from "@/lib/song-format";
import { UserIcon } from "@/components/ui/Icons";
import type { FollowedArtist } from "@/types/music";
import { cn } from "@/lib/utils";

type FollowListModalProps = {
  userId: string;
  type: "followers" | "following";
  title: string;
  onClose: () => void;
};

export function FollowListModal({
  userId,
  type,
  title,
  onClose,
}: FollowListModalProps) {
  const { user: currentUser } = useAuth();
  const { isFollowing, toggleFollow, actionId } = useFollow();
  const [items, setItems] = useState<FollowedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data =
        type === "followers"
          ? await getFollowersRequest(userId)
          : await getFollowingForUserRequest(userId);

      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list.");
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
    });
  }, [fetchData]);

  // Close modal on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const getFallbackLetter = (name: string) => {
    return name.trim().slice(0, 1).toUpperCase() || "U";
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl animate-scale-up flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-900">
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-orange-500 hover:text-white"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-900/60 p-2 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-zinc-800 shimmer" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-24 rounded bg-zinc-800 shimmer" />
                      <div className="h-2.5 w-16 rounded bg-zinc-800 shimmer" />
                    </div>
                  </div>
                  <div className="h-8 w-20 rounded-full bg-zinc-800 shimmer" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300 text-center">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-zinc-900 text-zinc-600 mb-3">
                <UserIcon size={20} />
              </div>
              <p className="text-sm font-medium">No accounts found.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="divide-y divide-zinc-900/40 space-y-3">
              {items.map((item) => {
                const targetId = item.artist_id || item.user_id;
                const displayName = getArtistDisplayName(item);
                const avatarUrl = getArtistAvatarUrl(item);
                const resolvedAvatar = resolveApiAssetUrl(avatarUrl);
                const isItemSelf = currentUser?.id === item.user_id;
                const isItemFollowed =
                  isFollowing(item.user_id) ||
                  Boolean(item.artist_id && isFollowing(item.artist_id));
                const isActionLoading =
                  actionId === item.user_id ||
                  Boolean(item.artist_id && actionId === item.artist_id);

                const profilePath = getUserProfilePath(item.user_id);

                return (
                  <div
                    key={`${item.user_id}-${targetId}`}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={profilePath}
                      onClick={onClose}
                      className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-80"
                    >
                      <div className="shrink-0">
                        {resolvedAvatar ? (
                          <div
                            className="h-10 w-10 rounded-full bg-zinc-900 bg-cover bg-center border border-zinc-800/80"
                            style={{ backgroundImage: `url(${resolvedAvatar})` }}
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-zinc-950 text-sm font-black text-white">
                            {getFallbackLetter(displayName)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-white transition hover:text-orange-400">
                          {displayName}
                        </h3>
                        <p className="truncate text-xs text-zinc-500">
                          @{item.username} • {item.artist_id ? "Artist" : "User"}
                        </p>
                      </div>
                    </Link>

                    {!isItemSelf && (
                      <button
                        type="button"
                        disabled={isActionLoading}
                        onClick={() => {
                          void toggleFollow(targetId, displayName).then(() =>
                            fetchData()
                          );
                        }}
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
                          isItemFollowed
                            ? "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
                            : "bg-orange-500 text-orange-950 hover:bg-orange-400"
                        )}
                      >
                        {isActionLoading
                          ? "..."
                          : isItemFollowed
                          ? "Following"
                          : "Follow"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
