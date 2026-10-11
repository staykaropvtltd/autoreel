"use client";

import { useRef, useEffect, type ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";

interface ReflectBackgroundProps {
  children?: ReactNode;
  className?: string;
  dotSize?: number;
  gap?: number;
  radius?: number;
}

interface GridNode {
  originX: number;
  originY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  highlight: number;
}

export default function ReflectBackground({
  children,
  className = "",
  dotSize = 1.8,
  gap = 28,
  radius = 45,
}: ReflectBackgroundProps) {
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let grid: GridNode[][] = [];
    let cols = 0;
    let rows = 0;
    const mouse = { x: -1000, y: -1000, active: false };

    const initGrid = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const width = rect.width;
      const height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);

      cols = Math.ceil(width / gap) + 1;
      rows = Math.ceil(height / gap) + 1;
      grid = [];

      for (let r = 0; r < rows; r++) {
        const row: GridNode[] = [];
        for (let c = 0; c < cols; c++) {
          const ox = c * gap;
          const oy = r * gap;
          row.push({
            originX: ox,
            originY: oy,
            x: ox,
            y: oy,
            vx: 0,
            vy: 0,
            highlight: 0,
          });
        }
        grid.push(row);
      }
    };

    initGrid();
    window.addEventListener("resize", initGrid);

    // Mouse move interaction
    let moveTimeout: ReturnType<typeof setTimeout>;
    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-disable-reflect="true"]')) {
        mouse.active = false;
        return;
      }

      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;

      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        mouse.active = false;
      }, 100);
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
      mouse.active = false;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Micro Spring Physics (Small & Tight)
    const friction = 0.88;
    const spring = 0.1;
    const maxPush = 2.5; // Very small micro push (2.5px max)

    const render = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      const isLightMode = themeRef.current === "light";

      // Theme background
      ctx.fillStyle = isLightMode ? "#F8F7F4" : "#09090B";
      ctx.fillRect(0, 0, w, h);

      const mx = mouse.x;
      const my = mouse.y;
      const isMouseActive = mouse.active;
      const rSq = radius * radius;

      // 1. Update Physics for every grid node
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const node = grid[r][c];

          if (isMouseActive) {
            const dx = node.x - mx;
            const dy = node.y - my;
            const distSq = dx * dx + dy * dy;

            if (distSq < rSq && distSq > 0) {
              const dist = Math.sqrt(distSq);
              const force = 1 - dist / radius;
              const angle = Math.atan2(dy, dx);

              const push = force * maxPush;
              node.vx += Math.cos(angle) * push * 0.08;
              node.vy += Math.sin(angle) * push * 0.08;
              node.highlight = Math.min(0.3, node.highlight + force * 0.15);
            }
          }

          // Spring return to original grid coordinate
          const homeDx = node.originX - node.x;
          const homeDy = node.originY - node.y;

          node.vx += homeDx * spring;
          node.vy += homeDy * spring;

          node.vx *= friction;
          node.vy *= friction;

          node.x += node.vx;
          node.y += node.vy;

          // Decay highlight back to subtle base
          node.highlight *= 0.90;
        }
      }

      // 2. Draw Interconnecting Subtle Threads
      ctx.lineWidth = 0.55;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const node = grid[r][c];

          // Horizontal Thread (Right Neighbor)
          if (c + 1 < cols) {
            const rightNode = grid[r][c + 1];
            const avgHighlight = (node.highlight + rightNode.highlight) / 2;
            const threadAlpha = isLightMode
              ? 0.04 + avgHighlight * 0.08
              : 0.06 + avgHighlight * 0.08;

            ctx.strokeStyle = isLightMode
              ? `rgba(0, 0, 0, ${threadAlpha})`
              : `rgba(255, 255, 255, ${threadAlpha})`;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(rightNode.x, rightNode.y);
            ctx.stroke();
          }

          // Vertical Thread (Bottom Neighbor)
          if (r + 1 < rows) {
            const bottomNode = grid[r + 1][c];
            const avgHighlight = (node.highlight + bottomNode.highlight) / 2;
            const threadAlpha = isLightMode
              ? 0.04 + avgHighlight * 0.08
              : 0.06 + avgHighlight * 0.08;

            ctx.strokeStyle = isLightMode
              ? `rgba(0, 0, 0, ${threadAlpha})`
              : `rgba(255, 255, 255, ${threadAlpha})`;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(bottomNode.x, bottomNode.y);
            ctx.stroke();
          }
        }
      }

      // 3. Draw Intersecting Subtle Small Dots
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const node = grid[r][c];
          const dotAlpha = isLightMode
            ? 0.12 + node.highlight * 0.15
            : 0.16 + node.highlight * 0.15;

          // Core
          ctx.fillStyle = isLightMode ? "#F8F7F4" : "#09090B";
          ctx.beginPath();
          ctx.arc(node.x, node.y, dotSize, 0, Math.PI * 2);
          ctx.fill();

          // Subtle Ring Outline
          ctx.strokeStyle = isLightMode
            ? `rgba(0, 0, 0, ${dotAlpha})`
            : `rgba(255, 255, 255, ${dotAlpha})`;
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.arc(node.x, node.y, dotSize, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", initGrid);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      clearTimeout(moveTimeout);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dotSize, gap, radius]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className}`}
    >
      {/* Background Interconnected Thread Grid Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* Foreground Content */}
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
