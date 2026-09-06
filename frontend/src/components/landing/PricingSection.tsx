import InteractivePricingCards from "../originkit/ui/pricing-01/interactive-pricing-cards";

interface PricingSectionProps {
  onLaunchStudio: () => void;
}

export default function PricingSection({ onLaunchStudio }: PricingSectionProps) {
  return (
    <div id="pricing">
      <InteractivePricingCards onLaunchStudio={onLaunchStudio} />
    </div>
  );
}
