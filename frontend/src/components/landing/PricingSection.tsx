import SaaSPricingSection from "./SaaSPricingSection";

interface PricingSectionProps {
  onLaunchStudio: () => void;
}

export default function PricingSection({ onLaunchStudio }: PricingSectionProps) {
  return <SaaSPricingSection onLaunchStudio={onLaunchStudio} />;
}
