"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLikes } from "@/components/like/LikeProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import { SongComments } from "@/components/song/SongComments";
import { SongMoreOptionsSheet } from "@/components/song/SongMoreOptionsSheet";
import {
  HeartIcon,
  CommentIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  MoreIcon,
  VolumeIcon,
  VolumeMuteIcon,
  MusicIcon,
} from "@/components/ui/Icons";
import { getDiscoverFeedRequest, getFeedRequest } from "@/lib/api";
import {
  formatDuration,
  getArtistAvatarUrl,
  getArtistDisplayName,
  getSongCoverUrl,
} from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import { useMobileFeedStore, type FeedTab } from "@/stores/mobile-feed-store";
import type { Song } from "@/types/music";
import { cn } from "@/lib/utils";

export function MobileTikTokFeed() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);

  const { isSongLiked, toggleLike } = useLikes();
  const { isFollowing, toggleFollow, actionId: followActionId } = useFollow();
  const { openAddSongModal } = usePlaylists();

  // Mobile Feed Zustand Persistent Store
  const activeTab = useMobileFeedStore((state) => state.activeTab);
  const setActiveTab = useMobileFeedStore((state) => state.setActiveTab);
  const discoverSongs = useMobileFeedStore((state) => state.discoverSongs);
  const followingSongs = useMobileFeedStore((state) => state.followingSongs);
  const setDiscoverSongs = useMobileFeedStore((state) => state.setDiscoverSongs);
  const appendDiscoverSongs = useMobileFeedStore((state) => state.appendDiscoverSongs);
  const setFollowingSongs = useMobileFeedStore((state) => state.setFollowingSongs);
  const appendFollowingSongs = useMobileFeedStore((state) => state.appendFollowingSongs);
  const discoverExcludeIds = useMobileFeedStore((state) => state.discoverExcludeIds);
  const activeSongIndex = useMobileFeedStore((state) => state.activeSongIndex);
  const setActiveSongIndex = useMobileFeedStore((state) => state.setActiveSongIndex);
  const hasLoadedDiscover = useMobileFeedStore((state) => state.hasLoadedDiscover);
  const hasLoadedFollowing = useMobileFeedStore((state) => state.hasLoadedFollowing);
  const resetTab = useMobileFeedStore((state) => state.resetTab);

  const songs = activeTab === "discover" ? discoverSongs : followingSongs;
  const hasLoaded = activeTab === "discover" ? hasLoadedDiscover : hasLoadedFollowing;

  const [loading, setLoading] = useState(!hasLoaded);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [commentSong, setCommentSong] = useState<Song | null>(null);
  const [closingComment, setClosingComment] = useState(false);

  const handleCloseComments = () => {
    if (closingComment) return;
    setClosingComment(true);
    setTimeout(() => {
      setCommentSong(null);
      setClosingComment(false);
    }, 280);
  };
  const [moreOptionsSong, setMoreOptionsSong] = useState<Song | null>(null);
  const [prevVolume, setPrevVolume] = useState(1);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isRestoredRef = useRef(false);

  const isMuted = volume === 0;

  const handleToggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume || 1);
    }
  };

  // Load songs with smooth transition: only replace songs AFTER fetch finishes!
  const loadSongs = useCallback(
    async (nextPage: number, isReset = false) => {
      if (isReset) {
        setRefreshing(true);
      } else {
        setLoadingMore(true);
      }

      try {
        let result;
        if (activeTab === "discover") {
          result = await getDiscoverFeedRequest(
            accessToken,
            nextPage,
            8,
            isReset ? [] : discoverExcludeIds,
          );
          if (isReset) {
            // Replace songs and scroll to top AFTER data is ready
            setDiscoverSongs(result.items);
            if (containerRef.current) {
              containerRef.current.scrollTop = 0;
            }
          } else {
            appendDiscoverSongs(result.items);
          }
        } else {
          if (!accessToken) {
            setFollowingSongs([]);
            setLoading(false);
            setRefreshing(false);
            setLoadingMore(false);
            return;
          }
          result = await getFeedRequest(accessToken, nextPage, 8);
          if (isReset) {
            setFollowingSongs(result.items);
            if (containerRef.current) {
              containerRef.current.scrollTop = 0;
            }
          } else {
            appendFollowingSongs(result.items);
          }
        }

        setHasMore(
          result.pagination
            ? result.pagination.page < result.pagination.totalPages
            : false,
        );
      } catch (err) {
        console.error("Error loading mobile feed:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [
      activeTab,
      accessToken,
      discoverExcludeIds,
      setDiscoverSongs,
      appendDiscoverSongs,
      setFollowingSongs,
      appendFollowingSongs,
    ],
  );

  // Initial load when tab changes or if not loaded yet
  useEffect(() => {
    if (!hasLoaded) {
      void loadSongs(1, true);
    } else {
      setLoading(false);
    }
  }, [activeTab, hasLoaded]);

  // Listen for active tab click on /feed in bottom navigation to refresh feed
  useEffect(() => {
    const handleRefresh = () => {
      void loadSongs(1, true);
    };

    window.addEventListener("REFRESH_MOBILE_FEED", handleRefresh);
    return () => {
      window.removeEventListener("REFRESH_MOBILE_FEED", handleRefresh);
    };
  }, [loadSongs]);

  // Scroll to restored position on mount when returning to /feed
  useEffect(() => {
    if (!loading && songs.length > 0 && !isRestoredRef.current) {
      isRestoredRef.current = true;
      if (activeSongIndex > 0 && activeSongIndex < songs.length) {
        const targetElement = cardRefs.current[activeSongIndex];
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }
    }
  }, [loading, songs, activeSongIndex]);

  // IntersectionObserver to auto-play track & update store when card comes into focus
  useEffect(() => {
    if (songs.length === 0 || loading || refreshing) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexStr = entry.target.getAttribute("data-index");
            if (indexStr !== null) {
              const index = parseInt(indexStr, 10);
              setActiveSongIndex(index);

              const song = songs[index];
              if (song) {
                // Auto play track on swipe snap focus
                if (currentSong?.id !== song.id) {
                  playSong(song);
                }
              }

              // Load more if near bottom
              if (index >= songs.length - 2 && hasMore && !loadingMore) {
                setPage((prevPage) => {
                  const nextPage = prevPage + 1;
                  void loadSongs(nextPage, false);
                  return nextPage;
                });
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6,
      },
    );

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, [songs, loading, refreshing, currentSong, playSong, hasMore, loadingMore, loadSongs, setActiveSongIndex]);

  const handleRefreshFeed = () => {
    void loadSongs(1, true);
  };

  const handleShare = async (song: Song) => {
    const shareUrl = `${window.location.origin}/songs/${song.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: song.title,
          text: `Check out ${song.title} on Music Streaming!`,
          url: shareUrl,
        });
      } catch {
        // Fallback to clipboard
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice("Copied link to clipboard!");
      setTimeout(() => setShareNotice(null), 2500);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-5rem)] max-w-md mx-auto bg-black text-white flex flex-col overflow-hidden select-none p-1">
      {/* Toast Notice */}
      {shareNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl border border-orange-400 animate-bounce">
          {shareNotice}
        </div>
      )}

      {/* Translucent Glass Spinner Floating Overlay (Icon only, no text) */}
      {refreshing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="p-3 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 shadow-[0_10px_35px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in duration-200">
            <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        </div>
      )}

      {/* Initial Loading State */}
      {loading && !refreshing ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-400 font-semibold tracking-wide">Finding tracks for you...</p>
        </div>
      ) : songs.length === 0 && !refreshing ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-base font-bold text-zinc-200">No songs found</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
            {activeTab === "following"
              ? "Follow artists to see their latest uploads here, or switch to Discover."
              : "No unlistened songs right now. Try refreshing!"}
          </p>
          <button
            onClick={handleRefreshFeed}
            className="mt-5 px-5 py-2.5 text-xs font-bold rounded-full bg-orange-500 text-white hover:bg-orange-600 active:scale-95 shadow-lg"
          >
            Refresh Feed
          </button>
        </div>
      ) : (
        /* Vertical Snap Scroll Container */
        <div
          ref={containerRef}
          className="flex-1 w-full overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar rounded-[2rem] overflow-hidden"
        >
          {songs.map((song, index) => {
            const coverUrl = getSongCoverUrl(song);
            const artistName = getArtistDisplayName(song.artist);
            const avatarUrl = getArtistAvatarUrl(song.artist);
            const isCurrentPlaying = currentSong?.id === song.id && isPlaying;
            const liked = isSongLiked(song.id);

            const artistId = song.artist?.id;
            const artistUserId = song.artist?.user_id || song.artist?.id;
            const profileUrl = artistId
              ? `/artists/${artistId}`
              : artistUserId
              ? `/users/${artistUserId}`
              : "#";
            const followingArtist = isFollowing(artistUserId);

            const handleGoToProfile = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (profileUrl !== "#") {
                router.push(profileUrl);
              }
            };

            return (
              <div
                key={`${song.id}-${index}`}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                data-index={index}
                data-song-id={song.id}
                className="relative w-full h-[calc(100vh-5rem)] snap-start snap-always flex flex-col justify-between p-3.5 overflow-hidden shrink-0 rounded-[2rem]"
              >
                {/* Full-Screen Cover Artwork Background with subtle dynamic zoom on play */}
                {coverUrl ? (
                  <Image
                    src={coverUrl}
                    alt={song.title}
                    fill
                    className={cn(
                      "object-cover rounded-[2rem] pointer-events-none transition-transform duration-1000 ease-out",
                      isCurrentPlaying ? "scale-105" : "scale-100",
                    )}
                    priority={index === 0}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-[2rem]" />
                )}

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/90 rounded-[2rem] pointer-events-none" />

                {/* Top Pill Navigation inside Card */}
                <div className="relative z-30 flex items-center justify-between pt-1 px-2">
                  <div className="flex items-center gap-1 bg-[#3A3533]/80 p-1 rounded-full border border-white/10 backdrop-blur-md shadow-lg">
                    <button
                      onClick={() => setActiveTab("discover")}
                      className={cn(
                        "px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-300 active:scale-95",
                        activeTab === "discover"
                          ? "bg-[#544D4A] text-white shadow-md"
                          : "text-zinc-300 hover:text-white",
                      )}
                    >
                      Discover
                    </button>
                    <button
                      onClick={() => setActiveTab("following")}
                      className={cn(
                        "px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-300 active:scale-95",
                        activeTab === "following"
                          ? "bg-[#544D4A] text-white shadow-md"
                          : "text-zinc-300 hover:text-white",
                      )}
                    >
                      Following
                    </button>
                  </div>

                  <button
                    onClick={() => setMoreOptionsSong(song)}
                    className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/60 active:scale-90 transition-all duration-200 shadow-md cursor-pointer"
                  >
                    <MoreIcon size={18} />
                  </button>
                </div>

                {/* Center Speaker Icon with Pulsing Glow on Play */}
                <div
                  onClick={() => {
                    if (currentSong?.id === song.id) {
                      togglePlay();
                    } else {
                      playSong(song);
                    }
                  }}
                  className="relative z-20 my-auto flex flex-col items-center justify-center cursor-pointer group"
                >
                  {isCurrentPlaying && (
                    <div className="absolute w-16 h-16 rounded-full border border-orange-500/40 animate-ping pointer-events-none" />
                  )}
                  <button
                    onClick={handleToggleMute}
                    className={cn(
                      "w-14 h-14 rounded-full bg-black/40 backdrop-blur-md border flex items-center justify-center text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-95",
                      isCurrentPlaying ? "border-orange-500/50 shadow-orange-500/20" : "border-white/15",
                    )}
                    title={isMuted ? "Unmute sound" : "Mute sound"}
                  >
                    {isMuted ? <VolumeMuteIcon size={24} /> : <VolumeIcon size={24} />}
                  </button>
                </div>

                {/* Right Side Action Icons */}
                <div className="absolute right-4 bottom-36 z-30 flex flex-col items-center gap-4">
                  {/* Like */}
                  <button
                    onClick={() => void toggleLike(song)}
                    className="flex flex-col items-center gap-1 group active:scale-125 transition-transform duration-200"
                  >
                    <div className="transition-transform duration-300 group-hover:scale-110">
                      <HeartIcon
                        size={28}
                        filled={liked}
                        className={cn(
                          "transition-colors duration-300",
                          liked ? "text-orange-500 fill-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" : "text-white drop-shadow-md",
                        )}
                      />
                    </div>
                    <span className={cn("text-xs font-bold transition-colors duration-300", liked ? "text-orange-400" : "text-white drop-shadow-md")}>
                      {song.play_count || 0}
                    </span>
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => setCommentSong(song)}
                    className="flex flex-col items-center gap-1 group active:scale-90 transition-transform duration-200"
                  >
                    <div className="transition-transform duration-300 group-hover:scale-110 text-white drop-shadow-md">
                      <CommentIcon size={26} />
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow-md">
                      Comment
                    </span>
                  </button>

                  {/* Add to Playlist (+) */}
                  <button
                    onClick={() => openAddSongModal(song)}
                    className="w-8 h-8 rounded-lg border-2 border-white/80 flex items-center justify-center text-white bg-black/30 backdrop-blur-xs active:scale-90 hover:scale-110 transition-transform duration-200 shadow-md"
                    title="Save to Playlist"
                  >
                    <PlusIcon size={18} />
                  </button>
                </div>

                {/* Bottom Card Box (Positioned cleanly above bottom nav) */}
                <div className="relative z-30 pb-1">
                  {/* Recommendation Badge above Box */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 mb-1.5 drop-shadow-md">
                    <span className="text-orange-400 animate-pulse">★</span>
                    <span>Recommended for you • {formatDuration(song.duration_sec)}</span>
                  </div>

                  {/* Translucent Dark Container with smooth border glow when playing */}
                  <div className={cn(
                    "bg-[#2A2523]/85 backdrop-blur-xl p-3.5 rounded-3xl border shadow-2xl flex items-center justify-between gap-3 transition-all duration-500",
                    isCurrentPlaying ? "border-orange-500/30 shadow-orange-500/10" : "border-white/10",
                  )}>
                    {/* Left Details */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Link
                        href={`/songs/${song.id}`}
                        className="block text-lg sm:text-xl font-black text-white leading-tight truncate hover:underline tracking-wide drop-shadow-sm transition-colors duration-200"
                        title={song.title}
                      >
                        {song.title}
                      </Link>

                      <div className="flex items-center gap-2">
                        <div
                          onClick={handleGoToProfile}
                          className="flex items-center gap-2 group min-w-0 cursor-pointer"
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full overflow-hidden relative shrink-0 transition-transform duration-300 group-hover:scale-110",
                            isCurrentPlaying ? "ring-2 ring-orange-500/70" : "border border-white/20",
                          )}>
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt={artistName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                                {artistName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-bold text-zinc-100 group-hover:text-white truncate max-w-[100px] sm:max-w-[130px] group-hover:underline">
                            {artistName}
                          </span>
                        </div>

                        {artistUserId && (
                          <button
                            disabled={followActionId === artistUserId}
                            onClick={() => void toggleFollow(artistUserId, artistName)}
                            className={cn(
                              "px-3 py-1 text-xs font-bold rounded-full transition-all duration-300 active:scale-95 shrink-0 shadow-md",
                              followingArtist
                                ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                                : "bg-[#4E4744] text-white hover:bg-[#605855]",
                            )}
                          >
                            {followingArtist ? "Following" : "Follow"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Play/Pause Button inside Card */}
                    <button
                      onClick={() => {
                        if (currentSong?.id === song.id) {
                          togglePlay();
                        } else {
                          playSong(song);
                        }
                      }}
                      className={cn(
                        "w-11 h-11 rounded-full border-2 bg-black/30 text-white flex items-center justify-center shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl cursor-pointer",
                        isCurrentPlaying ? "border-orange-400 bg-orange-500/20 text-orange-400" : "border-white/70 hover:bg-black/50",
                      )}
                    >
                      {isCurrentPlaying ? (
                        <PauseIcon size={22} className="text-orange-400" />
                      ) : (
                        <PlayIcon size={22} className="ml-0.5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="w-full py-6 flex items-center justify-center gap-2 text-xs text-zinc-400 animate-pulse">
              <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
              <span>Loading more unplayed tracks...</span>
            </div>
          )}
        </div>
      )}

      {/* Slide-up Comments Drawer with smooth opening and closing animations */}
      {commentSong && (
        <div
          onClick={handleCloseComments}
          className={cn(
            "fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end transition-opacity duration-300",
            closingComment ? "opacity-0 pointer-events-none" : "animate-in fade-in duration-300",
          )}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-md mx-auto h-[75vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-4 flex flex-col overflow-hidden transition-transform duration-300 ease-out",
              closingComment ? "translate-y-full" : "animate-in slide-in-from-bottom duration-300 ease-out",
            )}
          >
            {/* Top Drag Handle Pill */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-2.5 shrink-0 opacity-80" />

            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <CommentIcon size={18} className="text-orange-500 shrink-0" />
                <span className="text-sm font-bold text-white truncate">
                  Comments for {commentSong.title}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              <SongComments songId={commentSong.id} song={commentSong} minimal />
            </div>
          </div>
        </div>
      )}

      {/* Slide-up Song More Options Sheet */}
      {moreOptionsSong && (
        <SongMoreOptionsSheet
          song={moreOptionsSong}
          onClose={() => setMoreOptionsSong(null)}
          onOpenComments={() => setCommentSong(moreOptionsSong)}
        />
      )}
    </div>
  );
}
