"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { useAuth } from "@/components/auth/AuthProvider";
import { getErrorMessage } from "@/lib/admin-format";
import {
  createSongRequest,
  getAlbumsRequest,
  getArtistsRequest,
  getGenresRequest,
  uploadAudioRequest,
  uploadCoverRequest,
} from "@/lib/api";
import { notifySongUploaded } from "@/lib/song-events";
import type { AlbumRecord, ArtistRecord, GenreRecord, Song } from "@/types/music";

type UploadFormState = {
  artist_id: string;
  album_id: string;
  genre_id: string;
};

type BulkUploadStatus =
  | "pending"
  | "uploading-cover"
  | "uploading-audio"
  | "creating-song"
  | "success"
  | "error";

type BulkTrack = {
  id: string;
  file: File;
  title: string;
  durationSec: number | null;
  coverFile: File | null;
  coverPreviewUrl: string | null;
  coverError: string | null;
  status: BulkUploadStatus;
  message: string;
};

type BulkSummary = {
  total: number;
  success: number;
  failed: number;
};

const emptyForm: UploadFormState = {
  artist_id: "",
  album_id: "",
  genre_id: "",
};

const audioTitleExtensions = /\.(mp3|wav|m4a|flac|aac)$/i;

const statusLabels: Record<BulkUploadStatus, string> = {
  pending: "Waiting",
  "uploading-cover": "Uploading Cover",
  "uploading-audio": "Uploading Audio",
  "creating-song": "Creating Song",
  success: "Success",
  error: "Failed",
};

function optionalValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
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

function revokeCoverPreview(previewUrl: string | null) {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
}

function revokeBulkTrackPreviews(tracks: BulkTrack[]) {
  tracks.forEach((track) => revokeCoverPreview(track.coverPreviewUrl));
}

function formatDuration(durationSec: number | null) {
  if (durationSec === null) {
    return "Not detected";
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getBulkStatusClass(status: BulkUploadStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }

  if (status === "error") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-400";
  }

  if (status === "uploading-cover" || status === "uploading-audio") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  }

  if (status === "creating-song") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }

  return "border-zinc-800 bg-zinc-900/60 text-zinc-400";
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

function safeNotifySongUploaded(song: Song) {
  try {
    if (song?.id) {
      notifySongUploaded(song);
    }
  } catch {
    // Catalog refresh is a convenience signal; upload success should remain success.
  }
}

