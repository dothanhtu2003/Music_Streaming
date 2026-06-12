"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  formatDate,
  formatNumber,
  getAdminUserDisplayName,
  getErrorMessage,
} from "@/lib/admin-format";
import { getAdminDashboardRequest } from "@/lib/api";
import { getArtistDisplayName } from "@/lib/song-format";
import type { AdminDashboard } from "@/types/music";

function getMetricIcon(label: string) {
  const baseClass = "h-5 w-5 text-emerald-450";
  switch (label.toLowerCase()) {
    case "total users":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "total songs":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    case "total artists":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "total albums":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "total genres":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "total playlists":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      );
    case "total play count":
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={baseClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

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
        { label: "Total Users", value: dashboard.total_users },
        { label: "Total Songs", value: dashboard.total_songs },
        { label: "Total Artists", value: dashboard.total_artists },
        { label: "Total Albums", value: dashboard.total_albums },
        { label: "Total Genres", value: dashboard.total_genres },
        { label: "Total Playlists", value: dashboard.total_playlists },
        { label: "Total Play Count", value: dashboard.total_play_count },
      ]
    : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header block */}
      <div className="border-b border-zinc-900 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
              Admin Portal
            </p>
            <h1 className="mt-1.5 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Dashboard Overview
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Real-time analytics and statistics retrieved from the music database.
            </p>
          </div>
          
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="self-start sm:self-center flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-md"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-zinc-450" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Synchronizing...</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
                </svg>
                <span>Refresh Dashboard</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-450">
          {error}
        </div>
      )}

      {/* Metrics Cards Grid */}
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && !dashboard
          ? Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 p-5 shadow-lg animate-pulse">
                <div className="h-3.5 bg-zinc-900 rounded w-1/2 mb-3"></div>
                <div className="h-8 bg-zinc-900 rounded w-1/3 mb-4"></div>
                <div className="h-3 bg-zinc-900 rounded w-2/3"></div>
              </div>
            ))
          : metrics.map((metric) => (
              <div key={metric.label} className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-zinc-950 p-5 shadow-lg hover:border-zinc-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 group">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/20 to-emerald-500/0 group-hover:from-emerald-500/50" />
                
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                      {formatNumber(metric.value)}
                    </p>
                  </div>
                  
                  <div className="rounded-xl bg-zinc-900 p-2.5 border border-zinc-800 group-hover:bg-emerald-500/5 group-hover:border-emerald-500/20 transition-all duration-300">
                    {getMetricIcon(metric.label)}
                  </div>
                </div>
                
                <p className="mt-3 text-[11px] text-zinc-550 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-555 animate-pulse"></span>
                  <span>Current database count</span>
                </p>
              </div>
            ))}
      </section>

      {/* Tables Section */}
      <section className="grid gap-8 xl:grid-cols-2">
        {/* Top Songs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Top Songs</span>
            </h2>
            <span className="text-xs text-zinc-500">Most played tracks</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 shadow-inner">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-900 text-sm text-left">
                <thead className="bg-zinc-900/40 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-bold">Song</th>
                    <th scope="col" className="px-5 py-4 font-bold">Artist</th>
                    <th scope="col" className="px-5 py-4 font-bold">Genre</th>
                    <th scope="col" className="px-5 py-4 font-bold text-right">Plays</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/70">
                  {loading && !dashboard ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-2/3"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-1/2"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-1/3"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-12 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : !dashboard || dashboard.top_songs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-zinc-500">
                        No songs found.
                      </td>
                    </tr>
                  ) : (
                    dashboard.top_songs.map((song, index) => (
                      <tr key={song.id} className="text-zinc-350 hover:bg-zinc-900/25 transition-colors">
                        <td className="px-5 py-4 font-medium text-white flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-500 min-w-4 text-center">
                            {index + 1}
                          </span>
                          <span className="truncate">{song.title}</span>
                        </td>
                        <td className="px-5 py-4">{getArtistDisplayName(song.artist)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 border border-zinc-800">
                            {song.genre?.name ?? "Unknown"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-zinc-200">
                          {formatNumber(song.play_count)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Newest Users */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Newest Users</span>
            </h2>
            <span className="text-xs text-zinc-500">Recently registered accounts</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 shadow-inner">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-900 text-sm text-left">
                <thead className="bg-zinc-900/40 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-bold">User</th>
                    <th scope="col" className="px-5 py-4 font-bold">Email</th>
                    <th scope="col" className="px-5 py-4 font-bold">Role</th>
                    <th scope="col" className="px-5 py-4 font-bold">Status</th>
                    <th scope="col" className="px-5 py-4 text-right font-bold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/70">
                  {loading && !dashboard ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-1/2"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-2/3"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-12"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-12"></div></td>
                        <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-16 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : !dashboard || dashboard.newest_users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-zinc-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    dashboard.newest_users.map((user) => (
                      <tr key={user.id} className="text-zinc-350 hover:bg-zinc-900/25 transition-colors">
                        <td className="px-5 py-4 font-medium text-white">
                          {getAdminUserDisplayName(user)}
                        </td>
                        <td className="px-5 py-4 text-zinc-400 truncate max-w-48">{user.email}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            user.is_banned
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-green-500/10 text-green-400 border border-green-500/20"
                          }`}>
                            {user.is_banned ? "Banned" : "Active"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-xs text-zinc-500">
                          {formatDate(user.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
