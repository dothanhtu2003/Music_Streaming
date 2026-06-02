"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, getErrorMessage, slugify } from "@/lib/admin-format";
import {
  createGenreRequest,
  deleteGenreRequest,
  getGenresRequest,
  updateGenreRequest,
} from "@/lib/api";
import type { GenreRecord } from "@/types/music";

type GenreFormState = {
  name: string;
  slug: string;
};

const emptyForm: GenreFormState = {
  name: "",
  slug: "",
};

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function AdminGenresPage() {
  const { accessToken } = useAuth();
  const [genres, setGenres] = useState<GenreRecord[]>([]);
  const [form, setForm] = useState<GenreFormState>(emptyForm);
  const [editingGenre, setEditingGenre] = useState<GenreRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);

  const loadGenres = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getGenresRequest(1, 100);
      setGenres(result.items);
    } catch (genresError) {
      setError(getErrorMessage(genresError, "Could not load genres."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadGenres();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadGenres]);

  const updateForm = (key: keyof GenreFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
  };

  const handleNameChange = (value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      name: value,
      slug: currentForm.slug ? currentForm.slug : slugify(value),
    }));
  };

  const startEdit = (genre: GenreRecord) => {
    setEditingGenre(genre);
    setForm({
      name: genre.name,
      slug: genre.slug,
    });
    setFormError(null);
    setNotice(null);
  };

  const resetForm = () => {
    setEditingGenre(null);
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
    const slug = form.slug.trim().toLowerCase();

    if (name.length < 2) {
      setFormError("Genre name must be at least 2 characters.");
      return;
    }

    if (!slugRegex.test(slug)) {
      setFormError("Slug must use lowercase letters, numbers, and hyphens.");
      return;
    }

    setSaving(true);
    setFormError(null);
    setNotice(null);

    try {
      if (editingGenre) {
        const updatedGenre = await updateGenreRequest(
          editingGenre.id,
          { name, slug },
          accessToken,
        );

        setGenres((currentGenres) =>
          currentGenres.map((genre) =>
            genre.id === updatedGenre.id ? updatedGenre : genre,
          ),
        );
        setEditingGenre(updatedGenre);
        setNotice({ type: "success", text: "Genre updated successfully." });
      } else {
        const createdGenre = await createGenreRequest(
          { name, slug },
          accessToken,
        );

        setGenres((currentGenres) => [createdGenre, ...currentGenres]);
        setForm(emptyForm);
        setNotice({ type: "success", text: "Genre created successfully." });
      }
    } catch (saveError) {
      setFormError(getErrorMessage(saveError, "Could not save genre."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (genre: GenreRecord) => {
    if (!accessToken) {
      setNotice({
        type: "error",
        text: "Admin token is missing. Please login again.",
      });
      return;
    }

    const confirmed = window.confirm(`Delete genre "${genre.name}"?`);

    if (!confirmed) {
      return;
    }

    setActionId(genre.id);
    setNotice(null);

    try {
      await deleteGenreRequest(genre.id, accessToken);
      setGenres((currentGenres) =>
        currentGenres.filter((currentGenre) => currentGenre.id !== genre.id),
      );

      if (editingGenre?.id === genre.id) {
        resetForm();
      }

      setNotice({ type: "success", text: "Genre deleted successfully." });
    } catch (deleteError) {
      setNotice({
        type: "error",
        text: getErrorMessage(deleteError, "Could not delete genre."),
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Genres"
        description="Create, edit, and delete genre records."
      />

      <AdminNotice notice={notice} />

      <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-5"
        >
          <div>
            <p className="text-sm font-semibold text-white">
              {editingGenre ? "Edit genre" : "Create genre"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Slug should look like pop, indie-rock, or lo-fi.
            </p>
          </div>

          <label className="block text-sm font-medium text-zinc-300">
            Name
            <input
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
              required
              minLength={2}
              maxLength={100}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-zinc-300">
            Slug
            <input
              value={form.slug}
              onChange={(event) => updateForm("slug", event.target.value)}
              required
              maxLength={120}
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
              {saving ? "Saving..." : editingGenre ? "Save changes" : "Create"}
            </button>
            {editingGenre && (
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
          headers={["Name", "Slug", "Created", "Actions"]}
          loading={loading}
          error={error}
          empty={!loading && genres.length === 0}
          emptyMessage="No genres found."
        >
          {genres.map((genre) => (
            <tr key={genre.id} className="text-zinc-300">
              <td className="px-4 py-3 font-medium text-white">{genre.name}</td>
              <td className="px-4 py-3">{genre.slug}</td>
              <td className="px-4 py-3">{formatDate(genre.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(genre)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(genre)}
                    disabled={actionId === genre.id}
                    className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionId === genre.id ? "Deleting..." : "Delete"}
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
