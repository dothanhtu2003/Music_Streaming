"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { listenSongRequest, saveRecentlyPlayedRequest } from "@/lib/api";
import {
  RECENTLY_PLAYED_UPDATED_EVENT,
  saveLocalRecentlyPlayed,
} from "@/lib/recently-played-storage";
import { getSongAudioUrl } from "@/lib/song-format";
import type { Song } from "@/types/music";

type PlayerContextValue = {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  volume: number;
  repeat: boolean;
  shuffle: boolean;
  currentTime: number;
  duration: number;
  playerError: string | null;
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

type PlayerProviderProps = {
  children: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function setAudioCurrentTime(audio: HTMLAudioElement, time: number) {
  try {
    audio.currentTime = time;
  } catch {
    // Some browsers reject seeking before metadata is ready.
  }
}

function buildQueue(selectedSong: Song, songs?: Song[]) {
  const nextQueue: Song[] = [];
  const seenIds = new Set<string>();
  const source = songs?.length ? songs : [selectedSong];

  source.forEach((song) => {
    if (!seenIds.has(song.id)) {
      nextQueue.push(song);
      seenIds.add(song.id);
    }
  });

  if (!seenIds.has(selectedSong.id)) {
    return [selectedSong, ...nextQueue];
  }

  return nextQueue;
}

export function PlayerProvider({ children }: PlayerProviderProps) {
  const { accessToken } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);
  const listenedSongIdRef = useRef<string | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const audioSrc = currentSong ? getSongAudioUrl(currentSong) : null;

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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
  }, [audioSrc]);

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

  const playAudio = useCallback(() => {
    const audio = audioRef.current;

    setPlayerError(null);
    setIsPlaying(true);

    if (!audio) {
      return;
    }

    attemptPlayback();
  }, [attemptPlayback]);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const selectSong = useCallback(
    (song: Song, shouldPlay = true) => {
      const isSameSong = currentSong?.id === song.id;
      const audio = audioRef.current;

      listenedSongIdRef.current = null;
      setCurrentSong(song);
      setCurrentTime(0);
      setDuration(song.duration_sec);
      setPlayerError(null);
      setIsPlaying(shouldPlay);

      if (isSameSong && audio) {
        setAudioCurrentTime(audio, 0);

        if (shouldPlay) {
          playAudio();
        } else {
          pauseAudio();
        }
      }
    },
    [currentSong?.id, pauseAudio, playAudio],
  );

  const playSong = useCallback(
    (song: Song, nextQueue?: Song[]) => {
      setQueue(buildQueue(song, nextQueue));
      selectSong(song);
    },
    [selectSong],
  );

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      const audioDuration =
        audio && Number.isFinite(audio.duration) ? audio.duration : duration;
      const nextTime = clamp(time, 0, audioDuration || 0);

      if (audio) {
        setAudioCurrentTime(audio, nextTime);
      }

      setCurrentTime(nextTime);
    },
    [duration],
  );

  const playNext = useCallback(() => {
    if (!currentSong && queue.length > 0) {
      selectSong(queue[0]);
      return;
    }

    if (!currentSong) {
      return;
    }

    if (queue.length <= 1) {
      selectSong(currentSong);
      return;
    }

    if (shuffle && queue.length > 1) {
      const currentIndex = queue.findIndex(
        (item) => item.id === currentSong.id,
      );
      let nextIndex = currentIndex;

      while (nextIndex === currentIndex) {
        nextIndex = Math.floor(Math.random() * queue.length);
      }

      selectSong(queue[nextIndex] ?? currentSong);
      return;
    }

    const currentIndex = queue.findIndex((item) => item.id === currentSong.id);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % queue.length;

    selectSong(queue[nextIndex] ?? currentSong);
  }, [currentSong, queue, selectSong, shuffle]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;

    if ((audio?.currentTime ?? currentTime) > 3) {
      seek(0);
      playAudio();
      return;
    }

    if (!currentSong && queue.length > 0) {
      selectSong(queue[0]);
      return;
    }

    if (!currentSong) {
      return;
    }

    if (queue.length <= 1) {
      selectSong(currentSong);
      return;
    }

    const currentIndex = queue.findIndex((item) => item.id === currentSong.id);
    const previousIndex =
      currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;

    selectSong(queue[previousIndex] ?? currentSong);
  }, [currentSong, currentTime, playAudio, queue, seek, selectSong]);

  const togglePlay = useCallback(() => {
    if (!currentSong && queue.length > 0) {
      selectSong(queue[0]);
      return;
    }

    if (!currentSong) {
      return;
    }

    setPlayerError(null);
    setIsPlaying((playing) => !playing);
  }, [currentSong, queue, selectSong]);

  const changeVolume = useCallback((nextVolume: number) => {
    if (!Number.isFinite(nextVolume)) {
      return;
    }

    const safeVolume = clamp(nextVolume, 0, 1);

    if (audioRef.current) {
      audioRef.current.volume = safeVolume;
    }

    setVolumeState(safeVolume);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat((currentValue) => !currentValue);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((currentValue) => !currentValue);
  }, []);

  const reportListen = useCallback(() => {
    if (!currentSong || listenedSongIdRef.current === currentSong.id) {
      return;
    }

    listenedSongIdRef.current = currentSong.id;

    if (!accessToken) {
      saveLocalRecentlyPlayed(currentSong);

      void listenSongRequest(currentSong.id).catch(() => {
        listenedSongIdRef.current = null;
        setPlayerError("Audio is playing, but listen count could not be saved.");
      });

      return;
    }

    void Promise.all([
      listenSongRequest(currentSong.id, accessToken),
      saveRecentlyPlayedRequest(currentSong.id, accessToken),
    ])
      .then(() => {
        window.dispatchEvent(new Event(RECENTLY_PLAYED_UPDATED_EVENT));
      })
      .catch(() => {
        listenedSongIdRef.current = null;
        setPlayerError("Audio is playing, but play activity could not be saved.");
      });
  }, [accessToken, currentSong]);

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
  }, [currentSong?.duration_sec]);

  const handleCanPlay = useCallback(() => {
    attemptPlayback();
  }, [attemptPlayback]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    reportListen();
  }, [reportListen]);

  const handlePause = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || audio.ended) {
      return;
    }

    // Ignore pause events fired while loading a new track if playback is still intended.
    if (!isPlayingRef.current) {
      setIsPlaying(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    if (repeat) {
      const audio = audioRef.current;

      listenedSongIdRef.current = null;
      seek(0);
      setIsPlaying(true);

      if (audio) {
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

    if (shuffle) {
      playNext();
      return;
    }

    const currentIndex = queue.findIndex((song) => song.id === currentSong.id);

    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      playNext();
      return;
    }

    setIsPlaying(false);
  }, [currentSong, playNext, queue, repeat, seek, shuffle]);

  const handleAudioError = useCallback(() => {
    setIsPlaying(false);
    setPlayerError("Could not load this audio file.");
  }, []);

  const value = useMemo(
    () => ({
      currentSong,
      queue,
      isPlaying,
      volume,
      repeat,
      shuffle,
      currentTime,
      duration,
      playerError,
      playSong,
      togglePlay,
      playNext,
      playPrevious,
      seek,
      setVolume: changeVolume,
      toggleRepeat,
      toggleShuffle,
    }),
    [
      currentSong,
      queue,
      isPlaying,
      volume,
      repeat,
      shuffle,
      currentTime,
      duration,
      playerError,
      playSong,
      togglePlay,
      playNext,
      playPrevious,
      seek,
      changeVolume,
      toggleRepeat,
      toggleShuffle,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
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
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error("usePlayer must be used inside PlayerProvider.");
  }

  return context;
}
