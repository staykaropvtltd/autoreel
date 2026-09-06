import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import LiquidCarveButton from "../liquid-carve-button";
import { BillingCycleControl, useBillingCycle } from "./billing-toggle";
import { useTheme } from "../../../../context/ThemeContext";

interface InteractivePricingCardsProps {
  onLaunchStudio: () => void;
}

type PlanId = "free" | "creator" | "pro" | "business";

interface PlanDetails {
  id: PlanId;
  name: string;
  badge?: string;
  tagline: string;
  monthlyPrice: number | string;
  yearlyPrice: number | string;
  currency: string;
  periodText: string;
  unitCost?: string;
  buttonLabel: string;
  reelsCount: string;
  passCode: string;
  features: string[];
}

const PLANS: Record<PlanId, PlanDetails> = {
  free: {
    id: "free",
    name: "Free Trial",
    tagline: "Experience automatic video curation with demo or sample shoot footage.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "₹",
    periodText: "forever",
    buttonLabel: "Start Free",
    reelsCount: "3 Reels / Month",
    passCode: "KL-FREE-003",
    features: [
      "3 sample Reels / month",
      "720p HD MP4 export",
      "Automatic blur & shake rejection",
      "1 licensed audio track included",
      "Interactive web timeline editor",
      "Zero credit card required",
    ],
  },
  creator: {
    id: "creator",
    name: "Creator",
    tagline: "For independent boutiques, creators, and online ethnic fashion stores.",
    monthlyPrice: 299,
    yearlyPrice: 239,
    currency: "₹",
    periodText: "per month",
    unitCost: "₹11.96 / Reel",
    buttonLabel: "Choose Creator",
    reelsCount: "25 Reels / Month",
    passCode: "KL-CREATOR-025",
    features: [
      "25 Reels / month (₹11.96 / Reel)",
      "1080x1920 9:16 Full HD export",
      "Automatic blur & duplicate rejection",
      "Full licensed music library",
      "Standard video export queue",
      "Commercial publishing rights",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro Studio",
    badge: "MOST POPULAR",
    tagline: "For high-velocity ethnic wear retailers and frequent collection drops.",
    monthlyPrice: 799,
    yearlyPrice: 639,
    currency: "₹",
    periodText: "per month",
    unitCost: "₹7.99 / Reel",
    buttonLabel: "Get Pro Studio",
    reelsCount: "100 Reels / Month",
    passCode: "KL-PRO-100",
    features: [
      "100 Reels / month (₹7.99 / Reel)",
      "Signature 2s ivory intro & outro cards",
      "220px mobile safe-area typography",
      "Priority cloud video rendering",
      "Multi-clip batch upload mode",
      "Full human override & timeline editor",
      "Custom brand watermark & logo",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    tagline: "For multi-brand enterprise fashion houses and large e-commerce catalogs.",
    monthlyPrice: "Custom",
    yearlyPrice: "Custom",
    currency: "",
    periodText: "billed annually",
    buttonLabel: "Contact Sales",
    reelsCount: "Unlimited Reels",
    passCode: "KL-ENTERPRISE-VIP",
    features: [
      "Unlimited reel rendering",
      "REST API & webhook integrations",
      "Custom brand typography & intros",
      "Dedicated cloud render instance",
      "24/7 priority dedicated support",
      "Custom intro/outro video animations",
    ],
  },
};

// Render Individual Credit Card Graphic with 100% Theme-Adaptive Data
const CardGraphic = ({
  plan,
  isYearly,
  isExpanded = false,
  isLight = false,
}: {
  plan: PlanDetails;
  isYearly: boolean;
  isExpanded?: boolean;
  isLight?: boolean;
}) => {
  const priceDisplay =
    typeof plan.monthlyPrice === "number"
      ? `${plan.currency}${isYearly ? plan.yearlyPrice : plan.monthlyPrice}`
      : plan.monthlyPrice;

  // Pro Studio Pass Card (Hero Card)
  // Pro Studio Pass Card (Hero Card)
  if (plan.id === "pro") {
    return (
      <div
        className={`relative w-full h-full rounded-2xl p-4 sm:p-5 overflow-hidden flex flex-col justify-between select-none transition-all ${
          isLight
            ? "bg-white text-neutral-950 border-2 border-orange-400/50 shadow-[0_20px_50px_rgba(252,115,28,0.18)]"
            : "bg-white text-black shadow-2xl"
        } ${isExpanded ? (isLight ? "ring-2 ring-[#FC731C]" : "ring-2 ring-white") : ""}`}
      >
        {/* Right Geometric Column */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-12 sm:w-14 flex flex-col items-center justify-around py-3 ${
            isLight ? "bg-[#131620]" : "bg-[#0A0A0C]"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isLight ? "bg-[#1D63FF] text-white shadow-sm" : "bg-white/20 text-white"
            }`}
          >
            ✦
          </div>
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
              isLight ? "bg-[#FF715B] text-white shadow-sm" : "bg-white/15 text-white"
            }`}
          >
            ✿
          </div>
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              isLight ? "bg-[#25D366] text-white shadow-sm" : "bg-white/25 text-white"
            }`}
          >
            ★
          </div>
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
              isLight ? "bg-[#FF3366] text-white shadow-sm" : "bg-white/10 text-white"
            }`}
          >
            ●
          </div>
        </div>

        {/* Left Side Details */}
        <div className={`pr-12 h-full flex flex-col justify-between ${isLight ? "text-[#0A0A0C]" : "text-[#111827]"}`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${isLight ? "text-[#C26715]" : "text-neutral-500"}`}>
                {plan.passCode}
              </span>
              <span
                className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                  isLight
                    ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white shadow-xs"
                    : "bg-black text-white"
                }`}
              >
                Popular
              </span>
            </div>
            <div className="text-sm font-serif font-bold">
              {plan.name}
            </div>
            <div className={`text-[11px] font-semibold ${isLight ? "text-neutral-700" : "text-neutral-800"}`}>
              {plan.reelsCount}
            </div>
          </div>

          {/* Gold / Silver Metal Chip */}
          <div className="py-2">
            <div
              className={`w-10 h-7 rounded-md border shadow-sm flex items-center justify-center ${
                isLight
                  ? "bg-gradient-to-br from-[#FFE082] via-[#FFCA28] to-[#FFA000] border-[#FFD54F]"
                  : "bg-neutral-100 border-neutral-300"
              }`}
            >
              <div className={`w-7 h-5 border rounded-xs ${isLight ? "border-[#C67D00]/50" : "border-black/20"}`} />
            </div>
          </div>

          {/* Price & Unit Rate */}
          <div className="space-y-0.5">
            <div className="text-sm font-serif font-bold">
              {priceDisplay} <span className={`text-[10px] font-normal ${isLight ? "text-neutral-500" : "text-neutral-500"}`}>/{plan.periodText}</span>
            </div>
            <div className={`text-[10px] font-mono font-bold ${isLight ? "text-[#E05305]" : "text-neutral-900"}`}>
              {plan.unitCost}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Creator Pass
  if (plan.id === "creator") {
    return (
      <div
        className={`relative w-full h-full rounded-2xl p-4 sm:p-5 overflow-hidden flex flex-col justify-between select-none transition-all ${
          isLight
            ? "text-white border border-blue-400/40 shadow-xl"
            : "bg-[#141418] text-white border border-white/15 shadow-2xl"
        } ${isExpanded ? (isLight ? "ring-2 ring-blue-500" : "ring-2 ring-white/50") : ""}`}
        style={{
          background: isLight
            ? "linear-gradient(180deg, #10162A 0%, #10162A 44%, #1D63FF 45%, #104BC7 100%)"
            : "linear-gradient(180deg, #18181E 0%, #111116 100%)",
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono font-bold tracking-widest ${isLight ? "text-[#93C5FD]" : "text-neutral-400"}`}>
              {plan.passCode}
            </span>
            <div className={`w-2.5 h-2.5 rounded-full ${isLight ? "bg-[#FFD15C] shadow-sm" : "bg-white"}`} />
          </div>
          <div className="text-sm font-serif font-bold">
            {plan.name}
          </div>
          <div className={`text-[11px] font-semibold ${isLight ? "text-blue-100" : "text-neutral-300"}`}>
            {plan.reelsCount}
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <div
            className={`w-9 h-7 rounded-md border shadow-sm flex items-center justify-center ${
              isLight
                ? "bg-gradient-to-br from-[#FFE082] via-[#FFCA28] to-[#FFA000] border-[#FFD54F]"
                : "bg-neutral-800 border-white/20"
            }`}
          >
            <div className={`w-6 h-5 border rounded-xs ${isLight ? "border-[#C67D00]/50" : "border-black/20"}`} />
          </div>
          <div className="flex items-baseline justify-between text-xs font-mono">
            <span className="font-bold text-sm">{priceDisplay}</span>
            <span className={`text-[10px] ${isLight ? "text-[#FFD15C] font-bold" : "text-neutral-400"}`}>{plan.unitCost}</span>
          </div>
        </div>
      </div>
    );
  }

  // Business Pass
  if (plan.id === "business") {
    return (
      <div
        className={`relative w-full h-full rounded-2xl p-4 sm:p-5 overflow-hidden flex flex-col justify-between select-none transition-all ${
          isLight
            ? "text-white border border-rose-400/40 shadow-xl"
            : "bg-[#111116] text-white border border-white/15 shadow-2xl"
        } ${isExpanded ? (isLight ? "ring-2 ring-rose-500" : "ring-2 ring-white/50") : ""}`}
        style={{
          background: isLight
            ? "linear-gradient(135deg, #220B16 0%, #17070E 46%, #B71C3D 47%, #920F2B 100%)"
            : "linear-gradient(135deg, #1A1A22 0%, #0F0F14 100%)",
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div
              className={`w-8 h-6 rounded-md border flex items-center justify-center shadow-inner ${
                isLight
                  ? "bg-gradient-to-br from-[#FFE082] via-[#FFCA28] to-[#FFA000] border-[#FFD54F]"
                  : "bg-neutral-800 border-white/20"
              }`}
            >
              <div className={`w-5 h-4 border rounded-xs ${isLight ? "border-[#C67D00]/50" : "border-black/20"}`} />
            </div>
            <span className={`text-[9px] font-mono font-bold tracking-widest uppercase ${isLight ? "text-[#F9A8D4]" : "text-neutral-400"}`}>
              {plan.passCode}
            </span>
          </div>
          <div className="text-sm font-serif font-bold pt-1">
            {plan.name}
          </div>
          <div className={`text-[11px] font-semibold ${isLight ? "text-rose-100" : "text-neutral-300"}`}>
            {plan.reelsCount}
          </div>
        </div>

        <div className="space-y-0.5 pt-4">
          <div className={`text-[10px] font-mono tracking-widest ${isLight ? "text-[#FFD15C] font-bold" : "text-neutral-400"}`}>
            ENTERPRISE SCALE
          </div>
          <div className="text-sm font-serif font-bold">
            Custom Quote
          </div>
        </div>
      </div>
    );
  }

  // Free Trial Card
  return (
    <div
      className={`relative w-full h-full rounded-2xl p-4 sm:p-5 overflow-hidden flex flex-col justify-between select-none transition-all ${
        isLight
          ? "text-emerald-950 border border-emerald-400/50 shadow-xl"
          : "bg-[#14141A] text-white border border-white/15 shadow-2xl"
      } ${isExpanded ? (isLight ? "ring-2 ring-emerald-500" : "ring-2 ring-white/50") : ""}`}
      style={{
        background: isLight
          ? "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)"
          : "linear-gradient(135deg, #18181E 0%, #101014 100%)",
      }}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-mono font-bold tracking-widest ${isLight ? "text-emerald-700" : "text-neutral-400"}`}>
            {plan.passCode}
          </span>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
              isLight
                ? "text-emerald-800 bg-emerald-100 border-emerald-300 shadow-2xs"
                : "text-white bg-white/10 border-white/20"
            }`}
          >
            No Card
          </span>
        </div>
        <div className="text-sm font-serif font-bold">
          {plan.name}
        </div>
        <div className={`text-[11px] font-semibold ${isLight ? "text-emerald-800" : "text-neutral-300"}`}>
          {plan.reelsCount}
        </div>
      </div>

      <div className="py-2">
        <div
          className={`w-9 h-6 rounded-md border flex items-center justify-center ${
            isLight
              ? "bg-emerald-100/90 border-emerald-300/80 shadow-2xs"
              : "bg-neutral-800 border-white/20"
          }`}
        >
          <div className={`w-6 h-4 border rounded-xs ${isLight ? "border-emerald-700/30" : "border-black/20"}`} />
        </div>
      </div>

      <div className="flex items-baseline justify-between text-xs font-mono font-bold">
        <span className="text-sm">₹0 / Forever</span>
        <span className={`text-[10px] ${isLight ? "text-emerald-700" : "text-neutral-400"}`}>Free Demo</span>
      </div>
    </div>
  );
};

export default function InteractivePricingCards({ onLaunchStudio }: InteractivePricingCardsProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { isYearly, toggleBillingCycle } = useBillingCycle();
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId | null>(null);

  const selectedPlan = selectedPlanId ? PLANS[selectedPlanId] : null;

  return (
    <section
      id="pricing"
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-transparent border-t overflow-hidden text-center transition-colors ${
        isLight ? "border-black/5" : "border-white/10"
      }`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10">
        {/* Section Header */}
        <header className="flex max-w-2xl flex-col items-center gap-4 text-center">
          <span
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors ${
              isLight
                ? "bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/15 border border-amber-500/30 text-amber-950 shadow-2xs"
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
              Choose Your Video Pass
            </h2>
            <p
              className={`text-base transition-colors ${
                isLight ? "text-neutral-600" : "text-neutral-400"
              }`}
            >
              Pay only for publish-ready videos created from your raw footage. Click on any pass to inspect plan details.
            </p>
          </div>
        </header>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center">
          <div
            className={`px-5 py-2.5 rounded-full border shadow-lg transition-colors ${
              isLight
                ? "bg-white border-neutral-200 text-neutral-900"
                : "bg-[#14141A] border-white/15 text-white"
            }`}
          >
            <BillingCycleControl
              isYearly={isYearly}
              onChange={toggleBillingCycle}
              monthlyLabel="Monthly"
              yearlyLabel="Annual (Save 20%)"
              className="text-xs font-semibold"
            />
          </div>
        </div>

        {/* MAIN INTERACTIVE AREA: Animated State Transition */}
        <div className="w-full min-h-[460px] flex items-center justify-center relative">
          <AnimatePresence mode="wait">
            {/* STATE 1: DEFAULT FLOATING 3D CARDS CLUSTER */}
            {!selectedPlanId && (
              <motion.div
                key="cluster"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full flex flex-col items-center justify-center py-6"
              >
                {/* 3D Floating Cards Container */}
                <div className="relative w-full max-w-[580px] h-[340px] flex items-center justify-center">
                  {/* Card 1: Free Trial (Left Back) */}
                  <motion.div
                    layoutId="card-free"
                    onClick={() => setSelectedPlanId("free")}
                    whileHover={{ scale: 1.08, rotate: -18, zIndex: 40 }}
                    animate={{ y: [0, 8, 0] }}
                    transition={{
                      y: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                      scale: { type: "spring", stiffness: 300, damping: 20 },
                    }}
                    className="absolute left-0 sm:left-4 top-10 w-44 sm:w-52 h-64 sm:h-72 rounded-2xl cursor-pointer -rotate-14 z-10 shadow-2xl"
                  >
                    <CardGraphic plan={PLANS.free} isYearly={isYearly} isLight={isLight} />
                  </motion.div>

                  {/* Card 2: Creator Pass (Center-Left) */}
                  <motion.div
                    layoutId="card-creator"
                    onClick={() => setSelectedPlanId("creator")}
                    whileHover={{ scale: 1.08, rotate: -4, zIndex: 40 }}
                    animate={{ y: [0, -8, 0] }}
                    transition={{
                      y: { duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 },
                      scale: { type: "spring", stiffness: 300, damping: 20 },
                    }}
                    className="absolute left-16 sm:left-24 top-2 w-48 sm:w-56 h-68 sm:h-76 rounded-2xl cursor-pointer -rotate-6 z-20 shadow-2xl"
                  >
                    <CardGraphic plan={PLANS.creator} isYearly={isYearly} isLight={isLight} />
                  </motion.div>

                  {/* Card 3: Pro Studio Pass (Hero Foreground - Center) */}
                  <motion.div
                    layoutId="card-pro"
                    onClick={() => setSelectedPlanId("pro")}
                    whileHover={{ scale: 1.08, rotate: 2, zIndex: 50 }}
                    animate={{ y: [0, 9, 0] }}
                    transition={{
                      y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 },
                      scale: { type: "spring", stiffness: 300, damping: 20 },
                    }}
                    className="absolute left-32 sm:left-44 top-6 w-52 sm:w-60 h-72 sm:h-80 rounded-2xl cursor-pointer -rotate-1 z-30 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.85)]"
                  >
                    <CardGraphic plan={PLANS.pro} isYearly={isYearly} isLight={isLight} />
                  </motion.div>

                  {/* Card 4: Business Pass (Right Back) */}
                  <motion.div
                    layoutId="card-business"
                    onClick={() => setSelectedPlanId("business")}
                    whileHover={{ scale: 1.08, rotate: 18, zIndex: 40 }}
                    animate={{ y: [0, -7, 0] }}
                    transition={{
                      y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
                      scale: { type: "spring", stiffness: 300, damping: 20 },
                    }}
                    className="absolute right-0 sm:right-6 top-8 w-44 sm:w-52 h-64 sm:h-72 rounded-2xl cursor-pointer rotate-12 z-20 shadow-2xl"
                  >
                    <CardGraphic plan={PLANS.business} isYearly={isYearly} isLight={isLight} />
                  </motion.div>
                </div>

                {/* Helper Text */}
                <div
                  className={`mt-8 text-xs font-medium text-center select-none transition-colors ${
                    isLight ? "text-neutral-600" : "text-neutral-400"
                  }`}
                >
                  Click any pass card to inspect prices
                </div>
              </motion.div>
            )}

            {/* STATE 2: ACTIVE INSPECTED PLAN VIEW */}
            {selectedPlan && (
              <motion.div
                key={`details-${selectedPlan.id}`}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
                className={`w-full rounded-3xl p-6 sm:p-10 shadow-2xl relative text-left transition-colors border-2 ${
                  isLight
                    ? "bg-white border-orange-400/30 shadow-[0_25px_70px_rgba(252,115,28,0.12)] text-neutral-950"
                    : "bg-[#121216] border-white/20 text-white"
                }`}
              >
                {/* Close Button (✕) */}
                <button
                  onClick={() => setSelectedPlanId(null)}
                  className={`absolute top-5 right-5 w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer z-20 shadow-md ${
                    isLight
                      ? "bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-900"
                      : "bg-[#1C1C26] hover:bg-[#282836] border-white/20 text-white"
                  }`}
                  aria-label="Close plan details"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* 2-Column Split: Left Side Card + Right Side Deliverables */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  {/* Left Column: Focused Card Display */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
                    <motion.div
                      layoutId={`card-${selectedPlan.id}`}
                      className="w-56 sm:w-64 h-76 sm:h-88 rounded-2xl shadow-2xl relative"
                    >
                      <CardGraphic plan={selectedPlan} isYearly={isYearly} isExpanded={true} isLight={isLight} />
                    </motion.div>

                    {/* Switcher Tabs at Bottom of Card */}
                    <div className="flex items-center gap-1.5 pt-2">
                      {(["free", "creator", "pro", "business"] as const).map((id) => (
                        <button
                          key={id}
                          onClick={() => setSelectedPlanId(id)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            selectedPlanId === id
                              ? isLight
                                ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white shadow-md font-bold"
                                : "bg-white text-black shadow-sm"
                              : isLight
                              ? "bg-neutral-100 text-neutral-600 hover:text-black border border-neutral-200"
                              : "bg-[#181822] text-neutral-400 hover:text-white border border-white/10"
                          }`}
                        >
                          {PLANS[id].name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Plan Breakdown & CTA */}
                  <div className="md:col-span-7 space-y-6">
                    {/* Title & Badge */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-serif text-2xl sm:text-3xl font-bold">
                          {selectedPlan.name}
                        </h3>
                        {selectedPlan.badge && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs ${
                              isLight
                                ? "bg-gradient-to-r from-[#FF611A] to-[#FC731C] text-white"
                                : "bg-white text-black"
                            }`}
                          >
                            {selectedPlan.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                        {selectedPlan.tagline}
                      </p>
                    </div>

                    {/* Price Header */}
                    <div
                      className={`p-4 rounded-2xl border flex items-baseline justify-between ${
                        isLight
                          ? "bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-rose-500/10 border border-amber-200/90 text-neutral-950"
                          : "bg-[#181824] border-white/10 text-white"
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif text-3xl sm:text-4xl font-bold">
                          {typeof selectedPlan.monthlyPrice === "number"
                            ? `${selectedPlan.currency}${isYearly ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice}`
                            : selectedPlan.monthlyPrice}
                        </span>
                        <span className={`text-xs ${isLight ? "text-neutral-600" : "text-neutral-400"}`}>
                          /{selectedPlan.periodText} {isYearly && typeof selectedPlan.monthlyPrice === "number" && selectedPlan.monthlyPrice > 0 ? "(billed annually)" : ""}
                        </span>
                      </div>
                      {selectedPlan.unitCost && (
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                            isLight
                              ? "text-[#E05305] bg-orange-100/90 border-orange-300 shadow-2xs"
                              : "text-white bg-white/10 border-white/20"
                          }`}
                        >
                          {selectedPlan.unitCost}
                        </span>
                      )}
                    </div>

                    {/* Deliverables Checklist */}
                    <div className="space-y-3">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider block ${
                          isLight ? "text-[#18181B]" : "text-white"
                        }`}
                      >
                        What You Get:
                      </span>
                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs ${isLight ? "text-neutral-700" : "text-neutral-300"}`}>
                        {selectedPlan.features.map((feat, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isLight ? "text-emerald-600" : "text-white"}`} />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Button: Liquid Carve CTA (Theme Aware) */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
                      <LiquidCarveButton
                        label={selectedPlan.buttonLabel}
                        onClick={onLaunchStudio}
                        padding="16px 42px"
                        rounded={100}
                        colors={
                          isLight
                            ? { fill: "#FC731C", textColor: "#FFFFFF" }
                            : { fill: "#FFFFFF", textColor: "#000000" }
                        }
                        blob={
                          isLight
                            ? { color: "#FF8C38", size: 85, smoothness: 55 }
                            : { color: "#222222", size: 85, smoothness: 55 }
                        }
                        font={{
                          fontFamily: "Plus Jakarta Sans, sans-serif",
                          fontSize: "15px",
                          fontWeight: 700,
                        }}
                        addIcon={true}
                        icon={{
                          type: "symbol",
                          symbol: "↗",
                          color: isLight ? "#FFFFFF" : "#000000",
                          size: 15,
                          side: "right",
                        }}
                      />

                      <button
                        onClick={() => setSelectedPlanId(null)}
                        className={`text-sm transition-colors cursor-pointer py-2 font-medium ${
                          isLight ? "text-neutral-600 hover:text-black" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        ← Back to all passes
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
