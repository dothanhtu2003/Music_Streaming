"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { resolveApiAssetUrl } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { following, toggleFollow, actionId } = useFollow();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Current user profile loaded from the auth session."
      />

      <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-sm text-zinc-500">Signed in as</p>
        <h2 className="mt-2 text-2xl font-bold text-white">
          {user?.username ?? "Loading..."}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{user?.email}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
        >
          Logout
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Following"
          value={String(following.length)}
          helper="Artists you follow"
        />
        <StatCard label="Playlists" value="6" helper="Created by user" />
        <StatCard
          label="Role"
          value={user?.role ?? "user"}
          helper="Current account role"
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-bold text-white">Artists you follow</h3>
        {following.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-500 text-sm">
            <p>You are not following any artist yet.</p>
            <p className="mt-2 text-xs text-zinc-600">Explore songs on the home page to start following artists!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {following.map((artist) => {
              const targetId = artist.artist_id || artist.user_id;
              const artistName = artist.name || artist.username;
              const avatarUrl = resolveApiAssetUrl(artist.avatar_url);
              const isActionLoading = actionId === targetId;

              return (
                <div
                  key={artist.user_id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-4 hover:border-green-500/50 transition duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {avatarUrl ? (
                      <div
                        className="h-12 w-12 shrink-0 rounded-full bg-cover bg-center border border-zinc-800"
                        style={{ backgroundImage: `url(${avatarUrl})` }}
                      />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-green-500 to-zinc-900 border border-zinc-800 text-sm font-bold text-white">
                        {artistName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      {artist.artist_id ? (
                        <Link href={`/artists/${artist.artist_id}`}>
                          <h4 className="font-semibold text-white truncate hover:text-green-400">
                            {artistName}
                          </h4>
                        </Link>
                      ) : (
                        <h4 className="font-semibold text-white truncate">
                          {artistName}
                        </h4>
                      )}
                      <p className="text-xs text-zinc-500">Artist</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() =>
                      void toggleFollow(targetId, artistName)
                    }
                    className="rounded bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white transition border border-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isActionLoading ? "..." : "Unfollow"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
