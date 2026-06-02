import type { Song } from "@/types/music";

export const SONG_CATALOG_UPDATED_EVENT = "music_song_catalog_updated";

const PENDING_UPLOADED_SONG_KEY = "music_pending_uploaded_song_id";

export type SongCatalogUpdatedDetail = {
  reason: "upload";
  song?: Song;
  songId?: string;
};

export function notifySongUploaded(song: Song) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(PENDING_UPLOADED_SONG_KEY, song.id);
  } catch {
    // The live event still updates mounted pages if session storage is blocked.
  }

  window.dispatchEvent(
    new CustomEvent<SongCatalogUpdatedDetail>(SONG_CATALOG_UPDATED_EVENT, {
      detail: {
        reason: "upload",
        song,
        songId: song.id,
      },
    }),
  );
}

export function consumePendingUploadedSongId() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const songId = window.sessionStorage.getItem(PENDING_UPLOADED_SONG_KEY);
    window.sessionStorage.removeItem(PENDING_UPLOADED_SONG_KEY);

    return songId;
  } catch {
    return null;
  }
}
