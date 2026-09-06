// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

"use client";

import { useCallback, useState } from "react";

export type BillingCycle = "monthly" | "yearly";

type BillingToggleProps = {
  isYearly: boolean;
  onChange: () => void;
  className?: string;
};

import { useTheme } from "../../../../context/ThemeContext";

export const BillingToggle = ({
  isYearly,
  onChange,
  className,
}: BillingToggleProps) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isYearly}
      aria-label="Toggle yearly billing"
      onClick={onChange}
      className={`relative h-[28px] w-11.5 shrink-0 cursor-pointer rounded-full border shadow-sm transition-all focus-visible:outline-2 ${
        isLight
          ? isYearly
            ? "border-orange-400/50 bg-[#FC731C]"
            : "border-neutral-300 bg-neutral-200"
          : isYearly
          ? "border-white bg-white"
          : "border-white/20 bg-neutral-800"
      } ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-0 rounded-full transition-colors duration-200 ease ${
          isYearly
            ? isLight
              ? "bg-[#FC731C]"
              : "bg-white"
            : isLight
            ? "bg-neutral-200"
            : "bg-neutral-800"
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-1 left-1 z-10 size-4 rounded-full transition-transform duration-200 ease-out ${
          isYearly ? "translate-x-4.5" : "translate-x-0"
        }`}
      >
        <span
          className={`absolute inset-0 rounded-full transition-colors duration-200 ease ${
            isYearly
              ? isLight
                ? "bg-white shadow-[0px_2px_5px_rgba(0,0,0,0.25)]"
                : "bg-black shadow-[0px_2px_4px_rgba(0,0,0,0.5)]"
              : isLight
              ? "bg-neutral-700 shadow-sm"
              : "bg-white shadow-sm"
          }`}
        />
      </span>
    </button>
  );
};

type BillingCycleControlProps = {
  isYearly: boolean;
  onChange: () => void;
  monthlyLabel?: string;
  yearlyLabel?: string;
  className?: string;
};

export const BillingCycleControl = ({
  isYearly,
  onChange,
  monthlyLabel = "Billed Monthly",
  yearlyLabel = "Billed yearly",
  className,
}: BillingCycleControlProps) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div
      className={`flex items-center gap-3.5 text-xs sm:text-sm font-medium ${className ?? ""}`}
    >
      <span
        className={`transition-colors duration-200 ease ${
          !isYearly
            ? isLight
              ? "text-[#0A0A0C] font-bold"
              : "text-white font-bold"
            : isLight
            ? "text-neutral-500"
            : "text-neutral-400"
        }`}
      >
        {monthlyLabel}
      </span>

      <BillingToggle isYearly={isYearly} onChange={onChange} />

      <span
        className={`transition-colors duration-200 ease flex items-center gap-1.5 ${
          isYearly
            ? isLight
              ? "text-[#0A0A0C] font-bold"
              : "text-white font-bold"
            : isLight
            ? "text-neutral-500"
            : "text-neutral-400"
        }`}
      >
        <span>{yearlyLabel.replace(/\s*\(Save\s*20%\)/i, "")}</span>
        {yearlyLabel.toLowerCase().includes("save") && (
          <span
            className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full transition-colors ${
              isLight
                ? isYearly
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs"
                  : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                : isYearly
                ? "bg-white text-black"
                : "bg-white/10 text-neutral-400 border border-white/10"
            }`}
          >
            SAVE 20%
          </span>
        )}
      </span>
    </div>
  );
};

export const useBillingCycle = (initialCycle: BillingCycle = "monthly") => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialCycle);
  const isYearly = billingCycle === "yearly";

  const toggleBillingCycle = useCallback(() => {
    setBillingCycle((current) =>
      current === "monthly" ? "yearly" : "monthly",
    );
  }, []);

  const getPrice = useCallback(
    (monthlyPrice: number, yearlyPrice: number) =>
      isYearly ? yearlyPrice : monthlyPrice,
    [isYearly],
  );

  return {
    billingCycle,
    isYearly,
    setBillingCycle,
    toggleBillingCycle,
    getPrice,
  };
};
