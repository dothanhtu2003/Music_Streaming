"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getSongsRequest,
  isUnauthorizedError,
  listenSongRequest,
  saveRecentlyPlayedSong,
} from "@/lib/api";
import {
  RECENTLY_PLAYED_UPDATED_EVENT,
  saveLocalRecentlyPlayed,
} from "@/lib/recently-played-storage";
import { getSongAudioUrl } from "@/lib/song-format";
import {
  usePlayerStore,
  type PlayerStore,
  type RepeatMode,
} from "@/stores/player-store";

type PlayerRuntimeValue = {
  audioRef: RefObject<HTMLAudioElement | null>;
};

type PlayerValue = PlayerStore &
  PlayerRuntimeValue & {
    repeat: boolean;
    playNext: () => void;
    playPrevious: () => void;
    seekTo: (time: number) => void;
    toggleRepeat: () => void;
  };

type PlayerProviderProps = {
  children: ReactNode;
};

const PlayerRuntimeContext = createContext<PlayerRuntimeValue | null>(null);

function setAudioCurrentTime(audio: HTMLAudioElement, time: number) {
  try {
    audio.currentTime = time;
  } catch {
    // Some browsers reject seeking before metadata is ready.
  }
}

export function PlayerProvider({ children }: PlayerProviderProps) {
  const { accessToken } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const listenedSongIdRef = useRef<string | null>(null);

  const currentSong = usePlayerStore((state) => state.currentSong);
  const recentlyPlayedContext = usePlayerStore(
    (state) => state.recentlyPlayedContext,
  );
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const seekTarget = usePlayerStore((state) => state.seekTarget);
  const seekVersion = usePlayerStore((state) => state.seekVersion);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setPlayerError = usePlayerStore((state) => state.setPlayerError);
  const seek = usePlayerStore((state) => state.seek);
  const nextSongAfterEnd = usePlayerStore((state) => state.nextSongAfterEnd);
  const clearSeekRequest = usePlayerStore((state) => state.clearSeekRequest);
  const setAllCatalogSongs = usePlayerStore((state) => state.setAllCatalogSongs);
  const audioSrc = currentSong ? getSongAudioUrl(currentSong) : null;

  useEffect(() => {
    let isMounted = true;

    async function loadCatalogSongs() {
      try {
        const firstPage = await getSongsRequest(1, 100);
        const remainingPages = Array.from(
          { length: Math.max(0, firstPage.pagination.totalPages - 1) },
          (_, index) => index + 2,
        );
        const remainingResults = await Promise.allSettled(
          remainingPages.map((page) => getSongsRequest(page, 100)),
        );

        if (isMounted) {
          setAllCatalogSongs([
            ...firstPage.items,
            ...remainingResults.flatMap((result) =>
              result.status === "fulfilled" ? result.value.items : [],
            ),
          ]);
        }
      } catch {
        // Playback can still continue with the queue supplied by the page.
      }
    }

    void loadCatalogSongs();

    return () => {
      isMounted = false;
    };
  }, [setAllCatalogSongs]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    listenedSongIdRef.current = null;
  }, [currentSong?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const attemptPlayback = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || !audioSrc || !isPlayingRef.current) {
      return;
    }

    setPlayerError(null);

    void audio.play().catch(() => {
      if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setIsPlaying(false);
        setPlayerError("Could not play this audio file.");
      }
    });
  }, [audioSrc, setIsPlaying, setPlayerError]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!audioSrc) {
      audio.pause();
      return;
    }

    if (isPlaying) {
      attemptPlayback();
      return;
    }

    audio.pause();
  }, [audioSrc, attemptPlayback, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || seekTarget === null) {
      return;
    }

    setAudioCurrentTime(audio, seekTarget);
    clearSeekRequest();
  }, [clearSeekRequest, seekTarget, seekVersion]);

  const reportListen = useCallback(() => {
    if (!currentSong || listenedSongIdRef.current === currentSong.id) {
      return;
    }

    listenedSongIdRef.current = currentSong.id;

    if (!recentlyPlayedContext) {
      saveLocalRecentlyPlayed(currentSong);
    }

    const handleActivityError = (error: unknown, message: string) => {
      if (isUnauthorizedError(error)) {
        return;
      }

      listenedSongIdRef.current = null;
      setPlayerError(message);
    };

    if (!accessToken) {
      window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));

      void listenSongRequest(currentSong.id).catch((listenError) => {
        handleActivityError(
          listenError,
          "Audio is playing, but listen count could not be saved.",
        );
      });

      return;
    }

    void listenSongRequest(currentSong.id, accessToken).catch((listenError) => {
      handleActivityError(
        listenError,
        "Audio is playing, but listen count could not be saved.",
      );
    });

    if (!recentlyPlayedContext) {
      void saveRecentlyPlayedSong(currentSong.id, accessToken)
        .catch((recentlyPlayedError) => {
          if (isUnauthorizedError(recentlyPlayedError)) {
            return;
          }

          console.warn("Failed to save recently played song", recentlyPlayedError);
        })
        .finally(() => {
          window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));
        });
    }
  }, [accessToken, currentSong, recentlyPlayedContext, setPlayerError]);

  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setDuration(
      Number.isFinite(audio.duration)
        ? audio.duration
        : (currentSong?.duration_sec ?? 0),
    );
  }, [currentSong?.duration_sec, setDuration]);

  const handleCanPlay = useCallback(() => {
    attemptPlayback();
  }, [attemptPlayback]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  }, [setCurrentTime]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    reportListen();
  }, [reportListen, setIsPlaying]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || audio.ended) {
      return;
    }

    if (!isPlayingRef.current) {
      setIsPlaying(false);
    }
  }, [setIsPlaying]);

  const handleEnded = useCallback(() => {
    if (repeatMode === "one") {
      const audio = audioRef.current;

      listenedSongIdRef.current = null;
      seek(0);
      setIsPlaying(true);

      if (audio) {
        setAudioCurrentTime(audio, 0);

        void audio.play().catch(() => {
          setIsPlaying(false);
          setPlayerError("Could not play this audio file.");
        });
      }

      return;
    }

    if (!currentSong) {
      setIsPlaying(false);
      return;
    }

    nextSongAfterEnd();
  }, [
    currentSong,
    nextSongAfterEnd,
    repeatMode,
    seek,
    setIsPlaying,
    setPlayerError,
  ]);

  const handleAudioError = useCallback(() => {
    setIsPlaying(false);
    setPlayerError("Could not load this audio file.");
  }, [setIsPlaying, setPlayerError]);

  const runtimeValue = useMemo(() => ({ audioRef }), []);

  return (
    <PlayerRuntimeContext.Provider value={runtimeValue}>
      {children}
      <audio
        ref={audioRef}
        src={audioSrc ?? undefined}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleAudioError}
      />
    </PlayerRuntimeContext.Provider>
  );
}

export function usePlayer(): PlayerValue {
  const runtime = useContext(PlayerRuntimeContext);
  const player = usePlayerStore();

  if (!runtime) {
    throw new Error("usePlayer must be used inside PlayerProvider.");
  }

  return {
    ...player,
    ...runtime,
    repeat: player.repeatMode !== "off",
    playNext: player.nextSong,
    playPrevious: player.previousSong,
    seekTo: player.seek,
    toggleRepeat: player.toggleRepeatMode,
  };
}

export type { RepeatMode };
