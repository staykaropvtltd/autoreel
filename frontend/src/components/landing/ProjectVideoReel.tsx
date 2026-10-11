import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Check, Heart, MessageCircle, Send, Music } from "lucide-react";

interface ProjectVideoReelProps {
  className?: string;
  onLaunchStudio?: () => void;
}

const VIDEO_STAGES = [
  {
    id: 1,
    title: "1. Raw Photos Upload",
    subtitle: "Saree & Fabric Shoot",
    tag: "100% Weave Fidelity",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=85",
    caption: "Uploading raw saree shots · Logo auto-detected",
    duration: 4, // seconds
  },
  {
    id: 2,
    title: "2. AI Reframe & Beat-Sync",
    subtitle: "9:16 Subject Centering",
    tag: "124 BPM Audio Sync",
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=85",
    caption: "Auto-centering pallu drape & beat-matched cuts",
    duration: 4, // seconds
  },
  {
    id: 3,
    title: "3. Ready Instagram Reel",
    subtitle: "Brand Kit + Telugu Copy",
    tag: "Ready in 54s",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=85",
    caption: "Publish-ready Reel with shop watermark & regional copy",
    duration: 5, // seconds
  },
];

const TOTAL_DURATION = VIDEO_STAGES.reduce((acc, s) => acc + s.duration, 0); // 13s

export default function ProjectVideoReel({ className = "" }: ProjectVideoReelProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1;
        return next >= TOTAL_DURATION ? 0 : next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Determine which stage is active based on currentTime
  let accumulated = 0;
  let currentStageIndex = 0;
  for (let i = 0; i < VIDEO_STAGES.length; i++) {
    accumulated += VIDEO_STAGES[i].duration;
    if (currentTime < accumulated) {
      currentStageIndex = i;
      break;
    }
  }
  const currentStage = VIDEO_STAGES[currentStageIndex];
  const progressPercent = (currentTime / TOTAL_DURATION) * 100;

  return (
    <div
      className={`relative w-[210px] sm:w-[230px] md:w-[250px] aspect-[9/16] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-black/15 bg-neutral-950 flex flex-col justify-between text-white select-none ${className}`}
    >
      {/* 1. Background Video Simulation: Crossfading Photos with Zoom/Pan */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage.id}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <img
              src={currentStage.image}
              alt={currentStage.title}
              className="w-full h-full object-cover object-center filter brightness-[0.92] contrast-[1.05]"
            />
            {/* Ambient gradients for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/60" />
          </motion.div>
        </AnimatePresence>

        {/* Dynamic Scanning Grid / Beat Effect for Stage 2 */}
        {currentStageIndex === 1 && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* 9:16 safe area frame */}
            <div className="absolute inset-3 border border-dashed border-amber-400/60 rounded-xl" />
            <motion.div
              className="w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b]"
              animate={{ y: [10, 360, 10] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            />
          </div>
        )}
      </div>

      {/* 2. Top Header Overlay (Reel Badge & Audio Equalizer) */}
      <div className="relative z-20 p-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] font-mono tracking-wider uppercase font-semibold text-white/90">
            Reel Demo
          </span>
        </div>

        {/* Audio Equalizer Bars */}
        <div className="flex items-center gap-0.5 bg-black/50 backdrop-blur-md px-1.5 py-1 rounded-full border border-white/10">
          <Music className="w-2.5 h-2.5 text-amber-400 mr-0.5" />
          {[0.6, 1.0, 0.4, 0.8].map((speed, i) => (
            <motion.span
              key={i}
              className="w-0.5 bg-amber-400 rounded-full"
              animate={isPlaying ? { height: ["3px", "10px", "4px"] } : { height: "3px" }}
              transition={{ duration: speed, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
      </div>

      {/* 3. Center Interactive Notification / Step Indicator */}
      <div className="relative z-20 px-3">
        <motion.div
          key={currentStage.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/65 backdrop-blur-md border border-white/15 rounded-xl p-2 shadow-lg"
        >
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-mono font-bold text-amber-400">
              {currentStage.title}
            </span>
            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-white/15 text-white">
              {currentStage.tag}
            </span>
          </div>
          <p className="text-[9px] text-white/80 leading-tight">
            {currentStage.caption}
          </p>
        </motion.div>
      </div>

      {/* 4. Bottom Reel UI & Controls */}
      <div className="relative z-20 p-3 space-y-2">
        {/* Social Icons Sidebar */}
        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-white flex items-center gap-1">
              <span>@kaladhar_heirlooms</span>
              <Check className="w-2.5 h-2.5 text-sky-400 stroke-[3]" />
            </p>
            <p className="text-[8px] text-white/70 font-mono">
              🎵 Trending Telugu Audio · 124 BPM
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 text-white/90">
            <button className="flex flex-col items-center cursor-pointer">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span className="text-[8px] font-mono">1.8k</span>
            </button>
            <button className="flex flex-col items-center cursor-pointer">
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="text-[8px] font-mono">94</span>
            </button>
            <button className="flex flex-col items-center cursor-pointer">
              <Send className="w-3.5 h-3.5" />
              <span className="text-[8px] font-mono">420</span>
            </button>
          </div>
        </div>

        {/* Video Scrubber & Play/Pause Bar */}
        <div className="space-y-1 pt-1 border-t border-white/15">
          {/* Continuous progress line */}
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-100 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Time & Play toggle */}
          <div className="flex items-center justify-between text-[8px] font-mono text-white/70">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5 fill-current" />}
              <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
            </button>
            <span>
              0:{Math.floor(currentTime).toString().padStart(2, "0")} / 0:{TOTAL_DURATION}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
