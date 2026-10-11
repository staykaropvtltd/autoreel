import { useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, Maximize2, Layers, Smartphone, Eye } from "lucide-react";

export default function Features03() {
  const [activeTab, setActiveTab] = useState<"all" | "quality" | "framing" | "branding">("all");

  return (
    <section id="features" className="py-28 px-4 sm:px-6 lg:px-8 bg-[#09090B] border-t border-white/5 text-left">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#16161F] border border-[#D4AF37]/30 text-xs font-semibold uppercase tracking-wider text-[#F3C766]">
              <Layers className="w-3.5 h-3.5" />
              <span>Intelligent Video Pipeline</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#FAF7F2] leading-tight">
              Engineered for High-Velocity <br className="hidden sm:block" />
              <span className="gold-gradient-text italic font-normal">Ethnic Wear Catalogs</span>
            </h2>
            <p className="text-base sm:text-lg text-[#A39E9B] leading-relaxed font-sans">
              From blur rejection to automated 9:16 safe-area branding — every feature is purpose-built to turn raw saree and lehenga shoots into high-converting social Reels.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 p-1.5 rounded-full bg-[#121218] border border-white/10 shrink-0 self-start md:self-auto">
            {(
              [
                { id: "all", label: "All Features" },
                { id: "quality", label: "AI Quality" },
                { id: "framing", label: "9:16 Framing" },
                { id: "branding", label: "Safe Branding" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#FAF7F2] text-[#09090B] shadow-sm font-bold"
                    : "text-[#A39E9B] hover:text-[#FAF7F2]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Card 1 (Span 8 Cols): Automated Quality & Blur Scoring */}
          {(activeTab === "all" || activeTab === "quality") && (
            <div className="md:col-span-8 rounded-3xl bg-[#121218] border border-white/8 p-7 sm:p-9 shadow-2xl flex flex-col justify-between group hover:border-[#D4AF37]/30 transition-all duration-300 relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766]">
                    <Eye className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#D4AF37] px-3 py-1 rounded-full bg-[#1C1A14] border border-[#D4AF37]/20">
                    Auto-Scoring Engine
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-2xl font-bold text-[#FAF7F2]">
                    Automatic Blur & Camera Shake Rejection
                  </h3>
                  <p className="text-sm text-[#A39E9B] max-w-xl leading-relaxed">
                    Every second of raw photoshoot video is analyzed for optical clarity, focal plane sharpness, and motion stability. Out-of-focus takes and handheld camera jitters are automatically dropped before timeline assembly.
                  </p>
                </div>
              </div>

              {/* Visual Mockup inside Bento Card */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Rejected Take Mockup */}
                <div className="p-4 rounded-2xl bg-[#181822] border border-red-500/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-400 font-bold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      <span>Take 03 · Blur Detected</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#746A6D]">4.2s</span>
                  </div>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/5">
                    <img
                      src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=50"
                      alt="Blurry take"
                      className="w-full h-full object-cover blur-sm opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-[11px] font-bold text-red-400 bg-black/80 px-2.5 py-1 rounded-full border border-red-500/30">
                        Score: 38/100 · Dropped
                      </span>
                    </div>
                  </div>
                </div>

                {/* Approved Take Mockup */}
                <div className="p-4 rounded-2xl bg-[#181822] border border-emerald-500/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Take 04 · Sharp Hero Shot</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#746A6D]">5.8s</span>
                  </div>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-white/5">
                    <img
                      src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80"
                      alt="Sharp take"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="text-[11px] font-bold text-emerald-400 bg-black/80 px-2.5 py-1 rounded-full border border-emerald-500/30">
                        Score: 96/100 · Selected
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 2 (Span 4 Cols): 9:16 Smart Ambient Canvas Reframe */}
          {(activeTab === "all" || activeTab === "framing") && (
            <div className="md:col-span-4 rounded-3xl bg-[#121218] border border-white/8 p-7 sm:p-9 shadow-2xl flex flex-col justify-between group hover:border-[#D4AF37]/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766]">
                  <Maximize2 className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-xl font-bold text-[#FAF7F2]">
                    Smart 9:16 Ambient Canvas Reframing
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A39E9B] leading-relaxed">
                    Horizontal (16:9) and square photoshoot footage receive an ambient blurred backdrop treatment, keeping models uncropped and sarees perfectly centered.
                  </p>
                </div>
              </div>

              {/* Visual 9:16 Reframe Card */}
              <div className="mt-6 flex justify-center">
                <div className="relative w-36 aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/20 shadow-xl">
                  {/* Background Blurred Ambient Layer */}
                  <img
                    src="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=40"
                    alt="Ambient backdrop"
                    className="absolute inset-0 w-full h-full object-cover blur-md opacity-60 scale-125"
                  />
                  {/* Foreground Center Horizontal Take */}
                  <div className="absolute inset-x-1.5 top-1/2 -translate-y-1/2 aspect-video rounded-lg overflow-hidden border border-white/30 shadow-md">
                    <img
                      src="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=300&q=80"
                      alt="Centered take"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-2 left-2 right-2 text-center">
                    <span className="text-[9px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                      Zero Cropping
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 3 (Span 4 Cols): Duplicate Pose Deduplication & Angle Diversity */}
          {(activeTab === "all" || activeTab === "quality") && (
            <div className="md:col-span-4 rounded-3xl bg-[#121218] border border-white/8 p-7 sm:p-9 shadow-2xl flex flex-col justify-between group hover:border-[#D4AF37]/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766]">
                  <Layers className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-xl font-bold text-[#FAF7F2]">
                    Pose Deduplication & Shot Diversity
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A39E9B] leading-relaxed">
                    The AI identifies repeated model stances across multiple takes and constructs a diverse 4-stage visual narrative: Hero Walk ➔ Pallu Drape ➔ Zari Macro ➔ Full Silhouette.
                  </p>
                </div>
              </div>

              {/* Visual Shot Sequence Pills */}
              <div className="mt-6 space-y-2 text-xs">
                {[
                  { name: "01. Full Walk Movement", tag: "Selected", color: "text-emerald-400" },
                  { name: "02. Repeat Stance", tag: "Skipped (Duplicate)", color: "text-[#746A6D]" },
                  { name: "03. Pallu Embroidery Macro", tag: "Selected", color: "text-emerald-400" },
                  { name: "04. 360 Spin Turn", tag: "Selected", color: "text-emerald-400" },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#181822] border border-white/5 flex items-center justify-between font-mono text-[11px]"
                  >
                    <span className="text-[#FAF7F2] font-sans truncate">{item.name}</span>
                    <span className={`font-bold shrink-0 ml-2 ${item.color}`}>{item.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 4 (Span 4 Cols): Mobile Safe-Area Margin Protection */}
          {(activeTab === "all" || activeTab === "branding") && (
            <div className="md:col-span-4 rounded-3xl bg-[#121218] border border-white/8 p-7 sm:p-9 shadow-2xl flex flex-col justify-between group hover:border-[#D4AF37]/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766]">
                  <Smartphone className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-xl font-bold text-[#FAF7F2]">
                    220px Mobile Safe-Area Protection
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A39E9B] leading-relaxed">
                    Overlaid product titles, fabric tags, and prices are constrained strictly within mobile safe zones, ensuring they are never covered by Instagram likes or TikTok comments.
                  </p>
                </div>
              </div>

              {/* Visual Safe Zone Grid */}
              <div className="mt-6 p-4 rounded-2xl bg-[#181822] border border-white/5 text-center space-y-2">
                <div className="h-6 rounded-lg bg-red-500/10 border border-dashed border-red-500/30 flex items-center justify-center text-[10px] text-red-400 font-mono">
                  Top Mobile UI Notch Danger Zone
                </div>
                <div className="py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-400 font-serif">
                  ✓ Protected Safe Zone (Title & Price)
                </div>
                <div className="h-6 rounded-lg bg-red-500/10 border border-dashed border-red-500/30 flex items-center justify-center text-[10px] text-red-400 font-mono">
                  Bottom Description & Audio Caption Zone
                </div>
              </div>
            </div>
          )}

          {/* Card 5 (Span 4 Cols): Signature 2s Ivory Brand Cards */}
          {(activeTab === "all" || activeTab === "branding") && (
            <div className="md:col-span-4 rounded-3xl bg-[#121218] border border-white/8 p-7 sm:p-9 shadow-2xl flex flex-col justify-between group hover:border-[#D4AF37]/30 transition-all duration-300">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-[#1C1A14] border border-[#D4AF37]/30 flex items-center justify-center text-[#F3C766]">
                  <ShieldCheck className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-xl font-bold text-[#FAF7F2]">
                    Signature 2s Luxury Brand Cards
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A39E9B] leading-relaxed">
                    Rendered with your official boutique logo watermark, brand colors, and elegant warm ivory intro/outro cards to give your brand an international luxury identity.
                  </p>
                </div>
              </div>

              {/* Visual Brand Card Mockup */}
              <div className="mt-6 p-5 rounded-2xl bg-gradient-to-br from-[#FFFDF9] to-[#F5F0E6] text-[#09090B] border border-[#D4AF37]/40 shadow-lg text-center space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#8A8580] block">
                  Signature Intro Card · 2.0s
                </span>
                <div className="font-serif font-bold text-lg text-[#09090B] tracking-tight">
                  KALADHAR
                </div>
                <div className="text-[10px] text-[#555] italic">
                  Heritage Silk Edition · Autumn / Festive
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}
