import { useEffect, useState } from "react";
import LandingNavbar from "./LandingNavbar";
import LandingHeroStepSection from "./LandingHeroStepSection";
import ScrollStatementSection from "./ScrollStatementSection";
import HowItWorksSection from "./HowItWorksSection";
import PricingSection from "./PricingSection";
import FinalCtaBand from "./FinalCtaBand";
import LandingFooter from "./LandingFooter";
import AuthModal from "../auth/AuthModal";
import ReflectBackground from "../originkit/ui/reflect-background";
import { useTheme } from "../../context/ThemeContext";

import { type BrandingInfo } from "../../branding";

interface LandingPageProps {
  onLaunchStudio: () => void;
  onNavigateToSignIn?: () => void;
  onNavigateToSignUp?: () => void;
  branding?: BrandingInfo;
}

export default function LandingPage({
  onLaunchStudio,
  onNavigateToSignIn,
  onNavigateToSignUp,
}: LandingPageProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"signin" | "signup">("signin");
  const [showContactModal, setShowContactModal] = useState(false);

  const openAuth = (mode: "signin" | "signup" = "signin") => {
    if (mode === "signin" && onNavigateToSignIn) {
      onNavigateToSignIn();
      return;
    }
    if (mode === "signup" && onNavigateToSignUp) {
      onNavigateToSignUp();
      return;
    }
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.title = "Kaladhar · AI Reels & Video Automation for Textile SMBs";
  }, []);

  return (
    <div className="min-h-screen font-sans antialiased overflow-x-hidden bg-white text-neutral-900 selection:bg-black/15 selection:text-black">
      {/* 1. Fixed/Sticky Top Navigation Bar (Pitch Black) */}
      <LandingNavbar
        onLaunchStudio={onLaunchStudio}
        onOpenContact={() => setShowContactModal(true)}
        onOpenAuth={openAuth}
      />

      {/* 2. Hero Section with 3-Step Interactive Animation (Pure White Background) */}
      <div className="w-full bg-white text-black">
        <LandingHeroStepSection onLaunchStudio={onLaunchStudio} />
      </div>

      {/* 2. Seamless Section Continuity */}
      <ReflectBackground gap={28} dotSize={1.8} radius={45}>
        {/* Core Value Statement */}
        <ScrollStatementSection />

        {/* How It Works (Above Pricing Section) */}
        <HowItWorksSection onLaunchStudio={onLaunchStudio} />

        {/* Pricing System */}
        <PricingSection onLaunchStudio={onLaunchStudio} />

        {/* Final CTA Band */}
        <FinalCtaBand onLaunchStudio={onLaunchStudio} />
      </ReflectBackground>

      {/* 3. Footer */}
      <LandingFooter onLaunchStudio={onLaunchStudio} onOpenAuth={openAuth} />

      {/* 4. Global Auth Modal (Sign In / Sign Up / Google OAuth) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={onLaunchStudio}
      />

      {/* 5. Contact Modal */}
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
              type="button"
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
                Contact the ReelKaro team
              </h3>
              <p className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                Create product videos for the catalog you choose.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs font-mono">
              <div
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isLight
                    ? "bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950"
                    : "bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700 text-white"
                }`}
              >
                <span className={isLight ? "text-emerald-900 font-medium" : "text-neutral-300"}>WhatsApp</span>
                <span className={isLight ? "font-bold text-emerald-700" : "font-semibold"}>Contact not configured</span>
              </div>

              <div
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isLight
                    ? "bg-amber-50/80 hover:bg-amber-100/80 border-amber-200 text-amber-950"
                    : "bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700 text-white"
                }`}
              >
                <span className={isLight ? "text-amber-900 font-medium" : "text-neutral-300"}>Email Support</span>
                <span className={isLight ? "font-bold text-amber-700" : "font-medium"}>Contact not configured</span>
              </div>

              <div
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  isLight
                    ? "bg-neutral-50 border-neutral-200 text-neutral-900"
                    : "bg-neutral-800/80 border-neutral-700 text-white"
                }`}
              >
                <span className={isLight ? "text-neutral-700 font-medium" : "text-neutral-300"}>Location</span>
                <span className={isLight ? "text-neutral-600" : "text-neutral-400"}>Not configured</span>
              </div>
            </div>

            <div className={`pt-3 border-t ${isLight ? "border-neutral-200" : "border-neutral-800"}`}>
              <button
                type="button"
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
    </div>
  );
}

