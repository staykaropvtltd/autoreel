"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";

interface LabelSlideButtonProps {
  label?: string;
  subLabel?: string;
  icon?: ReactNode;
  showIcon?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  colors?: {
    bg?: string;
    textColor?: string;
    hoverBg?: string;
    hoverTextColor?: string;
    borderColor?: string;
  };
}

export default function LabelSlideButton({
  label = "Try For Free",
  subLabel,
  icon,
  showIcon = true,
  onClick,
  className = "",
  style,
  colors = {
    bg: "#121214",
    textColor: "#FFFFFF",
    hoverBg: "#1C1C22",
    hoverTextColor: "#FFFFFF",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
}: LabelSlideButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverText = subLabel || label;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: isHovered ? colors.hoverBg || colors.bg : colors.bg,
        color: isHovered ? colors.hoverTextColor || colors.textColor : colors.textColor,
        borderColor: colors.borderColor || "transparent",
        ...style,
      }}
      className={`relative inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full border shadow-xl cursor-pointer select-none overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] active:scale-95 group ${className}`}
    >
      {/* Dual Sliding Label Container */}
      <div className="relative h-[20px] overflow-hidden flex flex-col items-center justify-center font-sans font-bold text-[14px] tracking-wide">
        
        {/* Label 1 (Slides UP on Hover) */}
        <span
          className={`h-[20px] flex items-center transition-transform duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
            isHovered ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          {label}
        </span>

        {/* Label 2 (Slides IN from Bottom on Hover) */}
        <span
          className={`absolute h-[20px] flex items-center transition-transform duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
            isHovered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
          }`}
        >
          {hoverText}
        </span>
      </div>

      {/* Sliding Arrow Icon */}
      {showIcon && (
        <div className="relative w-4 h-4 overflow-hidden flex items-center justify-center">
          {icon ? (
            icon
          ) : (
            <>
              {/* Default Arrow 1 */}
              <ArrowUpRight
                className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
                  isHovered ? "translate-x-4 -translate-y-4 opacity-0" : "translate-x-0 translate-y-0 opacity-100"
                }`}
              />
              {/* Hover Arrow 2 (Slides In) */}
              <ArrowUpRight
                className={`absolute w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
                  isHovered ? "translate-x-0 translate-y-0 opacity-100" : "-translate-x-4 translate-y-4 opacity-0"
                }`}
              />
            </>
          )}
        </div>
      )}
    </button>
  );
}
