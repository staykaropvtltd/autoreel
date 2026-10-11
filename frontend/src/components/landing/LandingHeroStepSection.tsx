import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send } from "lucide-react";

interface LandingHeroStepSectionProps {
  onLaunchStudio: () => void;
}

const STEP_DATA = [
  {
    step: 1,
    badgeText: "STEP 01 · Raw Photoshoot Take",
    dotColor: "#06B6D4", // Cyan
    duration: 3800, // ms
  },
  {
    step: 2,
    badgeText: "STEP 02 · AI 9:16 Reframe & Beat-Sync",
    dotColor: "#A855F7", // Purple
    duration: 3800, // ms
  },
  {
    step: 3,
    badgeText: "STEP 03 · Publish-Ready Video Reel",
    dotColor: "#EC4899", // Pink
    duration: 6500, // ms
  },
];

export default function LandingHeroStepSection({
  onLaunchStudio,
}: LandingHeroStepSectionProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [reelLiked, setReelLiked] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auto-advance loop across Step 1 -> Step 2 -> Step 3 -> Loop
  useEffect(() => {
    const currentConfig = STEP_DATA[currentStep - 1];
    const timer = setTimeout(() => {
      setCurrentStep((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)));
      setProgress(0);
    }, currentConfig.duration);

    return () => clearTimeout(timer);
  }, [currentStep]);

  // Story progress bar ticker for Step 3
  useEffect(() => {
    if (currentStep !== 3) {
      setProgress(0);
      return;
    }

    const startTime = Date.now();
    const duration = STEP_DATA[2].duration;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [currentStep]);

  return (
    <section className="relative w-full min-h-[calc(100vh-64px)] bg-white text-black flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 select-none overflow-hidden">
      
      {/* Top Area: KALADHAR Brand on Left, and Perfectly Centered Step Pill */}
      <div className="relative z-30 w-full flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 sm:gap-0 min-h-[60px]">
        {/* Top Left: KALADHAR in Bold Sans-Serif */}
        <div className="text-center sm:text-left space-y-0.5">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-sans font-black tracking-tight uppercase leading-none text-black">
            KALADHAR
          </h1>
          <p className="text-[10px] sm:text-xs font-mono tracking-[0.26em] uppercase font-semibold text-neutral-500">
            AUTO-REEL · STUDIO
          </p>
        </div>

        {/* Top Center: Exactly Centered Step Badge Pill */}
        <div className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 top-0 sm:top-1 z-30 flex items-center justify-center max-w-full">
          <button
            type="button"
            onClick={() => {
              setCurrentStep((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)));
            }}
            className="group relative bg-[#202024] hover:bg-[#2c2c33] text-white text-xs sm:text-sm font-mono font-medium px-4 sm:px-5 py-2 rounded-full shadow-lg transition-all flex items-center gap-2.5 cursor-pointer border border-white/10 active:scale-98 whitespace-nowrap"
            title="Click to switch step"
          >
            {/* Step indicator dot */}
            <span
              className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors duration-300 shrink-0"
              style={{
                backgroundColor: STEP_DATA[currentStep - 1].dotColor,
                color: STEP_DATA[currentStep - 1].dotColor,
              }}
            />

            <span>{STEP_DATA[currentStep - 1].badgeText}</span>

            {/* Quick mini switcher dots */}
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-white/20">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentStep(s as 1 | 2 | 3);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                    currentStep === s
                      ? "bg-white scale-125"
                      : "bg-white/30 hover:bg-white/70"
                  }`}
                  title={`Jump to Step ${s}`}
                />
              ))}
            </div>
          </button>
        </div>

        {/* Top Right is kept empty for balanced layout (Pause & Reset removed) */}
        <div className="hidden sm:block w-[120px]" />
      </div>

      {/* Main Center Stage: Perfectly Centered Under the Step Pill */}
      <div className="relative w-full flex-1 min-h-[460px] sm:min-h-[520px] md:min-h-[580px] lg:min-h-[640px] flex items-center justify-center py-4">
        
        {/* =========================================================================
            STEP 1 & STEP 2: Full Color Wide Photoshoot (100% Centered under Step Pill)
            ========================================================================= */}
        <AnimatePresence mode="wait">
          {currentStep !== 3 ? (
            <motion.div
              key="step-wide-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4 }}
              className="relative w-full flex items-center justify-center"
            >
              {/* Centered Woman Photo in Full Vibrant Color */}
              <div className="relative flex items-center justify-center">
                <img
                  src="/lady_colored_hero.png"
                  alt="Raw Photoshoot Take"
                  className="max-h-[520px] sm:max-h-[580px] md:max-h-[640px] w-auto object-contain select-none mx-auto block"
                  draggable={false}
                />

                {/* STEP 02 OVERLAY: Pure Glowing Cyan 9:16 Frame - Centered over woman */}
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="absolute inset-y-1 sm:inset-y-2 left-1/2 -translate-x-1/2 w-[270px] sm:w-[310px] md:w-[340px] aspect-[9/16] rounded-2xl border-2 border-[#22D3EE] shadow-[0_0_35px_rgba(34,211,238,0.55),inset_0_0_18px_rgba(34,211,238,0.25)] pointer-events-none flex flex-col justify-between p-3.5 z-20"
                  >
                    {/* Top Corner Marks */}
                    <div className="w-full flex items-center justify-between">
                      <span className="w-3.5 h-3.5 border-t-2 border-l-2 border-[#22D3EE] rounded-tl" />
                      <span className="w-3.5 h-3.5 border-t-2 border-r-2 border-[#22D3EE] rounded-tr" />
                    </div>

                    {/* Animated Scanning Laser Line */}
                    <motion.div
                      className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#22D3EE] to-transparent shadow-[0_0_12px_#22D3EE]"
                      animate={{ y: [10, 480, 10] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Bottom Corner Marks */}
                    <div className="w-full flex items-center justify-between">
                      <span className="w-3.5 h-3.5 border-b-2 border-l-2 border-[#22D3EE] rounded-bl" />
                      <span className="w-3.5 h-3.5 border-b-2 border-r-2 border-[#22D3EE] rounded-br" />
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            /* =========================================================================
               STEP 3: Live Publish-Ready Video Reel (100% Centered under Step Pill)
               ========================================================================= */
            <motion.div
              key="step-reel-container"
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[9/16] w-[270px] sm:w-[310px] md:w-[340px] max-h-[540px] sm:max-h-[580px] md:max-h-[640px] rounded-[28px] sm:rounded-[36px] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-black/20 bg-black flex flex-col justify-between text-white mx-auto"
            >
              {/* Dynamic Reel Background with Subtle Cinematic Ken Burns Motion */}
              <div className="absolute inset-0 z-0 overflow-hidden bg-black">
                <motion.div
                  className="w-full h-full"
                  animate={{
                    scale: [1, 1.05, 1.02],
                    y: [0, -6, 0],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <img
                    src="/lady_colored_reel_hd.png"
                    alt="Publish Ready Reel"
                    className="w-full h-full object-cover object-center filter contrast-[1.03] brightness-[1.01]"
                    draggable={false}
                  />
                </motion.div>

                {/* Subtle bottom gradient for depth */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/40 pointer-events-none" />
              </div>

              {/* 1. Top Story/Reel Progress Bar (Visual playback animation only, no words) */}
              <div className="relative z-20 p-3 pt-3.5">
                <div className="w-full h-1 bg-white/30 backdrop-blur-sm rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* 2. Middle Area (100% clean, no text/names/words) */}
              <div className="relative z-10 flex-1" />

              {/* 3. Bottom Right: Minimal Social Action Icons (Zero text/numbers) */}
              <div className="relative z-20 p-3 pb-3.5 flex items-end justify-end">
                <div className="flex flex-col items-center gap-3 text-white/90 shrink-0">
                  {/* Heart Icon Button with Tap Pulse (Zero numbers) */}
                  <button
                    type="button"
                    onClick={() => setReelLiked(!reelLiked)}
                    className="cursor-pointer group"
                    title="Like"
                  >
                    <motion.div
                      whileTap={{ scale: 1.3 }}
                      className={`p-1.5 rounded-full bg-black/40 backdrop-blur-md transition-colors ${
                        reelLiked ? "text-rose-500" : "text-white group-hover:text-rose-400"
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          reelLiked ? "fill-rose-500 stroke-rose-500" : "stroke-white"
                        }`}
                      />
                    </motion.div>
                  </button>

                  {/* Comment Icon (Zero numbers) */}
                  <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-md" title="Comment">
                    <MessageCircle className="w-4 h-4 stroke-white" />
                  </div>

                  {/* Share Icon (Zero numbers) */}
                  <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-md" title="Share">
                    <Send className="w-3.5 h-3.5 stroke-white" />
                  </div>

                  {/* Spinning Audio Vinyl Disc */}
                  <div className="relative pt-0.5" title="Audio">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                      className="w-7 h-7 rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-700 to-neutral-900 border border-white/40 flex items-center justify-center shadow-lg"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    </motion.div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Bottom Subtle Caption Bar */}
      <div className="relative z-10 w-full flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-neutral-200 text-neutral-500 text-[11px] font-sans">
        <p>
          Kaladhar AI transforms single uncropped photoshoot takes into high-conversion Instagram Reels.
        </p>
        <button
          type="button"
          onClick={onLaunchStudio}
          className="text-black hover:text-neutral-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>Launch Reel Studio</span>
          <span>→</span>
        </button>
      </div>

    </section>
  );
}
