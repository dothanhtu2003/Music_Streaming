"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MobileTikTokFeed } from "@/components/feed/MobileTikTokFeed";
import { SongList } from "@/components/song/SongList";
import { PageHeader } from "@/components/ui/PageHeader";
import { getFeedRequest } from "@/lib/api";
import { SONG_CATALOG_UPDATED_EVENT } from "@/lib/song-events";
import type { Song, SongPagination } from "@/types/music";

const SONG_LIMIT = 9;

export default function FeedPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<SongPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated and auth loading is done
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent("/feed")}`);
    }
  }, [authLoading, isAuthenticated, router]);

  const loadFeedSongs = useCallback(async (page: number) => {
    if (!accessToken) return;

    try {
      const result = await getFeedRequest(accessToken, page, SONG_LIMIT);
      setSongs((currentSongs) =>
        page === 1 ? result.items : [...currentSongs, ...result.items],
      );
      setPagination(result.pagination);
    } catch (feedError) {
      throw feedError;
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !accessToken) {
      return;
    }

    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
    });

    getFeedRequest(accessToken, 1, SONG_LIMIT)
      .then((result) => {
        if (!isMounted) return;
        setSongs(result.items);
        setPagination(result.pagination);
      })
      .catch((feedError) => {
        if (!isMounted) return;
        setError(
          feedError instanceof Error
            ? feedError.message
            : "Could not load feed songs.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, isAuthenticated, authLoading]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }
    let timerId: NodeJS.Timeout | null = null;

    const handleCatalogUpdated = () => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        void loadFeedSongs(1).catch(() => {});
      }, 500);
    };

    window.addEventListener(SONG_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener(SONG_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    };
  }, [accessToken, isAuthenticated, loadFeedSongs]);

  const handleLoadMore = async () => {
    if (!pagination || loadingMore || !accessToken) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      await loadFeedSongs(pagination.page + 1);
    } catch (loadMoreError) {
      setError(
        loadMoreError instanceof Error
          ? loadMoreError.message
          : "Could not load more feed songs.",
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const canLoadMore = pagination
    ? pagination.page < pagination.totalPages
    : false;

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-zinc-400">Loading auth session...</div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View: TikTok-style Audio Swipe Feed */}
      <div className="block md:hidden">
        <MobileTikTokFeed />
      </div>

      {/* Desktop/Laptop View: Classic Feed Layout (Untouched) */}
      <div className="hidden md:block space-y-6 page-fade-in pb-16">
        <PageHeader
          eyebrow="Personalized"
          title="Your Feed"
          description="Fresh new songs from the artists and users you follow."
        />

        <section className="space-y-4">
          <SongList
            songs={songs}
            loading={loading}
            error={error}
            variant="list"
            emptyMessage="Follow some artists to see their latest songs."
            canLoadMore={canLoadMore}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
          />
        </section>
      </div>
    </>
  );
}
