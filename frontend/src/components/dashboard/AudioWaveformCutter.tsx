/**
 * AudioWaveformCutter.tsx
 * Professional interactive audio waveform trimmer for Kaladhar Studio Pipeline 2.
 *
 * Features:
 *  - Visual waveform rendered on Canvas (decoded via Web Audio API or synthetic bars)
 *  - Auto-locked sliding selection window to target reel duration (15s / 30s / 45s)
 *  - Draggable handle with real-time JetBrains Mono timecode display
 *  - Hook preset jump buttons (Intro, Drop, Chorus)
 *  - Audition Cut: plays only the trimmed segment and auto-stops at end marker
 *  - Emits { startTime, endTime } to parent on every change
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types & Constants                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */

interface AudioCutState {
  startTime: number;
  endTime: number;
}

interface AudioWaveformCutterProps {
  /** Full URL or blob URL for the audio file to decode & display. */
  audioSrc: string;
  /** Known total duration of the track (used if Web Audio decode fails). */
  sourceDuration: number;
  /** Target reel duration in seconds — locks the selection window width. */
  targetDuration: 15 | 30 | 45;
  /** Fired whenever the user moves the selection window. */
  onChange: (cut: AudioCutState) => void;
  /** Initial start time for the selection window. */
  initialStartTime?: number;
}

const WAVEFORM_BARS = 120; // number of amplitude bars rendered
const TRACK_HEIGHT = 72;   // px — height of the waveform canvas

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1).padStart(4, "0");
  return `${String(mins).padStart(2, "0")}:${secs}`;
}

/** Decode audio buffer and down-sample to `numBars` amplitude values (0–1). */
async function decodeWaveform(
  audioSrc: string,
  numBars: number
): Promise<number[]> {
  const ctx = new (window.AudioContext ||
    (window as any).webkitAudioContext)();
  const response = await fetch(audioSrc);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  const rawData = audioBuffer.getChannelData(0); // mono L channel
  const blockSize = Math.floor(rawData.length / numBars);
  const peaks: number[] = [];

  for (let i = 0; i < numBars; i++) {
    let peak = 0;
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(rawData[i * blockSize + j]);
      if (abs > peak) peak = abs;
    }
    peaks.push(peak);
  }

  // Normalize to 0–1
  const max = Math.max(...peaks, 0.01);
  return peaks.map((p) => p / max);
}