export default function AdminUploadPage() {
  const { accessToken } = useAuth();
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [genres, setGenres] = useState<GenreRecord[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);
  const [bulkForm, setBulkForm] = useState<UploadFormState>(emptyForm);
  const [bulkTracks, setBulkTracks] = useState<BulkTrack[]>([]);
  const [bulkCoverFile, setBulkCoverFile] = useState<File | null>(null);
  const [bulkInputKey, setBulkInputKey] = useState(0);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSummary, setBulkSummary] = useState<BulkSummary | null>(null);
  const bulkTracksRef = useRef<BulkTrack[]>([]);
  const [bulkCoverPreview, setBulkCoverPreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!bulkCoverFile) {
      queueMicrotask(() => {
        setBulkCoverPreview(null);
      });
      return;
    }
    const url = URL.createObjectURL(bulkCoverFile);
    queueMicrotask(() => {
      setBulkCoverPreview(url);
    });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [bulkCoverFile]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleBulkAudioChange(e.dataTransfer.files);
    }
  };

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setBulkError(null);

    try {
      const [artistResult, albumResult, genreResult] = await Promise.all([
        getArtistsRequest(1, 100),
        getAlbumsRequest(1, 100),
        getGenresRequest(1, 100),
      ]);

      setArtists(artistResult.items);
      setAlbums(albumResult.items);
      setGenres(genreResult.items);
    } catch (optionsError) {
      setBulkError(
        getErrorMessage(optionsError, "Could not load form options."),
      );
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadOptions();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadOptions]);

  useEffect(() => {
    bulkTracksRef.current = bulkTracks;
  }, [bulkTracks]);

  useEffect(() => {
    return () => {
      revokeBulkTrackPreviews(bulkTracksRef.current);
    };
  }, []);

  const updateBulkForm = (key: keyof UploadFormState, value: string) => {
    setBulkForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const updateBulkTrack = (trackId: string, patch: Partial<BulkTrack>) => {
    setBulkTracks((currentTracks) =>
      currentTracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    );
  };

  const handleBulkAudioChange = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);

    setBulkError(null);
    setBulkSummary(null);

    const nextTracks = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${bulkTracksRef.current.length + index}-${file.lastModified}-${file.name}`,
      file,
      title: getDefaultTitle(file.name),
      durationSec: null,
      coverFile: null,
      coverPreviewUrl: null,
      coverError: null,
      status: "pending" as BulkUploadStatus,
      message: isMp3File(file) ? "Ready" : "Only MP3 files are supported.",
    }));

    setBulkTracks((currentTracks) => [...currentTracks, ...nextTracks]);

    await Promise.all(
      nextTracks.map(async (track) => {
        if (!isMp3File(track.file)) {
          updateBulkTrack(track.id, {
            status: "error",
            message: "Only MP3 files are supported by the current upload API.",
          });
          return;
        }

        const durationSec = await getAudioDurationSec(track.file);

        updateBulkTrack(track.id, {
          durationSec,
          message: durationSec === null ? "Ready. Duration will use fallback." : "Ready",
        });
      }),
    );
  };

  const removeBulkTrack = (trackId: string) => {
    const track = bulkTracksRef.current.find((item) => item.id === trackId);

    if (track) {
      revokeCoverPreview(track.coverPreviewUrl);
    }

    setBulkTracks((currentTracks) =>
      currentTracks.filter((currentTrack) => currentTrack.id !== trackId),
    );
    setBulkError(null);
    setBulkSummary(null);
  };

  const handleBulkTitleChange = (trackId: string, title: string) => {
    const track = bulkTracksRef.current.find((item) => item.id === trackId);
    const isAudioValid = track ? isMp3File(track.file) : true;
    const message = track?.coverError
      ? track.coverError
      : isAudioValid
        ? "Ready"
        : "Only MP3 files are supported by the current upload API.";

    updateBulkTrack(trackId, {
      title,
      status: isAudioValid && !track?.coverError ? "pending" : "error",
      message,
    });
  };

  const clearBulkList = () => {
    revokeBulkTrackPreviews(bulkTracksRef.current);
    setBulkTracks([]);
    setBulkCoverFile(null);
    setBulkForm(emptyForm);
    setBulkError(null);
    setBulkSummary(null);
    setBulkInputKey((currentKey) => currentKey + 1);
  };

  const handleTrackCoverChange = (trackId: string, file: File | null) => {
    const track = bulkTracksRef.current.find((item) => item.id === trackId);

    if (!track) {
      return;
    }

    revokeCoverPreview(track.coverPreviewUrl);

    if (!file) {
      const isAudioValid = isMp3File(track.file);

      updateBulkTrack(trackId, {
        coverFile: null,
        coverPreviewUrl: null,
        coverError: null,
        message: isAudioValid
          ? "Ready"
          : "Only MP3 files are supported by the current upload API.",
        status: isAudioValid ? "pending" : "error",
      });
      return;
    }

    if (!isCoverFile(file)) {
      const message = "Cover must be JPG, PNG, or WebP.";

      updateBulkTrack(trackId, {
        coverFile: null,
        coverPreviewUrl: null,
        coverError: message,
        status: "error",
        message,
      });
      return;
    }

    const isAudioValid = isMp3File(track.file);

    updateBulkTrack(trackId, {
      coverFile: file,
      coverPreviewUrl: URL.createObjectURL(file),
      coverError: null,
      status: isAudioValid ? "pending" : "error",
      message: isAudioValid
        ? "Ready"
        : "Only MP3 files are supported by the current upload API.",
    });
  };

  const removeTrackCover = (trackId: string) => {
    handleTrackCoverChange(trackId, null);
  };

  const getBulkDuration = (track: BulkTrack) => {
    return track.durationSec ?? 0;
  };

  const validateBulkTrack = (track: BulkTrack) => {
    const title = track.title.trim();
    const durationSec = getBulkDuration(track);

    if (!isMp3File(track.file)) {
      return "Only MP3 files are supported by the current upload API.";
    }

    if (title.length < 2) {
      return "Song title must be at least 2 characters.";
    }

    if (!Number.isInteger(durationSec) || durationSec < 0) {
      return "Duration must be a non-negative integer.";
    }

    if (track.coverError) {
      return track.coverError;
    }

    if (track.coverFile && !isCoverFile(track.coverFile)) {
      return "Cover must be JPG, PNG, or WebP.";
    }

    return null;
  };

  const handleBulkUpload = async () => {
    if (!accessToken) {
      setBulkError("Admin token is missing. Please login again.");
      return;
    }

    if (bulkTracks.length === 0) {
      setBulkError("Select at least one audio file.");
      return;
    }

    if (!bulkForm.artist_id) {
      setBulkError("Artist is required for bulk upload.");
      return;
    }

    if (bulkCoverFile && !isCoverFile(bulkCoverFile)) {
      setBulkError("Shared cover must be JPG, PNG, or WebP.");
      return;
    }

    setBulkUploading(true);
    setBulkError(null);
    setBulkSummary(null);
    setNotice(null);

    const validatedTracks = bulkTracks.map((track) => {
      const validationError = validateBulkTrack(track);

      if (validationError) {
        updateBulkTrack(track.id, {
          status: "error",
          message: validationError,
        });
      }

      return {
        ...track,
        validationError,
        durationSec: getBulkDuration(track),
      };
    });
    const uploadableTracks = validatedTracks.filter(
      (track) => !track.validationError,
    );

    if (uploadableTracks.length === 0) {
      setBulkUploading(false);
      setBulkSummary({
        total: bulkTracks.length,
        success: 0,
        failed: bulkTracks.length,
      });
      setBulkError("No valid tracks to upload.");
      return;
    }

    let sharedCoverUrl: string | null = null;
    let sharedCoverError: string | null = null;
    let successCount = 0;
    let failedCount = bulkTracks.length - uploadableTracks.length;

    try {
      if (bulkCoverFile) {
        const sharedCoverTracks = uploadableTracks.filter(
          (track) => !track.coverFile,
        );

        sharedCoverTracks.forEach((track) => {
          updateBulkTrack(track.id, {
            status: "uploading-cover",
            message: "Uploading shared cover...",
          });
        });

        try {
          sharedCoverUrl = await uploadCoverRequest(bulkCoverFile, accessToken);
        } catch (coverError) {
          sharedCoverError = getErrorMessage(
            coverError,
            "Could not upload shared cover.",
          );
          failedCount += sharedCoverTracks.length;

          sharedCoverTracks.forEach((track) => {
            updateBulkTrack(track.id, {
              status: "error",
              message: sharedCoverError || "Could not upload shared cover.",
            });
          });
        }
      }

      for (const track of uploadableTracks) {
        try {
          if (sharedCoverError && !track.coverFile) {
            continue;
          }

          let coverUrl = sharedCoverUrl;

          if (track.coverFile) {
            updateBulkTrack(track.id, {
              status: "uploading-cover",
              message: "Uploading track cover...",
            });

            coverUrl = await uploadCoverRequest(track.coverFile, accessToken);
          }

          updateBulkTrack(track.id, {
            status: "uploading-audio",
            message: "Uploading audio...",
          });

          const audioUrl = await uploadAudioRequest(track.file, accessToken);

          updateBulkTrack(track.id, {
            status: "creating-song",
            message: "Creating song record...",
          });

          const song = await createSongRequest(
            {
              title: track.title.trim(),
              artist_id: bulkForm.artist_id,
              album_id: optionalValue(bulkForm.album_id),
              genre_id: optionalValue(bulkForm.genre_id),
              file_url: audioUrl,
              cover_url: coverUrl,
              duration_sec: track.durationSec,
              is_active: true,
            },
            accessToken,
          );

          safeNotifySongUploaded(song);
          successCount += 1;
          updateBulkTrack(track.id, {
            status: "success",
            message: `Created "${song.title}".`,
          });
        } catch (trackError) {
          failedCount += 1;
          updateBulkTrack(track.id, {
            status: "error",
            message: getErrorMessage(trackError, "Could not upload this track."),
          });
        }
      }

      setBulkSummary({
        total: bulkTracks.length,
        success: successCount,
        failed: failedCount,
      });
      setNotice({
        type: successCount > 0 ? "success" : "error",
        text: `Bulk upload finished: ${successCount} succeeded, ${failedCount} failed.`,
      });
    } catch (coverError) {
      const message = getErrorMessage(coverError, "Could not upload shared cover.");
      failedCount += uploadableTracks.length;
      uploadableTracks.forEach((track) => {
        updateBulkTrack(track.id, {
          status: "error",
          message,
        });
      });
      setBulkSummary({
        total: bulkTracks.length,
        success: successCount,
        failed: failedCount,
      });
      setBulkError(message);
      setNotice({ type: "error", text: message });
    } finally {
      setBulkUploading(false);
    }
  };

  const completedBulkCount = bulkTracks.filter(
    (track) => track.status === "success" || track.status === "error",
  ).length;

  return (
    <div className="space-y-6">
      <AdminNotice notice={notice} />

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-6 md:p-8 shadow-2xl animate-fade-in">
        {/* Header Block */}
        <div className="border-b border-zinc-800/80 pb-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                Admin Center
              </p>
              <h1 className="mt-1.5 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Upload Center
              </h1>
              <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
                Select one or multiple MP3 files, choose metadata, and upload songs one by one.
              </p>
            </div>
            
            {bulkTracks.length > 0 && (
              <div className="self-start sm:self-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 border border-zinc-800/60 shadow-sm">
                <span className="text-emerald-400">{completedBulkCount}</span>
                <span className="text-zinc-500 font-normal"> / {bulkTracks.length} completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Section - 1 Row on Desktop */}
        <div className="grid gap-5 md:grid-cols-3 mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
            Artist
            <select
              value={bulkForm.artist_id}
              onChange={(event) => updateBulkForm("artist_id", event.target.value)}
              disabled={loadingOptions || bulkUploading}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
            >
              <option value="">
                {loadingOptions ? "Loading artists..." : "Select artist"}
              </option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
            Album
            <select
              value={bulkForm.album_id}
              onChange={(event) => updateBulkForm("album_id", event.target.value)}
              disabled={loadingOptions || bulkUploading}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
            >
              <option value="">Single / no album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
            Genre
            <select
              value={bulkForm.genre_id}
              onChange={(event) => updateBulkForm("genre_id", event.target.value)}
              disabled={loadingOptions || bulkUploading}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
            >
              <option value="">No genre</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Upload Areas Grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* Audio Upload Dropzone Area */}
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-450 mb-2">
              Select audio files
            </span>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all h-[155px] ${
                isDragActive
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/20 hover:border-zinc-700/80 hover:bg-zinc-900/40"
              } ${bulkUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
            >
              <input
                key={`bulk-audio-${bulkInputKey}`}
                type="file"
                multiple
                accept="audio/*,.mp3,audio/mpeg"
                disabled={bulkUploading}
                onChange={(event) => {
                  void handleBulkAudioChange(event.target.files);
                  event.currentTarget.value = "";
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              
              <div className="mb-3 rounded-full bg-zinc-900 p-2.5 text-zinc-400 border border-zinc-800">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-200">
                Drag & drop MP3 files here
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                or <span className="text-emerald-400 hover:text-emerald-300 font-medium underline">click to browse</span>
              </p>
            </div>
          </div>

          {/* Shared Cover Card Block */}
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-455 mb-2">
              Select shared cover
            </span>
            <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/10 p-5 h-[155px] justify-between">
              <div className="flex items-center gap-4">
                {bulkCoverFile && bulkCoverPreview ? (
                  <div className="relative shrink-0">
                    <img
                      src={bulkCoverPreview}
                      alt="Shared cover preview"
                      className="h-16 w-16 rounded-lg object-cover border border-zinc-800 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setBulkCoverFile(null);
                        setBulkInputKey((k) => k + 1);
                      }}
                      disabled={bulkUploading}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-zinc-300 hover:bg-rose-600 hover:text-white text-xs border border-zinc-700 transition disabled:opacity-50"
                      title="Remove shared cover"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-850 bg-zinc-900/40 text-zinc-700">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-300">Shared Cover Image</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500 leading-normal">
                    Optional. Songs without individual covers will fallback to this.
                  </p>
                  {bulkCoverFile && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-450 truncate">
                      {bulkCoverFile.name} ({(bulkCoverFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="inline-flex cursor-pointer rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/55 hover:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:text-white has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-40">
                  {bulkCoverFile ? "Change Cover" : "Choose Shared Cover"}
                  <input
                    key={`bulk-cover-${bulkInputKey}`}
                    type="file"
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                    disabled={bulkUploading}
                    onChange={(event) =>
                      setBulkCoverFile(event.target.files ? event.target.files[0] : null)
                    }
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Global Errors */}
        {bulkError && (
          <div className="mb-6 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-400 shadow-sm flex items-start gap-2.5">
            <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{bulkError}</span>
          </div>
        )}

        {/* Bulk Summary Statistics */}
        {bulkSummary && (
          <div className="grid gap-4 text-sm sm:grid-cols-3 mb-6">
            <div className="rounded-xl border border-zinc-850 bg-zinc-900/30 p-4 shadow-sm">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Tracks</p>
              <p className="mt-1 text-2xl font-bold text-white">{bulkSummary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Success</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">{bulkSummary.success}</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Failed</p>
              <p className="mt-1 text-2xl font-bold text-rose-400">{bulkSummary.failed}</p>
            </div>
          </div>
        )}

        {/* Track List Preview Table Area */}
        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Selected Tracks List
            </h3>
            {bulkTracks.length > 0 && (
              <span className="text-xs text-zinc-500">
                Configure cover art and rename titles before uploading.
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-inner">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-850 text-sm">
                <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-450">
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
                  {bulkTracks.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center text-zinc-550 leading-normal" colSpan={6}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="h-8 w-8 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                          </svg>
                          <span>No audio files selected yet. Drag & drop or browse above.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    bulkTracks.map((track) => (
                      <tr key={track.id} className="text-zinc-300 hover:bg-zinc-900/35 transition-colors">
                        <td className="max-w-xs px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <button
                              type="button"
                              onClick={() => removeBulkTrack(track.id)}
                              disabled={bulkUploading}
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
                              <p className="mt-0.5 text-xs text-zinc-550">
                                {(track.file.size / (1024 * 1024)).toFixed(1)} MB
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-64 px-5 py-4">
                          <input
                            value={track.title}
                            onChange={(event) =>
                              handleBulkTitleChange(track.id, event.target.value)
                            }
                            disabled={bulkUploading || track.status === "success"}
                            maxLength={200}
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/80 focus:bg-zinc-900/90 focus:ring-1 focus:ring-emerald-500/80 transition disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs font-mono text-zinc-400">
                          {formatDuration(track.durationSec)}
                        </td>
                        <td className="min-w-48 px-5 py-4">
                          {track.coverFile && track.coverPreviewUrl ? (
                            <div className="flex items-center gap-3">
                              <div
                                className="h-10 w-10 shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 bg-cover bg-center shadow-sm"
                                style={{
                                  backgroundImage: `url(${track.coverPreviewUrl})`,
                                }}
                                role="img"
                                aria-label={`${track.title || track.file.name} cover`}
                              />
                              <span className="max-w-24 truncate text-xs text-zinc-400 font-medium">
                                {track.coverFile.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeTrackCover(track.id)}
                                disabled={bulkUploading || track.status === "success"}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:bg-rose-950/60 hover:text-rose-450 text-xs border border-zinc-800 transition disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Remove cover for ${track.title}`}
                                title="Remove cover"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="min-w-10 text-xs text-zinc-500 italic">
                                {bulkCoverFile ? "Shared" : "None"}
                              </span>
                              <label className="inline-flex cursor-pointer rounded-lg border border-zinc-850 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:text-white has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-45">
                                Choose
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                  disabled={bulkUploading || track.status === "success"}
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
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold tracking-wide shadow-sm ${getBulkStatusClass(
                              track.status,
                            )}`}
                          >
                            {statusLabels[track.status]}
                          </span>
                        </td>
                        <td className="min-w-56 px-5 py-4 text-xs text-zinc-500 leading-relaxed">
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

        {/* Action Controls Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-900 pt-6 mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleBulkUpload()}
              disabled={bulkUploading || loadingOptions || bulkTracks.length === 0}
              className="relative overflow-hidden rounded-lg bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-900 disabled:text-zinc-500 shadow-md"
            >
              {bulkUploading ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Uploading...</span>
                </div>
              ) : (
                "Upload All"
              )}
            </button>
            <button
              type="button"
              onClick={clearBulkList}
              disabled={bulkUploading || bulkTracks.length === 0}
              className="rounded-lg border border-zinc-800 bg-zinc-900/25 hover:bg-zinc-900/60 hover:border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-300 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear list
            </button>
          </div>

          {bulkTracks.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-800"></span>
                <span>Total: <strong className="text-zinc-200 font-bold">{bulkTracks.length}</strong></span>
              </div>
              
              {(completedBulkCount > 0 || bulkSummary) && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span>Success: <strong className="text-emerald-400 font-bold">{bulkSummary?.success ?? bulkTracks.filter(t => t.status === "success").length}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    <span>Failed: <strong className="text-rose-400 font-bold">{bulkSummary?.failed ?? bulkTracks.filter(t => t.status === "error").length}</strong></span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
