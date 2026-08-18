"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/components/auth/AuthProvider";
import { getGenresRequest, uploadTrackRequest } from "@/lib/api";
import { notifySongUploaded } from "@/lib/song-events";
import type { GenreRecord, Song } from "@/types/music";

type UploadStatus = "pending" | "uploading" | "success" | "error";

type UploadTrack = {
  id: string;
  file: File;
  title: string;
  durationSec: number | null;
  coverFile: File | null;
  coverPreviewUrl: string | null;
  coverError: string | null;
  status: UploadStatus;
  message: string;
};

type Notice = {
  type: "success" | "error";
  text: string;
};

type UploadSummary = {
  total: number;
  success: number;
  failed: number;
};

const AUDIO_MAX_SIZE_MB = 20;
const AUDIO_MAX_SIZE = AUDIO_MAX_SIZE_MB * 1024 * 1024;
const COVER_MAX_SIZE_MB = 5;
const COVER_MAX_SIZE = COVER_MAX_SIZE_MB * 1024 * 1024;
const audioTitleExtensions = /\.(mp3|wav|m4a|flac|aac)$/i;

const statusLabels: Record<UploadStatus, string> = {
  pending: "Ready",
  uploading: "Uploading",
  success: "Success",
  error: "Failed",
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isMp3File(file: File) {
  return file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3");
}

function isCoverFile(file: File) {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const lowerName = file.name.toLowerCase();

  return (
    validTypes.includes(file.type) ||
    validExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

function getDefaultTitle(fileName: string) {
  return fileName
    .replace(audioTitleExtensions, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDuration(durationSec: number | null) {
  if (durationSec === null) {
    return "Not detected";
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getAudioDurationSec(file: File) {
  return new Promise<number | null>((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute("src");
      audio.load();
    };

    const finish = (duration: number | null) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(duration);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration)
        ? Math.max(0, Math.round(audio.duration))
        : null;

      finish(duration);
    };
    audio.onerror = () => finish(null);
    audio.src = objectUrl;

    window.setTimeout(() => finish(null), 5000);
  });
}

function revokeCoverPreview(previewUrl: string | null) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
}

function revokeTrackCoverPreviews(tracks: UploadTrack[]) {
  tracks.forEach((track) => revokeCoverPreview(track.coverPreviewUrl));
}

function getStatusClass(status: UploadStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }

  if (status === "error") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-400";
  }

  if (status === "uploading") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  }

  return "border-zinc-800 bg-zinc-900/60 text-zinc-400";
}