/** Synthesize a plausible-looking waveform from track characteristics. */
function syntheticWaveform(numBars: number, seed: number): number[] {
  const bars: number[] = [];
  for (let i = 0; i < numBars; i++) {
    const base =
      0.3 +
      0.45 * Math.sin((i / numBars) * Math.PI * 3 + seed) +
      0.15 * Math.sin((i / numBars) * Math.PI * 11 + seed * 2) +
      0.1 * Math.sin((i / numBars) * Math.PI * 23 + seed * 0.7);
    bars.push(Math.max(0.08, Math.min(1, Math.abs(base))));
  }
  return bars;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function AudioWaveformCutter({
  audioSrc,
  sourceDuration,
  targetDuration,
  onChange,
  initialStartTime = 0,
}: AudioWaveformCutterProps) {
  /* ── State ── */
  const [waveform, setWaveform] = useState<number[]>([]);
  const [waveformReady, setWaveformReady] = useState(false);
  const [startTime, setStartTime] = useState(
    Math.min(initialStartTime, Math.max(0, sourceDuration - targetDuration))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [dragOffset, setDragOffset] = useState(0); // offset within window at drag start

  /* ── Refs ── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  /* Derived */
  const endTime = Math.min(startTime + targetDuration, sourceDuration);
  const clampedStart = Math.min(
    startTime,
    Math.max(0, sourceDuration - targetDuration)
  );

  /* ─────────────────────────────────────────────── */
  /*  Decode waveform when src changes               */
  /* ─────────────────────────────────────────────── */
  useEffect(() => {
    setWaveformReady(false);
    let cancelled = false;

    (async () => {
      try {
        const bars = await decodeWaveform(audioSrc, WAVEFORM_BARS);
        if (!cancelled) {
          setWaveform(bars);
          setWaveformReady(true);
        }
      } catch {
        // Fallback: synthetic waveform from the src string hash
        const seed = audioSrc
          .split("")
          .reduce((a, c) => a + c.charCodeAt(0), 0);
        if (!cancelled) {
          setWaveform(syntheticWaveform(WAVEFORM_BARS, seed));
          setWaveformReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioSrc]);

  /* ─────────────────────────────────────────────── */
  /*  Reset start time when audio src changes        */
  /* ─────────────────────────────────────────────── */
  useEffect(() => {
    const clamped = Math.min(
      initialStartTime,
      Math.max(0, sourceDuration - targetDuration)
    );
    setStartTime(clamped);
  }, [audioSrc, initialStartTime, sourceDuration, targetDuration]);

  /* ─────────────────────────────────────────────── */
  /*  Emit changes upward                            */
  /* ─────────────────────────────────────────────── */
  useEffect(() => {
    onChange({ startTime: clampedStart, endTime: clampedStart + targetDuration });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedStart, targetDuration]);

  /* ─────────────────────────────────────────────── */
  /*  Canvas rendering                               */
  /* ─────────────────────────────────────────────── */
  const drawWaveform = useCallback(
    (playheadFraction?: number) => {
      const canvas = canvasRef.current;
      if (!canvas || waveform.length === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = TRACK_HEIGHT;
      canvas.width = W * dpr;
      canvas.height = H * dpr;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const maxStartPos = Math.max(0, sourceDuration - targetDuration);
      const selStart = (clampedStart / sourceDuration) * W;
      const selEnd = ((clampedStart + targetDuration) / sourceDuration) * W;

      /* Background shimmer inside selection */
      const selGrad = ctx.createLinearGradient(selStart, 0, selEnd, 0);
      selGrad.addColorStop(0, "rgba(29,185,84,0.06)");
      selGrad.addColorStop(0.5, "rgba(29,185,84,0.12)");
      selGrad.addColorStop(1, "rgba(29,185,84,0.06)");
      ctx.fillStyle = selGrad;
      ctx.fillRect(selStart, 0, selEnd - selStart, H);

      /* Bars */
      const barW = W / WAVEFORM_BARS;
      const gap = Math.max(1, barW * 0.18);

      waveform.forEach((amp, i) => {
        const x = i * barW;
        const frac = x / W;
        const timeSec = frac * sourceDuration;
        const inSelection = timeSec >= clampedStart && timeSec < clampedStart + targetDuration;

        const barH = Math.max(4, amp * H * 0.88);
        const y = (H - barH) / 2;

        if (inSelection) {
          /* Spotify-green selection gradient bar */
          const grad = ctx.createLinearGradient(x, y, x, y + barH);
          grad.addColorStop(0, "rgba(29,185,84,0.95)");
          grad.addColorStop(0.5, "rgba(29,185,84,1)");
          grad.addColorStop(1, "rgba(29,185,84,0.7)");
          ctx.fillStyle = grad;
        } else {
          /* Muted off-selection bar */
          ctx.fillStyle = "rgba(255,255,255,0.12)";
        }

        ctx.beginPath();
        ctx.roundRect(x + gap / 2, y, Math.max(1, barW - gap), barH, 2);
        ctx.fill();
      });

      /* Playhead (audition cursor) */
      if (playheadFraction !== undefined) {
        const px = playheadFraction * W;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(px, 4);
        ctx.lineTo(px, H - 4);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* Selection bracket — left handle */
      ctx.fillStyle = "#1DB954";
      ctx.fillRect(selStart - 2, 0, 3, H);
      // Top cap
      ctx.beginPath();
      ctx.roundRect(selStart - 7, 0, 14, 12, 3);
      ctx.fill();

      /* Selection bracket — right handle */
      ctx.fillRect(selEnd - 1, 0, 3, H);
      ctx.beginPath();
      ctx.roundRect(selEnd - 7, 0, 14, 12, 3);
      ctx.fill();

      /* Drag-anywhere hint arrow on selection center */
      if (!isDragging && maxStartPos > 0) {
        const cx = (selStart + selEnd) / 2;
        ctx.fillStyle = "rgba(29,185,84,0.4)";
        ctx.font = "10px JetBrains Mono";
        ctx.textAlign = "center";
        ctx.fillText("⟷", cx, H - 6);
      }
    },
    [waveform, clampedStart, targetDuration, sourceDuration, isDragging]
  );

  /* Redraw on state changes */
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform, waveformReady]);

  /* ─────────────────────────────────────────────── */
  /*  Drag handling                                  */
  /* ─────────────────────────────────────────────── */
  const getTimeFraction = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const frac = getTimeFraction(e.clientX);
    const clickedTime = frac * sourceDuration;
    // Record offset within selection window so dragging feels natural
    setDragOffset(clickedTime - clampedStart);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const frac = getTimeFraction(e.clientX);
    const clickedTime = frac * sourceDuration;
    const newStart = clickedTime - dragOffset;
    const maxStart = Math.max(0, sourceDuration - targetDuration);
    setStartTime(Math.max(0, Math.min(maxStart, newStart)));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  /* ─────────────────────────────────────────────── */
  /*  Audition Cut (play only the trimmed segment)   */
  /* ─────────────────────────────────────────────── */
  const startAudition = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.src = audioSrc;
    audio.currentTime = clampedStart;
    audio.play();
    setIsAuditioning(true);

    const checkEnd = () => {
      if (!audioRef.current) return;
      const playhead = audioRef.current.currentTime;
      const playheadFrac =
        ((playhead - clampedStart) / targetDuration) *
          ((clampedStart + targetDuration) / sourceDuration - clampedStart / sourceDuration) +
        clampedStart / sourceDuration;

      drawWaveform(Math.min(1, Math.max(0, playhead / sourceDuration)));

      if (playhead >= clampedStart + targetDuration) {
        audioRef.current.pause();
        setIsAuditioning(false);
        drawWaveform();
        return;
      }
      animFrameRef.current = requestAnimationFrame(checkEnd);
    };

    animFrameRef.current = requestAnimationFrame(checkEnd);
  }, [audioSrc, clampedStart, targetDuration, sourceDuration, drawWaveform]);

  const stopAudition = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioRef.current?.pause();
    setIsAuditioning(false);
    drawWaveform();
  }, [drawWaveform]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audioRef.current?.pause();
    };
  }, []);

  /* Stop audition if src changes */
  useEffect(() => {
    stopAudition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc]);

  /* ─────────────────────────────────────────────── */
  /*  Preset jumps                                   */
  /* ─────────────────────────────────────────────── */
  const jumpTo = (sec: number) => {
    const maxStart = Math.max(0, sourceDuration - targetDuration);
    setStartTime(Math.max(0, Math.min(maxStart, sec)));
    stopAudition();
  };

  const presets = [
    { label: "Intro", sec: 0 },
    {
      label: "Drop",
      sec: Math.min(15, Math.max(0, sourceDuration - targetDuration)),
    },
    {
      label: "Chorus",
      sec: Math.min(30, Math.max(0, sourceDuration - targetDuration)),
    },
  ].filter((p) => p.sec < sourceDuration - 1);

  /* ─────────────────────────────────────────────── */
  /*  Render                                         */
  /* ─────────────────────────────────────────────── */
  return (
    <div className="awc-root">
      {/* Header row */}
      <div className="awc-header">
        <div className="awc-timecode-block">
          <span className="awc-label">CUT WINDOW</span>
          <span className="awc-timecode">
            {formatTimecode(clampedStart)} – {formatTimecode(clampedStart + targetDuration)}
            <span className="awc-duration-badge">{targetDuration}s</span>
          </span>
        </div>

        {/* Preset jumps */}
        <div className="awc-presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="awc-preset-btn"
              onClick={() => jumpTo(p.sec)}
            >
              <SkipBack className="w-3 h-3" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas track */}
      <div
        ref={trackRef}
        className={`awc-track ${isDragging ? "awc-dragging" : ""}`}
        role="slider"
        tabIndex={0}
        aria-label="Audio cut start time"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, sourceDuration - targetDuration)}
        aria-valuenow={clampedStart}
        aria-valuetext={`Cut from ${formatTimecode(clampedStart)} to ${formatTimecode(endTime)}`}
        style={{ height: TRACK_HEIGHT }}
        onKeyDown={(event) => {
          const maxStart = Math.max(0, sourceDuration - targetDuration);
          let nextStart: number | null = null;
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextStart = clampedStart - 0.5;
          if (event.key === "ArrowRight" || event.key === "ArrowUp") nextStart = clampedStart + 0.5;
          if (event.key === "PageDown") nextStart = clampedStart - 5;
          if (event.key === "PageUp") nextStart = clampedStart + 5;
          if (event.key === "Home") nextStart = 0;
          if (event.key === "End") nextStart = maxStart;
          if (nextStart !== null) {
            event.preventDefault();
            setStartTime(Math.max(0, Math.min(maxStart, nextStart)));
            stopAudition();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {!waveformReady ? (
          <div className="awc-loading-bars">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="awc-skeleton-bar"
                style={{ animationDelay: `${(i % 8) * 80}ms` }}
              />
            ))}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="awc-canvas"
            style={{ width: "100%", height: TRACK_HEIGHT }}
          />
        )}
      </div>

      {/* Bottom: timecode rail + audition button */}
      <div className="awc-footer">
        {/* Time ruler ticks */}
        <div className="awc-ruler">
          {Array.from({ length: 7 }).map((_, i) => {
            const t = (i / 6) * sourceDuration;
            return (
              <span key={i} className="awc-ruler-tick">
                {formatTimecode(t)}
              </span>
            );
          })}
        </div>

        {/* Audition button */}
        <button
          type="button"
          className={`awc-audition-btn ${isAuditioning ? "awc-auditioning" : ""}`}
          onClick={isAuditioning ? stopAudition : startAudition}
          disabled={!waveformReady}
        >
          {isAuditioning ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 ml-0.5" />
              Audition Cut
            </>
          )}
        </button>
      </div>
    </div>
  );
}
