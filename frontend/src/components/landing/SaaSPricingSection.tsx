import { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";

interface SaaSPricingSectionProps {
  onLaunchStudio: () => void;
}

interface PricingTier {
  id: "starter" | "pro" | "enterprise";
  name: string;
  tagline: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  priceDisplay?: string;
  periodText: string;
  popular?: boolean;
  buttonLabel: string;
  accent: {
    primary: string;
    lightBorder: string;
    darkBorder: string;
    lightGlow: string;
    darkGlow: string;
    checkColorLight: string;
    checkColorDark: string;
  };
  features: string[];
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For boutique creators testing viral social video.",
    monthlyPrice: 499,
    yearlyPrice: 399,
    periodText: "/mo",
    buttonLabel: "Start free",
    accent: {
      primary: "#10B981", // Emerald
      lightBorder: "rgba(16, 185, 129, 0.3)",
      darkBorder: "rgba(16, 185, 129, 0.22)",
      lightGlow: "0px 20px 60px -15px rgba(16, 185, 129, 0.15), 0px 0px 0px 1px rgba(16, 185, 129, 0.25)",
      darkGlow: "0px 24px 80px 0px rgba(2, 6, 23, 0.4), 0px 0px 0px 1px rgba(16, 185, 129, 0.35)",
      checkColorLight: "#059669",
      checkColorDark: "#34D399",
    },
    features: [
      "25 AI Reel generations / month",
      "Up to 3 active collection projects",
      "Automatic blur & shake rejection",
      "1080x1920 Full HD MP4 export",
    ],
  },
  {
    id: "pro",
    name: "Pro Studio",
    tagline: "For high-velocity ethnic wear retailers.",
    monthlyPrice: 1499,
    yearlyPrice: 1199,
    periodText: "/mo",
    popular: true,
    buttonLabel: "Start Pro",
    accent: {
      primary: "#FC731C", // Radiant Saffron & Sunset Gold
      lightBorder: "rgba(252, 115, 28, 0.55)",
      darkBorder: "rgba(252, 115, 28, 0.45)",
      lightGlow: "0px 25px 80px -10px rgba(252, 115, 28, 0.25), 0px 0px 0px 1.5px rgba(252, 115, 28, 0.4)",
      darkGlow: "0px 24px 90px 0px rgba(255, 97, 26, 0.25), 0px 0px 0px 1px rgba(252, 115, 28, 0.45)",
      checkColorLight: "#EA580C",
      checkColorDark: "#FB923C",
    },
    features: [
      "100 AI Reel generations / month",
      "Priority 2x cloud render speed",
      "Signature 2s intro & outro cards",
      "Custom brand watermark & logo",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For multi-brand fashion houses & catalogs.",
    monthlyPrice: null,
    yearlyPrice: null,
    priceDisplay: "Contact Sales",
    periodText: "Custom annual agreement",
    buttonLabel: "Contact Sales",
    accent: {
      primary: "#8A43E1", // Royal Violet / Amethyst
      lightBorder: "rgba(138, 67, 225, 0.3)",
      darkBorder: "rgba(138, 67, 225, 0.22)",
      lightGlow: "0px 20px 60px -15px rgba(138, 67, 225, 0.15), 0px 0px 0px 1px rgba(138, 67, 225, 0.25)",
      darkGlow: "0px 24px 80px 0px rgba(2, 6, 23, 0.4), 0px 0px 0px 1px rgba(138, 67, 225, 0.35)",
      checkColorLight: "#7C3AED",
      checkColorDark: "#C084FC",
    },
    features: [
      "Unlimited AI Reel generations",
      "Dedicated GPU cloud cluster",
      "Custom brand typography & themes",
      "Dedicated success manager & SLA",
    ],
  },
];

export default function SaaSPricingSection({ onLaunchStudio }: SaaSPricingSectionProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section
      id="pricing"
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-transparent border-t relative z-20 transition-colors ${
        isLight ? "border-black/5" : "border-white/10"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12">
        {/* Section Header */}
        <header className="flex max-w-2xl flex-col items-center gap-4 text-center">
          <span
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              isLight
                ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-500/30 text-amber-950 shadow-xs"
                : "bg-white/10 border border-white/20 text-white"
            }`}
          >
            Transparent Pricing Plans
          </span>

          <div className="flex flex-col items-center gap-3">
            <h2
              className={`font-serif text-3xl sm:text-5xl font-bold tracking-tight transition-colors ${
                isLight ? "text-[#18181B]" : "text-white"
              }`}
            >
              Choose Your Video Reel Pass
            </h2>
            <p
              className={`text-base sm:text-lg max-w-xl transition-colors ${
                isLight ? "text-neutral-600" : "text-neutral-400"
              }`}
            >
              Pay only for publish-ready 9:16 reels created from your raw footage. Every plan includes beat-synced cuts and Full HD exports.
            </p>
          </div>
        </header>

        {/* Interactive Billing Cycle Toggle */}
        <div className="flex items-center justify-center">
          <div
            className={`p-1 rounded-full border shadow-sm flex items-center gap-1 transition-colors ${
              isLight
                ? "bg-neutral-100/90 border-neutral-200"
                : "bg-[#14141B] border-white/15"
            }`}
          >
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`relative px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                !isYearly
                  ? isLight
                    ? "text-black"
                    : "text-white"
                  : isLight
                  ? "text-neutral-500 hover:text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {!isYearly && (
                <motion.div
                  layoutId="billing-pill"
                  className={`absolute inset-0 rounded-full shadow-sm ${
                    isLight ? "bg-white" : "bg-white/15 border border-white/20"
                  }`}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span className="relative z-10">Monthly billing</span>
            </button>

            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`relative px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isYearly
                  ? isLight
                    ? "text-black"
                    : "text-white"
                  : isLight
                  ? "text-neutral-500 hover:text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {isYearly && (
                <motion.div
                  layoutId="billing-pill"
                  className={`absolute inset-0 rounded-full shadow-sm ${
                    isLight ? "bg-white" : "bg-white/15 border border-white/20"
                  }`}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span className="relative z-10">Yearly billing</span>
              <span
                className="relative z-10 text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase tracking-wider"
                style={{
                  backgroundImage: "linear-gradient(135deg, #FF611A, #FC731C)",
                }}
              >
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7 items-stretch">
          {PRICING_TIERS.map((tier) => {
            const isPro = tier.id === "pro";
            const currentPrice =
              tier.monthlyPrice !== null
                ? isYearly
                  ? tier.yearlyPrice
                  : tier.monthlyPrice
                : null;

            return (
              <motion.article
                key={tier.id}
                whileHover={{
                  scale: isPro ? 1.03 : 1.02,
                  y: -4,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                }}
                className={`relative rounded-[24px] p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                  isLight
                    ? isPro
                      ? "bg-gradient-to-b from-orange-50/70 via-white to-white border-2 text-neutral-900"
                      : "bg-white border text-neutral-900"
                    : isPro
                    ? "bg-gradient-to-b from-[rgba(255,97,26,0.18)] via-white/[0.07] to-white/[0.04] backdrop-blur-xl border text-white"
                    : "bg-white/[0.05] backdrop-blur-md border text-white"
                }`}
                style={{
                  borderColor: isLight ? tier.accent.lightBorder : tier.accent.darkBorder,
                  boxShadow: isLight
                    ? isPro
                      ? tier.accent.lightGlow
                      : "0px 12px 35px -8px rgba(0, 0, 0, 0.06)"
                    : isPro
                    ? tier.accent.darkGlow
                    : "0px 24px 80px 0px rgba(2, 6, 23, 0.32)",
                }}
              >
                {/* Top Section */}
                <div className="space-y-6">
                  {/* Header Row: Title & Most Popular Badge */}
                  <div className="flex items-start justify-between gap-3 min-h-[32px]">
                    <div>
                      <h3
                        className={`text-2xl font-bold tracking-tight ${
                          isLight ? "text-neutral-900" : "text-white"
                        }`}
                      >
                        {tier.name}
                      </h3>
                      <p
                        className={`text-sm mt-1 leading-snug ${
                          isLight ? "text-neutral-600" : "text-neutral-400"
                        }`}
                      >
                        {tier.tagline}
                      </p>
                    </div>

                    {tier.popular && (
                      <span
                        className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full text-white shadow-xs"
                        style={{
                          backgroundImage: "linear-gradient(135deg, #FF611A, #FC731C)",
                        }}
                      >
                        Most Popular
                      </span>
                    )}
                  </div>

                  {/* Pricing Display */}
                  <div className="pt-2 pb-2 border-b border-black/5 dark:border-white/10">
                    {currentPrice !== null ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl sm:text-5xl font-extrabold tracking-tight font-sans">
                          ₹{currentPrice.toLocaleString("en-IN")}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            isLight ? "text-neutral-500" : "text-neutral-400"
                          }`}
                        >
                          {tier.periodText}
                        </span>
                        {isYearly && (
                          <span
                            className={`ml-auto text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isLight
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                            }`}
                          >
                            Billed yearly
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans">
                          {tier.priceDisplay}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            isLight ? "text-neutral-500" : "text-neutral-400"
                          }`}
                        >
                          {tier.periodText}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feature Checklist (Limited, Focused Deliverables) */}
                  <div className="space-y-3 pt-1">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider block ${
                        isLight ? "text-neutral-800" : "text-neutral-200"
                      }`}
                    >
                      Included Deliverables:
                    </span>
                    <ul className="space-y-3">
                      {tier.features.map((feature, i) => {
                        const isReelCountFeature = i === 0;
                        return (
                          <li key={i} className="flex items-center gap-3 text-sm">
                            <div
                              className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{
                                color: isLight
                                  ? tier.accent.checkColorLight
                                  : tier.accent.checkColorDark,
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                className="w-4 h-4"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                            <span
                              className={`${
                                isReelCountFeature
                                  ? isLight
                                    ? "font-bold text-neutral-900"
                                    : "font-bold text-white"
                                  : isLight
                                  ? "text-neutral-700"
                                  : "text-neutral-300"
                              }`}
                            >
                              {feature}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                {/* Bottom CTA Button */}
                <div className="pt-8 mt-auto">
                  <button
                    type="button"
                    onClick={onLaunchStudio}
                    className={`w-full py-3.5 px-6 rounded-full text-sm font-bold tracking-tight transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                      isPro
                        ? isLight
                          ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white hover:brightness-105 shadow-[0_4px_16px_rgba(252,115,28,0.35)]"
                          : "bg-white text-black hover:bg-[#FC731C] hover:text-white shadow-[0_0_24px_rgba(255,255,255,0.2)]"
                        : isLight
                        ? "bg-neutral-900 hover:bg-black text-white hover:shadow-md"
                        : "bg-white/10 hover:bg-white text-white hover:text-black border border-white/15"
                    }`}
                  >
                    <span>{tier.buttonLabel}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
