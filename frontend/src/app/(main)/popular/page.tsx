"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getSongsRequest } from "@/lib/api";
import { SongListItem } from "@/components/song/SongListItem";
import { ListItemSkeleton } from "@/components/ui/Skeletons";
import { HeartIcon, MoreIcon, PauseIcon, PlayIcon, PlusIcon, UserIcon, MusicIcon } from "@/components/ui/Icons";
import { usePlayerStore } from "@/stores/player-store";
import type { Song } from "@/types/music";
import { EmptyState } from "@/components/ui/EmptyState";
import { getArtistDisplayName, getGenreName, getSongCoverUrl, formatPlayCount, formatDuration } from "@/lib/song-format";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 20;

type BrutalistTrackRowProps = {
  song: Song;
  index: number;
  queue: Song[];
  isSongLiked: (id: string) => boolean;
  toggleLike: (song: Song) => Promise<unknown>;
  actionSongId: string | null;
  openAddSongModal: (song: Song) => void;
};

function BrutalistTrackRow({
  song,
  index,
  queue,
  isSongLiked,
  toggleLike,
  actionSongId,
  openAddSongModal,
}: BrutalistTrackRowProps) {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentSong = currentSong?.id === song.id;
  const isCurrentPlaying = isCurrentSong && isPlaying;
  const isLiked = isSongLiked(song.id);
  const likeLoading = actionSongId === song.id;
  const coverUrl = getSongCoverUrl(song);
  const artistName = getArtistDisplayName(song.artist);
  const genreName = getGenreName(song);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handlePlayClick = () => {
    if (isCurrentSong) {
      togglePlay();
    } else {
      playSong(song, queue);
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    void toggleLike(song);
  };

  return (
    <div
      className={cn(
        "relative group flex items-center justify-between gap-4 border-t border-zinc-900 p-4 transition-all duration-150 hover:bg-zinc-900/30 bg-black rounded-none",
        isCurrentSong && "bg-zinc-950 border-orange-500/20"
      )}
    >
      {/* Giant Background Number (Subtle outline watermark behind content) */}
      <div
        className="absolute left-16 top-1/2 -translate-y-1/2 select-none pointer-events-none font-mono font-black opacity-[0.02] text-7xl md:text-8xl transition-all duration-150 group-hover:opacity-[0.04]"
        style={{ WebkitTextStroke: "1px #ffffff", color: "transparent" }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Left items: Play button, Cover, Title, Artist */}
      <div className="flex min-w-0 flex-1 items-center gap-4 relative z-10">
        {/* Premium Rounded Play Button */}
        <button
          type="button"
          onClick={handlePlayClick}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-all duration-150 bg-zinc-950",
            isCurrentSong
              ? "bg-orange-500 border-orange-500 text-black hover:bg-orange-400 hover:border-orange-400"
              : "hover:bg-white hover:border-white hover:text-black"
          )}
          aria-label={isCurrentPlaying ? "Pause" : "Play"}
        >
          {isCurrentPlaying ? (
            <PauseIcon size={12} className="fill-current" />
          ) : (
            <PlayIcon size={12} className="fill-current ml-0.5" />
          )}
        </button>

        {/* Square Cover (Subtly rounded corners for premium feel) */}
        <Link href={`/songs/${song.id}`} className="shrink-0">
          {coverUrl ? (
            <div
              className="h-10 w-10 rounded-lg bg-zinc-900 bg-cover bg-center border border-zinc-800/80"
              style={{ backgroundImage: `url(${coverUrl})` }}
              aria-label={`${song.title} cover`}
            />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-900 text-xs font-bold text-white border border-zinc-800/80">
              {song.title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Title & Artist */}
        <div className="min-w-0 flex-1">
          <Link href={`/songs/${song.id}`}>
            <h4
              className={cn(
                "truncate text-sm font-bold transition-colors duration-150 uppercase tracking-tight hover:text-orange-500",
                isCurrentSong ? "text-orange-500 font-extrabold" : "text-white group-hover:text-orange-500"
              )}
            >
              {song.title}
            </h4>
          </Link>
          <p className="truncate text-xs text-zinc-500 uppercase tracking-wide mt-0.5">
            {artistName}
          </p>
        </div>
      </div>

      {/* Middle items: Genre, Plays (desktop only) */}
      <div className="hidden w-[220px] shrink-0 items-center gap-6 md:flex relative z-10">
        {/* Genre Tag - Clean rounded pills */}
        <span className="w-24 truncate">
          <span className="inline-block bg-zinc-900 border border-zinc-800/80 text-zinc-400 px-2.5 py-0.5 rounded-full font-mono text-[9px] font-bold tracking-wider uppercase">
            {genreName}
          </span>
        </span>

        {/* Plays */}
        <span className="flex w-28 items-center gap-1.5 text-xs font-mono text-zinc-500" title={`${formatPlayCount(song.play_count)} plays`}>
          <MusicIcon size={12} className="text-zinc-500 shrink-0" />
          <span>{formatPlayCount(song.play_count)}</span>
        </span>
      </div>

      {/* Right items: Like, Duration, Dropdown Menu */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0 w-[115px] justify-end relative z-10">
        {/* Like Button */}
        <button
          type="button"
          disabled={likeLoading}
          onClick={handleLikeClick}
          className={cn(
            "p-1.5 transition duration-150 hover:scale-110 focus:outline-none",
            isLiked ? "text-orange-500" : "text-zinc-650 hover:text-white"
          )}
          title={isLiked ? "Unlike" : "Like"}
        >
          <HeartIcon size={14} filled={isLiked} />
        </button>

        {/* Duration */}
        <span className="hidden text-xs text-zinc-550 font-mono sm:inline w-10 text-right">
          {formatDuration(song.duration_sec)}
        </span>

        {/* 3-dots Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all duration-150"
          >
            <MoreIcon size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 z-50 w-52 origin-top-right rounded-xl border border-zinc-800 bg-[#0D0D0D] p-1 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openAddSongModal(song);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-orange-500 hover:text-black"
              >
                <PlusIcon size={14} />
                Add to Playlist
              </button>

              <Link
                href={`/songs/${song.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-orange-500 hover:text-black"
              >
                <UserIcon size={14} />
                View Details
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PopularTracksPage() {
  const playSong = usePlayerStore((state) => state.playSong);
  const { actionSongId, isSongLiked, toggleLike } = useLikes();
  const { openAddSongModal } = usePlaylists();

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Set document title
  useEffect(() => {
    document.title = "Popular Tracks | Music";
  }, []);

  const loadPopularSongs = useCallback(async (pageNum: number, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await getSongsRequest(pageNum, PAGE_LIMIT, { sort: "popular" });
      
      if (isLoadMore) {
        setSongs((prevSongs) => {
          // Prevent duplicates
          const existingIds = new Set(prevSongs.map((s) => s.id));
          const newSongs = result.items.filter((s) => !existingIds.has(s.id));
          return [...prevSongs, ...newSongs];
        });
      } else {
        setSongs(result.items);
      }
      
      setPage(result.pagination.page);
      setTotalPages(result.pagination.totalPages);
      setTotalItems(result.pagination.totalItems);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load popular tracks.",
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadPopularSongs(1, false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadPopularSongs]);

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playSong(songs[0], songs);
    }
  };

  const canLoadMore = page < totalPages;
  const topSong = songs[0] ?? null;
  const topArtistName = topSong ? getArtistDisplayName(topSong.artist) : "";
  const topSongTitle = topSong ? topSong.title : "";
  const topGenre = topSong ? getGenreName(topSong) : "";

  return (
    <div className="space-y-8 page-fade-in pb-16 bg-black min-h-screen text-white">
      {/* Refined Playlist Banner (Strictly premium, clean look, rounded-2xl corners, no raw styling) */}
      <section className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-[#0D0D0D] p-6 sm:p-8">
        <div className="relative">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            {/* Playlist-style Square Cover - Brutalist Chart Brand (Rounded-2xl) */}
            <div className="relative h-36 w-36 shrink-0 md:h-44 md:w-44 rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-orange-950 flex flex-col justify-between p-4 shadow-none border border-zinc-800">
              <div className="flex justify-between items-start">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                  OFFICIAL
                </span>
                <span className="text-[8px] font-mono text-zinc-600">LIVE</span>
              </div>
              
              <div className="my-2">
                <h2 className="text-4xl font-black tracking-tighter text-white leading-none uppercase italic">
                  HOT<br />
                  <span className="text-orange-500 font-extrabold">100</span>
                </h2>
              </div>
              
              <div className="text-[8px] font-black uppercase tracking-wider text-zinc-500">
                GLOBAL RANKINGS
              </div>
            </div>
            
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono tracking-widest text-orange-500 uppercase font-black">
                    Community Leaderboard
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                </div>
                {/* Premium white italic title (much cleaner than orange) */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white uppercase italic leading-none">
                  Popular Tracks
                </h1>
              </div>

              {/* Chart Stats Row - Clean text only, separated by dots, no boxes */}
              <div className="text-[10px] sm:text-xs font-mono text-[#888888] flex flex-wrap items-center gap-x-2 gap-y-1 uppercase tracking-wider">
                <span>CHART SIZE: {loading && songs.length === 0 ? "..." : `${totalItems} TRACKS`}</span>
                {topSong && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[280px]">
                      CURRENT #1: <span className="text-white font-bold">{topSongTitle}</span> BY <span className="text-white font-bold">{topArtistName}</span>
                    </span>
                    <span>•</span>
                    <span>TOP GENRE: <span className="text-white font-bold">{topGenre}</span></span>
                  </>
                )}
              </div>
              
              {/* Play Hot 100 Button - Rounded-full premium button */}
              <div className="pt-2">
                {!loading && songs.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePlayAll}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 hover:scale-105 text-orange-950 hover:bg-orange-400 font-extrabold uppercase tracking-widest text-xs px-6 py-3 transition-all duration-150"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="fill-current"><path d="M8 5v14l11-7z"/></svg>
                    Play Hot 100
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Track list section */}
      {!error && (
        <section className="bg-black border border-zinc-900 rounded-2xl p-0 space-y-0 shadow-none overflow-hidden">
          {loading && songs.length === 0 ? (
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="p-4 border-t border-zinc-900">
                  <ListItemSkeleton />
                </div>
              ))}
            </div>
          ) : songs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No popular tracks yet"
                description="Tracks will appear here as they gain plays."
              />
            </div>
          ) : (
            <div className="space-y-0">
              {/* Table Header */}
              <div className="flex items-center justify-between gap-4 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#888888] border-b border-zinc-900 bg-[#0D0D0D]">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="w-8 text-center hidden sm:inline-block">#</span>
                  <span>Title</span>
                </div>
                <div className="hidden w-[220px] shrink-0 items-center gap-6 md:flex">
                  <span className="w-24">Genre</span>
                  <span className="w-28">Plays</span>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 shrink-0 w-[115px] justify-end">
                  <span className="mr-8">Duration</span>
                </div>
              </div>

              {/* List items with solid dividers */}
              <div className="border-b border-zinc-900">
                {songs.map((song, index) => (
                  <BrutalistTrackRow
                    key={song.id}
                    song={song}
                    index={index}
                    queue={songs}
                    isSongLiked={isSongLiked}
                    toggleLike={toggleLike}
                    actionSongId={actionSongId}
                    openAddSongModal={openAddSongModal}
                  />
                ))}
              </div>

              {canLoadMore && (
                <div className="flex justify-center py-6 bg-[#0D0D0D]">
                  <button
                    type="button"
                    onClick={() => void loadPopularSongs(page + 1, true)}
                    disabled={loadingMore}
                    className="rounded-full border border-zinc-800 hover:border-white px-8 py-3 text-xs font-black uppercase tracking-widest text-[#888888] hover:text-white transition duration-150 bg-transparent"
                  >
                    {loadingMore ? "Loading..." : "Load more songs"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
