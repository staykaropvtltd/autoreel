"use client";

import { useRef, type CSSProperties } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

type ScrollHighlightProps = {
  text?: string;
  font?: CSSProperties;
  dimColor?: string;
  highlightColor?: string;
  splitBy?: "characters" | "words";
  scrollStart?: string;
  scrollEnd?: string;
  scrub?: boolean | number;
  className?: string;
  containerStyle?: CSSProperties;
};

// Single Word Component that lights up smoothly as its slice of scroll is reached
const Word = ({
  children,
  progress,
  range,
  dimColor,
  highlightColor,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  dimColor: string;
  highlightColor: string;
}) => {
  const opacity = useTransform(progress, range, [0.22, 1]);
  const color = useTransform(progress, range, [dimColor, highlightColor]);

  return (
    <motion.span
      style={{ opacity, color }}
      className="inline-block transition-colors duration-100 will-change-[opacity,color]"
    >
      {children}
    </motion.span>
  );
};

export default function ScrollHighlight({
  text = "Ethnic fashion moves at the speed of social commerce. From handwoven Banarasi silks to bespoke bridal lehengas, Kaladhar Auto-Reel curates, reframes, and brands your raw photoshoot footage into ready-to-publish vertical Reels in minutes.",
  font = {
    fontFamily: '"Playfair Display", Georgia, serif',
    fontSize: "clamp(26px, 3.8vw, 46px)",
    fontWeight: 700,
    lineHeight: "1.32",
    letterSpacing: "-0.02em",
    textAlign: "center",
  },
  dimColor = "rgba(250, 247, 242, 0.22)",
  highlightColor = "#FAF7F2",
  className = "",
  containerStyle,
}: ScrollHighlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 85%", "end 45%"],
  });

  const words = text.trim().split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  return (
    <div
      ref={containerRef}
      className={`w-full flex items-center justify-center ${className}`}
      style={{ padding: "40px 0", ...containerStyle }}
    >
      <p
        style={{
          margin: 0,
          display: "inline-block",
          whiteSpace: "pre-wrap",
          ...font,
        }}
      >
        {words.map((word, i) => {
          // Staggered range for each word across scroll progress
          const start = i / totalWords;
          const end = Math.min(1, (i + 1.2) / totalWords);

          return (
            <span key={`${word}-${i}`} className="inline-block">
              <Word
                progress={scrollYProgress}
                range={[start, end]}
                dimColor={dimColor}
                highlightColor={highlightColor}
              >
                {word}
              </Word>
              {i < words.length - 1 && <span>&nbsp;</span>}
            </span>
          );
        })}
      </p>
    </div>
  );
}