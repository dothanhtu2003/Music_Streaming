"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatDate, formatNumber, getErrorMessage } from "@/lib/admin-format";
import { getAdminDashboardRequest } from "@/lib/api";
import type { AdminDashboard } from "@/types/music";

export default function AdminPage() {
  const { accessToken } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getAdminDashboardRequest(accessToken);
      setDashboard(data);
    } catch (dashboardError) {
      setError(getErrorMessage(dashboardError, "Could not load dashboard."));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadDashboard();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadDashboard]);

  const metrics: Array<{ label: string; value: number }> = dashboard
    ? [
        { label: "Total users", value: dashboard.total_users },
        { label: "Total songs", value: dashboard.total_songs },
        { label: "Total artists", value: dashboard.total_artists },
        { label: "Total albums", value: dashboard.total_albums },
        { label: "Total genres", value: dashboard.total_genres },
        { label: "Total playlists", value: dashboard.total_playlists },
        { label: "Total play count", value: dashboard.total_play_count },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Dashboard"
        description="Overview metrics from GET /api/admin/dashboard."
        action={
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !dashboard
          ? Array.from({ length: 6 }).map((_, index) => (
              <StatCard key={index} label="Loading" value="..." helper="Please wait" />
            ))
          : metrics.map((metric) => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={formatNumber(metric.value)}
                helper="Current database value"
              />
            ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Top songs</h2>
          <AdminTable
            headers={["Song", "Artist", "Genre", "Plays"]}
            loading={loading && !dashboard}
            empty={Boolean(dashboard && dashboard.top_songs.length === 0)}
            emptyMessage="No songs found."
          >
            {dashboard?.top_songs.map((song) => (
              <tr key={song.id} className="text-zinc-300">
                <td className="px-4 py-3 font-medium text-white">{song.title}</td>
                <td className="px-4 py-3">{song.artist.name}</td>
                <td className="px-4 py-3">{song.genre?.name ?? "Unknown"}</td>
                <td className="px-4 py-3">{formatNumber(song.play_count)}</td>
              </tr>
            ))}
          </AdminTable>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Newest users</h2>
          <AdminTable
            headers={["User", "Email", "Role", "Status", "Joined"]}
            loading={loading && !dashboard}
            empty={Boolean(dashboard && dashboard.newest_users.length === 0)}
            emptyMessage="No users found."
          >
            {dashboard?.newest_users.map((user) => (
              <tr key={user.id} className="text-zinc-300">
                <td className="px-4 py-3 font-medium text-white">
                  {user.username}
                </td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3 capitalize">{user.role}</td>
                <td className="px-4 py-3">
                  {user.is_banned ? "Banned" : "Active"}
                </td>
                <td className="px-4 py-3">{formatDate(user.created_at)}</td>
              </tr>
            ))}
          </AdminTable>
        </div>
      </section>
    </div>
  );
}
