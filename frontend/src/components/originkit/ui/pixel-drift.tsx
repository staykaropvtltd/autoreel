"use client";

import { useRef, useEffect } from "react";

interface PixelDriftProps {
  text?: string;
  fontSize?: number;
  gap?: number;
  pixelSize?: number;
  radius?: number;
  orangeRatio?: number;
  className?: string;
}

interface Pixel {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export default function PixelDrift({
  text = "Ethnic fashion moves at the speed of social commerce. Kaladhar Auto-Reel curates, reframes, and brands raw photoshoot footage into ready-to-publish vertical Reels in minutes.",
  fontSize = 38,
  gap = 2.0,
  pixelSize = 1.8,
  radius = 115,
  orangeRatio = 0.16,
  className = "",
}: PixelDriftProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let animationFrameId: number;
    let pixels: Pixel[] = [];
    const mouse = { x: -1000, y: -1000, active: false, radius };

    const orangeColors = ["#FC731C", "#FF8533", "#FF6B1A"];
    const whiteColors = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FAF7F2"];

    const initPixels = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      
      const width = rect.width || 960;
      
      // Responsive font size tuned for crisp, clear visibility
      const responsiveFontSize = Math.min(fontSize, Math.max(22, width * 0.038));
      const lineHeight = responsiveFontSize * 1.58;
      const maxLineWidth = Math.min(width - 32, 900);

      // Offscreen canvas for crisp rasterization
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = 800;
      const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.font = `800 ${responsiveFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, sans-serif`;
      offCtx.letterSpacing = "0.025em";

      // Multi-line word wrap algorithm
      const words = text.split(" ");
      let line = "";
      const lines: string[] = [];

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = offCtx.measureText(testLine);
        if (metrics.width > maxLineWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + " ";
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      const totalTextHeight = lines.length * lineHeight;
      const height = Math.max(240, totalTextHeight + 60);

      // Set container & canvas sizing
      container.style.height = `${height}px`;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      // Render crisp white typography on offscreen canvas
      offscreen.height = height;
      offCtx.clearRect(0, 0, width, height);
      offCtx.fillStyle = "#FFFFFF";
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.font = `800 ${responsiveFontSize}px "Plus Jakarta Sans", "Inter", -apple-system, sans-serif`;
      offCtx.letterSpacing = "0.025em";

      const startY = (height - totalTextHeight) / 2 + responsiveFontSize * 0.5;

      lines.forEach((l, idx) => {
        offCtx.fillText(l, width / 2, startY + idx * lineHeight);
      });

      // Sample image data at ultra-dense sub-pixel grid
      const imgData = offCtx.getImageData(0, 0, width, height);
      const data = imgData.data;

      pixels = [];

      for (let y = 0; y < height; y += gap) {
        for (let x = 0; x < width; x += gap) {
          const index = (Math.floor(y) * width + Math.floor(x)) * 4;
          const alpha = data[index + 3];

          // If pixel contains text
          if (alpha > 30) {
            const isOrange = Math.random() < orangeRatio;
            const color = isOrange
              ? orangeColors[Math.floor(Math.random() * orangeColors.length)]
              : whiteColors[Math.floor(Math.random() * whiteColors.length)];

            pixels.push({
              x: x,
              y: y,
              originX: x,
              originY: y,
              vx: 0,
              vy: 0,
              size: pixelSize,
              color,
            });
          }
        }
      }
    };

    initPixels();
    window.addEventListener("resize", initPixels);

    // Mouse movement interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.active = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
        mouse.active = true;
      }
    };

    const handleTouchEnd = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.active = false;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd);

    // Physics Animation Loop
    const friction = 0.85;
    const spring = 0.09;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const mx = mouse.x;
      const my = mouse.y;
      const mRadius = mouse.radius;
      const mRadiusSq = mRadius * mRadius;

      for (let i = 0; i < pixels.length; i++) {
        const p = pixels[i];

        // Compute distance to mouse
        const dx = p.x - mx;
        const dy = p.y - my;
        const distSq = dx * dx + dy * dy;

        // Radial Wave & Magnetic Displacement Field on Hover
        if (distSq < mRadiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / mRadius);
          const angle = Math.atan2(dy, dx);

          // Disperse outward in a circular ripple wave
          const pushForce = force * 42;
          p.vx += Math.cos(angle) * pushForce * 0.18;
          p.vy += Math.sin(angle) * pushForce * 0.18;
        }

        // Spring return to origin
        const homeDx = p.originX - p.x;
        const homeDy = p.originY - p.y;

        p.vx += homeDx * spring;
        p.vy += homeDy * spring;

        p.vx *= friction;
        p.vy *= friction;

        p.x += p.vx;
        p.y += p.vy;

        // Draw crisp square pixel block
        ctx.fillStyle = p.color;
        ctx.fillRect(
          Math.round(p.x - p.size / 2),
          Math.round(p.y - p.size / 2),
          p.size,
          p.size
        );
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", initPixels);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [text, fontSize, gap, pixelSize, radius, orangeRatio]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full flex items-center justify-center select-none cursor-crosshair overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
}
