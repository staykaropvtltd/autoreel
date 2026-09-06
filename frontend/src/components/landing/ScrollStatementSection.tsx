import { useTheme } from "../../context/ThemeContext";

export default function ScrollStatementSection() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <section
      id="about"
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-transparent border-t text-center overflow-hidden flex items-center justify-center relative z-20 transition-colors ${
        isLight ? "border-black/5 text-[#18181B]" : "border-white/10 text-white"
      }`}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Subtle Pill Tag */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
            isLight
              ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-500/30 text-amber-950 shadow-xs"
              : "bg-white/10 border border-white/20 text-white"
          }`}
        >
          Automated Fashion Velocity
        </div>

        {/* Clean Luxury Typography */}
        <h2
          className={`font-serif text-2xl sm:text-4xl lg:text-5xl font-normal leading-[1.3] tracking-tight transition-colors ${
            isLight ? "text-[#18181B]" : "text-white"
          }`}
        >
          <span
            className={`italic font-normal underline decoration-2 underline-offset-8 transition-colors ${
              isLight
                ? "bg-gradient-to-r from-[#E05305] via-[#C26715] to-[#842247] bg-clip-text text-transparent font-semibold decoration-[#C26715]/40"
                : "text-white decoration-white/40"
            }`}
          >
            Kaladhar Auto-Reel
          </span>{" "}
          transforms raw photoshoot footage into publish-ready Reels in minutes.
        </h2>
      </div>
    </section>
  );
}

