import LiquidCarveButton from "../originkit/ui/liquid-carve-button";
import { useTheme } from "../../context/ThemeContext";

interface FinalCtaBandProps {
  onLaunchStudio: () => void;
}

export default function FinalCtaBand({ onLaunchStudio }: FinalCtaBandProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section
      id="projects"
      className={`py-28 px-4 sm:px-6 lg:px-8 bg-transparent border-t text-center relative overflow-hidden transition-colors ${
        isLight ? "border-black/5 text-[#18181B]" : "border-white/10 text-white"
      }`}
    >
      {/* Subtle Ambient Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div
          className={`w-[600px] h-[340px] rounded-full transition-all ${
            isLight
              ? "bg-gradient-to-r from-orange-400/15 via-rose-400/10 to-amber-400/15 blur-[120px]"
              : "bg-white/[0.03] blur-[100px]"
          }`}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto space-y-6">
        {/* Minimal Pill Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
            isLight
              ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-500/30 text-amber-950 shadow-2xs"
              : "bg-white/10 border border-white/20 text-white"
          }`}
        >
          Instant Video Automation
        </div>

        {/* Editorial Headline */}
        <h2
          className={`font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight leading-[1.15] transition-colors ${
            isLight ? "text-[#18181B]" : "text-white"
          }`}
        >
          Turn Raw Shoots Into <br />
          <span
            className={`italic font-normal underline decoration-2 underline-offset-8 transition-colors ${
              isLight
                ? "bg-gradient-to-r from-[#E05305] via-[#C26715] to-[#842247] bg-clip-text text-transparent font-semibold decoration-[#C26715]/40"
                : "text-white decoration-white/40"
            }`}
          >
            Publish-Ready Reels
          </span>
        </h2>

        {/* Minimal Subtitle */}
        <p
          className={`text-sm sm:text-base max-w-lg mx-auto leading-relaxed font-sans transition-colors ${
            isLight ? "text-neutral-600" : "text-neutral-400"
          }`}
        >
          Generate branded, high-converting 9:16 vertical Reels for your ethnic wear collection in minutes.
        </p>

        {/* Signature Liquid Carve CTA Button */}
        <div className="pt-4 flex justify-center">
          <LiquidCarveButton
            label="Launch Studio Now"
            onClick={onLaunchStudio}
            padding="18px 48px"
            rounded={100}
            colors={
              isLight
                ? { fill: "#FC731C", textColor: "#FFFFFF" }
                : { fill: "#FFFFFF", textColor: "#000000" }
            }
            blob={
              isLight
                ? { color: "#FF8C38", size: 95, smoothness: 55 }
                : { color: "#222222", size: 95, smoothness: 55 }
            }
            font={{
              fontFamily: '"Space Grotesk", "Sora", sans-serif',
              fontSize: "17px",
              fontWeight: 700,
              letterSpacing: "0.01em",
            }}
            addIcon={true}
            icon={{
              type: "symbol",
              symbol: "↗",
              color: isLight ? "#FFFFFF" : "#000000",
              size: 16,
              side: "right",
            }}
          />
        </div>
      </div>
    </section>
  );
}

