import { reelFileUrl } from "../api";
import type { ReelResult } from "../types";

interface ResultScreenProps {
  reel: ReelResult;
  onGenerateAnother: () => void;
}

export default function ResultScreen({
  reel,
  onGenerateAnother,
}: ResultScreenProps) {
  const fileUrl = reelFileUrl(reel.reel_id);

  return (
    <div className="max-w-md w-full mx-auto px-4 py-10 space-y-6">
      {/* HEADER */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Your Reel is Ready
        </h2>

        <p className="text-[var(--color-text-secondary)] text-sm">
          Publish-ready for Instagram, Facebook &amp; YouTube Shorts
        </p>
      </div>

      {/* VIDEO PREVIEW */}
      <div className="mx-auto w-full max-w-[280px] aspect-9/16 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
        <video
          src={fileUrl}
          controls
          className="h-full w-full object-contain"
        />
      </div>

      {/* REEL DETAILS */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {reel.duration.toFixed(1)}s
          </p>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Duration
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {reel.width} × {reel.height}
          </p>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Resolution
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {reel.video_codec.toUpperCase()}
          </p>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Video codec
          </p>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {reel.audio_codec?.toUpperCase() ?? "None"}
          </p>

          <p className="text-xs text-[var(--color-text-secondary)]">
            Audio codec
          </p>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={fileUrl}
          download={`reel_${reel.reel_id.slice(0, 8)}.mp4`}
          className="flex-1 text-center rounded-md bg-emerald-500 text-slate-950 font-medium py-2.5 hover:bg-emerald-400 transition-colors"
        >
          Download Reel
        </a>

        <button
          onClick={onGenerateAnother}
          className="flex-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium py-2.5 hover:border-[var(--color-brand-primary)] transition-colors"
        >
          Generate Another
        </button>
      </div>
    </div>
  );
}