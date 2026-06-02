import type {
  AuthUser,
  LoginPayload,
  LoginResult,
  RegisterPayload,
} from "@/types/auth";
import type {
  AdminDashboard,
  AdminPlaylist,
  AdminUser,
  AlbumRecord,
  ArtistRecord,
  GenreRecord,
  LikedSong,
  Pagination,
  PlaylistDetail,
  RecentlyPlayedSong,
  Song,
  SongPagination,
  SongWaveform,
  SongWritePayload,
  UserPlaylist,
  FollowedArtist,
} from "@/types/music";
import {
  clearTokens,
  notifyAuthTokenCleared,
} from "@/lib/auth-storage";
import {
  normalizeArtistProfile,
  normalizePlaylistDetail,
  normalizeSongArtist,
  normalizeSongs,
} from "@/lib/song-format";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
  }
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiRequestError && error.statusCode === 401;
}

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  pagination?: SongPagination;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
};

function getResponseErrorMessage(response: Response, responseText: string) {
  const trimmedText = responseText.trim();

  if (trimmedText && !trimmedText.startsWith("<") && trimmedText.length <= 180) {
    return trimmedText;
  }

  if (response.status === 429) {
    return "Too many requests. Please try again later.";
  }

  return response.statusText || "Request failed. Please try again.";
}

type ListenSongResult = {
  song: Song;
  historySaved: boolean;
};

type LikeSongResult = {
  liked: boolean;
  alreadyLiked?: boolean;
  wasLiked?: boolean;
  songId?: string;
  like?: {
    id: string;
    user_id: string;
    song_id: string;
    liked_at: string;
  };
};

type PlaylistSongActionResult = {
  added?: boolean;
  removed?: boolean;
  alreadyExists?: boolean;
  wasInPlaylist?: boolean;
  playlistId?: string;
  songId?: string;
  trackId?: string;
  playlistSong?: {
    id: string;
    playlist_id: string;
    song_id: string;
    position: number;
    added_at: string;
  };
  playlistTrack?: {
    id: string;
    playlist_id: string;
    song_id: string;
    position: number;
    added_at: string;
  };
};

type UploadTrackPayload = {
  title: string;
  genre?: string;
  description?: string;
  audioFile: File;
  coverFile?: File | null;
};

type PlaylistWritePayload = {
  title?: string;
  name?: string;
  description?: string | null;
  cover_url?: string | null;
  is_public?: boolean;
};

type UploadTrackToPlaylistResult = PlaylistSongActionResult & {
  song: Song;
  track: Song;
};

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers();
  const isFormData = isFormDataBody(options.body);
  let requestBody: BodyInit | undefined;

  if (options.body !== undefined) {
    requestBody = isFormDataBody(options.body)
      ? options.body
      : JSON.stringify(options.body);
  }

  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: requestBody,
    cache: "no-store",
  });

  const responseText = await response.text();
  let result: ApiResponse<T> | null = null;

  try {
    result = responseText
      ? (JSON.parse(responseText) as ApiResponse<T>)
      : null;
  } catch {
    result = null;
  }

  if (!response.ok || !result?.success) {
    const message =
      result?.message ?? getResponseErrorMessage(response, responseText);

    if (response.status === 401 && options.accessToken) {
      clearTokens();
      notifyAuthTokenCleared();
    }

    throw new ApiRequestError(message, response.status);
  }

  return result;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

function getPagination<T>(
  response: ApiResponse<T[]>,
  fallbackPage: number,
  fallbackLimit: number,
) {
  return (
    response.pagination ?? {
      page: fallbackPage,
      limit: fallbackLimit,
      totalItems: response.data?.length ?? 0,
      totalPages: 1,
    }
  );
}

export async function registerRequest(payload: RegisterPayload) {
  const response = await apiRequest<{ user: AuthUser }>("/auth/register", {
    method: "POST",
    body: payload,
  });

  if (!response.data?.user) {
    throw new Error("Register response is missing user data.");
  }

  return response.data.user;
}

