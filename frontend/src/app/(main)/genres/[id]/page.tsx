"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SongList } from "@/components/song/SongList";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGenreRequest, getSongsRequest } from "@/lib/api";
import type { GenreRecord, Song, SongPagination } from "@/types/music";

type GenreSongsPageProps = {
  params: Promise<{ id: string }>;
};

const SONGS_PER_PAGE = 20;

const emptyPagination: SongPagination = {
  page: 1,
  limit: SONGS_PER_PAGE,
  totalItems: 0,
  totalPages: 1,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function GenreSongsContent({ genreId }: { genreId: string }) {
  const [genre, setGenre] = useState<GenreRecord | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<SongPagination>(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [genreResult, songResult] = await Promise.all([
          getGenreRequest(genreId),
          getSongsRequest(1, SONGS_PER_PAGE, { genre_id: genreId }),
        ]);

        if (!isMounted) {
          return;
        }

        setGenre(genreResult);
        setSongs(songResult.items);
        setPagination(songResult.pagination);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setSongs([]);
        setPagination(emptyPagination);
        setError(getErrorMessage(loadError, "Could not load genre songs."));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [genreId]);

  const handleLoadMore = async () => {
    if (loadingMore || pagination.page >= pagination.totalPages) {
      return;
    }

    setLoadingMore(true);
    setError(null);

    try {
      const result = await getSongsRequest(
        pagination.page + 1,
        SONGS_PER_PAGE,
        { genre_id: genreId },
      );

      setSongs((currentSongs) => [...currentSongs, ...result.items]);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load more songs."));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-6 page-fade-in pb-10">
      <PageHeader
        eyebrow="Genre"
        title={genre?.name ?? "Genre songs"}
        description={
          loading
            ? "Loading songs in this genre."
            : `${pagination.totalItems} tracks in this genre.`
        }
        action={
          <Link
            href="/home"
            className="rounded-full border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-orange-500 hover:text-white"
          >
            Back to Home
          </Link>
        }
      />

      <section className="rounded-3xl border border-zinc-900/60 bg-zinc-950/40 p-5 sm:p-6">
        <SongList
          songs={songs}
          loading={loading}
          error={error}
          emptyMessage="No songs in this genre."
          emptyDescription="Tracks uploaded under this genre will appear here."
          canLoadMore={pagination.page < pagination.totalPages}
          loadingMore={loadingMore}
          onLoadMore={() => {
            void handleLoadMore();
          }}
          variant="list"
        />
      </section>
    </div>
  );
}

export default function GenreSongsPage({ params }: GenreSongsPageProps) {
  const [genreId, setGenreId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void params.then(({ id }) => {
      if (isMounted) {
        setGenreId(id);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [params]);

  return (
    <ProtectedRoute loginPath="/login">
      {genreId ? (
        <GenreSongsContent genreId={genreId} />
      ) : (
        <div className="grid min-h-40 place-items-center text-sm text-zinc-500">
          Loading genre...
        </div>
      )}
    </ProtectedRoute>
  );
}
