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
  isUnauthorizedError,
  listenSongRequest,
  saveRecentlyPlayedRequest,
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
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const queue = usePlayerStore((state) => state.queue);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const seekTarget = usePlayerStore((state) => state.seekTarget);
  const seekVersion = usePlayerStore((state) => state.seekVersion);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setIsPlaying = usePlayerStore((state) => state.setIsPlaying);
  const setPlayerError = usePlayerStore((state) => state.setPlayerError);
  const seek = usePlayerStore((state) => state.seek);
  const nextSong = usePlayerStore((state) => state.nextSong);
  const clearSeekRequest = usePlayerStore((state) => state.clearSeekRequest);
  const audioSrc = currentSong ? getSongAudioUrl(currentSong) : null;

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
    saveLocalRecentlyPlayed(currentSong);

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

    void saveRecentlyPlayedRequest(currentSong.id, accessToken)
      .catch((recentlyPlayedError) => {
        handleActivityError(
          recentlyPlayedError,
          "Audio is playing, but play activity could not be saved.",
        );
      })
      .finally(() => {
        window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));
      });
  }, [accessToken, currentSong, setPlayerError]);

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

    if (!currentSong || queue.length <= 1) {
      setIsPlaying(false);
      return;
    }

    const currentIndex = queue.findIndex((song) => song.id === currentSong.id);
    const isLastTrack = currentIndex >= queue.length - 1;

    if (shuffle || repeatMode === "all" || !isLastTrack) {
      nextSong();
      return;
    }

    setIsPlaying(false);
  }, [
    currentSong,
    nextSong,
    queue,
    repeatMode,
    seek,
    setIsPlaying,
    setPlayerError,
    shuffle,
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
