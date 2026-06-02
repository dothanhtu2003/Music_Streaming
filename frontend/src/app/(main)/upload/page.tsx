"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { uploadTrackRequest } from "@/lib/api";

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

function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.type === "success";

  return (
    <div
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? "border-green-500/40 bg-green-500/10 text-green-300"
          : "border-red-500/40 bg-red-500/10 text-red-300"
      }`}
    >
      {notice.text}
    </div>
  );
}

export default function UploadPage() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [form, setForm] = useState<UploadFormState>(emptyForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Upload"
        title="Upload track"
        description="Share an MP3 track from your account."
      />

      <NoticeBanner notice={notice} />

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6 md:grid-cols-2"
      >
        <label className="block text-sm font-medium text-zinc-300">
          Title
          <input
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            required
            maxLength={200}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            placeholder="Track title"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          Genre
          <input
            value={form.genre}
            onChange={(event) => updateForm("genre", event.target.value)}
            maxLength={100}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            placeholder="Pop, Lo-fi, Rock..."
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300 md:col-span-2">
          Description
          <textarea
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            rows={4}
            maxLength={5000}
            className="mt-2 w-full resize-none rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            placeholder="Short note about this track"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          MP3 file
          <input
            type="file"
            accept=".mp3,audio/mpeg,audio/mp3"
            required
            onChange={(event) =>
              setAudioFile(event.target.files ? event.target.files[0] : null)
            }
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-green-950"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          Cover image
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setCoverFile(event.target.files ? event.target.files[0] : null)
            }
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </label>

        <div className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-400 md:col-span-2">
          Artist name will be saved as{" "}
          <span className="font-semibold text-white">
            {user?.username ?? "your username"}
          </span>
          .
        </div>

        {formError && (
          <p className="text-sm text-red-300 md:col-span-2">{formError}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 md:w-fit"
        >
          {saving ? "Uploading..." : "Upload track"}
        </button>
      </form>
    </div>
  );
}
