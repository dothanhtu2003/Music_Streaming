"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  BellIcon,
  CommentIcon,
  HeartIcon,
  MusicIcon,
  PlayIcon,
  SearchIcon,
  UploadIcon,
  UserIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import {
  getStudioOverviewRequest,
  getStudioRecentActivityRequest,
  getStudioTopTracksRequest,
  getStudioTracksRequest,
  resolveApiAssetUrl,
} from "@/lib/api";
import { formatDuration, formatPlayCount } from "@/lib/song-format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePlayerStore } from "@/stores/player-store";
import type {
  Song,
  StudioActivity,
  StudioOverview,
  StudioTrack,
  StudioTrackSort,
  SongPagination,
} from "@/types/music";

const emptyOverview: StudioOverview = {
  totalTracks: 0,
  totalPlays: 0,
  totalLikes: 0,
  totalComments: 0,
  followers: 0,
  following: 0,
};

const sortOptions: Array<{ value: StudioTrackSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "plays", label: "Most played" },
  { value: "likes", label: "Most liked" },
  { value: "comments", label: "Most commented" },
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(value);
}

function trackToSong(track: StudioTrack): Song {
  return {
    id: track.id,
    title: track.title,
    description: null,
    file_url: track.fileUrl ?? "",
    cover_url: track.coverUrl ?? null,
    duration_sec: track.duration ?? 0,
    play_count: track.playCount,
    likes_count: track.likeCount,
    is_active: track.isActive ?? true,
    created_at: track.createdAt,
    updated_at: track.createdAt,
    artist: {
      id: "",
      name: track.artistName ?? "Unknown artist",
      display_name: track.artistName ?? "Unknown artist",
      avatar_url: null,
    },
    album: null,
    genre: null,
  };
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: typeof MusicIcon;
}) {
  return (
    <div className="group rounded-2xl border border-zinc-900 bg-zinc-950/80 p-3.5 sm:p-5 shadow-sm transition-all duration-300 hover:border-zinc-800 hover:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 truncate">
            {label}
          </p>
          <p className="mt-1 text-xl sm:text-3xl font-black tracking-tight text-white transition-all group-hover:text-orange-400">
            {formatPlayCount(value)}
          </p>
        </div>
        <span className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-400 transition-all group-hover:scale-105 group-hover:bg-orange-500 group-hover:text-orange-950">
          <Icon size={18} className="sm:hidden" />
          <Icon size={22} className="hidden sm:block" />
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500 hidden sm:block">{description}</p>
    </div>
  );
}

function StudioSkeleton() {
  return (
    <div className="space-y-6 pb-28">
      <div className="h-24 animate-pulse rounded-2xl bg-zinc-950" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-zinc-950" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-950" />
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-950" />
      </div>
    </div>
  );
}

function TrackArtwork({ track }: { track: StudioTrack }) {
  const coverUrl = resolveApiAssetUrl(track.coverUrl);

  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={`${track.title} cover`}
        className="h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg border border-zinc-800 object-cover"
      />
    );
  }

  return (
    <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-600">
      <MusicIcon size={16} />
    </div>
  );
}

function PlayButton({
  track,
  queue,
}: {
  track: StudioTrack;
  queue: StudioTrack[];
}) {
  const playSong = usePlayerStore((state) => state.playSong);
  const canPlay = Boolean(track.fileUrl);

  return (
    <button
      type="button"
      disabled={!canPlay}
      onClick={() => playSong(trackToSong(track), queue.map(trackToSong))}
      title={canPlay ? "Play track" : "Track has no playable file"}
      className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-orange-500/60 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PlayIcon size={14} />
    </button>
  );
}

