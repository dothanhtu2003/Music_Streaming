"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { getErrorMessage } from "@/lib/admin-format";
import {
  createAlbumRequest,
  deleteAlbumRequest,
  getAlbumsRequest,
  getArtistsRequest,
  updateAlbumRequest,
} from "@/lib/api";
import type { AlbumRecord, ArtistRecord } from "@/types/music";

type AlbumFormState = {
  title: string;
  artist_id: string;
  cover_url: string;
  release_date: string;
};

const emptyForm: AlbumFormState = {
  title: "",
  artist_id: "",
  cover_url: "",
  release_date: "",
};

function optionalValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export default function AdminAlbumsPage() {
  const { accessToken } = useAuth();
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [form, setForm] = useState<AlbumFormState>(emptyForm);
  const [editingAlbum, setEditingAlbum] = useState<AlbumRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [albumResult, artistResult] = await Promise.all([
        getAlbumsRequest(1, 100),
        getArtistsRequest(1, 100),
      ]);

      setAlbums(albumResult.items);
      setArtists(artistResult.items);
    } catch (albumsError) {
      setError(getErrorMessage(albumsError, "Could not load albums."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadAlbums();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadAlbums]);

  const updateForm = (key: keyof AlbumFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const startEdit = (album: AlbumRecord) => {
    setEditingAlbum(album);
    setForm({
      title: album.title,
      artist_id: album.artist_id,
      cover_url: album.cover_url ?? "",
      release_date: album.release_date ?? "",
    });
    setFormError(null);
    setNotice(null);
  };

  const resetForm = () => {
    setEditingAlbum(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setFormError("Admin token is missing. Please login again.");
      return;
    }

    const title = form.title.trim();

    if (title.length < 2) {
      setFormError("Album title must be at least 2 characters.");
      return;
    }

    if (!form.artist_id) {
      setFormError("Artist is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      const payload = {
        title,
        artist_id: form.artist_id,
        cover_url: optionalValue(form.cover_url),
        release_date: optionalValue(form.release_date),
      };

      if (editingAlbum) {
        const updatedAlbum = await updateAlbumRequest(
          editingAlbum.id,
          payload,
          accessToken,
        );

        setAlbums((currentAlbums) =>
          currentAlbums.map((album) =>
            album.id === updatedAlbum.id ? updatedAlbum : album,
          ),
        );
        setEditingAlbum(updatedAlbum);
        setNotice({ type: "success", text: "Album updated successfully." });
      } else {
        const createdAlbum = await createAlbumRequest(payload, accessToken);

        setAlbums((currentAlbums) => [createdAlbum, ...currentAlbums]);
        setForm(emptyForm);
        setNotice({ type: "success", text: "Album created successfully." });
      }
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, "Could not save album."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (album: AlbumRecord) => {
    if (!accessToken) {
      setNotice({
        type: "error",
        text: "Admin token is missing. Please login again.",
      });
      return;
    }

    const confirmed = window.confirm(`Delete album "${album.title}"?`);

    if (!confirmed) {
      return;
    }

    setActionId(album.id);
    setNotice(null);

    try {
      await deleteAlbumRequest(album.id, accessToken);
      setAlbums((currentAlbums) =>
        currentAlbums.filter((currentAlbum) => currentAlbum.id !== album.id),
      );

      if (editingAlbum?.id === album.id) {
        resetForm();
      }

      setNotice({ type: "success", text: "Album deleted successfully." });
    } catch (deleteError) {
      setNotice({
        type: "error",
        text: getErrorMessage(deleteError, "Could not delete album."),
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Albums"
        description="Create, edit, and delete album records."
      />

      <AdminNotice notice={notice} />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        >
          <div>
            <p className="text-sm font-semibold text-white">
              {editingAlbum ? "Edit album" : "Create album"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Album title and artist are required.
            </p>
          </div>

          <label className="block text-sm font-medium text-zinc-300">
            Title
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
            Artist
            <select
              value={form.artist_id}
              onChange={(event) => updateForm("artist_id", event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
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
            Cover URL
            <input
              value={form.cover_url}
              onChange={(event) => updateForm("cover_url", event.target.value)}
              maxLength={1000}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Release date
            <input
              value={form.release_date}
              onChange={(event) =>
                updateForm("release_date", event.target.value)
              }
              type="date"
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            />
          </label>

          {formError && <p className="text-sm text-red-300">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {saving ? "Saving..." : editingAlbum ? "Save changes" : "Create"}
            </button>
            {editingAlbum && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <AdminTable
          headers={["Title", "Artist", "Release date", "Cover", "Actions"]}
          loading={loading}
          error={error}
          empty={!loading && albums.length === 0}
          emptyMessage="No albums found."
        >
          {albums.map((album) => (
            <tr key={album.id} className="text-zinc-300">
              <td className="px-4 py-3 font-medium text-white">{album.title}</td>
              <td className="px-4 py-3">{album.artist?.name ?? "Unknown"}</td>
              <td className="px-4 py-3">{album.release_date ?? "N/A"}</td>
              <td className="px-4 py-3">{album.cover_url ? "Yes" : "No"}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(album)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(album)}
                    disabled={actionId === album.id}
                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionId === album.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
