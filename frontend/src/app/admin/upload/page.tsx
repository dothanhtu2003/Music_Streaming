"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { getErrorMessage } from "@/lib/admin-format";
import {
  createSongRequest,
  getAlbumsRequest,
  getArtistsRequest,
  getGenresRequest,
  uploadAudioRequest,
  uploadCoverRequest,
} from "@/lib/api";
import type { AlbumRecord, ArtistRecord, GenreRecord } from "@/types/music";

type UploadFormState = {
  title: string;
  artist_id: string;
  album_id: string;
  genre_id: string;
  duration_sec: string;
};

const emptyForm: UploadFormState = {
  title: "",
  artist_id: "",
  album_id: "",
  genre_id: "",
  duration_sec: "",
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

export default function AdminUploadPage() {
  const { accessToken } = useAuth();
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [genres, setGenres] = useState<GenreRecord[]>([]);
  const [form, setForm] = useState<UploadFormState>(emptyForm);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    setFormError(null);

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
      setFormError(
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

  const updateForm = (key: keyof UploadFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = form.title.trim();
    const duration = Number(form.duration_sec);

    if (!accessToken) {
      setFormError("Admin token is missing. Please login again.");
      return;
    }

    if (title.length < 2) {
      setFormError("Song title must be at least 2 characters.");
      return;
    }

    if (!form.artist_id) {
      setFormError("Artist is required.");
      return;
    }

    if (!Number.isInteger(duration) || duration < 0) {
      setFormError("Duration must be a non-negative integer.");
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
      const audioUrl = await uploadAudioRequest(audioFile, accessToken);
      const coverUrl = coverFile
        ? await uploadCoverRequest(coverFile, accessToken)
        : null;

      const song = await createSongRequest(
        {
          title,
          artist_id: form.artist_id,
          album_id: optionalValue(form.album_id),
          genre_id: optionalValue(form.genre_id),
          file_url: audioUrl,
          cover_url: coverUrl,
          duration_sec: duration,
          is_active: true,
        },
        accessToken,
      );

      setForm(emptyForm);
      setAudioFile(null);
      setCoverFile(null);
      setFileInputKey((currentKey) => currentKey + 1);
      setNotice({
        type: "success",
        text: `Song "${song.title}" uploaded and created successfully.`,
      });
    } catch (uploadError) {
      setFormError(getErrorMessage(uploadError, "Could not upload song."));
      setNotice({
        type: "error",
        text: getErrorMessage(uploadError, "Could not upload song."),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Upload song"
        description="Upload an MP3 and optional cover, then create a song record."
      />

      <AdminNotice notice={notice} />

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6 md:grid-cols-2"
      >
        <label className="block text-sm font-medium text-zinc-300">
          Song title
          <input
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            required
            minLength={2}
            maxLength={200}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          Duration seconds
          <input
            value={form.duration_sec}
            onChange={(event) => updateForm("duration_sec", event.target.value)}
            required
            type="number"
            min={0}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          Artist
          <select
            value={form.artist_id}
            onChange={(event) => updateForm("artist_id", event.target.value)}
            required
            disabled={loadingOptions}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
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

        <label className="block text-sm font-medium text-zinc-300">
          Album
          <select
            value={form.album_id}
            onChange={(event) => updateForm("album_id", event.target.value)}
            disabled={loadingOptions}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Single / no album</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          Genre
          <select
            value={form.genre_id}
            onChange={(event) => updateForm("genre_id", event.target.value)}
            disabled={loadingOptions}
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">No genre</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-zinc-300">
          MP3 file
          <input
            key={`audio-${fileInputKey}`}
            type="file"
            accept=".mp3,audio/mpeg"
            required
            onChange={(event) =>
              setAudioFile(event.target.files ? event.target.files[0] : null)
            }
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-green-950"
          />
        </label>

        <label className="block text-sm font-medium text-zinc-300 md:col-span-2">
          Cover image
          <input
            key={`cover-${fileInputKey}`}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) =>
              setCoverFile(event.target.files ? event.target.files[0] : null)
            }
            className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
        </label>

        {formError && (
          <p className="text-sm text-red-300 md:col-span-2">{formError}</p>
        )}

        <button
          type="submit"
          disabled={saving || loadingOptions}
          className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 md:w-fit"
        >
          {saving ? "Uploading..." : "Upload and create song"}
        </button>
      </form>
    </div>
  );
}
