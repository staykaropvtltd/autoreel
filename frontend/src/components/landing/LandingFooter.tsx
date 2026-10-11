import DotMatrixBlockGame from "../originkit/ui/dot-matrix-block-game";
import { useTheme } from "../../context/ThemeContext";

interface LandingFooterProps {
  onLaunchStudio: () => void;
  onOpenAuth?: (mode?: "signin" | "signup") => void;
}

// Custom Social Icons
function XIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function LinkedinIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

export default function LandingFooter({ onLaunchStudio, onOpenAuth }: LandingFooterProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const scrollTo = (id?: string) => {
    if (!id || id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <footer
      className={`relative pt-16 sm:pt-20 pb-0 px-0 text-left border-t overflow-hidden min-h-[480px] flex flex-col justify-between w-full transition-colors ${
        isLight
          ? "bg-[#F4F2ED] border-black/10 text-[#0A0A0C]"
          : "bg-[#09090B] border-white/10 text-white"
      }`}
    >
      {/* 1. TOP FOOTER CONTENT */}
      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 lg:px-12 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Info & Socials (Col 1-6) */}
          <div className="md:col-span-6 space-y-4">
            <h3
              className={`font-serif text-3xl font-normal tracking-tight ${
                isLight ? "text-[#0A0A0C]" : "text-white"
              }`}
            >
              Kaladhar
            </h3>
            <p
              className={`text-sm max-w-sm font-sans leading-relaxed ${
                isLight ? "text-neutral-700" : "text-neutral-400"
              }`}
            >
              AI agents for modern ethnic wear video commerce. Curate, reframe, and publish high-converting vertical Reels in minutes.
            </p>

            {/* Social Media Circular Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  isLight
                    ? "bg-black/5 hover:bg-[#1DA1F2]/10 border-black/10 hover:border-[#1DA1F2]/40 text-neutral-900 hover:text-[#1DA1F2]"
                    : "bg-white/5 hover:bg-white/15 border-white/15 text-white"
                }`}
                aria-label="X Twitter"
              >
                <XIcon className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  isLight
                    ? "bg-black/5 hover:bg-[#E1306C]/10 border-black/10 hover:border-[#E1306C]/40 text-neutral-900 hover:text-[#E1306C]"
                    : "bg-white/5 hover:bg-white/15 border-white/15 text-white"
                }`}
                aria-label="Instagram"
              >
                <InstagramIcon className="w-4.5 h-4.5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  isLight
                    ? "bg-black/5 hover:bg-[#0A66C2]/10 border-black/10 hover:border-[#0A66C2]/40 text-neutral-900 hover:text-[#0A66C2]"
                    : "bg-white/5 hover:bg-white/15 border-white/15 text-white"
                }`}
                aria-label="LinkedIn"
              >
                <LinkedinIcon className="w-4 h-4" />
              </a>
            </div>

            <p className={`text-xs pt-2 font-mono ${isLight ? "text-neutral-500" : "text-neutral-500"}`}>
              © 2026 Kaladhar Studio. Built for ethnic fashion brands.
            </p>
          </div>

          {/* Navigation Column (Col 7-9) */}
          <div className="md:col-span-3 space-y-3.5">
            <h4
              className={`font-serif text-base font-semibold tracking-wide ${
                isLight ? "text-[#18181B]" : "text-white"
              }`}
            >
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("top")}
                  className={`transition-colors cursor-pointer text-left ${
                    isLight ? "text-neutral-700 hover:text-black" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("about")}
                  className={`transition-colors cursor-pointer text-left ${
                    isLight ? "text-neutral-700 hover:text-black" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  About
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("how-it-works")}
                  className={`transition-colors cursor-pointer text-left ${
                    isLight ? "text-neutral-700 hover:text-black" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => scrollTo("pricing")}
                  className={`transition-colors cursor-pointer text-left ${
                    isLight ? "text-neutral-700 hover:text-black" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  Pricing
                </button>
              </li>
            </ul>
          </div>

          {/* Studio & Access Column (Col 10-12) */}
          <div className="md:col-span-3 space-y-3.5">
            <h4
              className={`font-serif text-base font-semibold tracking-wide ${
                isLight ? "text-[#18181B]" : "text-white"
              }`}
            >
              Studio
            </h4>
            <ul className="space-y-2.5 text-sm font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.("signin")}
                  className={`transition-colors cursor-pointer text-left ${
                    isLight ? "text-neutral-700 hover:text-black" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.("signup")}
                  className={`transition-colors cursor-pointer text-left ${
                    isLight ? "text-neutral-700 hover:text-black" : "text-neutral-300 hover:text-white"
                  }`}
                >
                  Get Started
                </button>
              </li>
              <li className="pt-1">
                <button
                  type="button"
                  onClick={onLaunchStudio}
                  className={`transition-colors cursor-pointer text-left font-bold ${
                    isLight
                      ? "text-[#E05305] hover:text-[#C26715] hover:underline"
                      : "text-white hover:underline"
                  }`}
                >
                  Launch Studio →
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED GAP BUFFER */}
      <div className="h-12 sm:h-16 w-full" />

      {/* 3. GAME ANIMATION EXTENDING TO FULL SCREEN EDGES */}
      <div className="relative w-full h-[220px] sm:h-[260px] pointer-events-none overflow-hidden z-0">
        <DotMatrixBlockGame
          dotColor={isLight ? "#1A1A1A" : "#FFFFFF"}
          dotSize={9}
          gap={13}
          speed={1.0}
          className="w-full h-full"
        />
      </div>
    </footer>
  );
}

