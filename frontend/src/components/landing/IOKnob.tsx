import { useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";

interface IOKnobProps {
  className?: string;
  size?: "sm" | "md";
}

/**
 * Synthesizes a crisp, mechanical tactile click using the Web Audio API.
 * Ensures an instant, reliable sound response with zero network latency.
 */
function playTactileClick() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // 1. Initial mechanical transient click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.04);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(3, ctx.currentTime);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.045);

    // Also attempt to play the remote sample if available
    const audio = new Audio("https://framerusercontent.com/assets/kjE5ZkSkczjtJJkdDhP4kiyPyo.wav");
    audio.volume = 0.25;
    audio.play().catch(() => {
      // Audio autoplay policy or network error handled gracefully
    });
  } catch {
    // Audio unsupported or blocked; silently ignore
  }
}

export default function IOKnob({ className = "", size = "md" }: IOKnobProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const isTogglingRef = useRef(false);

  const handleToggle = () => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    playTactileClick();
    toggleTheme();
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 200);
  };

  const isSmall = size === "sm";
  const containerW = isSmall ? "w-[62px]" : "w-[72px]";
  const containerH = isSmall ? "h-[32px]" : "h-[36px]";
  const knobSize = isSmall ? 26 : 30;

  return (
    <div
      className={`relative inline-flex items-center select-none ${className}`}
      title={isLight ? "Switch to Dark Mode (Pure Monochrome)" : "Switch to Light Mode (Alabaster Luxury)"}
    >
      <motion.button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-label="Toggle theme mode"
        onClick={handleToggle}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={`relative ${containerW} ${containerH} rounded-full cursor-pointer p-[3px] transition-all duration-300 focus:outline-none shadow-md ${
          isLight
            ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] border border-[#E0520A] shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),0_0_12px_rgba(252,115,28,0.3)]"
            : "bg-[#141418] border border-white/20 shadow-[inset_0_2px_5px_rgba(0,0,0,0.85)]"
        }`}
      >
        {/* Track Glyphs: "I" (Left / Light / On) and "O" (Right / Dark / Off) */}
        <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
          {/* "I" Symbol (On) */}
          <div
            className={`w-[2px] h-[12px] rounded-full transition-all duration-300 ${
              isLight ? "bg-white opacity-95 scale-110 shadow-sm" : "bg-white/40 opacity-50"
            }`}
          />

          {/* "O" Symbol (Off) */}
          <div
            className={`w-[13px] h-[13px] rounded-full border-2 transition-all duration-300 ${
              !isLight ? "border-white opacity-90 scale-110" : "border-white/60 opacity-60"
            }`}
          />
        </div>

        {/* Tactile 3D Sliding Knob */}
        <motion.div
          className="relative rounded-full z-10 flex items-center justify-center cursor-pointer pointer-events-none"
          style={{
            width: knobSize,
            height: knobSize,
          }}
          animate={{
            x: isLight ? (isSmall ? 30 : 36) : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 480,
            damping: 28,
            mass: 0.8,
          }}
        >
          {/* Outer Stroke Bevel Ring */}
          <div
            className={`absolute inset-0 rounded-full transition-colors duration-200 ${
              isLight
                ? "bg-gradient-to-b from-white to-[#D0D0D4] shadow-[0_2px_6px_rgba(0,0,0,0.22),0_8px_16px_-2px_rgba(0,0,0,0.18)]"
                : "bg-gradient-to-b from-[#FAFAFA] to-[#C8C8CC] shadow-[0_2px_5px_rgba(0,0,0,0.4),0_8px_18px_-1px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.2)]"
            }`}
          />

          {/* Inner Surface of the Knob */}
          <div
            className={`relative rounded-full ${
              isSmall ? "w-[22px] h-[22px]" : "w-[26px] h-[26px]"
            } ${
              isLight
                ? "bg-gradient-to-b from-[#FFFFFF] via-[#F4F4F6] to-[#ECECEE]"
                : "bg-gradient-to-b from-[#EDEDED] via-[#E2E2E2] to-[#D5D5D5]"
            } flex items-center justify-center shadow-inner`}
          >
            {/* Subtle center tactile dimple */}
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isLight ? "bg-neutral-400/40" : "bg-neutral-600/40"
              }`}
            />
          </div>
        </motion.div>
      </motion.button>
    </div>
  );
}
