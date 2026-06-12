"use client";

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
  createArtistRequest,
  deleteArtistRequest,
  getArtistsRequest,
  updateArtistRequest,
} from "@/lib/api";
import { getArtistDisplayName } from "@/lib/song-format";
import type { ArtistRecord } from "@/types/music";

type ArtistFormState = {
  name: string;
  bio: string;
  avatar_url: string;
};

const emptyForm: ArtistFormState = {
  name: "",
  bio: "",
  avatar_url: "",
};

function optionalValue(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export default function AdminArtistsPage() {
  const { accessToken } = useAuth();
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [form, setForm] = useState<ArtistFormState>(emptyForm);
  const [editingArtist, setEditingArtist] = useState<ArtistRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);

  const loadArtists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getArtistsRequest(1, 100);
      setArtists(result.items);
    } catch (artistsError) {
      setError(getErrorMessage(artistsError, "Could not load artists."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadArtists();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadArtists]);

  const updateForm = (key: keyof ArtistFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const startEdit = (artist: ArtistRecord) => {
    setEditingArtist(artist);
    setForm({
      name: artist.name,
      bio: artist.bio ?? "",
      avatar_url: artist.avatar_url ?? "",
    });
    setFormError(null);
    setNotice(null);
  };

  const resetForm = () => {
    setEditingArtist(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setFormError("Admin token is missing. Please login again.");
      return;
    }

    const name = form.name.trim();

    if (name.length < 2) {
      setFormError("Artist name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      const payload = {
        name,
        bio: optionalValue(form.bio),
        avatar_url: optionalValue(form.avatar_url),
      };

      if (editingArtist) {
        const updatedArtist = await updateArtistRequest(
          editingArtist.id,
          payload,
          accessToken,
        );

        setArtists((currentArtists) =>
          currentArtists.map((artist) =>
            artist.id === updatedArtist.id ? updatedArtist : artist,
          ),
        );
        setEditingArtist(updatedArtist);
        setNotice({ type: "success", text: "Artist updated successfully." });
      } else {
        const createdArtist = await createArtistRequest(payload, accessToken);

        setArtists((currentArtists) => [createdArtist, ...currentArtists]);
        setForm(emptyForm);
        setNotice({ type: "success", text: "Artist created successfully." });
      }
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, "Could not save artist."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (artist: ArtistRecord) => {
    if (!accessToken) {
      setNotice({
        type: "error",
        text: "Admin token is missing. Please login again.",
      });
      return;
    }

    const confirmed = window.confirm(`Delete artist "${getArtistDisplayName(artist)}"?`);

    if (!confirmed) {
      return;
    }

    setActionId(artist.id);
    setNotice(null);

    try {
      await deleteArtistRequest(artist.id, accessToken);
      setArtists((currentArtists) =>
        currentArtists.filter((currentArtist) => currentArtist.id !== artist.id),
      );

      if (editingArtist?.id === artist.id) {
        resetForm();
      }

      setNotice({ type: "success", text: "Artist deleted successfully." });
    } catch (deleteError) {
      setNotice({
        type: "error",
        text: getErrorMessage(deleteError, "Could not delete artist."),
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Artists"
        description="Create, edit, and delete artist records."
      />

      <AdminNotice notice={notice} />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        >
          <div>
            <p className="text-sm font-semibold text-white">
              {editingArtist ? "Edit artist" : "Create artist"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Name is required. Bio and avatar URL are optional.
            </p>
          </div>

          <label className="block text-sm font-medium text-zinc-300">
            Name
            <input
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              required
              minLength={2}
              maxLength={150}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Bio
            <textarea
              value={form.bio}
              onChange={(event) => updateForm("bio", event.target.value)}
              maxLength={5000}
              rows={4}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Avatar URL
            <input
              value={form.avatar_url}
              onChange={(event) => updateForm("avatar_url", event.target.value)}
              maxLength={1000}
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
              {saving ? "Saving..." : editingArtist ? "Save changes" : "Create"}
            </button>
            {editingArtist && (
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
          headers={["Name", "Bio", "Avatar", "Created", "Actions"]}
          loading={loading}
          error={error}
          empty={!loading && artists.length === 0}
          emptyMessage="No artists found."
        >
          {artists.map((artist) => (
            <tr key={artist.id} className="text-zinc-300">
              <td className="px-4 py-3 font-medium text-white">
                {getArtistDisplayName(artist)}
              </td>
              <td className="max-w-xs px-4 py-3">
                <span className="line-clamp-2">{artist.bio ?? "No bio"}</span>
              </td>
              <td className="px-4 py-3">{artist.avatar_url ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{formatDate(artist.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(artist)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(artist)}
                    disabled={actionId === artist.id}
                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionId === artist.id ? "Deleting..." : "Delete"}
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
