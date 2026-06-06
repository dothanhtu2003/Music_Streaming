"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useFollow } from "@/components/follow/FollowProvider";
import { FollowListModal } from "@/components/follow/FollowListModal";
import { useLikes } from "@/components/like/LikeProvider";
import { usePlaylists } from "@/components/playlist/PlaylistProvider";
import {
  ArtistTrackRow,
  ArtistTrackRowSkeleton,
} from "@/components/song/ArtistTrackRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistIcon, UserIcon, PlayIcon, PauseIcon } from "@/components/ui/Icons";
import {
  getMySongsRequest,
  getRecentlyPlayedRequest,
  resolveApiAssetUrl,
  uploadCurrentUserAvatarRequest,
  updateCurrentUserRequest,
} from "@/lib/api";
import {
  RECENTLY_PLAYED_UPDATED_EVENT,
  getLocalRecentlyPlayed,
} from "@/lib/recently-played-storage";
import {
  SONG_CATALOG_UPDATED_EVENT,
  consumePendingUploadedSongId,
  type SongCatalogUpdatedDetail,
} from "@/lib/song-events";
import {
  formatPlayCount,
  getArtistAvatarUrl,
  getArtistDisplayName,
  getSongCoverUrl,
} from "@/lib/song-format";
import { usePlayerStore } from "@/stores/player-store";
import { getUserProfilePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type {
  FollowedArtist,
  RecentlyPlayedSong,
  Song,
  UserPlaylist,
} from "@/types/music";

type ProfileTab = "overview" | "tracks" | "playlists" | "following" | "liked";

type EditableProfile = {
  username: string;
  bio: string;
  avatarUrl: string;
};

type EditProfileSavePayload = EditableProfile & {
  avatarFile: File | null;
};

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "tracks", label: "My tracks" },
  { id: "playlists", label: "Playlists" },
  { id: "following", label: "Following" },
  { id: "liked", label: "Liked songs" },
];

function getFallbackLetter(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "U";
}

function isOwnTrack(song: Song, userId: string, username: string) {
  const artistUserId = song.artist?.user_id;
  const artistName = song.artist?.name?.trim().toLowerCase();

  return (
    artistUserId === userId ||
    Boolean(artistName && artistName === username.trim().toLowerCase())
  );
}

