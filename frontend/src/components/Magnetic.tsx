import { useRef } from "react";

interface MagneticProps {
  children: React.ReactNode;
  strength?: number;
  distance?: number;
}

export default function Magnetic({
  children,
  strength = 0.35,
  distance = 120,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();

    const x =
      e.clientX - (rect.left + rect.width / 2);

    const y =
      e.clientY - (rect.top + rect.height / 2);

    const distanceFromCenter =
      Math.sqrt(x * x + y * y);

    if (distanceFromCenter < distance) {
      ref.current.style.transform = `
        translate(
          ${x * strength}px,
          ${y * strength}px
        )
      `;
    }
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;

    ref.current.style.transform =
      "translate(0px, 0px)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="magnetic-wrapper"
    >
      {children}
    </div>
  );
}