"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSongsRequest, resolveApiAssetUrl } from "@/lib/api";
import { usePlayerStore } from "@/stores/player-store";
import {
  PlayIcon,
  PauseIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import type { Song } from "@/types/music";

export default function AboutPage() {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const playSong = usePlayerStore((state) => state.playSong);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);

  // Audio Launchpad State
  const [activePads, setActivePads] = useState<boolean[]>(Array(8).fill(false));
  const [mixerLevels, setMixerLevels] = useState({
    bass: 75,
    treble: 60,
    tempo: 128,
  });
  const [isVisualizerBouncing, setIsVisualizerBouncing] = useState(false);

  const slides = [
    {
      subtitle: "STAGE A — AUDIO INCEPTION",
      title: "IT ALL STARTS WITH AN UPLOAD.",
      description: "Music is where you define what's next. Drop your audio tracks directly and broadcast your frequency to global listeners instantly.",
      primaryText: "Drop Your Frequency",
      primaryHref: "/upload",
      secondaryText: "Scan Trending",
      secondaryHref: "#trending",
      accentGlow: "bg-orange-500/10",
      accentText: "text-orange-400 border-orange-500/25 bg-orange-500/10",
      gradAccent: "from-orange-500 via-orange-600 to-amber-500"
    },
    {
      subtitle: "STAGE B — ARTIST RADAR",
      title: "AMP UP YOUR COMMUNITY.",
      description: "Own your audience. Connect directly with listeners, drop updates, and analyze real-time streaming data on our advanced artist studio.",
      primaryText: "Launch Artist Studio",
      primaryHref: "/studio",
      secondaryText: "Meet Creators",
      secondaryHref: "#lineup",
      accentGlow: "bg-purple-500/10",
      accentText: "text-purple-400 border-purple-500/25 bg-purple-500/10",
      gradAccent: "from-purple-500 via-pink-600 to-rose-500"
    },
    {
      subtitle: "STAGE C — SEAMLESS SYNC",
      title: "THE BEAT GOES EVERYWHERE.",
      description: "Engineered for pure mobility. Sync your libraries, likes, and playlists across web, mobile, and tablets without missing a single beat.",
      primaryText: "Get Mobile App",
      primaryHref: "#download",
      secondaryText: "Enter Stream",
      secondaryHref: "/",
      accentGlow: "bg-cyan-500/10",
      accentText: "text-cyan-400 border-cyan-500/25 bg-cyan-500/10",
      gradAccent: "from-cyan-500 via-teal-500 to-emerald-500"
    }
  ];

  // Auto rotation of slides
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [slides.length]);

  // Fetch trending songs
  useEffect(() => {
    let isMounted = true;
    const fetchTrending = async () => {
      try {
        const result = await getSongsRequest(1, 6, { sort: "plays" });
        if (isMounted) {
          setTrendingSongs(result.items);
        }
      } catch (err) {
        console.error("Failed to load trending songs:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void fetchTrending();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlaySong = (song: Song) => {
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      playSong(song, trendingSongs);
    }
  };

  // Web Audio Launchpad Sound Generator
  const playSynthSound = (padIndex: number) => {
    try {
      const audioWindow = window as Window &
        typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        };
      const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Apply mixer volume modifier based on type
      let volModifier = 1.0;
      if (padIndex < 4) { // Drums & FX
        volModifier = mixerLevels.bass / 100;
      } else { // Melodic Synths
        volModifier = mixerLevels.treble / 100;
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (padIndex === 0) { // Kick Drum
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.22);
        gain.gain.setValueAtTime(0.85 * volModifier, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (padIndex === 1) { // Snare Hit
        osc.type = "triangle";
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
        gain.gain.setValueAtTime(0.6 * volModifier, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (padIndex === 2) { // Hi-Hat Click
        osc.type = "square";
        osc.frequency.setValueAtTime(9000, now);
        gain.gain.setValueAtTime(0.12 * volModifier, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (padIndex === 3) { // Cyber Laser FX
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.28);
        gain.gain.setValueAtTime(0.35 * volModifier, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else { // Melodic chords (C4, Eb4, G4, Bb4)
        const notes = [261.63, 311.13, 392.00, 466.16]; // Chord notes
        const freq = notes[padIndex - 4];
        
        // EDM Style Filter Sweep
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
        filter.frequency.exponentialRampToValueAtTime(300, now + 0.45);

        osc.disconnect(gain);
        osc.connect(filter);
        filter.connect(gain);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.25 * volModifier, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn("Audio Context blocked or not supported", e);
    }
  };

  const handlePadClick = (idx: number) => {
    playSynthSound(idx);
    setActivePads((prev) => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
    setTimeout(() => {
      setActivePads((prev) => {
        const next = [...prev];
        next[idx] = false;
        return next;
      });
    }, 200);

    // Shake visualizer
    setIsVisualizerBouncing(true);
    setTimeout(() => setIsVisualizerBouncing(false), 250);
  };

  const pads = [
    { name: "KICK DRUM", color: "from-orange-500 to-red-600", border: "border-orange-500/50", text: "text-orange-400" },
    { name: "SNARE", color: "from-pink-500 to-rose-600", border: "border-pink-500/50", text: "text-pink-400" },
    { name: "HI-HAT", color: "from-yellow-500 to-amber-600", border: "border-yellow-500/50", text: "text-yellow-400" },
    { name: "CYBER LASER", color: "from-cyan-500 to-blue-600", border: "border-cyan-500/50", text: "text-cyan-400" },
    { name: "LEAD C4", color: "from-purple-500 to-violet-700", border: "border-purple-500/50", text: "text-purple-400" },
    { name: "LEAD Eb4", color: "from-blue-500 to-indigo-700", border: "border-blue-500/50", text: "text-blue-400" },
    { name: "LEAD G4", color: "from-indigo-500 to-fuchsia-700", border: "border-indigo-500/50", text: "text-indigo-400" },
    { name: "LEAD Bb4", color: "from-emerald-500 to-teal-700", border: "border-emerald-500/50", text: "text-emerald-400" },
  ];

  return (
    <div className="w-full text-zinc-350 page-fade-in select-none bg-[#050505] cyber-grid relative overflow-x-hidden">
      {/* Decorative Neon Blurs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-orange-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[45vw] h-[45vw] bg-purple-500/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[5%] w-[40vw] h-[40vw] bg-cyan-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* 1. Gigantic Cyber Billboard (Hero Slide) */}
      <section className="relative w-full min-h-[92vh] flex flex-col justify-center items-center px-6 py-20 sm:px-12 lg:px-24 border-b border-zinc-900">
        {/* Backdrop Image & Gradients */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out scale-[1.01] opacity-60" 
          style={{ backgroundImage: `url('/about_hero_bg.png')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-[#050505]/85 to-[#050505]" />
        
        {/* Scan lines / Cyber pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.003)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none" />

        {/* Carousel Slide Content */}
        <div key={activeSlide} className="relative z-10 max-w-5xl mx-auto text-center space-y-8 hero-fade-in">
          <span className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] shadow-lg transition-all duration-500",
            slides[activeSlide].accentText
          )}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            {slides[activeSlide].subtitle}
          </span>
          
          <h1 className="text-4xl sm:text-7xl md:text-8xl font-black tracking-tight text-white leading-[0.95] font-sans italic uppercase">
            {slides[activeSlide].title.split(" ").map((word, idx, arr) => {
              const isAccent = idx >= arr.length - 2;
              return (
                <span key={idx} className={cn(
                  "inline-block mr-3 sm:mr-5 transition-all duration-500",
                  isAccent 
                    ? `bg-gradient-to-r ${slides[activeSlide].gradAccent} bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(255,85,0,0.15)]`
                    : "text-stroke-cyber"
                )}>
                  {word}
                </span>
              );
            })}
          </h1>
          
          <p className="text-sm sm:text-xl text-zinc-400 leading-relaxed font-medium max-w-3xl mx-auto drop-shadow-md">
            {slides[activeSlide].description}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-5 pt-6">
            <Link
              href={slides[activeSlide].primaryHref}
              className={cn(
                "px-9 py-4 text-xs font-black uppercase tracking-widest rounded-full text-white shadow-xl transition-all duration-300 hover:scale-[1.04] active:scale-95",
                activeSlide === 0 && "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/20 hover:shadow-orange-500/40",
                activeSlide === 1 && "bg-gradient-to-r from-purple-500 to-pink-500 shadow-purple-500/20 hover:shadow-purple-500/40",
                activeSlide === 2 && "bg-gradient-to-r from-cyan-500 to-teal-500 shadow-cyan-500/20 hover:shadow-cyan-500/40"
              )}
            >
              {slides[activeSlide].primaryText}
            </Link>
            <Link
              href={slides[activeSlide].secondaryHref}
              className="px-9 py-4 text-xs font-black uppercase tracking-widest rounded-full bg-zinc-950/80 border border-zinc-800 text-zinc-350 hover:text-white hover:border-zinc-650 hover:bg-zinc-900/50 backdrop-blur-md transition-all duration-300 hover:scale-[1.04] active:scale-95"
            >
              {slides[activeSlide].secondaryText}
            </Link>
          </div>
        </div>

        {/* Carousel Slide Indicators */}
        <div className="absolute bottom-12 left-0 right-0 z-10 flex justify-center items-center gap-4">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSlide(idx)}
              className={cn(
                "h-2.5 rounded-full transition-all duration-500 cursor-pointer",
                activeSlide === idx 
                  ? cn(
                      "w-10", 
                      idx === 0 && "bg-orange-500",
                      idx === 1 && "bg-purple-500",
                      idx === 2 && "bg-cyan-500"
                    )
                  : "w-2.5 bg-zinc-800 hover:bg-zinc-600"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* 2. Infinite Rave Marquee Ticker */}
      <div className="w-full bg-[#0d0d0f] border-y border-zinc-900 py-3.5 overflow-hidden z-20 relative">
        <div className="animate-marquee whitespace-nowrap flex items-center gap-16 font-mono text-xs font-black tracking-[0.25em] text-zinc-500">
          <span>✦ MUSIC RAVE ENGINE ONLINE</span>
          <span className="text-orange-500">✦ BROADCAST YOUR AUDIO FREQUENCY</span>
          <span>✦ 100% INDEPENDENT CREATORS</span>
          <span className="text-purple-500">✦ EXCLUSIVE STUDIO ANALYTICS</span>
          <span>✦ SYNCHRONIZED ACROSS DEVICES</span>
          <span className="text-cyan-500">✦ DESIGNED FOR REMARKABLE SOUNDS</span>
          {/* Repeating for infinite loop effect */}
          <span>✦ MUSIC RAVE ENGINE ONLINE</span>
          <span className="text-orange-500">✦ BROADCAST YOUR AUDIO FREQUENCY</span>
          <span>✦ 100% INDEPENDENT CREATORS</span>
          <span className="text-purple-500">✦ EXCLUSIVE STUDIO ANALYTICS</span>
          <span>✦ SYNCHRONIZED ACROSS DEVICES</span>
          <span className="text-cyan-500">✦ DESIGNED FOR REMARKABLE SOUNDS</span>
        </div>
      </div>

      {/* 3. Interactive Web Audio Launchpad & DJ Mixer Dashboard */}
      <section className="max-w-7xl mx-auto px-6 py-24 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em] bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded">
            EXPERIENCE THE SOUND
          </span>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight uppercase italic">
            Cyber Sound Launchpad
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium leading-relaxed">
            Unleash your creativity. Tap the synthesizer pads below to trigger real-time audio waveforms. Adjust the DJ mixer decks to sculpt the frequencies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
          {/* Column A: Launchpad Grid */}
          <div className="lg:col-span-8 bg-zinc-950/80 border border-zinc-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/[0.02] rounded-full blur-2xl pointer-events-none" />
            
            {/* Header: Visualizer */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                  Synthesizer Console v1.0
                </span>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black text-zinc-300 font-mono tracking-wider">
                    DECK READY // WEB_AUDIO_API
                  </span>
                </div>
              </div>

              {/* Simulated Waveform Visualizer */}
              <div className="h-8 flex items-end gap-1 px-3 bg-black/40 rounded-lg border border-zinc-900/60 overflow-hidden">
                {Array.from({ length: 14 }).map((_, i) => {
                  const delay = 0.1 * (i % 5);
                  const bounceHeight = 20 + ((i * 37) % 80);
                  return (
                    <span
                      key={i}
                      className={cn(
                        "w-1 rounded-t bg-gradient-to-t from-orange-500 to-pink-500 transition-all duration-300",
                        isVisualizerBouncing ? "animate-none" : "eq-bar"
                      )}
                      style={{
                        height: isVisualizerBouncing ? `${bounceHeight}%` : undefined,
                        animationDelay: `${delay}s`,
                        animationDuration: isVisualizerBouncing ? "0.15s" : "0.8s"
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Pad Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {pads.map((pad, idx) => {
                const isActive = activePads[idx];
                return (
                  <button
                    key={idx}
                    onClick={() => handlePadClick(idx)}
                    className={cn(
                      "aspect-[4/3] rounded-2xl border flex flex-col items-center justify-center p-4 relative overflow-hidden transition-all duration-200 cursor-pointer select-none group active:scale-95",
                      pad.border,
                      isActive 
                        ? `bg-gradient-to-br ${pad.color} text-black border-transparent shadow-2xl scale-[0.98]` 
                        : "bg-zinc-950 hover:bg-zinc-900/80 text-zinc-400 hover:text-white"
                    )}
                  >
                    {/* Glowing highlight */}
                    <span className={cn(
                      "absolute inset-0 opacity-10 bg-gradient-to-br transition-all duration-300 group-hover:opacity-20",
                      pad.color
                    )} />
                    
                    {/* Pad Number */}
                    <span className="absolute top-2 left-3 font-mono text-[9px] font-bold opacity-45">
                      PAD 0{idx + 1}
                    </span>

                    {/* Sound waves icon on active */}
                    <span className="mb-1">
                      {idx < 4 ? "🥁" : "🎹"}
                    </span>

                    {/* Pad Label */}
                    <span className={cn(
                      "text-xs font-black tracking-widest uppercase transition-colors duration-300",
                      isActive ? "text-black" : "text-zinc-300 group-hover:text-white"
                    )}>
                      {pad.name.split(" ")[0]}
                    </span>
                    <span className="text-[8px] font-mono opacity-50 font-bold mt-1">
                      {idx < 4 ? "ONE-SHOT" : "POLY-SYNTH"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hint footer */}
            <div className="text-[10px] font-mono text-zinc-500 text-center border-t border-zinc-900/60 pt-4">
              * Tap pads to compose dynamic loops. Best experienced with headphones.
            </div>
          </div>

          {/* Column B: DJ Mixer Dashboard / Control Deck */}
          <div className="lg:col-span-4 bg-zinc-950/80 border border-zinc-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-2xl relative">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest font-mono">
                Analog Mixer Deck
              </span>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Vibe Controller
              </h3>
            </div>

            {/* Slider Deck */}
            <div className="space-y-6 flex-1 py-4 justify-center flex flex-col">
              {/* Slider 1: Bass Volume */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-zinc-400 tracking-wider">DRUMS/BASS VOL</span>
                  <span className="text-orange-500 font-bold">{mixerLevels.bass}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixerLevels.bass}
                  onChange={(e) => setMixerLevels({ ...mixerLevels, bass: parseInt(e.target.value) })}
                  className="w-full slider-premium accent-orange-500"
                />
              </div>

              {/* Slider 2: Treble Level */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-zinc-400 tracking-wider">SYNTH LEVEL</span>
                  <span className="text-pink-500 font-bold">{mixerLevels.treble}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixerLevels.treble}
                  onChange={(e) => setMixerLevels({ ...mixerLevels, treble: parseInt(e.target.value) })}
                  className="w-full slider-premium accent-pink-500"
                />
              </div>

              {/* Slider 3: BPM / Tempo */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="font-bold text-zinc-400 tracking-wider">TEMPO BPM</span>
                  <span className="text-cyan-500 font-bold">{mixerLevels.tempo} BPM</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={mixerLevels.tempo}
                  onChange={(e) => setMixerLevels({ ...mixerLevels, tempo: parseInt(e.target.value) })}
                  className="w-full slider-premium accent-cyan-500"
                />
              </div>
            </div>

            {/* Glow meter widget */}
            <div className="p-4 rounded-2xl bg-black/50 border border-zinc-900 space-y-3 font-mono text-[10px] text-zinc-500">
              <div className="flex justify-between items-center">
                <span>BUFFER LOAD</span>
                <span className="text-emerald-500 font-bold">LATENCY: 0.1ms</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 via-pink-500 to-cyan-500 rounded-full" style={{ width: '85%' }} />
              </div>
              <div className="flex justify-between items-center text-[9px] pt-1">
                <span>MASTER GAIN: ACTIVE</span>
                <span>VIBE CHECK: passed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Festival Poster Lineup Section (The Tech Stack & Team) */}
      <section id="lineup" className="max-w-5xl mx-auto px-6 py-24">
        {/* Festival Poster container */}
        <div className="border-[3px] border-zinc-800 bg-[#08080a] p-8 sm:p-12 md:p-16 rounded-[2rem] text-center space-y-12 shadow-2xl relative overflow-hidden">
          {/* Diagonal retro warning stripes */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-orange-500 via-yellow-500 to-purple-600" />
          
          <div className="space-y-4">
            <span className="text-[10px] font-black text-yellow-500 tracking-[0.4em] uppercase">
              ✦ ANNUAL SUMMIT PRESENTATION ✦
            </span>
            <h2 className="text-4xl sm:text-7xl font-black text-white leading-none tracking-tight uppercase italic font-sans text-stroke-cyber hover:text-white transition duration-300">
              Tech Festival Lineup
            </h2>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              The high-octane engineering engines behind Music App
            </p>
          </div>

          <div className="h-[2px] bg-zinc-900 max-w-lg mx-auto" />

          {/* Lineup hierarchy */}
          <div className="space-y-10">
            {/* HEADLINERS */}
            <div className="space-y-3">
              <span className="text-[9px] font-mono font-bold text-orange-500 tracking-[0.3em] uppercase">
                ✦ STAGE HEADLINERS ✦
              </span>
              <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3">
                <span className="text-2xl sm:text-4xl font-black text-white hover:text-orange-500 transition-colors duration-300 uppercase tracking-tighter">
                  NEXT.JS 15
                </span>
                <span className="text-zinc-700 text-lg">•</span>
                <span className="text-2xl sm:text-4xl font-black text-white hover:text-purple-500 transition-colors duration-300 uppercase tracking-tighter">
                  NODE EXPRESS
                </span>
                <span className="text-zinc-700 text-lg">•</span>
                <span className="text-2xl sm:text-4xl font-black text-white hover:text-cyan-500 transition-colors duration-300 uppercase tracking-tighter">
                  POSTGRESQL
                </span>
              </div>
            </div>

            {/* FEATURING */}
            <div className="space-y-3">
              <span className="text-[9px] font-mono font-bold text-pink-500 tracking-[0.3em] uppercase">
                ✦ SPECIAL SUPPORTING FEATURING ✦
              </span>
              <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 max-w-3xl mx-auto">
                <span className="text-sm sm:text-lg font-black text-zinc-300 hover:text-white uppercase tracking-wider">
                  JWT Auth Security
                </span>
                <span className="text-zinc-800 text-sm">/</span>
                <span className="text-sm sm:text-lg font-black text-zinc-300 hover:text-white uppercase tracking-wider">
                  Multer Upload
                </span>
                <span className="text-zinc-800 text-sm">/</span>
                <span className="text-sm sm:text-lg font-black text-zinc-300 hover:text-white uppercase tracking-wider">
                  Tailwind CSS v4
                </span>
                <span className="text-zinc-800 text-sm">/</span>
                <span className="text-sm sm:text-lg font-black text-zinc-300 hover:text-white uppercase tracking-wider">
                  Zustand Store
                </span>
                <span className="text-zinc-800 text-sm">/</span>
                <span className="text-sm sm:text-lg font-black text-zinc-300 hover:text-white uppercase tracking-wider">
                  Web Audio Synthesizer
                </span>
              </div>
            </div>

            {/* THE CREW */}
            <div className="space-y-2 pt-4">
              <span className="text-[9px] font-mono font-bold text-zinc-500 tracking-[0.3em] uppercase">
                ✦ SOUND SYSTEM DESIGNERS ✦
              </span>
              <p className="text-xs font-black text-zinc-400 tracking-widest uppercase">
                Independent Developer: <span className="text-white">DOTHANHTU2003</span> ✦ Creative Direction: <span className="text-white">ANTIGRAVITY AI</span>
              </p>
            </div>
          </div>

          <div className="h-[2px] bg-zinc-900 max-w-lg mx-auto" />

          {/* Footer of poster */}
          <div className="text-[10px] font-mono text-zinc-600 flex justify-between items-center max-w-xl mx-auto pt-4 border-t border-zinc-900">
            <span>LOCATION: LOCALHOST:3000</span>
            <span>TICKET ID: #000-CREATOR-PASS</span>
            <span>STATUS: STAGE OPEN</span>
          </div>

          {/* Bottom retrowarning stripes */}
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500" />
        </div>
      </section>

      {/* 5. Trending Tracks Section */}
      <section id="trending" className="max-w-7xl mx-auto px-6 py-20 space-y-12 border-t border-zinc-900/60 relative">
        <div className="text-center max-w-md mx-auto space-y-3">
          <span className="text-[9px] font-mono font-bold text-purple-500 tracking-[0.3em] uppercase">
            LIVE DEMO STREAM
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase italic">
            Hear What&apos;s Trending
          </h2>
          <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-pink-500 mx-auto rounded-full" />
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            Listen to the top performing audio tracks uploaded by the community in real-time.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 pt-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="space-y-4 animate-pulse">
                <div className="aspect-square w-full rounded-2xl bg-zinc-900 shimmer" />
                <div className="space-y-2">
                  <div className="h-4 w-3/4 bg-zinc-900 rounded shimmer" />
                  <div className="h-3 w-1/2 bg-zinc-900 rounded shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : trendingSongs.length === 0 ? (
          <div className="rounded-3xl border border-zinc-900 bg-zinc-950/40 py-16 text-center">
            <p className="text-sm text-zinc-500">No trending tracks found in the database.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 pt-4">
            {trendingSongs.map((song) => {
              const coverUrl = resolveApiAssetUrl(song.cover_url);
              const isCurrent = currentSong?.id === song.id;

              return (
                <div 
                  key={song.id} 
                  onClick={() => handlePlaySong(song)}
                  className="group space-y-3 cursor-pointer"
                >
                  {/* Cover image with play overlay */}
                  <div
                    className={cn(
                      "relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-900 bg-cover bg-center border border-zinc-900 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/70 group-hover:border-zinc-700/80",
                      isCurrent && "border-orange-500/50 shadow-lg shadow-orange-500/10"
                    )}
                    style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
                  >
                    {!coverUrl && (
                      <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[#1a1a1a] to-zinc-950 text-3xl font-black text-orange-500/80">
                        {song.title?.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    
                    {/* Play/Pause Overlay */}
                    <div className={cn(
                      "absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300",
                      isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <span className="p-4 rounded-full bg-orange-500 text-black shadow-lg shadow-orange-500/30 transition-transform duration-300 transform scale-90 group-hover:scale-100 active:scale-90">
                        {isCurrent && isPlaying ? (
                          <PauseIcon size={14} />
                        ) : (
                          <PlayIcon size={14} className="ml-0.5" />
                        )}
                      </span>
                    </div>

                    {/* Mini visualizer ring on playing */}
                    {isCurrent && isPlaying && (
                      <div className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/50 backdrop-blur-md glow-cyber-orange">
                        <span className="flex gap-0.5 items-end h-2.5">
                          <span className="w-[1.5px] bg-orange-500 rounded-t eq-bar eq-bar-1" />
                          <span className="w-[1.5px] bg-orange-500 rounded-t eq-bar eq-bar-2" />
                          <span className="w-[1.5px] bg-orange-500 rounded-t eq-bar eq-bar-3" />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 px-1">
                    <p className={cn(
                      "truncate text-sm font-bold text-white transition leading-snug group-hover:text-orange-400",
                      isCurrent && "text-orange-400"
                    )}>
                      {song.title}
                    </p>
                    <p className="truncate text-xs text-zinc-500 mt-1 font-semibold group-hover:text-zinc-400">
                      {song.artist?.name || "Unknown Artist"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center pt-8">
          <Link
            href="/"
            className="inline-flex h-12 px-10 items-center justify-center text-xs font-black uppercase tracking-wider border border-zinc-800 hover:border-zinc-700 rounded-full bg-zinc-950/80 text-zinc-350 hover:text-white transition-all duration-300 hover:scale-[1.02] active:scale-95"
          >
            Explore trending playlists
          </Link>
        </div>
      </section>

      {/* 6. Never Stop Listening (App Promotion) */}
      <section id="download" className="max-w-7xl mx-auto px-6 py-20 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center bg-gradient-to-br from-zinc-950/80 to-[#0c0c0e]/95 rounded-[2.5rem] p-8 sm:p-12 lg:p-16 border border-zinc-900 relative overflow-hidden shadow-2xl">
          <div className="absolute right-0 bottom-0 w-[300px] h-[300px] bg-orange-500/[0.03] blur-[100px] rounded-full pointer-events-none" />
          
          <div className="lg:col-span-7 space-y-8">
            <span className="text-[9px] font-mono font-bold text-orange-500 tracking-[0.3em] uppercase">
              ✦ MULTI-PLATFORM SYNC ✦
            </span>
            <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[0.95] uppercase italic">
              Keep The Beat <br />
              <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">Always Pulsing</span>
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-medium max-w-xl">
              Sync your musical workspace. Download Music App across iOS, Android, and desktop clients to maintain absolute control over your playlist streams and artist feed.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-8 pt-2">
              {/* QR Code Container */}
              <div className="flex items-center gap-4 bg-black/60 p-4 rounded-2xl border border-zinc-900 shadow-xl shrink-0">
                <div className="bg-white p-2 rounded-lg w-20 h-20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-black" fill="currentColor">
                    <rect x="0" y="0" width="25" height="25" />
                    <rect x="5" y="5" width="15" height="15" fill="white" />
                    <rect x="75" y="0" width="25" height="25" />
                    <rect x="80" y="5" width="15" height="15" fill="white" />
                    <rect x="0" y="75" width="25" height="25" />
                    <rect x="5" y="80" width="15" height="15" fill="white" />
                    <rect x="40" y="10" width="10" height="20" />
                    <rect x="15" y="40" width="20" height="10" />
                    <rect x="45" y="45" width="15" height="15" />
                    <rect x="70" y="40" width="20" height="20" />
                    <rect x="50" y="70" width="15" height="10" />
                    <rect x="75" y="75" width="15" height="15" />
                  </svg>
                </div>
                <div className="text-left space-y-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Scan to listen</p>
                  <p className="text-[10px] text-zinc-500 leading-tight">Instant access on your phone</p>
                </div>
              </div>

              {/* Vector Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {/* App Store Button */}
                <button className="flex items-center gap-3 bg-black hover:bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-2.5 transition-all duration-300 w-full sm:w-auto justify-center cursor-pointer">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-semibold">Download on the</p>
                    <p className="text-xs font-bold text-white leading-tight mt-0.5">App Store</p>
                  </div>
                </button>

                {/* Google Play Button */}
                <button className="flex items-center gap-3 bg-black hover:bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-2.5 transition-all duration-300 w-full sm:w-auto justify-center cursor-pointer">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0">
                    <path d="M3.25 2.5a1 1 0 0 0-.25.7v17.6a1 1 0 0 0 .25.7l9.75-9.75zm1.5-1l12.8 7.4-4-4zm0 21l8.8-5.1-4.8-4.8zm13.3-11.4l3.5 2a1 1 0 0 1 0 1.8l-3.5 2 3.1-3.1z"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-semibold">Get it on</p>
                    <p className="text-xs font-bold text-white leading-tight mt-0.5">Google Play</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* phone mock */}
          <div className="lg:col-span-5 flex justify-center py-4 relative">
            <div className="absolute inset-0 bg-orange-500/10 rounded-3xl blur-3xl pointer-events-none transform rotate-12" />
            <Image
              src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=800"
              alt="Never Stop Listening"
              width={800}
              height={600}
              unoptimized
              className="w-full max-w-[340px] aspect-[4/3] object-cover rounded-2xl border border-zinc-800 shadow-2xl relative z-10 transition duration-500 hover:scale-[1.02] hover:rotate-1"
            />
          </div>
        </div>
      </section>

      {/* 7. Footer Section */}
      <footer className="border-t border-zinc-900 bg-[#070709] pt-16 pb-12 mt-20 text-center text-xs text-zinc-500 font-medium z-10 relative">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          {/* Social Icons */}
          <div className="flex justify-center items-center gap-6">
            <span className="hover:text-orange-500 transition-colors duration-300 cursor-pointer p-2.5 rounded-full hover:bg-zinc-900/50">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </span>
            <span className="hover:text-orange-500 transition-colors duration-300 cursor-pointer p-2.5 rounded-full hover:bg-zinc-900/50">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/></svg>
            </span>
            <span className="hover:text-orange-500 transition-colors duration-300 cursor-pointer p-2.5 rounded-full hover:bg-zinc-900/50">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.03 2.61-.01 3.91-.02.08 1.53.63 3.02 1.59 4.23a7.22 7.22 0 0 0 4.17 2.44v3.9c-1.28-.08-2.54-.53-3.64-1.21a7.48 7.48 0 0 1-2.12-1.92v6.33c.01 2.21-.86 4.39-2.43 5.96a8.88 8.88 0 0 1-6.72 2.6c-2.24-.11-4.41-1.11-5.93-2.78a9.08 9.08 0 0 1-2.1-7.2c.51-2.81 2.56-5.22 5.31-6a8.9 8.9 0 0 1 8.01 2v-8.3zm-3.69 11.2a4.93 4.93 0 0 0-1.07 4.14c.37 1.63 1.7 2.92 3.34 3.22a4.92 4.92 0 0 0 5.48-3.05c.42-.99.46-2.1.13-3.12v-1.1a8.38 8.38 0 0 1-2.12 1.9c-1.63.93-3.63.9-5.21-.06a4.85 4.85 0 0 0-.55-.93z"/></svg>
            </span>
            <span className="hover:text-orange-500 transition-colors duration-300 cursor-pointer p-2.5 rounded-full hover:bg-zinc-900/50">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.507 9.388.507 9.388.507s7.517 0 9.388-.507a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </span>
          </div>

          {/* Links Grid */}
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-3 max-w-4xl mx-auto px-4 leading-relaxed text-[11px] text-zinc-500 border-t border-zinc-900/50 pt-8">
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">About us</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Artist Resources</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Blog</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Jobs</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Developers</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Help</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Legal</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Privacy</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Cookie Policy</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Cookie Manager</span>
            <span className="hover:text-zinc-350 cursor-pointer transition-colors duration-300">Charts</span>
          </div>

          {/* Logo and Copyright */}
          <div className="flex flex-col items-center gap-3 pt-4 border-t border-zinc-900/20 max-w-xs mx-auto">
            <div className="flex items-center gap-2.5 opacity-50">
              <span className="grid place-items-center rounded bg-orange-500 font-black text-black w-6 h-6 text-xs select-none">M</span>
              <span className="text-xs font-black tracking-widest text-white uppercase font-sans">Music</span>
            </div>
            <p className="text-[10px] text-zinc-650 select-none font-normal">© 2026 Music App. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
