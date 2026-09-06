import { useEffect, useState } from "react";
import MagnettoHeroSection from "./MagnettoHeroSection";
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
    <div
      className={`min-h-screen font-sans antialiased overflow-x-hidden transition-colors duration-300 ${
        isLight
          ? "bg-[#F8F7F4] text-[#0A0A0C] selection:bg-black/15 selection:text-black"
          : "bg-[#09090B] text-white selection:bg-white/20 selection:text-white"
      }`}
    >
      {/* 1. Magnetto Hero Screen with Centered Human Model, Pixel Typography, Editorial Copy & Floating Dock */}
      <MagnettoHeroSection onLaunchStudio={onLaunchStudio} onOpenAuth={openAuth} />

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
    </div>
  );
}

