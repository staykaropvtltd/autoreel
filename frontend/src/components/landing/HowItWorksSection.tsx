import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";

interface HowItWorksSectionProps {
  onLaunchStudio?: () => void;
}

const STEPS = [
  {
    id: 0,
    number: "01",
    heading: "Raw Upload & Brand Kit",
    image: "/tv_editorial_1.jpg",
    duration: 4.5,
  },
  {
    id: 1,
    number: "02",
    heading: "AI Reframing & Beat-Sync",
    image: "/tv_editorial_2.jpg",
    duration: 4.5,
  },
  {
    id: 2,
    number: "03",
    heading: "Publish-Ready 60s Reel",
    image: "/tv_editorial_3.jpg",
    duration: 5.0,
  },
];

export default function HowItWorksSection({}: HowItWorksSectionProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [activeStep, setActiveStep] = useState(0);

  // Automatically advance to the next step when the current step duration completes
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, STEPS[activeStep].duration * 1000);

    return () => clearTimeout(timer);
  }, [activeStep]);

  const currentStep = STEPS[activeStep];

  // Manual step jump handler
  const handleStepClick = (index: number) => {
    setActiveStep(index);
  };

  return (
    <section
      id="how-it-works"
      className={`py-24 px-4 sm:px-6 lg:px-8 bg-transparent border-t relative z-20 transition-colors ${
        isLight ? "border-black/5" : "border-white/10"
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2
            className={`font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight transition-colors ${
              isLight ? "text-[#0A0A0C]" : "text-white"
            }`}
          >
            How It Works
          </h2>
          <p
            className={`text-xs sm:text-sm font-sans tracking-wide transition-colors ${
              isLight ? "text-neutral-600" : "text-neutral-400"
            }`}
          >
            Automated video pipeline for textile businesses.
          </p>
        </div>

        {/* Large TV on Left, Clean 3 Headings on Right */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-14">
          
          {/* LEFT: Large Television */}
          <div className="w-full lg:w-[72%] flex-1">
            <div
              className={`w-full rounded-[28px] sm:rounded-[42px] border-[6px] sm:border-[8px] p-3 sm:p-5 transition-all duration-300 ${
                isLight
                  ? "bg-[#EAE7E1] border-[#D6D1C7] shadow-[0_20px_50px_rgba(0,0,0,0.12)]"
                  : "bg-[#111115] border-[#222228] shadow-[0_30px_90px_rgba(0,0,0,0.98)]"
              }`}
            >
              {/* TV Screen Glass Container */}
              <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-[20px] sm:rounded-[30px] bg-black border-2 border-black shadow-[inset_0_0_60px_rgba(0,0,0,0.98)] overflow-hidden flex flex-col justify-between">
                {/* Visual Video Stream (High-Fashion Monochrome) */}
                <div className="absolute inset-0 z-0 overflow-hidden bg-black">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep.id}
                      initial={{ opacity: 0, scale: 1.03 }}
                      animate={{ opacity: 1, scale: 1.0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <img
                        src={currentStep.image}
                        alt={currentStep.heading}
                        className="w-full h-full object-cover object-center filter contrast-[1.06]"
                      />
                      {/* Cinema vignette */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />
                    </motion.div>
                  </AnimatePresence>

                  {/* Step 2: Minimalist White 9:16 vertical crop guide */}
                  {activeStep === 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center"
                    >
                      <div
                        className={`w-[180px] sm:w-[240px] md:w-[270px] h-[90%] border-2 rounded-2xl relative transition-all ${
                          isLight
                            ? "border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.4)]"
                            : "border-white/85 shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                        }`}
                      >
                        <span
                          className={`absolute top-2 left-2 text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded border transition-colors ${
                            isLight
                              ? "text-emerald-300 bg-black/85 border-emerald-400/50 shadow-md"
                              : "text-white bg-black/70 border-white/20"
                          }`}
                        >
                          9:16 AUTO-FRAME
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Top Status Bar: Clean Step Indicator Only */}
                <div className="relative z-30 p-3.5 sm:p-5 flex items-center justify-start text-[10px] sm:text-xs font-mono text-white select-none">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20">
                    <span
                      className={`w-1.5 h-1.5 rounded-full animate-pulse transition-colors ${
                        isLight
                          ? activeStep === 0
                            ? "bg-[#FC731C]"
                            : activeStep === 1
                            ? "bg-emerald-400"
                            : "bg-purple-400"
                          : "bg-white"
                      }`}
                    />
                    <span className="font-bold tracking-wider">STEP 0{activeStep + 1}</span>
                  </div>
                </div>

                {/* Bottom Progress Bar */}
                <div className="relative z-30 p-3.5 sm:p-5 pt-0">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      key={activeStep}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: currentStep.duration, ease: "linear" }}
                      className={`h-full transition-all ${
                        isLight
                          ? "bg-gradient-to-r from-[#FC731C] via-[#FFD15C] to-[#10B981] shadow-[0_0_12px_rgba(252,115,28,0.6)]"
                          : "bg-white shadow-[0_0_8px_#ffffff]"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: 3 Clean Headings */}
          <div className="w-full lg:w-[28%] flex flex-col justify-center space-y-6 sm:space-y-8 select-none">
            {STEPS.map((step, idx) => {
              const isActive = idx === activeStep;
              // Theme-adaptive vibrant colors for each step in light mode
              const lightColorClass =
                idx === 0
                  ? "text-[#E05305]"
                  : idx === 1
                  ? "text-[#1D63FF]"
                  : "text-[#059669]";
              const lightBarClass =
                idx === 0
                  ? "bg-[#FC731C] shadow-[0_0_12px_rgba(252,115,28,0.5)]"
                  : idx === 1
                  ? "bg-[#1D63FF] shadow-[0_0_12px_rgba(29,99,255,0.5)]"
                  : "bg-[#059669] shadow-[0_0_12px_rgba(5,150,105,0.5)]";

              return (
                <div
                  key={step.id}
                  onClick={() => handleStepClick(idx)}
                  className="cursor-pointer group flex items-center gap-4 transition-all duration-400"
                >
                  {/* Glowing Indicator Line on Left */}
                  <div
                    className={`h-10 w-1 rounded-full transition-all duration-400 ${
                      isActive
                        ? isLight
                          ? lightBarClass
                          : "bg-white shadow-[0_0_16px_rgba(255,255,255,0.95)]"
                        : isLight
                        ? "bg-neutral-300 group-hover:bg-neutral-400"
                        : "bg-neutral-800 group-hover:bg-neutral-600"
                    }`}
                  />

                  {/* Heading Text */}
                  <div className="space-y-0.5">
                    <span
                      className={`text-[10px] sm:text-xs font-mono tracking-widest uppercase block transition-colors duration-400 ${
                        isActive
                          ? isLight
                            ? `${lightColorClass} font-bold`
                            : "text-white font-bold"
                          : isLight
                          ? "text-neutral-500 group-hover:text-black"
                          : "text-neutral-600 group-hover:text-neutral-400"
                      }`}
                    >
                      STEP {step.number}
                    </span>
                    <h3
                      className={`text-lg sm:text-xl lg:text-2xl font-bold tracking-tight transition-all duration-400 leading-tight ${
                        isActive
                          ? isLight
                            ? "text-[#18181B] drop-shadow-sm scale-[1.02] origin-left"
                            : "text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.85)] scale-[1.02] origin-left"
                          : isLight
                          ? "text-neutral-500 hover:text-black"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {step.heading}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
}
