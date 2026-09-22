import { useState, useRef, useEffect } from "react";
import { ChevronDown, Bell, ArrowRight, Layers, Wand2, Music2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface LandingNavbarProps {
  onLaunchStudio: () => void;
  onOpenContact: () => void;
  onOpenAuth?: (mode?: "signin" | "signup") => void;
}

export default function LandingNavbar({
  onLaunchStudio,
  onOpenContact,
}: LandingNavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  const [productsOpen, setProductsOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [showBellNotification, setShowBellNotification] = useState(false);

  const productsRef = useRef<HTMLDivElement>(null);
  const solutionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (productsRef.current && !productsRef.current.contains(e.target as Node)) {
        setProductsOpen(false);
      }
      if (solutionsRef.current && !solutionsRef.current.contains(e.target as Node)) {
        setSolutionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToPricing = () => {
    const el = document.getElementById("pricing");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-black text-white border-b border-white/10 select-none">
      <div className="max-w-[1440px] mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Left: Brand Logo & Navigation Links */}
        <div className="flex items-center gap-6 sm:gap-8 md:gap-10">
          {/* Logo */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-1.5 text-lg sm:text-xl font-bold tracking-tight text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <span className="font-sans font-bold tracking-tight">Kaladhar</span>
          </button>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-neutral-300">
            {/* Products Dropdown */}
            <div className="relative" ref={productsRef}>
              <button
                type="button"
                onClick={() => {
                  setProductsOpen(!productsOpen);
                  setSolutionsOpen(false);
                }}
                className={`flex items-center gap-1 cursor-pointer transition-colors py-1 ${
                  productsOpen ? "text-white" : "hover:text-white"
                }`}
              >
                <span>Products</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    productsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {productsOpen && (
                <div className="absolute top-full left-0 mt-3 w-72 rounded-2xl bg-[#111114] border border-white/15 p-3 shadow-2xl shadow-black/80 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProductsOpen(false);
                        onLaunchStudio();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left flex items-start gap-3 cursor-pointer group"
                    >
                      <Wand2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                          Auto-Reel Studio
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Automated 9:16 reels from photoshoot clips
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProductsOpen(false);
                        onLaunchStudio();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left flex items-start gap-3 cursor-pointer group"
                    >
                      <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-cyan-300">
                          Smart Reframe & Crop
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Computer-vision centering on sarees & pallus
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProductsOpen(false);
                        onLaunchStudio();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left flex items-start gap-3 cursor-pointer group"
                    >
                      <Music2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-white group-hover:text-purple-300">
                          Beat-Sync Engine
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Rhythm-matched cuts to viral trending audio
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Solutions Dropdown */}
            <div className="relative" ref={solutionsRef}>
              <button
                type="button"
                onClick={() => {
                  setSolutionsOpen(!solutionsOpen);
                  setProductsOpen(false);
                }}
                className={`flex items-center gap-1 cursor-pointer transition-colors py-1 ${
                  solutionsOpen ? "text-white" : "hover:text-white"
                }`}
              >
                <span>Solutions</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    solutionsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {solutionsOpen && (
                <div className="absolute top-full left-0 mt-3 w-64 rounded-2xl bg-[#111114] border border-white/15 p-3 shadow-2xl shadow-black/80 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSolutionsOpen(false);
                        onLaunchStudio();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left cursor-pointer group"
                    >
                      <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                        Saree & Handloom SMBs
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Kanchipuram, Banarasi, & Cotton Weaves
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSolutionsOpen(false);
                        onLaunchStudio();
                      }}
                      className="w-full p-2.5 rounded-xl hover:bg-white/10 transition-colors text-left cursor-pointer group"
                    >
                      <p className="text-xs font-semibold text-white group-hover:text-amber-300">
                        Ethnic Wear Boutiques
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Lehengas, Anarkalis & Festive Collections
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing */}
            <button
              type="button"
              onClick={scrollToPricing}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Pricing
            </button>

            {/* Contact */}
            <button
              type="button"
              onClick={onOpenContact}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Contact
            </button>
          </nav>
        </div>

        {/* Right: Notification Bell, Theme Switcher, Dashboard Button */}
        <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBellNotification(!showBellNotification)}
              aria-label="Notifications"
              className="relative p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {/* Yellow status dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FFC107] ring-2 ring-black" />
            </button>

            {showBellNotification && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#141418] border border-white/15 p-3 shadow-2xl z-50 animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Studio Engine Status</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  FFmpeg 9:16 rendering and beat-sync pipeline are operating normally.
                </p>
              </div>
            )}
          </div>

          {/* Theme Switch Pill (matches • O tactile switch in screenshot) */}
          <button
            type="button"
            role="switch"
            aria-checked={isLight}
            aria-label="Toggle dark/light theme"
            onClick={toggleTheme}
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            className="w-11 h-6 rounded-full bg-[#202024] border border-white/20 p-0.5 flex items-center justify-between cursor-pointer transition-colors relative"
          >
            {/* Left circle: filled white dot in dark mode */}
            <span
              className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center ${
                !isLight
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-100"
                  : "bg-white/20 scale-75"
              }`}
            />
            {/* Right circle: outline circle */}
            <span
              className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center ${
                isLight
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-100"
                  : "border border-white/40 scale-75"
              }`}
            />
          </button>

          {/* Dashboard Pill Button (White pill with black text and arrow) */}
          <button
            type="button"
            onClick={onLaunchStudio}
            className="bg-white hover:bg-neutral-100 text-black text-xs sm:text-sm font-semibold py-2 px-4 sm:px-5 rounded-full shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

      </div>
    </header>
  );
}
