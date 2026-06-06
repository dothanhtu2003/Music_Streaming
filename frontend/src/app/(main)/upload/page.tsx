"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { uploadTrackRequest } from "@/lib/api";
import { notifySongUploaded } from "@/lib/song-events";

type UploadFormState = {
  title: string;
  genre: string;
  description: string;
};

type Notice = {
  type: "success" | "error";
  text: string;
};

const emptyForm: UploadFormState = {
  title: "",
  genre: "",
  description: "",
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

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.type === "success";

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 text-sm transition-all duration-305 ${
        isSuccess
          ? "border-orange-500/30 bg-orange-500/10 text-orange-300 animate-fade-in"
          : "border-red-500/30 bg-red-500/10 text-red-300 animate-fade-in"
      }`}
    >
      {isSuccess ? (
        <svg className="h-5 w-5 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
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
  const [form, setForm] = useState<UploadFormState>(emptyForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!coverFile) {
      queueMicrotask(() => {
        setCoverPreviewUrl(null);
      });
      return;
    }
    const url = URL.createObjectURL(coverFile);
    queueMicrotask(() => {
      setCoverPreviewUrl(url);
    });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [coverFile]);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 50 * 1024 * 1024) {
        setFormError("Audio file size must be 50MB or less.");
        setAudioFile(null);
        return;
      }
      setFormError(null);
      setAudioFile(file);
    }
  };

  const updateForm = (key: keyof UploadFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = form.title.trim();

    if (!accessToken) {
      router.replace(`/login?redirect=${encodeURIComponent("/upload")}`);
      return;
    }

    if (!title) {
      setFormError("Title is required.");
      return;
    }

    if (!audioFile) {
      setFormError("MP3 file is required.");
      return;
    }

    if (!isMp3File(audioFile)) {
      setFormError("Only MP3 audio files are allowed.");
      return;
    }

    if (audioFile.size > 50 * 1024 * 1024) {
      setFormError("Audio file size must be 50MB or less.");
      return;
    }

    if (coverFile && !isCoverFile(coverFile)) {
      setFormError("Cover must be JPG, PNG, or WebP.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      const song = await uploadTrackRequest(
        {
          title,
          genre: form.genre,
          description: form.description,
          audioFile,
          coverFile,
        },
        accessToken,
      );

      notifySongUploaded(song);

      setNotice({
        type: "success",
        text: `Track "${song.title}" uploaded successfully. Redirecting to Home...`,
      });

      window.setTimeout(() => {
        router.push("/");
      }, 900);
    } catch (uploadError) {
      const message = getErrorMessage(uploadError, "Could not upload track.");
      setFormError(message);
      setNotice({ type: "error", text: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <NoticeBanner notice={notice} />

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-6 md:p-8 shadow-2xl animate-fade-in">
        {/* Header Block */}
        <div className="border-b border-zinc-800/80 pb-6 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
              Upload
            </p>
            <h1 className="mt-1.5 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Upload track
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Share an MP3 track from your account.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata Section */}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Title
                <span className="text-orange-500 ml-1">*</span>
              </label>
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                required
                maxLength={200}
                disabled={saving}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
                placeholder="Track title"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Genre
              </label>
              <input
                value={form.genre}
                onChange={(event) => updateForm("genre", event.target.value)}
                maxLength={100}
                disabled={saving}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
                placeholder="Pop, Lo-fi, Rock..."
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={4}
              maxLength={5000}
              disabled={saving}
              className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
              placeholder="Short note about this track"
            />
          </div>

          {/* Files Section */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Audio Dropzone */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Audio File <span className="text-orange-500">*</span>
              </span>
              {!audioFile ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all h-[180px] ${
                    isDragActive
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-zinc-800 bg-zinc-900/20 hover:border-zinc-700/80 hover:bg-zinc-900/40"
                  } ${saving ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                >
                  <input
                    type="file"
                    accept=".mp3,audio/mpeg,audio/mp3"
                    disabled={saving}
                    onChange={(event) => {
                      const file = event.target.files ? event.target.files[0] : null;
                      if (file && file.size > 50 * 1024 * 1024) {
                        setFormError("Audio file size must be 50MB or less.");
                        setAudioFile(null);
                        return;
                      }
                      setFormError(null);
                      setAudioFile(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  
                  <div className="mb-3 rounded-full bg-zinc-900 p-2.5 text-zinc-400 border border-zinc-800">
                    <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-200">
                    Choose an MP3 file
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Drag & drop or <span className="text-orange-400 hover:text-orange-300 font-medium underline">click to browse</span>
                  </p>
                  <p className="mt-1.5 text-[10px] text-zinc-500">
                    Maximum size: 50MB
                  </p>
                </div>
              ) : (
                <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 h-[180px] animate-fade-in">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="rounded-lg bg-orange-500/10 p-3 text-orange-500 border border-orange-500/20 shrink-0">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate" title={audioFile.name}>
                        {audioFile.name}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {formatFileSize(audioFile.size)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setAudioFile(null)}
                      disabled={saving}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove file
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cover Upload */}
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Cover Image
              </span>
              {!coverFile ? (
                <div className="relative flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/80 transition-all h-[180px] text-center cursor-pointer">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={saving}
                    onChange={(event) =>
                      setCoverFile(event.target.files ? event.target.files[0] : null)
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="mb-2 rounded-full bg-zinc-900 p-2.5 text-zinc-500 border border-zinc-800">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-300">
                    Select cover image
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Optional • JPG, PNG or WebP
                  </p>
                </div>
              ) : (
                <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 h-[180px] animate-fade-in">
                  <div className="flex items-center gap-4 min-w-0">
                    {coverPreviewUrl ? (
                      <img
                        src={coverPreviewUrl}
                        alt="Cover preview"
                        className="h-16 w-16 rounded-lg object-cover border border-zinc-800 shadow-md shrink-0 animate-fade-in"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-500">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate" title={coverFile.name}>
                        {coverFile.name}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {formatFileSize(coverFile.size)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCoverFile(null)}
                      disabled={saving}
                      className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-900/50 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove cover
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Artist Info Card */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/10 px-4 py-3 flex items-center gap-3">
            <div className="rounded-full bg-orange-500/10 p-1.5 text-orange-500 border border-orange-500/20">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-xs text-zinc-400">
              Artist name will be saved as{" "}
              <span className="font-semibold text-zinc-200">
                {user?.username ?? "your username"}
              </span>
              .
            </p>
          </div>

          {/* Error display */}
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-350 animate-shake">
              <svg className="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {formError}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-start pt-2">
            <button
              type="submit"
              disabled={saving}
              className="relative flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-orange-950 hover:bg-orange-400 transition duration-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 shadow-md hover:shadow-orange-500/10 min-w-[140px]"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-orange-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </>
              ) : (
                "Upload track"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