export async function loginRequest(payload: LoginPayload) {
  const response = await apiRequest<LoginResult>("/auth/login", {
    method: "POST",
    body: payload,
  });

  if (
    !response.data?.user ||
    !response.data.accessToken ||
    !response.data.refreshToken
  ) {
    throw new Error("Login response is missing token data.");
  }

  return response.data;
}

export async function getCurrentUserRequest(accessToken: string) {
  const response = await apiRequest<{ user: AuthUser }>("/auth/me", {
    accessToken,
  });

  if (!response.data?.user) {
    throw new Error("Current user response is missing user data.");
  }

  return response.data.user;
}

export async function updateCurrentUserRequest(
  payload: {
    displayName: string;
    bio?: string | null;
  },
  accessToken: string,
) {
  const response = await apiRequest<{ user: AuthUser }>("/auth/me", {
    method: "PATCH",
    body: {
      display_name: payload.displayName,
      bio: payload.bio,
    },
    accessToken,
  });

  if (!response.data?.user) {
    throw new Error("Update profile response is missing user data.");
  }

  return response.data.user;
}

export async function uploadCurrentUserAvatarRequest(
  avatarFile: File,
  accessToken: string,
) {
  const formData = new FormData();
  formData.append("avatar", avatarFile);

  const response = await apiRequest<{ user: AuthUser }>("/auth/me/avatar", {
    method: "POST",
    body: formData,
    accessToken,
  });

  if (!response.data?.user) {
    throw new Error("Upload avatar response is missing user data.");
  }

  return response.data.user;
}

export async function logoutRequest(refreshToken: string) {
  await apiRequest("/auth/logout", {
    method: "POST",
    body: { refreshToken },
  });
}

export async function getSongsRequest(
  page = 1,
  limit = 9,
  filters: Record<string, string | number | undefined> = {},
) {
  const response = await apiRequest<Song[]>(
    `/songs${buildQuery({ page, limit, ...filters })}`,
  );

  return {
    items: normalizeSongs(response.data ?? []),
    pagination: getPagination(response, page, limit),
  };
}

export async function getMySongsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
) {
  const response = await apiRequest<Song[]>(
    `/songs/me${buildQuery({ page, limit })}`,
    { accessToken },
  );

  return {
    items: normalizeSongs(response.data ?? []),
    pagination: getPagination(response, page, limit),
  };
}

export async function searchSongsRequest(q: string, page = 1, limit = 9) {
  const response = await apiRequest<Song[]>(
    `/songs/search${buildQuery({ q, page, limit })}`,
  );

  return {
    items: normalizeSongs(response.data ?? []),
    pagination: getPagination(response, page, limit),
  };
}

export async function getSongRequest(id: string) {
  const response = await apiRequest<Song>(`/songs/${id}`);

  if (!response.data) {
    throw new Error("Song response is missing data.");
  }

  return normalizeSongArtist(response.data);
}

export async function getSongWaveformRequest(id: string) {
  if (!id) {
    throw new Error("Song id is required.");
  }

  const response = await apiRequest<SongWaveform>(`/songs/${id}/waveform`);

  if (!response.data) {
    throw new Error("Waveform response is missing data.");
  }

  return response.data;
}

export async function saveSongWaveformRequest(
  id: string,
  payload: { peaks: number[][]; duration: number },
) {
  if (!id) {
    throw new Error("Song id is required.");
  }

  const response = await apiRequest<SongWaveform>(`/songs/${id}/waveform`, {
    method: "POST",
    body: payload,
  });

  if (!response.data) {
    throw new Error("Waveform cache response is missing data.");
  }

  return response.data;
}

export async function listenSongRequest(
  id: string,
  accessToken?: string | null,
) {
  if (!id) {
    throw new Error("Song id is required.");
  }

  const response = await apiRequest<ListenSongResult>(`/songs/${id}/listen`, {
    method: "POST",
    accessToken,
  });

  if (!response.data?.song) {
    throw new Error("Listen response is missing song data.");
  }

  return {
    ...response.data,
    song: normalizeSongArtist(response.data.song),
  };
}

