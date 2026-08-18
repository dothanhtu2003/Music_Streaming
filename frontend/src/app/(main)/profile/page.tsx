"use client";

import Link from "next/link";
import Image from "next/image";
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
import { RecentlyPlayedList } from "@/components/song/RecentlyPlayedList";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlaylistIcon, UserIcon, PlayIcon, PauseIcon } from "@/components/ui/Icons";
import {
  getMySongsRequest,
  getRecentlyPlayed,
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
  RecentlyPlayedEntry,
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
    <nav className="overflow-x-auto no-scrollbar p-2 bg-[#09090b] border-b border-zinc-900/80 select-none">
      <div className="flex min-w-max items-center gap-2 px-2">
        {profileTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const count = counts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-xl cursor-pointer select-none flex items-center gap-2",
                isActive
                  ? "bg-gradient-to-r from-orange-500 to-pink-600 text-zinc-950 shadow-md shadow-orange-500/10 scale-[1.02]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-850"
              )}
            >
              <span className="relative z-10">{tab.label}</span>
              {count !== null && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-mono font-black border transition duration-300",
                  isActive
                    ? "bg-black/10 border-black/10 text-zinc-950"
                    : "bg-zinc-900/85 border-zinc-800 text-zinc-500"
                )}>
                  {formatPlayCount(count)}
                </span>
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
  const fallbackLetter = getFallbackLetter(username);

  return (
    <div className="group relative h-28 w-28 sm:h-36 sm:w-36 md:h-40 md:w-40 shrink-0 select-none">
      {/* Outer Rotating Glowing Ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-600 p-[2px] opacity-70 blur-[8px] transition-all duration-700 group-hover:opacity-100 group-hover:blur-[12px] animate-spin-slow" />
      
      {/* Inner Border Ring */}
      <div className="absolute -inset-[3px] rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-600 p-[3px] transition-all duration-500 group-hover:scale-[1.02]">
        <div className="h-full w-full rounded-full bg-zinc-950 p-[2px]">
          {avatarUrl ? (
            <div
              className="h-full w-full rounded-full bg-zinc-900 bg-cover bg-center border border-black/60 shadow-inner"
              style={{ backgroundImage: `url(${avatarUrl})` }}
              role="img"
              aria-label={`${username} avatar`}
            />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-zinc-900 to-zinc-950 text-orange-400 border border-black/60">
              <span className="text-5xl font-black tracking-tight sm:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-pink-500 to-purple-400 drop-shadow">
                {fallbackLetter}
              </span>
            </div>
          )}
        </div>
      </div>
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
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md select-none">
      <div className="w-full max-w-lg max-h-[88vh] sm:max-h-[calc(100vh-120px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-zinc-800/80 bg-[#09090b]/95 p-6 sm:p-8 shadow-2xl shadow-black/80 animate-in slide-in-from-bottom duration-300 dark-scrollbar">
        <div className="mb-6">
          <h2 className="text-xl font-black text-white tracking-tight">Edit profile</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Update your public profile details.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Display name / username
            </label>
            <input
              value={form.username}
              onChange={(event) => updateForm("username", event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-850 bg-zinc-950/50 px-4 py-3 text-sm font-semibold text-white outline-none transition duration-300 placeholder:text-zinc-650 focus:border-orange-500/50 focus:bg-zinc-950 focus:ring-1 focus:ring-orange-500/10"
              placeholder="Your display name"
              maxLength={40}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(event) => updateForm("bio", event.target.value)}
              className="mt-2 min-h-28 w-full resize-none rounded-xl border border-zinc-850 bg-zinc-950/50 px-4 py-3 text-sm font-medium text-white outline-none transition duration-300 placeholder:text-zinc-655 focus:border-orange-500/50 focus:bg-zinc-950 focus:ring-1 focus:ring-orange-500/10 leading-relaxed"
              placeholder="Tell listeners a little about you."
              maxLength={300}
            />
            <p className="mt-1 text-right text-[10px] text-zinc-600 font-mono">
              {form.bio.length}/300
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Avatar image
            </label>
            <div className="mt-2 flex items-center gap-4 rounded-xl border border-zinc-850 bg-zinc-950/30 p-4 backdrop-blur-sm">
              {avatarPreviewUrl ? (
                <div
                  className="h-16 w-16 shrink-0 rounded-full bg-zinc-900 bg-cover bg-center border border-zinc-800 shadow-md shadow-black/20"
                  style={{ backgroundImage: `url(${avatarPreviewUrl})` }}
                  role="img"
                  aria-label="Avatar preview"
                />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-pink-600 text-xl font-black text-white shadow-md shadow-black/20">
                  {getFallbackLetter(form.username)}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    handleAvatarChange(event.target.files?.[0] ?? null);
                  }}
                  className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-500/10 file:border file:border-orange-500/20 file:text-orange-400 file:px-3.5 file:py-1.5 file:text-xs file:font-black hover:file:bg-orange-500/20 file:cursor-pointer file:transition-all cursor-pointer"
                />
                <p className="text-[10px] text-zinc-650 font-medium">
                  JPG, PNG, or WebP. Max 2MB.
                </p>
              </div>
            </div>
          </div>

          {(formError || error) && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-400 animate-pulse">
              {formError || error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-5 py-2.5 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-600 px-6 py-2.5 text-xs font-bold text-zinc-950 transition hover:opacity-95 hover:shadow-lg hover:shadow-orange-500/10 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
        "group flex items-center justify-between gap-4 rounded-xl border border-zinc-900/60 bg-zinc-950/20 p-2.5 transition hover:border-zinc-800 hover:bg-zinc-900/30 relative overflow-hidden",
        isCurrentSong && "border-orange-500/20 bg-orange-500/[0.02]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 z-10">
        {/* Cover Art Wrapper with Vinyl */}
        <div className="relative h-12 w-12 shrink-0 select-none">
          {/* Vinyl Disc Behind */}
          <div className="absolute top-0.5 left-0.5 w-11 h-11 rounded-full bg-[#111] border-2 border-zinc-700/80 flex items-center justify-center transition-all duration-500 group-hover:translate-x-3.5 group-hover:rotate-180 z-0 shadow-md">
            {/* Grooves */}
            <div className="w-8 h-8 rounded-full border border-zinc-800/80 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-orange-500/80 flex items-center justify-center border border-black/40">
                <div className="w-1.5 h-1.5 rounded-full bg-black" />
              </div>
            </div>
          </div>

          {/* Front Cover Container */}
          <Link
            href={`/songs/${song.id}`}
            className="relative h-12 w-12 block overflow-hidden rounded-lg border border-zinc-900 bg-zinc-900/60 bg-cover bg-center z-10"
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
              <span className="rounded-full bg-orange-500 p-2 text-orange-950 hover:bg-orange-400 transition transform scale-90">
                {isCurrentSong && isPlaying ? (
                  <PauseIcon size={12} />
                ) : (
                  <PlayIcon size={12} className="ml-0.5" />
                )}
              </span>
            </div>
          </Link>
        </div>

        {/* Text information */}
        <div className="min-w-0 flex-1 pl-1">
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
                className="hover:text-orange-400 transition font-medium truncate max-w-[150px] inline-block font-semibold"
              >
                {artistName}
              </Link>
            ) : (
              <span className="truncate max-w-[150px] inline-block font-semibold">{artistName}</span>
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
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-orange-500 hover:text-orange-950 hover:border-orange-500 transition group-hover:border-zinc-700 md:opacity-0 group-hover:opacity-100 focus:opacity-100 z-10",
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
  const [imageError, setImageError] = useState(false);
  const coverUrl = resolveApiAssetUrl(
    playlist.custom_cover_url ?? playlist.cover_url,
  );
  const title = playlist.title || playlist.name || "Playlist";

  if (coverUrl && !imageError) {
    return (
      <div className="relative aspect-square w-full">
        <Image
          src={coverUrl}
          alt={`${title} cover`}
          fill
          sizes="(max-width: 640px) 50vw, 240px"
          unoptimized
          className="rounded-lg bg-zinc-900 object-cover"
          onError={() => setImageError(true)}
        />
      </div>
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
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedEntry[]>(
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

    void getRecentlyPlayed(20, accessToken)
      .then((items) => {
        if (isMounted) {
          setRecentlyPlayed(items);
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
          description="Songs and playlists you played recently."
        >
          {recentlyPlayed.length === 0 || recentlyPlayedLoading || recentlyPlayedError ? (
            <CompactRecentActivitySection
              songs={[]}
              loading={recentlyPlayedLoading}
              error={recentlyPlayedError}
              emptyTitle="No recently played items"
              emptyDescription="Start listening to see your recently played songs and playlists."
            />
          ) : (
            <RecentlyPlayedList items={recentlyPlayed} limit={5} />
          )}
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
        <div className="relative h-44 sm:h-60 w-full bg-[#08080f] overflow-hidden border-b border-white/5 select-none">
          {/* Animated gradient mesh bubbles */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[100%] rounded-full bg-gradient-to-br from-orange-600/20 to-pink-600/5 blur-[80px] animate-ambient-1" />
          <div className="absolute top-[30%] right-[-10%] w-[50%] h-[90%] rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/5 blur-[95px] animate-ambient-2" />
          <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[80%] rounded-full bg-gradient-to-tr from-pink-600/15 to-orange-500/5 blur-[85px] animate-ambient-3" />
          
          {/* Cyber grid and scanlines */}
          <div className="absolute inset-0 cyber-grid opacity-[0.4]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.001)_50%,rgba(0,0,0,0.08)_50%)] bg-[size:100%_4px]" />
          
          {/* Subtle gradient vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-black/30 z-10" />
        </div>
               {/* Profile info area */}
        <div className="px-4 pb-6 sm:px-6 lg:px-8 relative z-10">
          {/* Avatar floating and buttons */}
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-end sm:justify-between sm:text-left -mt-12 sm:-mt-16 md:-mt-20 gap-4 mb-4">
            <ProfileAvatar username={username} avatarUrl={avatarUrl} />
            
            {/* Desktop Actions */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 select-none">
              <button
                type="button"
                onClick={() => {
                  setProfileError(null);
                  setEditProfileOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900/40 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/40 transition-all duration-300 cursor-pointer active:scale-95 select-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 shrink-0"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Edit profile
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl bg-zinc-900/10 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-all duration-300 cursor-pointer active:scale-95 select-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 group-hover:text-red-400 shrink-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                Log out
              </button>

              {canShowArtistActions && (
                <Link
                  href="/upload"
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-600 px-4.5 py-2 text-xs font-bold text-zinc-950 hover:opacity-90 hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] transition-all duration-300 active:scale-95 select-none cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  Upload track
                </Link>
              )}

              {roleLabel === "admin" && (
                <Link
                  href="/admin/songs"
                  className="flex items-center gap-1.5 rounded-xl bg-zinc-900/10 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all duration-300 cursor-pointer active:scale-95 select-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500 shrink-0"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>
                  Manage tracks
                </Link>
              )}
            </div>
          </div>

          {/* Details list */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
                {profileLabel}
              </span>
              {roleLabel !== "user" && (
                <span className="inline-flex rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-300">
                  Role: {roleLabel}
                </span>
              )}
            </div>

            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white">
                {username}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                {user.email}
              </p>
              {profile.bio && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-zinc-900/60 to-purple-500/10 px-4 py-1.5 text-xs font-medium italic text-zinc-200 backdrop-blur-md shadow-sm max-w-xs sm:max-w-md">
                  <span className="text-orange-400 font-serif font-black not-italic text-sm">“</span>
                  <span className="truncate">{profile.bio}</span>
                  <span className="text-orange-400 font-serif font-black not-italic text-sm">”</span>
                </div>
              )}
            </div>

            {/* MOBILE 1-LINE STAT BAR */}
            <div className="flex sm:hidden items-center justify-center gap-3 py-2.5 border-y border-zinc-900/80 my-3 text-center">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="group/stat flex-1"
              >
                <span className="block text-base font-black text-white font-mono group-hover/stat:text-orange-400">{user.followersCount ?? 0}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Followers</span>
              </button>
              <span className="h-5 w-px bg-zinc-850" />
              <button
                type="button"
                onClick={() => setActiveFollowModal("following")}
                className="group/stat flex-1"
              >
                <span className="block text-base font-black text-white font-mono group-hover/stat:text-purple-400">{user.followingCount ?? following.length}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Following</span>
              </button>
              <span className="h-5 w-px bg-zinc-850" />
              <div className="flex-1">
                <span className="block text-base font-black text-white font-mono">{myTracks.length}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Tracks</span>
              </div>
              <span className="h-5 w-px bg-zinc-850" />
              <div className="flex-1">
                <span className="block text-base font-black text-white font-mono">{playlists.length}</span>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Playlists</span>
              </div>
            </div>

            {/* MOBILE COMPACT ACTION BUTTONS */}
            <div className="flex sm:hidden items-center justify-center gap-2 pt-1 w-full max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  setProfileError(null);
                  setEditProfileOpen(true);
                }}
                className="inline-flex h-9 px-5 items-center justify-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 text-xs font-bold text-zinc-200 transition active:scale-95 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 shrink-0"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Edit
              </button>

              {canShowArtistActions && (
                <Link
                  href="/upload"
                  className="inline-flex h-9 px-5 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-pink-600 text-xs font-black text-zinc-950 transition active:scale-95 shadow-md shadow-orange-500/10 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  Upload
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 px-4 items-center justify-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 text-xs font-bold text-red-400 transition active:scale-95 cursor-pointer"
              >
                Log Out
              </button>
            </div>

            {/* DESKTOP STATS GRID */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 max-w-2xl select-none">
              <button
                type="button"
                onClick={() => setActiveFollowModal("followers")}
                className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-orange-500/40 p-4 rounded-xl text-left transition-all duration-300 cursor-pointer focus:outline-none hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(249,115,22,0.1)] flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-orange-400">Followers</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{user.followersCount ?? 0}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-orange-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>

              <button
                type="button"
                onClick={() => setActiveFollowModal("following")}
                className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-purple-500/40 p-4 rounded-xl text-left transition-all duration-300 cursor-pointer focus:outline-none hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(168,85,247,0.1)] flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-purple-400">Following</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{user.followingCount ?? following.length}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-purple-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              </button>

              <div className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-cyan-500/40 p-4 rounded-xl text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(6,182,212,0.1)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-cyan-400">Tracks</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{myTracks.length}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-cyan-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>

              <div className="group/stat relative bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 hover:border-pink-500/40 p-4 rounded-xl text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(236,72,153,0.1)] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider transition duration-300 group-hover/stat:text-pink-400">Playlists</p>
                  <p className="text-2xl font-black text-white tracking-tight mt-0.5 font-mono">{playlists.length}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-hover/stat:text-pink-500 group-hover/stat:scale-110 group-hover/stat:drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] transition-all duration-300 shrink-0 ml-2"><path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M3 10h18"/><path d="M10 21V10"/></svg>
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
    <section className="space-y-4 p-5 rounded-2xl bg-zinc-950/40 border border-zinc-900/80 backdrop-blur-sm shadow-xl shadow-black/10 animate-[page-fade-in_300ms_ease-out] hover:border-zinc-800/40 transition-colors duration-300">
      <div className="flex flex-col gap-1 border-b border-zinc-900/60 pb-3">
        <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
        <p className="text-xs text-zinc-500 font-medium">{description}</p>
      </div>
      <div className="pt-1">{children}</div>
    </section>
  );
}
