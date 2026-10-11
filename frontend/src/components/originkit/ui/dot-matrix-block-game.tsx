"use client";

import { useRef, useEffect } from "react";

interface DotMatrixBlockGameProps {
  className?: string;
  dotColor?: string;
  dotSize?: number;
  gap?: number;
  speed?: number;
}

export default function DotMatrixBlockGame({
  className = "",
  dotColor = "#FAF7F2",
  dotSize = 9,
  gap = 13,
  speed = 1.0,
}: DotMatrixBlockGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let cols = 0;
    let rows = 0;
    let grid: (number | null)[][] = [];
    let fallingBlocks: { x: number; y: number; shape: [number, number][]; color: string }[] = [];
    let dropTimer = 0;
    let spawnTimer = 0;

    // Tetris Block Shapes [dx, dy]
    const SHAPES: [number, number][][] = [
      [[0, 0], [1, 0], [0, 1], [1, 1]], // 2x2 Square
      [[0, 0], [1, 0]],                  // 2x1 Horizontal
      [[0, 0], [0, 1]],                  // 1x2 Vertical
      [[0, 0], [1, 0], [2, 0]],          // 3x1 Line
      [[0, 0], [0, 1], [1, 1]],          // Corner
      [[0, 0]],                          // Single Dot
      [[0, 0], [1, 0], [1, 1], [2, 1]],  // Z-Shape
    ];

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width || window.innerWidth;
      const height = rect.height || 240;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      // Span full width past right edge
      cols = Math.ceil(width / gap) + 2;
      rows = Math.floor(height / gap);

      // Initialize empty grid matrix
      grid = Array.from({ length: rows }, () => Array(cols).fill(null));

      // Populate bottom 3 rows with near-complete baseline chains (e.g. 85% filled with small gaps)
      for (let r = rows - 3; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.15) {
            grid[r][c] = 1;
          }
        }
      }
    };

    resize();
    window.addEventListener("resize", resize);

    // Collision check helper
    const canMoveTo = (shape: [number, number][], targetX: number, targetY: number) => {
      for (const [dx, dy] of shape) {
        const nx = targetX + dx;
        const ny = targetY + dy;
        if (nx < 0 || nx >= cols || ny >= rows) return false;
        if (ny >= 0 && grid[ny][nx] !== null) return false;
      }
      return true;
    };

    // Eliminate completed row and shift all rows above down by 1
    const eliminateRow = (rowIndex: number) => {
      for (let r = rowIndex; r > 0; r--) {
        grid[r] = [...grid[r - 1]];
      }
      grid[0] = Array(cols).fill(null);
    };

    // Lock block into grid & check for 100% complete unbroken chains (zero blank beads)
    const lockBlock = (block: { x: number; y: number; shape: [number, number][] }) => {
      for (const [dx, dy] of block.shape) {
        const nx = block.x + dx;
        const ny = block.y + dy;
        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
          grid[ny][nx] = 1;
        }
      }

      // Check rows from bottom upwards:
      // Eliminate ONLY when row forms a 100% unbroken chain without any blank beads!
      for (let r = rows - 1; r >= 0; r--) {
        let isCompleteChain = true;
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] === null) {
            isCompleteChain = false;
            break;
          }
        }

        // If the row is 100% full (no blank beads), remove the layer and drop the stack!
        if (isCompleteChain) {
          eliminateRow(r);
          r++; // Recheck same row index after shift
        }
      }
    };

    const render = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || 240;

      ctx.clearRect(0, 0, w, h);

      // 1. Spawning New Falling Blocks Across Full Width
      spawnTimer += speed;
      if (spawnTimer > 14) {
        spawnTimer = 0;
        if (fallingBlocks.length < 16) {
          const randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
          const startX = Math.floor(Math.random() * (cols - 1));
          if (canMoveTo(randomShape, startX, 0)) {
            fallingBlocks.push({
              x: startX,
              y: -2,
              shape: randomShape,
              color: dotColor,
            });
          }
        }
      }

      // 2. Drop Physics (Falling Downward Step by Step)
      dropTimer += speed;
      if (dropTimer > 4.5) {
        dropTimer = 0;

        for (let i = fallingBlocks.length - 1; i >= 0; i--) {
          const block = fallingBlocks[i];
          if (canMoveTo(block.shape, block.x, block.y + 1)) {
            block.y += 1;
          } else {
            lockBlock(block);
            fallingBlocks.splice(i, 1);
          }
        }
      }

      // 3. Draw Landed Grid Matrix Dots (Circular Dots Across 100% Width)
      ctx.fillStyle = dotColor;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] !== null) {
            const px = c * gap + gap / 2;
            const py = r * gap + gap / 2;
            ctx.beginPath();
            ctx.arc(px, py, dotSize / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 4. Draw Active Falling Blocks
      for (const block of fallingBlocks) {
        for (const [dx, dy] of block.shape) {
          const gridX = block.x + dx;
          const gridY = block.y + dy;
          if (gridY >= 0) {
            const px = gridX * gap + gap / 2;
            const py = gridY * gap + gap / 2;
            ctx.beginPath();
            ctx.arc(px, py, dotSize / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dotColor, dotSize, gap, speed]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
