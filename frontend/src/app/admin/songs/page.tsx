"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, getErrorMessage } from "@/lib/admin-format";
import {
  deleteSongRequest,
  getAlbumsRequest,
  getArtistsRequest,
  getGenresRequest,
  getSongsRequest,
  updateSongRequest,
} from "@/lib/api";
import { formatDuration } from "@/lib/song-format";
import type {
  AlbumRecord,
  ArtistRecord,
  GenreRecord,
  Song,
  SongWritePayload,
} from "@/types/music";

type SongFormState = {
  title: string;
  artist_id: string;
  album_id: string;
  genre_id: string;
  file_url: string;
  cover_url: string;
  duration_sec: string;
};

const emptyForm: SongFormState = {
  title: "",
  artist_id: "",
  album_id: "",
  genre_id: "",
  file_url: "",
  cover_url: "",
  duration_sec: "",
};

function songToForm(song: Song): SongFormState {
  return {
    title: song.title,
    artist_id: song.artist.id,
    album_id: song.album?.id ?? "",
    genre_id: song.genre?.id ?? "",
    file_url: song.file_url,
    cover_url: song.cover_url ?? "",
    duration_sec: String(song.duration_sec),
  };
}

function optionalValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function buildSongPayload(form: SongFormState): SongWritePayload {
  const title = form.title.trim();
  const fileUrl = form.file_url.trim();
  const duration = Number(form.duration_sec);

  if (title.length < 2) {
    throw new Error("Song title must be at least 2 characters.");
  }

  if (!form.artist_id) {
    throw new Error("Artist is required.");
  }

  if (!fileUrl) {
    throw new Error("File URL is required.");
  }

  if (!Number.isInteger(duration) || duration < 0) {
    throw new Error("Duration must be a non-negative integer.");
  }

  return {
    title,
    artist_id: form.artist_id,
    album_id: optionalValue(form.album_id),
    genre_id: optionalValue(form.genre_id),
    file_url: fileUrl,
    cover_url: optionalValue(form.cover_url),
    duration_sec: duration,
  };
}

export default function AdminSongsPage() {
  const { accessToken } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [genres, setGenres] = useState<GenreRecord[]>([]);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [form, setForm] = useState<SongFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [songResult, artistResult, albumResult, genreResult] =
        await Promise.all([
          getSongsRequest(1, 100),
          getArtistsRequest(1, 100),
          getAlbumsRequest(1, 100),
          getGenresRequest(1, 100),
        ]);

      setSongs(songResult.items);
      setArtists(artistResult.items);
      setAlbums(albumResult.items);
      setGenres(genreResult.items);
    } catch (songsError) {
      setError(getErrorMessage(songsError, "Could not load songs."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadSongs();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadSongs]);

  const startEdit = (song: Song) => {
    setEditingSong(song);
    setForm(songToForm(song));
    setFormError(null);
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingSong(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const updateForm = (key: keyof SongFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingSong) {
      setFormError("Choose a song to edit first.");
      return;
    }

    if (!accessToken) {
      setFormError("Admin token is missing. Please login again.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      const payload = buildSongPayload(form);
      const updatedSong = await updateSongRequest(
        editingSong.id,
        payload,
        accessToken,
      );

      setSongs((currentSongs) =>
        currentSongs.map((song) =>
          song.id === updatedSong.id ? updatedSong : song,
        ),
      );
      setEditingSong(updatedSong);
      setForm(songToForm(updatedSong));
      setNotice({ type: "success", text: "Song updated successfully." });
    } catch (updateError) {
      setFormError(getErrorMessage(updateError, "Could not update song."));
    } finally {
      setSaving(false);
    }
  };

  const handleHideSong = async (song: Song) => {
    if (!accessToken) {
      setNotice({
        type: "error",
        text: "Admin token is missing. Please login again.",
      });
      return;
    }

    const confirmed = window.confirm(`Hide song "${song.title}"?`);

    if (!confirmed) {
      return;
    }

    setActionId(song.id);
    setNotice(null);

    try {
      await deleteSongRequest(song.id, accessToken);
      setSongs((currentSongs) =>
        currentSongs.filter((currentSong) => currentSong.id !== song.id),
      );

      if (editingSong?.id === song.id) {
        cancelEdit();
      }

      setNotice({ type: "success", text: "Song hidden successfully." });
    } catch (deleteError) {
      setNotice({
        type: "error",
        text: getErrorMessage(deleteError, "Could not hide song."),
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Songs"
        description="Manage active songs from the backend API."
        action={
          <Link
            href="/admin/upload"
            className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 transition hover:bg-green-400"
          >
            Add new song
          </Link>
        }
      />

      <AdminNotice notice={notice} />

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <AdminTable
          headers={[
            "Title",
            "Artist",
            "Album",
            "Genre",
            "Duration",
            "Created",
            "Actions",
          ]}
          loading={loading}
          error={error}
          empty={!loading && songs.length === 0}
          emptyMessage="No songs found."
        >
          {songs.map((song) => (
            <tr key={song.id} className="text-zinc-300">
              <td className="px-4 py-3 font-medium text-white">{song.title}</td>
              <td className="px-4 py-3">{song.artist.name}</td>
              <td className="px-4 py-3">{song.album?.title ?? "Single"}</td>
              <td className="px-4 py-3">{song.genre?.name ?? "Unknown"}</td>
              <td className="px-4 py-3">{formatDuration(song.duration_sec)}</td>
              <td className="px-4 py-3">{formatDate(song.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(song)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleHideSong(song)}
                    disabled={actionId === song.id}
                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionId === song.id ? "Hiding..." : "Hide"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        >
          <div>
            <p className="text-sm font-semibold text-white">Edit song</p>
            <p className="mt-1 text-xs text-zinc-500">
              {editingSong
                ? `Editing "${editingSong.title}"`
                : "Choose a song from the table."}
            </p>
          </div>

          <label className="block text-sm font-medium text-zinc-300">
            Title
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              disabled={!editingSong || saving}
              maxLength={200}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Artist
            <select
              value={form.artist_id}
              onChange={(event) => updateForm("artist_id", event.target.value)}
              disabled={!editingSong || saving}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Select artist</option>
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
              disabled={!editingSong || saving}
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
              disabled={!editingSong || saving}
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
            File URL
            <input
              value={form.file_url}
              onChange={(event) => updateForm("file_url", event.target.value)}
              disabled={!editingSong || saving}
              maxLength={1000}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Cover URL
            <input
              value={form.cover_url}
              onChange={(event) => updateForm("cover_url", event.target.value)}
              disabled={!editingSong || saving}
              maxLength={1000}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Duration seconds
            <input
              value={form.duration_sec}
              onChange={(event) =>
                updateForm("duration_sec", event.target.value)
              }
              disabled={!editingSong || saving}
              type="number"
              min={0}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          {formError && <p className="text-sm text-red-300">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!editingSong || saving}
              className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={!editingSong || saving}
              className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
