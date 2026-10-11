"use client";

import { useRef, useEffect } from "react";

interface LightBloomProps {
  className?: string;
  intensity?: number;
  speed?: number;
}

export default function LightBloom({
  className = "",
  intensity = 1.0,
  speed = 1.0,
}: LightBloomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // 10 Organic Silky Light Beams across the width
    const pillars = [
      { xRatio: 0.05, width: 90, height: 0.85, speed: 0.8, phase: 0 },
      { xRatio: 0.16, width: 110, height: 0.95, speed: 1.1, phase: 1.2 },
      { xRatio: 0.28, width: 85, height: 0.8, speed: 0.9, phase: 2.5 },
      { xRatio: 0.39, width: 120, height: 1.0, speed: 1.0, phase: 3.8 },
      { xRatio: 0.50, width: 95, height: 0.75, speed: 1.2, phase: 0.5 },
      { xRatio: 0.62, width: 115, height: 0.9, speed: 0.85, phase: 1.9 },
      { xRatio: 0.73, width: 80, height: 0.82, speed: 1.15, phase: 4.1 },
      { xRatio: 0.84, width: 130, height: 0.98, speed: 0.95, phase: 2.8 },
      { xRatio: 0.95, width: 100, height: 0.88, speed: 1.05, phase: 5.2 },
    ];

    const render = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);
      time += 0.014 * speed;

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      // 1. Deep Atmospheric Indigo-Violet Base
      const ambientGrad = ctx.createLinearGradient(0, h, 0, 0);
      ambientGrad.addColorStop(0, "rgba(79, 70, 229, 0.45)");
      ambientGrad.addColorStop(0.35, "rgba(59, 7, 100, 0.25)");
      ambientGrad.addColorStop(1, "rgba(6, 6, 8, 0)");
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Render Soft Silky Light Pillars
      pillars.forEach((p, idx) => {
        // Organic vertical undulation and lateral sway
        const sway = Math.sin(time * p.speed + p.phase) * 22;
        const currentX = p.xRatio * w + sway;
        const currentHeight = h * p.height * (0.88 + Math.cos(time * 0.7 + idx) * 0.12);
        const currentWidth = p.width * (0.9 + Math.sin(time * 0.8 + idx) * 0.15);

        // Pillar Gradient (White glow base -> electric violet -> deep indigo -> transparent)
        const pillarGrad = ctx.createLinearGradient(
          currentX,
          h,
          currentX,
          h - currentHeight
        );

        pillarGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * intensity})`);
        pillarGrad.addColorStop(0.1, `rgba(221, 214, 254, ${0.85 * intensity})`);
        pillarGrad.addColorStop(0.28, `rgba(139, 92, 246, ${0.65 * intensity})`);
        pillarGrad.addColorStop(0.6, `rgba(67, 56, 202, ${0.35 * intensity})`);
        pillarGrad.addColorStop(0.85, `rgba(30, 27, 75, ${0.15 * intensity})`);
        pillarGrad.addColorStop(1, "rgba(6, 6, 8, 0)");

        ctx.fillStyle = pillarGrad;

        // Draw soft vertical beam
        ctx.beginPath();
        const halfW = currentWidth / 2;
        ctx.moveTo(currentX - halfW, h);
        ctx.lineTo(currentX - halfW * 0.7, h - currentHeight);
        ctx.lineTo(currentX + halfW * 0.7, h - currentHeight);
        ctx.lineTo(currentX + halfW, h);
        ctx.closePath();
        ctx.fill();
      });

      // 3. Ultra-Bright Bottom Light Crest Wave (Matching Reference Glow)
      const crestGrad = ctx.createLinearGradient(0, h, 0, h - 45);
      crestGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * intensity})`);
      crestGrad.addColorStop(0.3, `rgba(216, 180, 254, ${0.75 * intensity})`);
      crestGrad.addColorStop(0.7, `rgba(124, 58, 237, ${0.35 * intensity})`);
      crestGrad.addColorStop(1, "rgba(79, 70, 229, 0)");
      ctx.fillStyle = crestGrad;
      ctx.fillRect(0, h - 45, w, 45);

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [intensity, speed]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden ${className}`}
    >
      {/* Canvas with Gaussian Blur Filter for Silky Aurora Glow */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block filter blur-[18px] sm:blur-[24px] scale-105"
      />
    </div>
  );
}