function TopTracksSection({
  tracks,
}: {
  tracks: StudioTrack[];
}) {
  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950 overflow-hidden shadow-sm">
      <div className="border-b border-zinc-900 px-4 py-3.5">
        <h2 className="text-sm font-bold text-white">Top Tracks</h2>
      </div>
      <div className="divide-y divide-zinc-900/60">
        {tracks.length === 0 ? (
          <p className="px-4 py-8 text-xs text-zinc-500">No top tracks yet.</p>
        ) : (
          tracks.map((track, index) => (
            <div key={track.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/40">
              <span className="w-4 text-xs font-bold text-zinc-600">{index + 1}</span>
              <TrackArtwork track={track} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white transition-colors hover:text-orange-400 cursor-default">{track.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {track.artistName ?? "Unknown artist"} • {formatPlayCount(track.playCount)} plays
                </p>
              </div>
              <span className="hidden w-12 text-right text-xs font-mono text-zinc-500 md:block">
                {formatDuration(track.duration ?? 0)}
              </span>
              <PlayButton track={track} queue={tracks} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const iconClass = "text-orange-400";

  if (type === "LIKE_SONG") return <HeartIcon size={14} className={iconClass} />;
  if (type === "COMMENT_SONG" || type === "REPLY_COMMENT") {
    return <CommentIcon size={14} className={iconClass} />;
  }
  if (type === "FOLLOW_USER") return <UsersIcon size={14} className={iconClass} />;

  return <BellIcon size={14} className={iconClass} />;
}

function RecentActivitySection({ items }: { items: StudioActivity[] }) {
  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950 overflow-hidden shadow-sm">
      <div className="border-b border-zinc-900 px-4 py-3.5">
        <h2 className="text-sm font-bold text-white">Recent Activity</h2>
      </div>
      <div className="divide-y divide-zinc-900/60">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-xs text-zinc-500">No recent activity yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/40">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500/10">
                <ActivityIcon type={item.type} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white">{item.title}</p>
                  {!item.isRead && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                  )}
                </div>
                {item.message && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                    {item.message}
                  </p>
                )}
                <p className="mt-1 text-[10px] font-medium text-zinc-500">
                  {formatRelativeDate(item.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function MyTracksSection({
  tracks,
  pagination,
  loading,
  query,
  sort,
  copiedTrackId,
  onQueryChange,
  onSortChange,
  onPageChange,
  onCopy,
}: {
  tracks: StudioTrack[];
  pagination: SongPagination | null;
  loading: boolean;
  query: string;
  sort: StudioTrackSort;
  copiedTrackId: string | null;
  onQueryChange: (value: string) => void;
  onSortChange: (value: StudioTrackSort) => void;
  onPageChange: (page: number) => void;
  onCopy: (track: StudioTrack) => void;
}) {
  const hasPrevious = Boolean(pagination && pagination.page > 1);
  const hasNext = Boolean(pagination && pagination.page < pagination.totalPages);

  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-zinc-900 px-4 py-4 sm:px-5 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-bold text-white">My Tracks</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Uploaded tracks in your studio catalog.</p>
        </div>
        <div className="flex flex-row items-center gap-2">
          <div className="relative flex-1 sm:w-60 items-center">
            <span className="absolute left-3 text-zinc-500">
              <SearchIcon size={14} />
            </span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search tracks..."
              className="h-9 w-full rounded-xl border border-zinc-800 bg-zinc-900/80 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-zinc-500 focus:border-orange-500/70"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as StudioTrackSort)}
            className="h-9 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 text-xs font-semibold text-zinc-300 outline-none transition focus:border-orange-500/70 cursor-pointer"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MOBILE COMPACT LIST VIEW */}
      <div className="p-2 sm:p-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-xl border border-zinc-900 bg-zinc-950 p-3 space-y-2 mb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-zinc-900" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-zinc-900" />
                  <div className="h-2.5 w-20 rounded bg-zinc-900" />
                </div>
              </div>
            </div>
          ))
        ) : tracks.length === 0 ? (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-6 text-center">
            <p className="text-sm font-bold text-white">No tracks found</p>
            <p className="mt-1 text-xs text-zinc-500">
              {query ? "Try adjusting your search query." : "Upload your first track to start building your audience."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80 divide-y divide-zinc-900/80">
            {tracks.map((track) => (
              <div key={track.id} className="flex items-center gap-3 p-3 transition hover:bg-zinc-900/50">
                <TrackArtwork track={track} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-bold text-xs text-white">{track.title}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.2 text-[8px] font-bold border",
                        track.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-800/50 text-zinc-400 border-zinc-800",
                      )}
                    >
                      {track.isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5">
                    <span>{formatPlayCount(track.playCount)} plays</span>
                    <span>•</span>
                    <span>{formatPlayCount(track.likeCount)} likes</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <PlayButton track={track} queue={tracks} />
                  <button
                    type="button"
                    onClick={() => onCopy(track)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-white"
                    title="Share / Copy Link"
                  >
                    {copiedTrackId === track.id ? "✓" : "🔗"}
                  </button>
                  <Link
                    href={`/songs/${track.id}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-white"
                    title="View Detail"
                  >
                    ➔
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-900/60 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-bold">Track</th>
              <th className="px-5 py-4 font-bold">Plays</th>
              <th className="px-5 py-4 font-bold">Likes</th>
              <th className="px-5 py-4 font-bold">Comments</th>
              <th className="px-5 py-4 font-bold">Uploaded</th>
              <th className="px-5 py-4 font-bold">Status</th>
              <th className="px-5 py-4 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900/40">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  <td className="px-5 py-4"><div className="h-10 w-56 rounded bg-zinc-900" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-12 rounded bg-zinc-900" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-12 rounded bg-zinc-900" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-12 rounded bg-zinc-900" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-20 rounded bg-zinc-900" /></td>
                  <td className="px-5 py-4"><div className="h-5 w-16 rounded bg-zinc-900" /></td>
                  <td className="px-5 py-4"><div className="ml-auto h-8 w-28 rounded bg-zinc-900" /></td>
                </tr>
              ))
            ) : tracks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <p className="text-base font-bold text-white">No tracks found</p>
                  <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                    {query ? "Try adjusting your search query or sorting options." : "Upload your first track to start building your audience."}
                  </p>
                  {!query && (
                    <Link
                      href="/upload"
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-orange-950 transition hover:bg-orange-400 shadow-md shadow-orange-500/10"
                    >
                      <UploadIcon size={16} />
                      Upload Track
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              tracks.map((track) => (
                <tr key={track.id} className="text-zinc-300 transition-colors hover:bg-zinc-900/10">
                  <td className="min-w-64 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <TrackArtwork track={track} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white transition-colors hover:text-orange-400 cursor-default">{track.title}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {track.artistName ?? "Unknown artist"} - {formatDuration(track.duration ?? 0)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 font-medium">{formatPlayCount(track.playCount)}</td>
                  <td className="px-5 py-3.5 text-zinc-400 font-medium">{formatPlayCount(track.likeCount)}</td>
                  <td className="px-5 py-3.5 text-zinc-400 font-medium">{formatPlayCount(track.commentCount)}</td>
                  <td className="px-5 py-3.5 text-zinc-500 font-medium">{formatDate(track.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border",
                        track.isActive
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-800/50 text-zinc-400 border-zinc-800",
                      )}
                    >
                      {track.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end items-center gap-2">
                      <PlayButton track={track} queue={tracks} />
                      <Link
                        href={`/songs/${track.id}`}
                        className="h-9 inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800 hover:text-white hover:border-zinc-700"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => onCopy(track)}
                        className="h-9 inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-800 hover:text-white hover:border-zinc-700 min-w-20"
                      >
                        {copiedTrackId === track.id ? "Copied" : "Copy Link"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-zinc-900/60 px-4 py-3.5 text-xs text-zinc-500">
          <span className="font-medium">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!hasPrevious}
              onClick={() => onPageChange((pagination.page ?? 1) - 1)}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={() => onPageChange((pagination.page ?? 1) + 1)}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function StudioContent() {
  const { accessToken } = useAuth();
  const [overview, setOverview] = useState<StudioOverview>(emptyOverview);
  const [topTracks, setTopTracks] = useState<StudioTrack[]>([]);
  const [tracks, setTracks] = useState<StudioTrack[]>([]);
  const [activity, setActivity] = useState<StudioActivity[]>([]);
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<StudioTrackSort>("newest");
  const [page, setPage] = useState(1);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "tracks">("overview");

  const statCards = useMemo(
    () => [
      {
        label: "Total Tracks",
        value: overview.totalTracks,
        description: "Active uploads in your studio.",
        icon: MusicIcon,
      },
      {
        label: "Total Plays",
        value: overview.totalPlays,
        description: "All plays across your tracks.",
        icon: PlayIcon,
      },
      {
        label: "Total Likes",
        value: overview.totalLikes,
        description: "Likes received on your uploads.",
        icon: HeartIcon,
      },
      {
        label: "Comments",
        value: overview.totalComments,
        description: "Audience comments on your tracks.",
        icon: CommentIcon,
      },
      {
        label: "Followers",
        value: overview.followers,
        description: "Users following your profile.",
        icon: UsersIcon,
      },
      {
        label: "Following",
        value: overview.following,
        description: "Profiles you currently follow.",
        icon: UserIcon,
      },
    ],
    [overview],
  );

  const loadSummary = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [overviewResult, topTrackResult, activityResult] = await Promise.all([
        getStudioOverviewRequest(accessToken),
        getStudioTopTracksRequest(accessToken, 5),
        getStudioRecentActivityRequest(accessToken, 10),
      ]);

      setOverview(overviewResult);
      setTopTracks(topTrackResult);
      setActivity(activityResult);
    } catch (studioError) {
      setError(getErrorMessage(studioError, "Could not load Artist Studio."));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadTracks = useCallback(async () => {
    if (!accessToken) return;

    setTracksLoading(true);

    try {
      const result = await getStudioTracksRequest(accessToken, {
        page,
        limit: 10,
        sort,
        q: query,
      });

      setTracks(result.items);
      setPagination(result.pagination);
    } catch (trackError) {
      setError(getErrorMessage(trackError, "Could not load your tracks."));
    } finally {
      setTracksLoading(false);
    }
  }, [accessToken, page, query, sort]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSummary();
    });
  }, [loadSummary]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadTracks();
    });
  }, [loadTracks]);

  const handleCopy = async (track: StudioTrack) => {
    const url = `${window.location.origin}/songs/${track.id}`;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopiedTrackId(track.id);
      window.setTimeout(() => setCopiedTrackId(null), 1400);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  const handleSortChange = (value: StudioTrackSort) => {
    setSort(value);
    setPage(1);
  };

  if (loading) {
    return <StudioSkeleton />;
  }

  if (error) {
    return (
      <div className="grid min-h-[55vh] place-items-center pb-28">
        <div className="max-w-md rounded-xl border border-rose-500/20 bg-rose-500/5 px-6 py-5 text-center">
          <p className="text-sm font-bold text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => {
              void loadSummary();
              void loadTracks();
            }}
            className="mt-4 rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28 page-fade-in">
      <header className="rounded-2xl border border-zinc-900 bg-zinc-950 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-orange-500">
              Studio
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white">
              Artist Studio
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400 hidden sm:block">
              Track your music performance, audience activity, and latest engagement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-orange-950 transition hover:bg-orange-400 shadow-md shadow-orange-500/10"
            >
              <UploadIcon size={16} />
              Upload Track
            </Link>
            <Link
              href="/profile"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-zinc-200 transition hover:border-zinc-700 hover:text-white"
            >
              <UserIcon size={16} />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Modern Tab Selector */}
      <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
        <div className="flex gap-1.5 rounded-xl bg-zinc-950 p-1 border border-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300",
              activeTab === "overview"
                ? "bg-orange-500 text-orange-950 font-bold shadow-md shadow-orange-500/15"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tracks")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300",
              activeTab === "tracks"
                ? "bg-orange-500 text-orange-950 font-bold shadow-md shadow-orange-500/15"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            )}
          >
            My Tracks
            <span className={cn(
              "inline-flex items-center justify-center px-1.5 py-0.2 text-[9px] font-bold rounded",
              activeTab === "tracks" ? "bg-orange-950/20 text-orange-950" : "bg-zinc-900 text-zinc-400"
            )}>
              {overview.totalTracks}
            </span>
          </button>
        </div>
      </div>

      {activeTab === "overview" ? (
        <>
          <section className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {statCards.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
            <TopTracksSection tracks={topTracks} />
            <RecentActivitySection items={activity} />
          </div>
        </>
      ) : (
        <MyTracksSection
          tracks={tracks}
          pagination={pagination}
          loading={tracksLoading}
          query={query}
          sort={sort}
          copiedTrackId={copiedTrackId}
          onQueryChange={handleQueryChange}
          onSortChange={handleSortChange}
          onPageChange={setPage}
          onCopy={(track) => void handleCopy(track)}
        />
      )}
    </div>
  );
}

export default function StudioPage() {
  return (
    <ProtectedRoute>
      <StudioContent />
    </ProtectedRoute>
  );
}
