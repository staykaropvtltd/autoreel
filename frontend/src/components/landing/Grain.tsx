import { motion } from "framer-motion";
import React from "react";

interface GrainProps {
  animate?: boolean;
  animationSpeed?: number;
  opacity?: number;
  grainSize?: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function Grain({
  animate = true,
  animationSpeed = 1,
  opacity = 0.25,
  grainSize = 250,
  style,
  className = "",
}: GrainProps) {
  const keyframesX = ["0%", "-5%", "-15%", "7%", "-5%", "-15%", "15%", "0%", "3%", "-10%"];
  const keyframesY = ["0%", "-10%", "5%", "-25%", "25%", "10%", "0%", "15%", "35%", "10%"];

  const containerStyle: React.CSSProperties = {
    backgroundImage: `url('/grain.png'), url('https://framerusercontent.com/images/rR6HYXBrMmX4cRpXfXUOvpvpB0.png')`,
    backgroundSize: `${grainSize}px ${grainSize}px`,
    backgroundRepeat: "repeat",
    position: "absolute",
    inset: "-200%",
    width: "400%",
    height: "400%",
    opacity,
    pointerEvents: "none",
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden pointer-events-none select-none ${className}`}
      style={style}
    >
      <motion.div
        style={containerStyle}
        animate={animate ? { x: keyframesX, y: keyframesY } : undefined}
        transition={{
          ease: "linear",
          repeat: Infinity,
          duration: 8 / Math.max(0.1, animationSpeed),
        }}
      />
    </div>
  );
}
