"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, getErrorMessage } from "@/lib/admin-format";
import {
  deleteAdminPlaylistRequest,
  getAdminPlaylistsRequest,
} from "@/lib/api";
import type { AdminPlaylist, Pagination } from "@/types/music";

const PAGE_LIMIT = 20;

export default function AdminPlaylistsPage() {
  const { accessToken } = useAuth();
  const [playlists, setPlaylists] = useState<AdminPlaylist[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getAdminPlaylistsRequest(
        accessToken,
        page,
        PAGE_LIMIT,
        search,
      );

      setPlaylists(result.items);
      setPagination(result.pagination);
    } catch (playlistError) {
      setError(getErrorMessage(playlistError, "Could not load playlists."));
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadPlaylists();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadPlaylists]);

  const handleSearch = () => {
    setPage(1);
    setSearch(query.trim());
  };

  const handleDelete = async (playlist: AdminPlaylist) => {
    if (!accessToken) {
      return;
    }

    const confirmed = window.confirm(
      `Delete playlist "${playlist.title}" by ${playlist.owner_name}?`,
    );

    if (!confirmed) {
      return;
    }

    setActionId(playlist.id);
    setError(null);

    try {
      await deleteAdminPlaylistRequest(playlist.id, accessToken);
      setPlaylists((currentPlaylists) =>
        currentPlaylists.filter((item) => item.id !== playlist.id),
      );
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not delete playlist."));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Playlists"
        description="View playlist owners and delete violating playlists."
        action={
          <button
            type="button"
            onClick={loadPlaylists}
            disabled={loading}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSearch();
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
          placeholder="Search by playlist, owner, or email"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <AdminTable
        headers={["Playlist", "Owner", "Tracks", "Visibility", "Created", "Actions"]}
        loading={loading}
        empty={!loading && playlists.length === 0}
        emptyMessage="No playlists found."
      >
        {playlists.map((playlist) => (
          <tr key={playlist.id} className="text-zinc-300">
            <td className="px-4 py-3">
              <p className="font-medium text-white">{playlist.title}</p>
              <p className="mt-1 max-w-xs truncate text-xs text-zinc-500">
                {playlist.description || "No description"}
              </p>
            </td>
            <td className="px-4 py-3">
              <p>{playlist.owner_name}</p>
              <p className="text-xs text-zinc-500">{playlist.owner_email}</p>
            </td>
            <td className="px-4 py-3">{playlist.track_count}</td>
            <td className="px-4 py-3">
              {playlist.is_public ? "Public" : "Private"}
            </td>
            <td className="px-4 py-3">{formatDate(playlist.created_at)}</td>
            <td className="px-4 py-3">
              <button
                type="button"
                disabled={actionId === playlist.id}
                onClick={() => {
                  void handleDelete(playlist);
                }}
                className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionId === playlist.id ? "Deleting..." : "Delete"}
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
              className="rounded-lg border border-zinc-700 px-3 py-2 font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
              className="rounded-lg border border-zinc-700 px-3 py-2 font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