export async function saveRecentlyPlayedRequest(
  songId: string,
  accessToken: string,
) {
  if (!songId) {
    throw new Error("Song id is required.");
  }

  const response = await apiRequest<RecentlyPlayedSong>("/recently-played", {
    method: "POST",
    body: { songId },
    accessToken,
  });

  if (!response.data) {
    throw new Error("Recently played response is missing song data.");
  }

  return normalizeSongArtist(response.data);
}

export async function getRecentlyPlayedRequest(accessToken: string) {
  const response = await apiRequest<RecentlyPlayedSong[]>("/recently-played", {
    accessToken,
  });

  return normalizeSongs(response.data ?? []);
}

export async function getMyLikedSongsRequest(
  accessToken: string,
  page = 1,
  limit = 100,
) {
  const response = await apiRequest<LikedSong[]>(
    `/likes/me${buildQuery({ page, limit })}`,
    { accessToken },
  );

  return {
    items: normalizeSongs(response.data ?? []),
    pagination: getPagination(response, page, limit),
  };
}

export async function likeSongRequest(songId: string, accessToken: string) {
  if (!songId) {
    throw new Error("Song id is required.");
  }

  const response = await apiRequest<LikeSongResult>("/likes/", {
    method: "POST",
    body: { songId },
    accessToken,
  });

  if (!response.data) {
    throw new Error("Like response is missing data.");
  }

  return response.data;
}

export async function unlikeSongRequest(songId: string, accessToken: string) {
  if (!songId) {
    throw new Error("Song id is required.");
  }

  const response = await apiRequest<LikeSongResult>("/likes/", {
    method: "DELETE",
    body: { songId },
    accessToken,
  });

  if (!response.data) {
    throw new Error("Unlike response is missing data.");
  }

  return response.data;
}

export async function getMyPlaylistsRequest(
  accessToken: string,
  page = 1,
  limit = 50,
) {
  const response = await apiRequest<UserPlaylist[]>(
    `/playlists/me${buildQuery({ page, limit })}`,
    { accessToken },
  );

  return {
    items: response.data ?? [],
    pagination: getPagination(response, page, limit),
  };
}

export async function getPlaylistRequest(id: string, accessToken: string) {
  const response = await apiRequest<PlaylistDetail>(`/playlists/${id}`, {
    accessToken,
  });

  if (!response.data) {
    throw new Error("Playlist response is missing data.");
  }

  return normalizePlaylistDetail(response.data);
}

