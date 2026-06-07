"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { useAuth } from "@/components/auth/AuthProvider";
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

function getUploaderLabel(song: Song) {
  const uploader = song.uploadedByUser;

  return (
    uploader?.displayName?.trim() ||
    uploader?.username?.trim() ||
    "Unknown"
  );
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

  // Search / Filter / Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [selectedGenreId, setSelectedGenreId] = useState("");
  const [sortOption, setSortOption] = useState("newest");

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

  // Compute filters from current songs list client-side
  const uniqueArtists = Array.from(
    new Map(songs.map((song) => [song.artist.id, song.artist])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const uniqueGenres = Array.from(
    new Map(
      songs
        .filter((song) => song.genre)
        .map((song) => [song.genre!.id, song.genre!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredSongs = songs
    .filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesArtist = !selectedArtistId || song.artist.id === selectedArtistId;
      const matchesGenre = !selectedGenreId || song.genre?.id === selectedGenreId;
      return matchesSearch && matchesArtist && matchesGenre;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "plays":
          return (b.play_count ?? 0) - (a.play_count ?? 0);
        case "title-az":
          return a.title.localeCompare(b.title);
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  return (
    <div className="space-y-6">
      {/* Header block */}
      <div className="border-b border-zinc-900 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
              Admin Portal
            </p>
            <h1 className="mt-1.5 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Songs Management
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Manage, edit, hide or publish active songs from the backend API database.
            </p>
          </div>
          
          <Link
            href="/admin/upload"
            className="self-start sm:self-center flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950 transition active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add new song</span>
          </Link>
        </div>
      </div>

      <AdminNotice notice={notice} />

      {/* Toolbar: Search, Filter, Sort */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-zinc-950 p-4 rounded-xl border border-zinc-900 shadow-sm">
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search by title or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-900 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedArtistId}
            onChange={(e) => setSelectedArtistId(e.target.value)}
            className="rounded-lg border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition cursor-pointer"
          >
            <option value="">All Artists</option>
            {uniqueArtists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>

          <select
            value={selectedGenreId}
            onChange={(e) => setSelectedGenreId(e.target.value)}
            className="rounded-lg border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition cursor-pointer"
          >
            <option value="">All Genres</option>
            {uniqueGenres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="rounded-lg border border-zinc-900 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="plays">Most Played</option>
            <option value="title-az">Title A-Z</option>
          </select>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Songs List Table */}
        <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-inner">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-850 text-sm text-left">
              <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-450">
                <tr>
                  <th scope="col" className="px-5 py-4 font-bold text-center w-16">Cover</th>
                  <th scope="col" className="px-5 py-4 font-bold">Title</th>
                  <th scope="col" className="px-5 py-4 font-bold">Artist</th>
                  <th scope="col" className="px-5 py-4 font-bold">Uploader</th>
                  <th scope="col" className="px-5 py-4 font-bold">Album</th>
                  <th scope="col" className="px-5 py-4 font-bold">Genre</th>
                  <th scope="col" className="px-5 py-4 font-bold">Duration</th>
                  <th scope="col" className="px-5 py-4 font-bold">Created</th>
                  <th scope="col" className="px-5 py-4 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/65">
                {loading && songs.length === 0 ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-12 w-12 bg-zinc-900 rounded-lg mx-auto"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-28"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-20"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-16"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-14"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-10"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-16"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-zinc-900 rounded w-16"></div></td>
                      <td className="px-5 py-4"><div className="h-7 bg-zinc-900 rounded w-24 mx-auto"></div></td>
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-rose-400 bg-rose-500/5">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSongs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        <span className="text-sm font-medium text-zinc-400">
                          {songs.length === 0
                            ? "No songs found in database."
                            : "No songs match the current query filters."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSongs.map((song) => (
                    <tr key={song.id} className="text-zinc-300 hover:bg-zinc-900/35 transition-colors">
                      <td className="px-5 py-3 text-center">
                        {song.cover_url ? (
                          <img
                            src={song.cover_url}
                            alt={`${song.title} artwork`}
                            className="h-12 w-12 rounded-lg object-cover border border-zinc-800 shadow-md mx-auto"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-zinc-850 bg-zinc-900/40 text-zinc-700 mx-auto shadow-sm">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold text-white min-w-44 max-w-xs truncate" title={song.title}>
                        {song.title}
                      </td>
                      <td className="px-5 py-3 text-zinc-350">{song.artist.name}</td>
                      <td className="px-5 py-3 text-zinc-400">{getUploaderLabel(song)}</td>
                      <td className="px-5 py-3 text-zinc-400">{song.album?.title ?? "Single"}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 border border-zinc-800/80">
                          {song.genre?.name ?? "Unknown"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-zinc-400">{formatDuration(song.duration_sec)}</td>
                      <td className="px-5 py-3 text-xs text-zinc-550">{formatDate(song.created_at)}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(song)}
                            className="rounded-lg border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900 hover:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition active:scale-[0.97] cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleHideSong(song)}
                            disabled={actionId === song.id}
                            className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-semibold text-rose-450 transition hover:bg-rose-500/20 hover:border-rose-500/50 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97] cursor-pointer"
                          >
                            {actionId === song.id ? "Hiding..." : "Hide"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form Panel Right */}
        <div className="flex flex-col">
          {!editingSong ? (
            <div className="flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/10 p-8 h-[500px] shadow-sm">
              <div className="mb-4 rounded-full bg-zinc-900 p-3.5 text-zinc-500 border border-zinc-800 shadow-inner">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-200">Select a song to edit</h3>
              <p className="mt-1 text-xs text-zinc-500 max-w-xs leading-relaxed">
                Choose any track from the list on the left to modify its metadata, audio files, and album cover layouts.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Edit Mode</span>
                <h3 className="text-base font-bold text-white tracking-tight mt-0.5">Edit Song Details</h3>
                <p className="text-xs text-zinc-500 truncate mt-1">
                  Editing: <strong className="text-zinc-300 font-medium">&quot;{editingSong.title}&quot;</strong>
                </p>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Title
                  <input
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    disabled={saving}
                    maxLength={200}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Artist
                  <select
                    value={form.artist_id}
                    onChange={(event) => updateForm("artist_id", event.target.value)}
                    disabled={saving}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner cursor-pointer"
                  >
                    <option value="">Select artist</option>
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
                    value={form.album_id}
                    onChange={(event) => updateForm("album_id", event.target.value)}
                    disabled={saving}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner cursor-pointer"
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
                    value={form.genre_id}
                    onChange={(event) => updateForm("genre_id", event.target.value)}
                    disabled={saving}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner cursor-pointer"
                  >
                    <option value="">No genre</option>
                    {genres.map((genre) => (
                      <option key={genre.id} value={genre.id}>
                        {genre.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  File URL
                  <input
                    value={form.file_url}
                    onChange={(event) => updateForm("file_url", event.target.value)}
                    disabled={saving}
                    maxLength={1000}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Cover URL
                  <input
                    value={form.cover_url}
                    onChange={(event) => updateForm("cover_url", event.target.value)}
                    disabled={saving}
                    maxLength={1000}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-450">
                  Duration seconds
                  <input
                    value={form.duration_sec}
                    onChange={(event) => updateForm("duration_sec", event.target.value)}
                    disabled={saving}
                    type="number"
                    min={0}
                    className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/85 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-inner"
                  />
                </label>
              </div>

              {formError && (
                <p className="text-xs text-rose-450 font-semibold bg-rose-500/5 border border-rose-500/10 rounded-lg px-3 py-2 animate-shake">
                  {formError}
                </p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-emerald-950 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-550 shadow-md shadow-emerald-500/5 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/20 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