function safeNotifySongUploaded(song: Song) {
  try {
    if (song?.id) {
      notifySongUploaded(song);
    }
  } catch {
    // Upload success should not depend on refreshing other song lists.
  }
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.type === "success";

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 text-sm ${
        isSuccess
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-300"
      }`}
    >
      {isSuccess ? (
        <svg className="h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
      <span>{notice.text}</span>
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [genreId, setGenreId] = useState("");
  const [description, setDescription] = useState("");
  const [genres, setGenres] = useState<GenreRecord[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [tracks, setTracks] = useState<UploadTrack[]>([]);
  const [tracksInputKey, setTracksInputKey] = useState(0);
  const [sharedCoverFile, setSharedCoverFile] = useState<File | null>(null);
  const [sharedCoverPreviewUrl, setSharedCoverPreviewUrl] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const tracksRef = useRef<UploadTrack[]>([]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    return () => {
      revokeTrackCoverPreviews(tracksRef.current);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadGenres = async () => {
      try {
        setGenresLoading(true);
        const result = await getGenresRequest(1, 100);

        if (isMounted) {
          setGenres(result.items);
        }
      } catch (genresError) {
        if (isMounted) {
          const message = getErrorMessage(genresError, "Could not load genres.");
          setFormError(message);
          setNotice({ type: "error", text: message });
        }
      } finally {
        if (isMounted) {
          setGenresLoading(false);
        }
      }
    };

    void loadGenres();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sharedCoverFile) {
      queueMicrotask(() => setSharedCoverPreviewUrl(null));
      return;
    }

    const url = URL.createObjectURL(sharedCoverFile);
    queueMicrotask(() => setSharedCoverPreviewUrl(url));

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [sharedCoverFile]);

  const updateTrack = (trackId: string, patch: Partial<UploadTrack>) => {
    setTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    );
  };

  const validateTrack = (track: UploadTrack) => {
    if (!isMp3File(track.file)) {
      return "Only MP3 files are supported.";
    }

    if (track.file.size > AUDIO_MAX_SIZE) {
      return `Audio file must be ${AUDIO_MAX_SIZE_MB}MB or less.`;
    }

    if (track.title.trim().length < 2) {
      return "Title must be at least 2 characters.";
    }

    if (track.coverError) {
      return track.coverError;
    }

    if (track.coverFile && !isCoverFile(track.coverFile)) {
      return "Cover must be JPG, PNG, or WebP.";
    }

    if (track.coverFile && track.coverFile.size > COVER_MAX_SIZE) {
      return `Cover file must be ${COVER_MAX_SIZE_MB}MB or less.`;
    }

    return null;
  };

  const handleAudioChange = useCallback(async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);

    setFormError(null);
    setNotice(null);
    setSummary(null);

    const nextTracks = selectedFiles.map((file, index) => {
      const isValidAudio = isMp3File(file);
      const isValidSize = file.size <= AUDIO_MAX_SIZE;
      let message = "Ready";

      if (!isValidAudio) {
        message = "Only MP3 files are supported.";
      } else if (!isValidSize) {
        message = `Audio file must be ${AUDIO_MAX_SIZE_MB}MB or less.`;
      }

      return {
        id: `${Date.now()}-${tracksRef.current.length + index}-${file.lastModified}-${file.name}`,
        file,
        title: getDefaultTitle(file.name),
        durationSec: null,
        coverFile: null,
        coverPreviewUrl: null,
        coverError: null,
        status: isValidAudio && isValidSize ? "pending" as UploadStatus : "error" as UploadStatus,
        message,
      };
    });

    setTracks((currentTracks) => [...currentTracks, ...nextTracks]);

    await Promise.all(
      nextTracks.map(async (track) => {
        if (track.status === "error") {
          return;
        }

        const durationSec = await getAudioDurationSec(track.file);

        updateTrack(track.id, {
          durationSec,
          message: durationSec === null ? "Ready. Duration not detected." : "Ready",
        });
      }),
    );
  }, []);

  const removeTrack = (trackId: string) => {
    const track = tracksRef.current.find((item) => item.id === trackId);

    if (track) {
      revokeCoverPreview(track.coverPreviewUrl);
    }

    setTracks((currentTracks) =>
      currentTracks.filter((currentTrack) => currentTrack.id !== trackId),
    );
    setFormError(null);
    setNotice(null);
    setSummary(null);
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setIsDragActive(true);
      return;
    }

    if (event.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    if (event.dataTransfer.files.length > 0) {
      void handleAudioChange(event.dataTransfer.files);
    }
  };

  const handleTitleChange = (trackId: string, title: string) => {
    const track = tracksRef.current.find((item) => item.id === trackId);

    if (!track) {
      return;
    }

    const validationError = validateTrack({ ...track, title });

    updateTrack(trackId, {
      title,
      status: validationError ? "error" : "pending",
      message: validationError ?? "Ready",
    });
  };

  const handleSharedCoverChange = (file: File | null) => {
    setFormError(null);

    if (!file) {
      setSharedCoverFile(null);
      return;
    }

    if (!isCoverFile(file)) {
      setSharedCoverFile(null);
      setFormError("Shared cover must be JPG, PNG, or WebP.");
      return;
    }

    if (file.size > COVER_MAX_SIZE) {
      setSharedCoverFile(null);
      setFormError(`Shared cover file must be ${COVER_MAX_SIZE_MB}MB or less.`);
      return;
    }

    setSharedCoverFile(file);
  };

  const handleTrackCoverChange = (trackId: string, file: File | null) => {
    const track = tracksRef.current.find((item) => item.id === trackId);

    if (!track) {
      return;
    }

    revokeCoverPreview(track.coverPreviewUrl);

    if (!file) {
      const nextTrack = {
        ...track,
        coverFile: null,
        coverPreviewUrl: null,
        coverError: null,
      };
      const validationError = validateTrack(nextTrack);

      updateTrack(trackId, {
        coverFile: null,
        coverPreviewUrl: null,
        coverError: null,
        status: validationError ? "error" : "pending",
        message: validationError ?? "Ready",
      });
      return;
    }

    if (!isCoverFile(file)) {
      const message = "Cover must be JPG, PNG, or WebP.";

      updateTrack(trackId, {
        coverFile: null,
        coverPreviewUrl: null,
        coverError: message,
        status: "error",
        message,
      });
      return;
    }

    if (file.size > COVER_MAX_SIZE) {
      const message = `Cover file must be ${COVER_MAX_SIZE_MB}MB or less.`;

      updateTrack(trackId, {
        coverFile: null,
        coverPreviewUrl: null,
        coverError: message,
        status: "error",
        message,
      });
      return;
    }

    const nextTrack = {
      ...track,
      coverFile: file,
      coverPreviewUrl: null,
      coverError: null,
    };
    const validationError = validateTrack(nextTrack);

    updateTrack(trackId, {
      coverFile: file,
      coverPreviewUrl: URL.createObjectURL(file),
      coverError: null,
      status: validationError ? "error" : "pending",
      message: validationError ?? "Ready",
    });
  };

  const clearList = () => {
    revokeTrackCoverPreviews(tracksRef.current);
    setTracks([]);
    setSharedCoverFile(null);
    setGenreId("");
    setDescription("");
    setFormError(null);
    setNotice(null);
    setSummary(null);
    setTracksInputKey((currentKey) => currentKey + 1);
  };

  const handleUpload = async () => {
    if (!accessToken) {
      router.replace(`/login?redirect=${encodeURIComponent("/upload")}`);
      return;
    }

    if (tracks.length === 0) {
      setFormError("Select at least one MP3 file.");
      return;
    }

    if (!genreId) {
      setFormError("Genre is required.");
      return;
    }

    if (sharedCoverFile && (!isCoverFile(sharedCoverFile) || sharedCoverFile.size > COVER_MAX_SIZE)) {
      setFormError(`Shared cover must be JPG, PNG, or WebP and ${COVER_MAX_SIZE_MB}MB or less.`);
      return;
    }

    setUploading(true);
    setFormError(null);
    setNotice(null);
    setSummary(null);

    const validatedTracks = tracks.map((track) => {
      const validationError = validateTrack(track);

      if (validationError) {
        updateTrack(track.id, {
          status: "error",
          message: validationError,
        });
      }

      return {
        ...track,
        validationError,
      };
    });
    const uploadableTracks = validatedTracks.filter((track) => !track.validationError);

    if (uploadableTracks.length === 0) {
      setUploading(false);
      setSummary({
        total: tracks.length,
        success: 0,
        failed: tracks.length,
      });
      setFormError("No valid tracks to upload.");
      return;
    }

    let successCount = 0;
    let failedCount = tracks.length - uploadableTracks.length;

    for (const track of uploadableTracks) {
      try {
        updateTrack(track.id, {
          status: "uploading",
          message: "Uploading track...",
        });

        const song = await uploadTrackRequest(
          {
            title: track.title.trim(),
            genre_id: genreId,
            description,
            audioFile: track.file,
            coverFile: track.coverFile ?? sharedCoverFile,
          },
          accessToken,
        );

        successCount += 1;
        safeNotifySongUploaded(song);
        updateTrack(track.id, {
          status: "success",
          message: `Uploaded "${song.title}".`,
        });
      } catch (trackError) {
        failedCount += 1;
        updateTrack(track.id, {
          status: "error",
          message: getErrorMessage(trackError, "Could not upload this track."),
        });
      }
    }

    setSummary({
      total: tracks.length,
      success: successCount,
      failed: failedCount,
    });
    setNotice({
      type: successCount > 0 ? "success" : "error",
      text: `Upload finished: ${successCount} succeeded, ${failedCount} failed.`,
    });
    setUploading(false);
  };

  const completedCount = tracks.filter(
    (track) => track.status === "success" || track.status === "error",
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <NoticeBanner notice={notice} />

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-6 shadow-2xl md:p-8">
        <div className="mb-6 border-b border-zinc-800/80 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
                Upload
              </p>
              <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                Upload tracks
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Select multiple MP3 files, edit titles, and choose cover art for each track.
              </p>
            </div>

            {tracks.length > 0 && (
              <div className="self-start rounded-full border border-zinc-800/60 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 shadow-sm sm:self-center">
                <span className="text-orange-400">{completedCount}</span>
                <span className="font-normal text-zinc-500"> / {tracks.length} completed</span>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-5 md:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Genre
            <span className="ml-1 text-orange-500">*</span>
            <select
              value={genreId}
              onChange={(event) => setGenreId(event.target.value)}
              disabled={genresLoading || uploading}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm text-white outline-none shadow-inner transition hover:bg-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {genresLoading ? "Loading genres..." : "Select genre"}
              </option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={uploading}
              maxLength={5000}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-3 text-sm normal-case tracking-normal text-white outline-none shadow-inner transition hover:bg-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Optional note for all selected tracks"
            />
          </label>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Select audio files
            </span>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative flex h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                isDragActive
                  ? "border-orange-500 bg-orange-500/5"
                  : "border-zinc-800 bg-zinc-900/20 hover:border-zinc-700/80 hover:bg-zinc-900/40"
              } ${uploading ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
            >
              <input
                key={`tracks-${tracksInputKey}`}
                type="file"
                multiple
                accept=".mp3,audio/mpeg,audio/mp3"
                disabled={uploading}
                onChange={(event) => {
                  void handleAudioChange(event.target.files);
                  event.currentTarget.value = "";
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />

              <div className="mb-3 rounded-full border border-zinc-800 bg-zinc-900 p-2.5 text-zinc-400">
                <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-200">
                Drag and drop MP3 files here
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                or <span className="font-medium text-orange-400 underline hover:text-orange-300">click to browse</span>
              </p>
              <p className="mt-1.5 text-[10px] text-zinc-500">
                Maximum size: {AUDIO_MAX_SIZE_MB}MB per file
              </p>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Shared cover image
            </span>
            <div className="flex h-[160px] flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/10 p-5">
              <div className="flex min-w-0 items-center gap-4">
                {sharedCoverFile && sharedCoverPreviewUrl ? (
                  <div className="relative shrink-0">
                    <Image
                      src={sharedCoverPreviewUrl}
                      alt="Shared cover preview"
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-lg border border-zinc-800 object-cover shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => handleSharedCoverChange(null)}
                      disabled={uploading}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-300 transition hover:bg-rose-600 hover:text-white disabled:opacity-50"
                      aria-label="Remove shared cover"
                      title="Remove shared cover"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-800 bg-zinc-900/40 text-zinc-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-300">
                    Shared Cover Image
                  </p>
                  <p className="mt-0.5 text-[11px] leading-normal text-zinc-500">
                    Optional. Tracks without individual covers will use this.
                  </p>
                  {sharedCoverFile && (
                    <p className="mt-1 truncate text-[11px] font-medium text-orange-300">
                      {sharedCoverFile.name} ({formatFileSize(sharedCoverFile.size)})
                    </p>
                  )}
                </div>
              </div>

              <label className="inline-flex cursor-pointer self-start rounded-lg border border-zinc-800 bg-zinc-900/55 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-white has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-40">
                {sharedCoverFile ? "Change Cover" : "Choose Cover"}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) =>
                    handleSharedCoverChange(event.target.files?.[0] ?? null)
                  }
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-800/80 bg-zinc-900/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-orange-500/20 bg-orange-500/10 p-1.5 text-orange-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-xs text-zinc-400">
              Artist name will be saved as{" "}
              <span className="font-semibold text-zinc-200">
                {user?.displayName || user?.username || "your profile name"}
              </span>
              .
            </p>
          </div>
        </div>

        {formError && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {formError}
          </div>
        )}

        {summary && (
          <div className="mb-6 grid gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Tracks</p>
              <p className="mt-1 text-2xl font-bold text-white">{summary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Success</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{summary.success}</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">Failed</p>
              <p className="mt-1 text-2xl font-bold text-rose-400">{summary.failed}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Selected Tracks
            </h2>
            {tracks.length > 0 && (
              <span className="text-xs text-zinc-500">
                Edit titles and choose a cover for each track before uploading.
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-inner">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800 text-sm">
                <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-5 py-4 font-bold">File</th>
                    <th className="px-5 py-4 font-bold">Title</th>
                    <th className="px-5 py-4 font-bold">Duration</th>
                    <th className="px-5 py-4 font-bold">Cover</th>
                    <th className="px-5 py-4 font-bold">Status</th>
                    <th className="px-5 py-4 font-bold">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/65 bg-zinc-950/20">
                  {tracks.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center text-zinc-500" colSpan={6}>
                        No audio files selected yet. Drag and drop or browse above.
                      </td>
                    </tr>
                  ) : (
                    tracks.map((track) => (
                      <tr key={track.id} className="text-zinc-300 transition-colors hover:bg-zinc-900/35">
                        <td className="max-w-xs px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => removeTrack(track.id)}
                              disabled={uploading}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-400 transition hover:border-rose-500/50 hover:bg-rose-950/60 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`Remove ${track.title || track.file.name} from selected tracks`}
                              title="Remove track"
                            >
                              x
                            </button>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-zinc-100">
                                {track.file.name}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {formatFileSize(track.file.size)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-64 px-5 py-4">
                          <input
                            value={track.title}
                            onChange={(event) =>
                              handleTitleChange(track.id, event.target.value)
                            }
                            disabled={uploading || track.status === "success"}
                            maxLength={200}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-2 text-sm text-zinc-100 outline-none transition focus:border-orange-500 focus:bg-zinc-900/90 focus:ring-1 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-zinc-400">
                          {formatDuration(track.durationSec)}
                        </td>
                        <td className="min-w-52 px-5 py-4">
                          {track.coverFile && track.coverPreviewUrl ? (
                            <div className="flex items-center gap-3">
                              <div
                                className="h-10 w-10 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 bg-cover bg-center shadow-sm"
                                style={{ backgroundImage: `url(${track.coverPreviewUrl})` }}
                                role="img"
                                aria-label={`${track.title || track.file.name} cover`}
                              />
                              <span className="max-w-24 truncate text-xs font-medium text-zinc-400">
                                {track.coverFile.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleTrackCoverChange(track.id, null)}
                                disabled={uploading || track.status === "success"}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xs text-zinc-400 transition hover:bg-rose-950/60 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Remove cover for ${track.title}`}
                                title="Remove cover"
                              >
                                x
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="min-w-10 text-xs italic text-zinc-500">
                                {sharedCoverFile ? "Shared" : "None"}
                              </span>
                              <label className="inline-flex cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-white has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-45">
                                Choose
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                  disabled={uploading || track.status === "success"}
                                  onChange={(event) => {
                                    handleTrackCoverChange(
                                      track.id,
                                      event.target.files?.[0] ?? null,
                                    );
                                    event.currentTarget.value = "";
                                  }}
                                  className="sr-only"
                                />
                              </label>
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide shadow-sm ${getStatusClass(track.status)}`}>
                            {statusLabels[track.status]}
                          </span>
                        </td>
                        <td className="min-w-56 px-5 py-4 text-xs leading-relaxed text-zinc-500">
                          {track.message || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-zinc-900 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading || genresLoading || tracks.length === 0}
              className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-bold text-orange-950 shadow-md transition hover:bg-orange-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500"
            >
              {uploading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-zinc-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </span>
              ) : (
                "Upload All"
              )}
            </button>
            <button
              type="button"
              onClick={clearList}
              disabled={uploading || tracks.length === 0}
              className="rounded-lg border border-zinc-800 bg-zinc-900/25 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900/60 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear list
            </button>
          </div>

          {tracks.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <span>Total: <strong className="font-bold text-zinc-200">{tracks.length}</strong></span>
              {(completedCount > 0 || summary) && (
                <>
                  <span>Success: <strong className="font-bold text-emerald-400">{summary?.success ?? tracks.filter((track) => track.status === "success").length}</strong></span>
                  <span>Failed: <strong className="font-bold text-rose-400">{summary?.failed ?? tracks.filter((track) => track.status === "error").length}</strong></span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