export async function createPlaylistRequest(
  payload: PlaylistWritePayload,
  accessToken: string,
) {
  const response = await apiRequest<PlaylistDetail>("/playlists", {
    method: "POST",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Create playlist response is missing data.");
  }

  return normalizePlaylistDetail(response.data);
}

export async function updatePlaylistRequest(
  id: string,
  payload: PlaylistWritePayload,
  accessToken: string,
) {
  const response = await apiRequest<UserPlaylist>(`/playlists/${id}`, {
    method: "PUT",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Update playlist response is missing data.");
  }

  return response.data;
}

export async function deletePlaylistRequest(id: string, accessToken: string) {
  const response = await apiRequest<UserPlaylist>(`/playlists/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (!response.data) {
    throw new Error("Delete playlist response is missing data.");
  }

  return response.data;
}

export async function addSongToPlaylistRequest(
  playlistId: string,
  songId: string,
  accessToken: string,
) {
  const response = await apiRequest<PlaylistSongActionResult>(
    `/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      body: { track_id: songId },
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Add song response is missing data.");
  }

  return response.data;
}

export async function removeSongFromPlaylistRequest(
  playlistId: string,
  songId: string,
  accessToken: string,
) {
  const response = await apiRequest<PlaylistSongActionResult>(
    `/playlists/${playlistId}/tracks/${songId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Remove song response is missing data.");
  }

  return response.data;
}

export async function reorderPlaylistSongsRequest(
  playlistId: string,
  songs: Array<{ songId: string; position: number }>,
  accessToken: string,
) {
  const response = await apiRequest<PlaylistDetail>(
    `/playlists/${playlistId}/tracks/reorder`,
    {
      method: "PATCH",
      body: { tracks: songs },
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Reorder playlist response is missing data.");
  }

  return normalizePlaylistDetail(response.data);
}

export async function getAdminDashboardRequest(accessToken: string) {
  const response = await apiRequest<AdminDashboard>("/admin/dashboard", {
    accessToken,
  });

  if (!response.data) {
    throw new Error("Dashboard response is missing data.");
  }

  return response.data;
}

export async function getAdminUsersRequest(
  accessToken: string,
  page = 1,
  limit = 20,
  q = "",
  role = "",
) {
  const response = await apiRequest<AdminUser[]>(
    `/admin/users${buildQuery({ page, limit, q, role })}`,
    { accessToken },
  );

  return {
    items: response.data ?? [],
    pagination: getPagination(response, page, limit),
  };
}

export async function getAdminPlaylistsRequest(
  accessToken: string,
  page = 1,
  limit = 20,
  q = "",
) {
  const response = await apiRequest<AdminPlaylist[]>(
    `/admin/playlists${buildQuery({ page, limit, q })}`,
    { accessToken },
  );

  return {
    items: response.data ?? [],
    pagination: getPagination(response, page, limit),
  };
}

export async function deleteAdminPlaylistRequest(
  playlistId: string,
  accessToken: string,
) {
  const response = await apiRequest<AdminPlaylist>(
    `/admin/playlists/${playlistId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Delete playlist response is missing data.");
  }

  return response.data;
}

export async function updateAdminUserRoleRequest(
  userId: string,
  role: AdminUser["role"],
  accessToken: string,
) {
  const response = await apiRequest<AdminUser>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
    accessToken,
  });

  if (!response.data) {
    throw new Error("Update user role response is missing data.");
  }

  return response.data;
}

export async function banAdminUserRequest(
  userId: string,
  accessToken: string,
) {
  const response = await apiRequest<AdminUser>(`/admin/users/${userId}/ban`, {
    method: "PATCH",
    accessToken,
  });

  if (!response.data) {
    throw new Error("Ban user response is missing data.");
  }

  return response.data;
}

export async function unbanAdminUserRequest(
  userId: string,
  accessToken: string,
) {
  const response = await apiRequest<AdminUser>(`/admin/users/${userId}/unban`, {
    method: "PATCH",
    accessToken,
  });

  if (!response.data) {
    throw new Error("Unban user response is missing data.");
  }

  return response.data;
}

export async function createSongRequest(
  payload: SongWritePayload,
  accessToken: string,
) {
  const response = await apiRequest<Song>("/songs", {
    method: "POST",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Create song response is missing data.");
  }

  return normalizeSongArtist(response.data);
}

export async function updateSongRequest(
  id: string,
  payload: Partial<SongWritePayload>,
  accessToken: string,
) {
  const response = await apiRequest<Song>(`/songs/${id}`, {
    method: "PUT",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Update song response is missing data.");
  }

  return normalizeSongArtist(response.data);
}

export async function deleteSongRequest(id: string, accessToken: string) {
  const response = await apiRequest<{ id: string; is_active: boolean }>(
    `/songs/${id}`,
    {
      method: "DELETE",
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Delete song response is missing data.");
  }

  return response.data;
}

export async function uploadTrackRequest(
  payload: UploadTrackPayload,
  accessToken: string,
) {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("audio", payload.audioFile);

  if (payload.genre?.trim()) {
    formData.append("genre", payload.genre.trim());
  }

  if (payload.description?.trim()) {
    formData.append("description", payload.description.trim());
  }

  if (payload.coverFile) {
    formData.append("cover", payload.coverFile);
  }

  const response = await apiRequest<Song>("/songs/upload", {
    method: "POST",
    body: formData,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Upload track response is missing song data.");
  }

  return normalizeSongArtist(response.data);
}

export async function uploadTrackToPlaylistRequest(
  playlistId: string,
  payload: UploadTrackPayload,
  accessToken: string,
) {
  const formData = new FormData();

  formData.append("title", payload.title);
  formData.append("audio_file", payload.audioFile);

  if (payload.genre?.trim()) {
    formData.append("genre", payload.genre.trim());
  }

  if (payload.description?.trim()) {
    formData.append("description", payload.description.trim());
  }

  if (payload.coverFile) {
    formData.append("cover_image", payload.coverFile);
  }

  const response = await apiRequest<UploadTrackToPlaylistResult>(
    `/playlists/${playlistId}/upload-track`,
    {
      method: "POST",
      body: formData,
      accessToken,
    },
  );

  if (!response.data?.song) {
    throw new Error("Upload playlist track response is missing song data.");
  }

  return {
    ...response.data,
    song: normalizeSongArtist(response.data.song),
    track: response.data.track
      ? normalizeSongArtist(response.data.track)
      : normalizeSongArtist(response.data.song),
  };
}

export async function getArtistsRequest(page = 1, limit = 100, q = "") {
  const response = await apiRequest<ArtistRecord[]>(
    `/artists${buildQuery({ page, limit, q })}`,
  );

  return {
    items: (response.data ?? []).map((artist) => normalizeArtistProfile(artist)),
    pagination: getPagination(response, page, limit),
  };
}

export async function createArtistRequest(
  payload: { name: string; bio?: string | null; avatar_url?: string | null },
  accessToken: string,
) {
  const response = await apiRequest<ArtistRecord>("/artists", {
    method: "POST",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Create artist response is missing data.");
  }

  return normalizeArtistProfile(response.data);
}

export async function updateArtistRequest(
  id: string,
  payload: { name?: string; bio?: string | null; avatar_url?: string | null },
  accessToken: string,
) {
  const response = await apiRequest<ArtistRecord>(`/artists/${id}`, {
    method: "PUT",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Update artist response is missing data.");
  }

  return normalizeArtistProfile(response.data);
}

export async function deleteArtistRequest(id: string, accessToken: string) {
  const response = await apiRequest<ArtistRecord>(`/artists/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (!response.data) {
    throw new Error("Delete artist response is missing data.");
  }

  return response.data;
}

export async function getAlbumsRequest(page = 1, limit = 100, q = "") {
  const response = await apiRequest<AlbumRecord[]>(
    `/albums${buildQuery({ page, limit, q })}`,
  );

  return {
    items: response.data ?? [],
    pagination: getPagination(response, page, limit),
  };
}

export async function createAlbumRequest(
  payload: {
    title: string;
    artist_id: string;
    cover_url?: string | null;
    release_date?: string | null;
  },
  accessToken: string,
) {
  const response = await apiRequest<AlbumRecord>("/albums", {
    method: "POST",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Create album response is missing data.");
  }

  return response.data;
}

export async function updateAlbumRequest(
  id: string,
  payload: {
    title?: string;
    artist_id?: string;
    cover_url?: string | null;
    release_date?: string | null;
  },
  accessToken: string,
) {
  const response = await apiRequest<AlbumRecord>(`/albums/${id}`, {
    method: "PUT",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Update album response is missing data.");
  }

  return response.data;
}

export async function deleteAlbumRequest(id: string, accessToken: string) {
  const response = await apiRequest<{ id: string }>(`/albums/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (!response.data) {
    throw new Error("Delete album response is missing data.");
  }

  return response.data;
}

export async function getGenresRequest(page = 1, limit = 100, q = "") {
  const response = await apiRequest<GenreRecord[]>(
    `/genres${buildQuery({ page, limit, q })}`,
  );

  return {
    items: response.data ?? [],
    pagination: getPagination(response, page, limit),
  };
}

export async function createGenreRequest(
  payload: { name: string; slug: string },
  accessToken: string,
) {
  const response = await apiRequest<GenreRecord>("/genres", {
    method: "POST",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Create genre response is missing data.");
  }

  return response.data;
}

export async function updateGenreRequest(
  id: string,
  payload: { name?: string; slug?: string },
  accessToken: string,
) {
  const response = await apiRequest<GenreRecord>(`/genres/${id}`, {
    method: "PUT",
    body: payload,
    accessToken,
  });

  if (!response.data) {
    throw new Error("Update genre response is missing data.");
  }

  return response.data;
}

export async function deleteGenreRequest(id: string, accessToken: string) {
  const response = await apiRequest<GenreRecord>(`/genres/${id}`, {
    method: "DELETE",
    accessToken,
  });

  if (!response.data) {
    throw new Error("Delete genre response is missing data.");
  }

  return response.data;
}

async function uploadFileRequest(
  path: string,
  file: File,
  accessToken: string,
) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiRequest<{ url: string }>(path, {
    method: "POST",
    body: formData,
    accessToken,
  });

  if (!response.data?.url) {
    throw new Error("Upload response is missing file URL.");
  }

  return response.data.url;
}

export async function uploadAudioRequest(file: File, accessToken: string) {
  return uploadFileRequest("/upload/audio", file, accessToken);
}

export async function uploadCoverRequest(file: File, accessToken: string) {
  return uploadFileRequest("/upload/cover", file, accessToken);
}

export type PaginatedResult<T> = {
  items: T[];
  pagination: Pagination;
};

export function resolveApiAssetUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  const apiOrigin = API_URL.replace(/\/api\/?$/, "");
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  return `${apiOrigin}${normalizedPath}`;
}

export async function followUserRequest(userId: string, accessToken: string) {
  if (!userId) {
    throw new Error("User/Artist id is required.");
  }

  const response = await apiRequest<{ followed: boolean; message: string }>(
    `/follow/${userId}`,
    {
      method: "POST",
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Follow response is missing data.");
  }

  return response.data;
}

export async function unfollowUserRequest(userId: string, accessToken: string) {
  if (!userId) {
    throw new Error("User/Artist id is required.");
  }

  const response = await apiRequest<{ unfollowed: boolean }>(
    `/follow/${userId}`,
    {
      method: "DELETE",
      accessToken,
    },
  );

  if (!response.data) {
    throw new Error("Unfollow response is missing data.");
  }

  return response.data;
}

export async function getFollowingRequest(accessToken: string) {
  const response = await apiRequest<FollowedArtist[]>("/follow/following", {
    accessToken,
  });

  return (response.data ?? []).map((artist) => normalizeArtistProfile(artist));
}

export async function getFeedRequest(accessToken: string, page = 1, limit = 9) {
  const response = await apiRequest<Song[]>(
    `/feed${buildQuery({ page, limit })}`,
    { accessToken },
  );

  return {
    items: normalizeSongs(response.data ?? []),
    pagination: getPagination(response, page, limit),
  };
}

export async function getArtistRequest(id: string) {
  const response = await apiRequest<ArtistRecord>(`/artists/${id}`);

  if (!response.data) {
    throw new Error("Artist response is missing data.");
  }

  return normalizeArtistProfile(response.data);
}

export async function getArtistSongsRequest(id: string, page = 1, limit = 10) {
  const response = await apiRequest<Song[]>(
    `/artists/${id}/songs${buildQuery({ page, limit })}`,
  );

  return {
    items: normalizeSongs(response.data ?? []),
    pagination: getPagination(response, page, limit),
  };
}

export async function getFollowStatusRequest(
  artistId: string,
  accessToken: string,
) {
  const response = await apiRequest<{
    followed: boolean;
    isSelf: boolean;
    followingId: string;
  }>(`/follow/status/${artistId}`, {
    accessToken,
  });

  if (!response.data) {
    throw new Error("Follow status response is missing data.");
  }

  return response.data;
}