function ProfileTabs({
  activeTab,
  onChange,
  counts,
}: {
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  counts: Record<ProfileTab, number | null>;
}) {
  return (
    <nav className="overflow-x-auto no-scrollbar border-b border-zinc-900">
      <div className="flex min-w-max items-center gap-2">
        {profileTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const count = counts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative px-4 py-4 text-sm font-bold transition",
                isActive
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              <span>{tab.label}</span>
              {count !== null && (
                <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-400">
                  {formatPlayCount(count)}
                </span>
              )}
              {isActive && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-orange-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ProfileAvatar({
  username,
  avatarUrl,
}: {
  username: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <div
        className="h-28 w-28 shrink-0 rounded-full border border-white/10 ring-4 ring-zinc-950 bg-zinc-950 bg-cover bg-center shadow-lg shadow-black/30 sm:h-36 sm:w-36 md:h-40 md:w-40 animate-fade-in"
        style={{ backgroundImage: `url(${avatarUrl})` }}
        role="img"
        aria-label={`${username} avatar`}
      />
    );
  }

  return (
    <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border border-orange-500/20 ring-4 ring-zinc-950 bg-zinc-950 bg-gradient-to-br from-orange-500/20 to-zinc-900 shadow-lg shadow-black/30 sm:h-36 sm:w-36 md:h-40 md:w-40 animate-fade-in">
      <span className="text-5xl font-extrabold text-orange-400 sm:text-6xl select-none">
        {getFallbackLetter(username)}
      </span>
    </div>
  );
}

function EditProfileModal({
  initialProfile,
  saving,
  error,
  onCancel,
  onSave,
}: {
  initialProfile: EditableProfile;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (profile: EditProfileSavePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<EditableProfile>(initialProfile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    resolveApiAssetUrl(initialProfile.avatarUrl),
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const updateForm = (field: keyof EditableProfile, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setFormError(null);
  };

  const handleAvatarChange = (file: File | null) => {
    setFormError(null);

    if (!file) {
      setAvatarFile(null);
      setAvatarPreviewUrl(resolveApiAssetUrl(initialProfile.avatarUrl));
      return;
    }

    if (!AVATAR_MIME_TYPES.has(file.type)) {
      setAvatarFile(null);
      setFormError("Avatar must be a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > AVATAR_MAX_SIZE) {
      setAvatarFile(null);
      setFormError("Avatar image must be 2MB or smaller.");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);

    if (avatarPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(nextPreviewUrl);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextProfile = {
      username: form.username.trim(),
      bio: form.bio.trim(),
      avatarUrl: form.avatarUrl.trim(),
      avatarFile,
    };

    if (nextProfile.username.length < 2) {
      setFormError("Display name must be at least 2 characters.");
      return;
    }

    if (nextProfile.username.length > 40) {
      setFormError("Display name must be 40 characters or less.");
      return;
    }

    if (nextProfile.bio.length > 300) {
      setFormError("Bio must be 300 characters or less.");
      return;
    }

    await onSave(nextProfile);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 pt-20 pb-28 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Edit profile</h2>
          <p className="text-sm text-zinc-500">
            Update your public profile details.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              Display name / username
            </label>
            <input
              value={form.username}
              onChange={(event) => updateForm("username", event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-400"
              placeholder="Your display name"
              maxLength={40}
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(event) => updateForm("bio", event.target.value)}
              className="mt-2 min-h-28 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange-400"
              placeholder="Tell listeners a little about you."
              maxLength={300}
            />
            <p className="mt-1 text-right text-xs text-zinc-600">
              {form.bio.length}/300
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              Avatar image
            </label>
            <div className="mt-2 flex items-center gap-4 rounded-lg border border-zinc-800 bg-black p-3">
              {avatarPreviewUrl ? (
                <div
                  className="h-16 w-16 shrink-0 rounded-full bg-zinc-900 bg-cover bg-center"
                  style={{ backgroundImage: `url(${avatarPreviewUrl})` }}
                  role="img"
                  aria-label="Avatar preview"
                />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-zinc-950 text-xl font-black text-white">
                  {getFallbackLetter(form.username)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    handleAvatarChange(event.target.files?.[0] ?? null);
                  }}
                  className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-sm file:font-black file:text-orange-950 hover:file:bg-orange-400"
                />
                <p className="mt-2 text-xs text-zinc-600">
                  JPG, PNG, or WebP. Max 2MB.
                </p>
              </div>
            </div>
          </div>

          {(formError || error) && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {formError || error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-full border border-zinc-700 bg-black px-5 py-2.5 text-sm font-bold text-zinc-200 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-black text-orange-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TrackListSection({
  songs,
  loading,
  error,
  emptyTitle,
  emptyDescription,
  actionLabel,
  href,
  onAction,
}: {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <ArtistTrackRowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <EmptyState
        icon={<PlaylistIcon size={24} />}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={actionLabel}
        href={href}
        onAction={onAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      {songs.map((song) => (
        <ArtistTrackRow key={song.id} song={song} queue={songs} />
      ))}
    </div>
  );
}

function CompactRecentActivityRow({ song, queue }: { song: Song; queue: Song[] }) {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const isCurrentSong = currentSong?.id === song.id;
  const coverUrl = getSongCoverUrl(song);
  const songTitle = song.title || "Untitled track";
  const artistId = song.artist?.id ?? "";
  const artistName = getArtistDisplayName(song.artist);
  const safeQueue = queue.length > 0 ? queue : [song];

  const handlePlay = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (isCurrentSong) {
      togglePlay();
      return;
    }

    playSong(song, safeQueue);
  };

  return (
    <article
      className={cn(
        "group flex items-center justify-between gap-4 rounded-xl border border-zinc-900/60 bg-zinc-950/20 p-2.5 transition hover:border-zinc-800 hover:bg-zinc-900/30",
        isCurrentSong && "border-orange-500/20 bg-orange-500/[0.02]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Cover Art */}
        <Link
          href={`/songs/${song.id}`}
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-900 bg-zinc-900/60 bg-cover bg-center"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          aria-label={`Open ${songTitle}`}
        >
          {!coverUrl && (
            <span className="grid h-full w-full place-items-center bg-gradient-to-br from-orange-500/20 to-zinc-950 text-sm font-black text-orange-400/80">
              {getFallbackLetter(songTitle)}
            </span>
          )}
          {/* Overlay play button on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handlePlay}
              className="rounded-full bg-orange-500 p-2 text-orange-950 hover:bg-orange-400 transition"
              aria-label={isCurrentSong && isPlaying ? "Pause" : "Play"}
            >
              {isCurrentSong && isPlaying ? (
                <PauseIcon size={12} />
              ) : (
                <PlayIcon size={12} className="ml-0.5" />
              )}
            </button>
          </div>
        </Link>

        {/* Text information */}
        <div className="min-w-0 flex-1">
          <Link
            href={`/songs/${song.id}`}
            className={cn(
              "block truncate text-sm font-bold transition hover:text-orange-400 leading-tight",
              isCurrentSong ? "text-orange-400" : "text-white",
            )}
          >
            {songTitle}
          </Link>
          
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {artistId ? (
              <Link
                href={`/artists/${artistId}`}
                className="hover:text-orange-400 transition font-medium truncate max-w-[150px] inline-block"
              >
                {artistName}
              </Link>
            ) : (
              <span className="truncate max-w-[150px] inline-block">{artistName}</span>
            )}
            <span className="text-zinc-700 font-normal select-none">•</span>
            <span>played recently</span>
          </div>
        </div>
      </div>

      {/* Play/Pause Button on Right */}
      <button
        type="button"
        onClick={handlePlay}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-orange-500 hover:text-orange-950 hover:border-orange-500 transition group-hover:border-zinc-700 md:opacity-0 group-hover:opacity-100 focus:opacity-100",
          isCurrentSong && "border-orange-500/30 text-orange-400 md:opacity-100",
        )}
        aria-label={isCurrentSong && isPlaying ? "Pause" : "Play"}
      >
        {isCurrentSong && isPlaying ? (
          <PauseIcon size={12} />
        ) : (
          <PlayIcon size={12} className="ml-0.5" />
        )}
      </button>
    </article>
  );
}

function CompactRecentActivitySection({
  songs,
  loading,
  error,
  emptyTitle,
  emptyDescription,
}: {
  songs: Song[];
  loading?: boolean;
  error?: string | null;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-xl border border-zinc-900/60 bg-zinc-950/20 p-2.5 animate-pulse">
            <div className="h-12 w-12 rounded-lg bg-zinc-900 shimmer shrink-0" />
            <div className="min-w-0 flex-1 space-y-2 py-1">
              <div className="h-3.5 w-1/3 rounded bg-zinc-900 shimmer" />
              <div className="h-3 w-1/4 rounded bg-zinc-900 shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300 animate-fade-in">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <EmptyState
        icon={<PlaylistIcon size={24} />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-2">
      {songs.map((song) => (
        <CompactRecentActivityRow key={song.id} song={song} queue={songs} />
      ))}
    </div>
  );
}

function PlaylistCover({ playlist }: { playlist: UserPlaylist }) {
  const coverUrl = resolveApiAssetUrl(
    playlist.custom_cover_url ?? playlist.cover_url,
  );
  const title = playlist.title || playlist.name || "Playlist";

  if (coverUrl) {
    return (
      <div
        className="aspect-square rounded-lg bg-zinc-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${coverUrl})` }}
        role="img"
        aria-label={`${title} cover`}
      />
    );
  }

  return (
    <div className="grid aspect-square place-items-center rounded-lg bg-gradient-to-br from-orange-500/80 to-zinc-950">
      <span className="text-4xl font-black text-white">
        {getFallbackLetter(title)}
      </span>
    </div>
  );
}

function PlaylistGrid({
  playlists,
  loading,
  error,
}: {
  playlists: UserPlaylist[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 animate-pulse"
          >
            <div className="aspect-square rounded-lg bg-zinc-900/60 shimmer" />
            <div className="mt-3 h-4 w-2/3 rounded bg-zinc-900/60 shimmer" />
            <div className="mt-2 h-3 w-1/2 rounded bg-zinc-900/60 shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <EmptyState
        icon={<PlaylistIcon size={24} />}
        title="No playlists yet."
        description="Create playlists to organize your favorite tracks."
        actionLabel="Create playlist"
        href="/playlists"
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {playlists.map((playlist) => {
        const title = playlist.title || playlist.name || "Playlist";
        const trackCount = playlist.track_count ?? playlist.song_count ?? 0;

        return (
          <Link
            key={playlist.id}
            href={`/playlists/${playlist.id}`}
            className="group rounded-xl border border-zinc-900/60 bg-zinc-950/40 p-3 transition hover:border-zinc-800 hover:bg-zinc-900/30"
          >
            <PlaylistCover playlist={playlist} />
            <div className="mt-3 min-w-0">
              <h3 className="truncate text-sm font-bold text-white transition group-hover:text-orange-400">
                {title}
              </h3>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {trackCount} tracks &middot; {playlist.is_public ? "Public" : "Private"}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function FollowingList({
  following,
  actionId,
  onToggleFollow,
}: {
  following: FollowedArtist[];
  actionId: string | null;
  onToggleFollow: (id: string, name: string) => void;
}) {
  if (following.length === 0) {
    return (
      <EmptyState
        icon={<UserIcon size={24} />}
        title="You are not following anyone yet"
        description="Explore artists and follow them to build your music profile."
        actionLabel="Explore music"
        href="/"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {following.map((artist) => {
        const targetId = artist.artist_id || artist.user_id;
        const artistName = getArtistDisplayName(artist);
        const avatarUrl = getArtistAvatarUrl(artist);
        const isActionLoading = actionId === targetId;

        return (
          <div
            key={`${artist.user_id}-${targetId}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-900 bg-zinc-950/50 p-3 transition hover:border-zinc-700 hover:bg-zinc-900/50"
          >
            <Link
              href={getUserProfilePath(artist.user_id)}
              className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-80"
            >
              <FollowingAvatar name={artistName} avatarUrl={avatarUrl} />

              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-white transition hover:text-orange-400">
                  {artistName}
                </h3>
                <p className="truncate text-xs text-zinc-500">
                  {artist.artist_id ? "Artist" : "User"}
                </p>
              </div>
            </Link>

            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => onToggleFollow(targetId, artistName)}
              className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isActionLoading ? "..." : "Unfollow"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FollowingAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <div
        className="h-11 w-11 rounded-full bg-zinc-900 bg-cover bg-center"
        style={{ backgroundImage: `url(${avatarUrl})` }}
        role="img"
        aria-label={`${name} avatar`}
      />
    );
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-zinc-950 text-sm font-black text-white">
      {getFallbackLetter(name)}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    accessToken,
    isLoading: authLoading,
    logout,
    fetchCurrentUser,
  } = useAuth();
  const { following, toggleFollow, actionId } = useFollow();
  const {
    playlists,
    isLoading: playlistsLoading,
    error: playlistsError,
  } = usePlaylists();
  const {
    likedSongs,
    isLoading: likedLoading,
    error: likedError,
  } = useLikes();
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [myTracks, setMyTracks] = useState<Song[]>([]);
  const [myTracksLoading, setMyTracksLoading] = useState(true);
  const [myTracksError, setMyTracksError] = useState<string | null>(null);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedSong[]>(
    [],
  );
  const [recentlyPlayedLoading, setRecentlyPlayedLoading] = useState(true);
  const [recentlyPlayedError, setRecentlyPlayedError] = useState<string | null>(
    null,
  );
  const [profile, setProfile] = useState<EditableProfile>({
    username: user?.username ?? "User",
    bio: "",
    avatarUrl: "",
  });
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [activeFollowModal, setActiveFollowModal] = useState<"followers" | "following" | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        setProfile({
          username: user.displayName || user.username || "User",
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl ?? "",
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  const loadMyTracks = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!user || !accessToken) {
        setMyTracks([]);
        setMyTracksLoading(false);
        setMyTracksError(null);
        return;
      }

      if (!quiet) {
        setMyTracksLoading(true);
      }

      setMyTracksError(null);

      try {
        const result = await getMySongsRequest(accessToken, 1, 100);
        setMyTracks(result.items);
      } catch (tracksError) {
        setMyTracks([]);
        setMyTracksError(
          tracksError instanceof Error
            ? tracksError.message
            : "Could not load your tracks.",
        );
      } finally {
        if (!quiet) {
          setMyTracksLoading(false);
        }
      }
    },
    [accessToken, user],
  );

  useEffect(() => {
    let isMounted = true;

    if (authLoading) {
      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        void loadMyTracks();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [authLoading, loadMyTracks]);

  useEffect(() => {
    let isMounted = true;

    if (!user || !accessToken) {
      return () => {
        isMounted = false;
      };
    }

    const pendingUploadedSongId = consumePendingUploadedSongId();

    if (pendingUploadedSongId) {
      queueMicrotask(() => {
        if (isMounted) {
          void loadMyTracks({ quiet: true });
        }
      });
    }

    const handleSongCatalogUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SongCatalogUpdatedDetail>).detail;

      if (detail?.song && isOwnTrack(detail.song, user.id, user.username)) {
        setMyTracks((currentTracks) => [
          detail.song as Song,
          ...currentTracks.filter((song) => song.id !== detail.song?.id),
        ]);
      }

      void loadMyTracks({ quiet: true });
    };

    window.addEventListener(
      SONG_CATALOG_UPDATED_EVENT,
      handleSongCatalogUpdated,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        SONG_CATALOG_UPDATED_EVENT,
        handleSongCatalogUpdated,
      );
    };
  }, [accessToken, loadMyTracks, user]);

  useEffect(() => {
    let isMounted = true;

    const loadLocalHistory = () => {
      if (isMounted) {
        setRecentlyPlayed(getLocalRecentlyPlayed());
        setRecentlyPlayedLoading(false);
        setRecentlyPlayedError(null);
      }
    };

    if (authLoading) {
      return () => {
        isMounted = false;
      };
    }

    queueMicrotask(() => {
      if (isMounted) {
        setRecentlyPlayedLoading(true);
        setRecentlyPlayedError(null);
      }
    });

    if (!accessToken) {
      loadLocalHistory();
      window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadLocalHistory);

      return () => {
        isMounted = false;
        window.removeEventListener(
          RECENTLY_PLAYED_UPDATED_EVENT,
          loadLocalHistory,
        );
      };
    }

    void getRecentlyPlayedRequest(accessToken)
      .then((items) => {
        if (isMounted) {
          setRecentlyPlayed(items as RecentlyPlayedSong[]);
        }
      })
      .catch((historyError) => {
        if (!isMounted) return;

        setRecentlyPlayed(getLocalRecentlyPlayed());
        setRecentlyPlayedError(
          historyError instanceof Error
            ? historyError.message
            : "Could not load recently played tracks.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setRecentlyPlayedLoading(false);
        }
      });

    window.addEventListener(RECENTLY_PLAYED_UPDATED_EVENT, loadLocalHistory);

    return () => {
      isMounted = false;
      window.removeEventListener(
        RECENTLY_PLAYED_UPDATED_EVENT,
        loadLocalHistory,
      );
    };
  }, [accessToken, authLoading]);

  const profileCounts = useMemo<Record<ProfileTab, number | null>>(
    () => ({
      overview: null,
      tracks: myTracks.length,
      playlists: playlists.length,
      following: user?.followingCount ?? following.length,
      liked: likedSongs.length,
    }),
    [user?.followingCount, following.length, likedSongs.length, myTracks.length, playlists.length],
  );

  if (!user) {
    return null;
  }

  const username = profile.username || user.username || "User";
  const avatarUrl = resolveApiAssetUrl(profile.avatarUrl);
  const roleLabel = user.role || "user";
  const profileLabel = myTracks.length > 0 ? "Artist" : "Profile";
  const canShowArtistActions = roleLabel === "admin" || myTracks.length > 0;

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleSaveProfile = async (nextProfile: EditProfileSavePayload) => {
    if (!accessToken) {
      setProfileError("You need to log in before editing your profile.");
      return;
    }

    setProfileSaving(true);
    setProfileError(null);

    try {
      let updatedUser = await updateCurrentUserRequest(
        {
          displayName: nextProfile.username,
          bio: nextProfile.bio || null,
        },
        accessToken,
      );

      if (nextProfile.avatarFile) {
        updatedUser = await uploadCurrentUserAvatarRequest(
          nextProfile.avatarFile,
          accessToken,
        );
      }

      setProfile({
        username: updatedUser.displayName || updatedUser.username || "User",
        bio: updatedUser.bio ?? "",
        avatarUrl: updatedUser.avatarUrl ?? "",
      });
      await fetchCurrentUser();
      setEditProfileOpen(false);
    } catch (saveError) {
      setProfileError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save profile.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const renderTabContent = () => {
    if (activeTab === "tracks") {
      return (
        <ContentBlock
          title="My tracks"
          description="Tracks connected to your artist profile."
        >
          <TrackListSection
            songs={myTracks}
            loading={myTracksLoading}
            error={myTracksError}
            emptyTitle="You haven't uploaded any tracks yet."
            emptyDescription="Upload your first track to start building your profile."
            actionLabel="Upload track"
            href="/upload"
          />
        </ContentBlock>
      );
    }

    if (activeTab === "playlists") {
      return (
        <ContentBlock
          title="Playlists"
          description="Your public and private playlists."
        >
          <PlaylistGrid
            playlists={playlists}
            loading={playlistsLoading}
            error={playlistsError}
          />
        </ContentBlock>
      );
    }

    if (activeTab === "following") {
      return (
        <ContentBlock
          title="Following"
          description="Artists and profiles you follow."
        >
          <FollowingList
            following={following}
            actionId={actionId}
            onToggleFollow={(id, name) => {
              void toggleFollow(id, name);
            }}
          />
        </ContentBlock>
      );
    }

    if (activeTab === "liked") {
      return (
        <ContentBlock
          title="Liked songs"
          description="Tracks you recently liked."
        >
          <TrackListSection
            songs={likedSongs}
            loading={likedLoading}
            error={likedError}
            emptyTitle="No liked songs yet"
            emptyDescription="Like tracks to collect them here."
          />
        </ContentBlock>
      );
    }

    return (
      <div className="space-y-6">
        <ContentBlock
          title="Recent activity"
          description="Tracks you played recently."
        >
          <CompactRecentActivitySection
            songs={recentlyPlayed.slice(0, 5)}
            loading={recentlyPlayedLoading}
            error={recentlyPlayedError}
            emptyTitle="No recently played tracks"
            emptyDescription="Tracks you play will appear here."
          />
        </ContentBlock>

        <ContentBlock title="Playlists" description="Your latest playlists.">
          <div className="space-y-4">
            <PlaylistGrid
              playlists={playlists.slice(0, 4)}
              loading={playlistsLoading}
              error={playlistsError}
            />
            {playlists.length > 4 && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab("playlists")}
                  className="text-xs font-bold text-orange-400 hover:text-orange-300 transition"
                >
                  View all playlists &rarr;
                </button>
              </div>
            )}
          </div>
        </ContentBlock>
      </div>
    );
  };

  return (
    <>
      {editProfileOpen && (
        <EditProfileModal
          initialProfile={profile}
          saving={profileSaving}
          error={profileError}
          onCancel={() => {
            if (!profileSaving) {
              setEditProfileOpen(false);
              setProfileError(null);
            }
          }}
          onSave={handleSaveProfile}
        />
      )}

      <div className="space-y-6 page-fade-in pb-32">
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
        {/* Banner area */}
        <div className="relative h-36 sm:h-48 w-full bg-gradient-to-r from-zinc-800 via-zinc-900 to-orange-950/40">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        
        {/* Profile info area */}
        <div className="px-4 pb-6 sm:px-6 lg:px-8 relative z-10">
          {/* Avatar floating and buttons */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 md:-mt-20 gap-4 mb-5">
            <ProfileAvatar username={username} avatarUrl={avatarUrl} />
            
            {/* Desktop Actions */}
            <div className="hidden sm:flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setProfileError(null);
                  setEditProfileOpen(true);
                }}
                className="rounded-full border border-zinc-700 bg-black/35 px-5 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-200"
              >
                Edit profile
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-red-500/30 bg-black/35 px-5 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
              >
                Log out
              </button>

              {canShowArtistActions && (
                <Link
                  href="/upload"
                  className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-black text-orange-950 transition hover:bg-orange-400"
                >
                  Upload track
                </Link>
              )}

              {roleLabel === "admin" && (
                <Link
                  href="/admin/songs"
                  className="rounded-full border border-zinc-700 bg-black/35 px-5 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-zinc-500 hover:bg-black/60 hover:text-white"
                >
                  Manage tracks
                </Link>
              )}
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
                  {profileLabel}
                </span>
                {roleLabel !== "user" && (
                  <span className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                    Role: {roleLabel}
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {username}
                </h1>
                <p className="text-sm text-zinc-450 mt-0.5">
                  {user.email}
                </p>
                {profile.bio && (
                  <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-300">
                    {profile.bio}
                  </p>
                )}
              </div>

              {/* Profile Stats with premium styling and responsive wrapping */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider select-none pt-1">
                <button
                  type="button"
                  onClick={() => setActiveFollowModal("followers")}
                  className="hover:text-white transition cursor-pointer focus:outline-none text-left"
                >
                  <span className="text-white font-extrabold mr-1">{user.followersCount ?? 0}</span>
                  {user.followersCount === 1 ? "follower" : "followers"}
                </button>
                <span className="text-zinc-800 hidden sm:inline select-none">&bull;</span>
                <button
                  type="button"
                  onClick={() => setActiveFollowModal("following")}
                  className="hover:text-white transition cursor-pointer focus:outline-none text-left"
                >
                  <span className="text-white font-extrabold mr-1">{user.followingCount ?? following.length}</span>
                  following
                </button>
                <span className="text-zinc-800 hidden sm:inline select-none">&bull;</span>
                <div>
                  <span className="text-white font-extrabold mr-1">{myTracks.length}</span>
                  tracks
                </div>
                <span className="text-zinc-800 hidden sm:inline select-none">&bull;</span>
                <div>
                  <span className="text-white font-extrabold mr-1">{playlists.length}</span>
                  playlists
                </div>
              </div>
            </div>

            {/* Mobile Actions: clean grid and primary/secondary layout hierarchy */}
            <div className="flex sm:hidden flex-col gap-2.5 pt-3.5 border-t border-zinc-900/60 w-full">
              {canShowArtistActions && (
                <Link
                  href="/upload"
                  className="flex h-11 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-orange-950 transition active:scale-[0.98] shadow-md shadow-orange-500/10"
                >
                  Upload track
                </Link>
              )}

              {roleLabel === "admin" && (
                <Link
                  href="/admin/songs"
                  className="flex h-11 items-center justify-center rounded-full border border-zinc-700 bg-black/35 text-sm font-bold text-zinc-200 transition active:scale-[0.98]"
                >
                  Manage tracks
                </Link>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setProfileError(null);
                    setEditProfileOpen(true);
                  }}
                  className="flex h-11 items-center justify-center rounded-full border border-zinc-700 bg-black/35 text-sm font-bold text-zinc-200 transition active:scale-[0.98]"
                >
                  Edit profile
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-11 items-center justify-center rounded-full border border-red-500/30 bg-black/35 text-sm font-bold text-red-300 transition active:scale-[0.98]"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950/50">
        <ProfileTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          counts={profileCounts}
        />

        <div className="p-4 sm:p-5">{renderTabContent()}</div>
      </section>
      </div>

      {activeFollowModal && (
        <FollowListModal
          userId={user.id}
          type={activeFollowModal}
          title={activeFollowModal === "followers" ? "Followers" : "Following"}
          onClose={() => setActiveFollowModal(null)}
        />
      )}
    </>
  );
}

function ContentBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black text-white">{title}</h2>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>
      {children}
    </section>
  );
}
