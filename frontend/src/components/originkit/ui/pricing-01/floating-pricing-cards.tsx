import { motion } from "motion/react";
import { Wifi } from "lucide-react";

export default function FloatingPricingCards() {
  return (
    <div className="relative w-full max-w-4xl mx-auto py-12 px-4 flex flex-col items-center justify-center select-none overflow-visible">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Cards Cluster */}
      <div className="relative w-full max-w-[560px] h-[300px] sm:h-[340px] flex items-center justify-center">
        
        {/* Card 4: Coral Pink & Obsidian Black (Back Right) */}
        <motion.div
          drag
          dragConstraints={{ left: -50, right: 50, top: -40, bottom: 40 }}
          whileHover={{ scale: 1.08, rotate: 12, zIndex: 40 }}
          whileDrag={{ scale: 1.12, zIndex: 50 }}
          animate={{ y: [0, 6, 0] }}
          transition={{
            y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
            scale: { type: "spring", stiffness: 300, damping: 20 },
          }}
          className="absolute right-2 sm:right-6 bottom-4 w-44 sm:w-52 h-28 sm:h-32 rounded-2xl p-3.5 shadow-2xl border border-white/20 overflow-hidden cursor-grab active:cursor-grabbing rotate-6"
          style={{
            background: "linear-gradient(135deg, #FF4B72 0%, #E02850 48%, #111116 50%, #09090D 100%)",
            boxShadow: "0 20px 40px -10px rgba(224, 40, 80, 0.4)",
          }}
        >
          <div className="h-full flex flex-col justify-between text-white">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/80">
                Studio VIP
              </span>
              <Wifi className="w-3.5 h-3.5 rotate-90 text-white/70" />
            </div>
            <div className="flex items-end justify-between">
              <div className="text-[11px] font-mono tracking-wider text-white/90">
                •••• 9428
              </div>
              <span className="font-serif font-black text-xs tracking-widest text-white italic">
                KALADHAR
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Crimson & Silver Zari Pattern (Middle Right) */}
        <motion.div
          drag
          dragConstraints={{ left: -50, right: 50, top: -40, bottom: 40 }}
          whileHover={{ scale: 1.08, rotate: 16, zIndex: 40 }}
          whileDrag={{ scale: 1.12, zIndex: 50 }}
          animate={{ y: [0, -7, 0] }}
          transition={{
            y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
            scale: { type: "spring", stiffness: 300, damping: 20 },
          }}
          className="absolute right-8 sm:right-16 top-4 w-44 sm:w-52 h-64 sm:h-72 rounded-2xl p-4 shadow-2xl border border-white/20 overflow-hidden cursor-grab active:cursor-grabbing rotate-12"
          style={{
            background: "linear-gradient(135deg, #2D2D38 0%, #181822 55%, #E03535 56%, #C02020 100%)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
          }}
        >
          {/* Subtle Geometric Weave Overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]" />

          <div className="relative h-full flex flex-col justify-between text-white">
            <div className="flex items-center justify-between">
              <div className="w-8 h-6 rounded-md bg-[#D4AF37] border border-[#F3C766] flex items-center justify-center shadow-inner">
                <div className="w-5 h-4 border border-black/30 rounded-sm" />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#FAF7F2]">
                ENTERPRISE
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-serif font-bold text-white/90">
                Unlimited Pass
              </div>
              <div className="text-[9px] font-mono text-white/60">
                FAST-TRACK RENDERING
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Electric Blue & Charcoal Split (Middle Left) */}
        <motion.div
          drag
          dragConstraints={{ left: -50, right: 50, top: -40, bottom: 40 }}
          whileHover={{ scale: 1.08, rotate: 0, zIndex: 40 }}
          whileDrag={{ scale: 1.12, zIndex: 50 }}
          animate={{ y: [0, 8, 0] }}
          transition={{
            y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 },
            scale: { type: "spring", stiffness: 300, damping: 20 },
          }}
          className="absolute left-16 sm:left-24 top-2 w-48 sm:w-56 h-68 sm:h-76 rounded-2xl p-4 shadow-2xl border border-white/20 overflow-hidden cursor-grab active:cursor-grabbing -rotate-6"
          style={{
            background: "linear-gradient(180deg, #161620 0%, #161620 48%, #1D63FF 49%, #1546C4 100%)",
            boxShadow: "0 25px 50px -12px rgba(29, 99, 255, 0.35)",
          }}
        >
          <div className="relative h-full flex flex-col justify-between text-white">
            {/* Top Half (Dark) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/80">
                  Creator Pass
                </span>
                <div className="flex -space-x-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#FC731C] opacity-90" />
                  <div className="w-4 h-4 rounded-full bg-[#FFBD2E] opacity-90" />
                </div>
              </div>
            </div>

            {/* Bottom Half (Electric Blue) */}
            <div className="space-y-2 pt-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-6 rounded-md bg-[#F3C766] border border-white/40 shadow-sm flex items-center justify-center">
                  <div className="w-5 h-4 border border-black/20 rounded-sm" />
                </div>
                <Wifi className="w-3.5 h-3.5 rotate-90 text-white" />
              </div>
              <div className="text-[10px] font-mono tracking-widest text-white/90">
                25 REELS / MO
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 1: Crisp White & Colorblock (Front Left - Hero Focus Card) */}
        <motion.div
          drag
          dragConstraints={{ left: -50, right: 50, top: -40, bottom: 40 }}
          whileHover={{ scale: 1.08, rotate: -3, zIndex: 50 }}
          whileDrag={{ scale: 1.15, zIndex: 60 }}
          animate={{ y: [0, -9, 0] }}
          transition={{
            y: { duration: 4.8, repeat: Infinity, ease: "easeInOut" },
            scale: { type: "spring", stiffness: 300, damping: 20 },
          }}
          className="absolute left-0 sm:left-4 top-8 w-52 sm:w-60 h-72 sm:h-80 rounded-2xl bg-white p-4 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] border-2 border-white/80 overflow-hidden cursor-grab active:cursor-grabbing -rotate-12 z-30 flex flex-col justify-between"
        >
          {/* Right Color-Block Pattern Column */}
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-14 bg-[#1E6BFF] flex flex-col items-center justify-around py-3">
            <div className="w-6 h-6 rounded-full bg-[#FF715B] flex items-center justify-center text-white text-[10px] font-bold">
              ◆
            </div>
            <div className="w-6 h-6 rounded-md bg-[#25D366] flex items-center justify-center text-white text-[10px] font-bold">
              ✿
            </div>
            <div className="w-6 h-6 rounded-full bg-[#FFD15C] flex items-center justify-center text-black text-[10px] font-bold">
              ▲
            </div>
            <div className="w-6 h-6 rounded-md bg-[#FF428E] flex items-center justify-center text-white text-[10px] font-bold">
              ●
            </div>
          </div>

          {/* Left Main Card Area */}
          <div className="pr-12 h-full flex flex-col justify-between text-[#111827]">
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold tracking-widest text-[#64748B] uppercase">
                Pro Studio Pass
              </div>
              <div className="text-xs font-serif font-bold text-[#111827]">
                100 Reels Included
              </div>
            </div>

            {/* Gold EMV Chip */}
            <div className="py-4">
              <div className="w-9 h-7 rounded-md bg-gradient-to-br from-[#F5D061] to-[#D4AF37] border border-[#E5B83B] shadow-sm flex items-center justify-center">
                <div className="w-6 h-5 border border-black/20 rounded-xs" />
              </div>
            </div>

            {/* Bottom Card Number & Branding */}
            <div className="space-y-0.5">
              <div className="text-[11px] font-mono tracking-wider font-semibold text-[#334155]">
                5412 •••• 8820
              </div>
              <div className="text-[9px] font-bold text-[#FC731C] tracking-wide uppercase">
                Instant Video Pass
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      {/* Interactive Helper Text */}
      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#A39E9B]">
        <span>Drag or hover cards to explore membership pass tiers</span>
      </div>

    </div>
  );
}
