import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { User as UserIcon } from "lucide-react";
import IOKnob from "./IOKnob";

interface MagnettoHeroSectionProps {
  onLaunchStudio: () => void;
  onOpenAuth?: (mode?: "signin" | "signup") => void;
}

export default function MagnettoHeroSection({ onLaunchStudio, onOpenAuth }: MagnettoHeroSectionProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"home" | "about" | "how-it-works" | "pricing">("home");
  const [showContactModal, setShowContactModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <section className="relative w-full pt-2 sm:pt-3 pb-2 sm:pb-3 px-2.5 sm:px-4 md:px-6 lg:px-8 max-w-[1420px] mx-auto">
      {/* 1. The Main Studio Card */}
      <div
        className={`relative w-full h-[calc(100vh-20px)] sm:h-[calc(100vh-24px)] md:h-[calc(100vh-28px)] min-h-[480px] max-h-[820px] rounded-[28px] sm:rounded-[40px] md:rounded-[48px] lg:rounded-[56px] border shadow-2xl overflow-hidden flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 transition-colors duration-300 ${
          isLight
            ? "bg-gradient-to-b from-[#FFFDF9] via-[#FAF7F0] to-[#F5EFE6] border-[#E8DFD1] shadow-[0_20px_60px_-15px_rgba(194,103,21,0.08)]"
            : "bg-[#F1F1F1] border-black/5 shadow-2xl"
        }`}
      >
        {/* Top Row: Brand on Left, Editorial & Quick Auth on Right */}
        <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-4 md:gap-6 w-full">
          {/* Top Left: KALADHAR in Pixel Typography */}
          <div className="space-y-0.5 sm:space-y-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-['Pixelify_Sans',_sans-serif] font-bold tracking-normal text-neutral-950 uppercase leading-none select-none">
              KALADHAR
            </h1>
            <p
              className={`text-[9px] sm:text-[10px] md:text-xs font-['Silkscreen',_monospace] tracking-[0.26em] sm:tracking-[0.28em] uppercase font-semibold transition-colors ${
                isLight ? "text-[#C26715]" : "text-neutral-700"
              }`}
            >
              AUTO-REEL · STUDIO
            </p>
          </div>

          {/* Top Right: Editorial Description + Sign In & Sign Up Buttons */}
          <div className="text-left md:text-right flex flex-col md:items-end gap-2.5 max-w-xs sm:max-w-sm md:max-w-md z-10">
            <p className="text-[11px] sm:text-xs md:text-[13px] text-neutral-700 font-sans tracking-wide leading-relaxed">
              At Kaladhar, we break boundaries to turn bold ideas into digital experiences that captivate and inspire.
            </p>
            {!user ? (
              <div className="flex items-center gap-2.5 sm:gap-3 pt-1 select-none">
                <button
                  type="button"
                  onClick={() => onOpenAuth?.("signin")}
                  className={`text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer py-2 px-4 sm:py-2.5 sm:px-5 rounded-full border shadow-2xs ${
                    isLight
                      ? "border-neutral-400/80 text-neutral-900 bg-white/80 hover:bg-white hover:border-neutral-900"
                      : "border-black/30 text-neutral-950 bg-black/5 hover:bg-black/10 hover:border-black"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.("signup")}
                  className={`text-xs sm:text-sm font-bold tracking-wide transition-all cursor-pointer py-2 px-4.5 sm:py-2.5 sm:px-6 rounded-full shadow-md flex items-center gap-1.5 ${
                    isLight
                      ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_4px_16px_rgba(252,115,28,0.35)]"
                      : "bg-black text-white hover:bg-neutral-800 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                  }`}
                >
                  <span>Get Started</span>
                  <span className="text-xs sm:text-sm font-normal">→</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 pt-1 text-xs sm:text-sm font-medium select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-neutral-900 font-medium">
                    Studio: <strong className="font-bold">{user.name}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLaunchStudio}
                  className={`text-xs font-mono font-bold tracking-wider uppercase px-3 py-1.5 rounded-full border shadow-sm transition-all cursor-pointer flex items-center gap-1 ${
                    isLight
                      ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 border-transparent shadow-[0_2px_10px_rgba(252,115,28,0.35)]"
                      : "bg-black text-white hover:bg-neutral-800 border-black"
                  }`}
                >
                  <span>Dashboard</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: The Indian Lady Model in Silk Saree Drape */}
        <div className="absolute inset-x-0 bottom-0 top-14 sm:top-16 md:top-6 flex items-end justify-center pointer-events-none z-0">
          <div className="relative h-[82%] sm:h-[86%] md:h-[90%] flex items-end justify-center">
            <img
              src="/lady_hero_blended.png"
              alt="Kaladhar Ethnic Wear Portrait"
              className="h-full w-auto max-w-[85vw] object-contain object-bottom select-none filter contrast-[1.03]"
              draggable={false}
            />
          </div>
        </div>

        {/* Bottom: Floating Smoked-Glass Dock with IOKnob on the Right */}
        <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 left-1/2 -translate-x-1/2 z-20 w-auto max-w-[96%]">
          <nav
            aria-label="Kaladhar Navigation"
            className={`backdrop-blur-xl shadow-2xl rounded-full px-3.5 py-2 sm:px-6 sm:py-2.5 flex items-center gap-2.5 sm:gap-5 md:gap-7 transition-all duration-300 ${
              isLight
                ? "bg-white/95 border border-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.12)] text-neutral-950"
                : "bg-gradient-to-r from-neutral-950/95 via-neutral-900/90 to-neutral-800/85 border border-white/15 shadow-2xl text-white"
            }`}
          >
            {/* Center: Functional Navigation Links matching Page Content */}
            <div className="flex items-center gap-2.5 sm:gap-4 md:gap-6">
              <button
                onClick={() => {
                  setActiveTab("home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`text-[10px] sm:text-[11px] md:text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                  activeTab === "home"
                    ? isLight
                      ? "text-[#C26715] font-bold"
                      : "text-white font-bold"
                    : isLight
                    ? "text-neutral-600 hover:text-black font-normal"
                    : "text-neutral-400 hover:text-neutral-200 font-normal"
                }`}
              >
                HOME
              </button>

              <button
                onClick={() => {
                  setActiveTab("about");
                  document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-[10px] sm:text-[11px] md:text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                  activeTab === "about"
                    ? isLight
                      ? "text-[#C26715] font-bold"
                      : "text-white font-bold"
                    : isLight
                    ? "text-neutral-600 hover:text-black font-normal"
                    : "text-neutral-400 hover:text-neutral-200 font-normal"
                }`}
              >
                ABOUT
              </button>

              <button
                onClick={() => {
                  setActiveTab("how-it-works");
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-[10px] sm:text-[11px] md:text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "how-it-works"
                    ? isLight
                      ? "text-[#C26715] font-bold"
                      : "text-white font-bold"
                    : isLight
                    ? "text-neutral-600 hover:text-black font-normal"
                    : "text-neutral-400 hover:text-neutral-200 font-normal"
                }`}
              >
                HOW IT WORKS
              </button>

              <button
                onClick={() => {
                  setActiveTab("pricing");
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`text-[10px] sm:text-[11px] md:text-xs font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                  activeTab === "pricing"
                    ? isLight
                      ? "text-[#C26715] font-bold"
                      : "text-white font-bold"
                    : isLight
                    ? "text-neutral-600 hover:text-black font-normal"
                    : "text-neutral-400 hover:text-neutral-200 font-normal"
                }`}
              >
                PRICING
              </button>
            </div>

            {/* Right: User Profile (when signed in) + Contact Button + Framer IOKnob Theme Toggle Switch */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* User Profile Pill when signed in */}
              {user && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-mono font-bold text-[10px] sm:text-[11px] md:text-xs tracking-wider uppercase transition-all cursor-pointer flex items-center gap-2 shrink-0 border ${
                      isLight
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-950 hover:bg-amber-500/20"
                        : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    }`}
                  >
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon className="w-3.5 h-3.5" />
                    )}
                    <span className="max-w-[60px] sm:max-w-[90px] truncate">{user.name}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {showUserDropdown && (
                    <div
                      className={`absolute bottom-full mb-3 right-0 w-52 rounded-2xl p-2.5 shadow-2xl border backdrop-blur-2xl z-50 transition-all ${
                        isLight
                          ? "bg-white/95 border-neutral-200 text-[#18181B] shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
                          : "bg-[#16161D]/95 border-white/20 text-white shadow-[0_20px_40px_rgba(0,0,0,0.85)]"
                      }`}
                    >
                      <div className="px-3 py-2 border-b border-inherit space-y-0.5">
                        <p className="text-xs font-bold truncate">{user.name}</p>
                        <p className="text-[10px] opacity-70 truncate">{user.email}</p>
                        {user.brandName && (
                          <p className="text-[9px] font-mono text-[#E05305] uppercase tracking-wider font-bold">
                            {user.brandName}
                          </p>
                        )}
                      </div>
                      <div className="pt-1.5 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            onLaunchStudio();
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-between ${
                            isLight
                              ? "hover:bg-neutral-100 text-[#E05305]"
                              : "hover:bg-white/10 text-white"
                          }`}
                        >
                          <span>Launch Studio</span>
                          <span>→</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUserDropdown(false);
                            logout();
                          }}
                          className={`w-full px-3 py-2 text-left text-xs font-medium rounded-xl transition-colors cursor-pointer text-red-500 ${
                            isLight ? "hover:bg-red-50" : "hover:bg-red-950/40"
                          }`}
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contact Button */}
              <button
                onClick={() => setShowContactModal(true)}
                className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full font-mono font-bold text-[10px] sm:text-[11px] md:text-xs tracking-wider uppercase shadow-md transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  isLight
                    ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:from-[#E0520A] hover:to-[#E05E0C] shadow-[0_4px_16px_rgba(252,115,28,0.4)]"
                    : "bg-white text-neutral-950 hover:bg-neutral-100"
                }`}
              >
                <span>CONTACT</span>
                <span>+</span>
              </button>

              {/* IOKnob Tactile Switch Button */}
              <IOKnob size="sm" />
            </div>
          </nav>
        </div>
      </div>

      {/* Contact & Studio Access Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`relative w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 transition-colors ${
              isLight
                ? "bg-white border border-neutral-200 text-neutral-950 shadow-[0_25px_60px_rgba(0,0,0,0.18)]"
                : "bg-neutral-900 border border-neutral-700 text-white"
            }`}
          >
            <button
              onClick={() => setShowContactModal(false)}
              className={`absolute top-4 right-4 p-1 rounded-full transition-colors cursor-pointer ${
                isLight
                  ? "text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              ✕
            </button>

            <div className="space-y-1">
              <span
                className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                  isLight ? "text-[#C26715]" : "text-neutral-300"
                }`}
              >
                Get In Touch
              </span>
              <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${isLight ? "text-neutral-950" : "text-white"}`}>
                Contact Kaladhar Studio
              </h3>
              <p className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                Turn your saree & ethnic wear catalog into viral social Reels.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs font-mono">
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isLight
                    ? "bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950"
                    : "bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700 text-white"
                }`}
              >
                <span className={isLight ? "text-emerald-900 font-medium" : "text-neutral-300"}>WhatsApp Studio</span>
                <span className={isLight ? "font-bold text-emerald-700" : "font-semibold underline"}>+91 (WhatsApp) →</span>
              </a>

              <a
                href="mailto:contact@staykaro.org"
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isLight
                    ? "bg-amber-50/80 hover:bg-amber-100/80 border-amber-200 text-amber-950"
                    : "bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700 text-white"
                }`}
              >
                <span className={isLight ? "text-amber-900 font-medium" : "text-neutral-300"}>Email Support</span>
                <span className={isLight ? "font-bold text-amber-700" : "font-medium underline"}>contact@staykaro.org</span>
              </a>

              <div
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  isLight
                    ? "bg-neutral-50 border-neutral-200 text-neutral-900"
                    : "bg-neutral-800/80 border-neutral-700 text-white"
                }`}
              >
                <span className={isLight ? "text-neutral-700 font-medium" : "text-neutral-300"}>Location</span>
                <span className={isLight ? "text-neutral-600" : "text-neutral-400"}>Hyderabad, India</span>
              </div>
            </div>

            <div className={`pt-3 border-t ${isLight ? "border-neutral-200" : "border-neutral-800"}`}>
              <button
                onClick={() => {
                  setShowContactModal(false);
                  onLaunchStudio();
                }}
                className={`w-full py-3 rounded-xl font-bold font-mono text-xs tracking-wider uppercase transition-all shadow-lg cursor-pointer ${
                  isLight
                    ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_4px_16px_rgba(252,115,28,0.4)]"
                    : "bg-white text-neutral-950 hover:bg-neutral-200"
                }`}
              >
                Launch Reel Studio Now →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
