import type { PlannedReelClip, ShotRole } from "../types";

interface PlanScreenProps {
  targetDuration: number;
  introSeconds: number;
  outroSeconds: number;
  clips: PlannedReelClip[];
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onGenerate: () => void;
  onBack: () => void;
  error: string | null;
}

const ROLE_LABEL: Record<ShotRole, string> = {
  HERO: "Hero",
  FULL_VIEW: "Full View",
  MOVEMENT: "Movement",
  DETAIL: "Detail",
  SIDE_VIEW: "Side View",
  PRODUCT_SHOWCASE: "Product Showcase",
  ENDING: "Ending",
  UNKNOWN: "Unclassified",
};

export default function PlanScreen({
  targetDuration,
  introSeconds,
  outroSeconds,
  clips,
  onRemove,
  onMoveUp,
  onMoveDown,
  onGenerate,
  onBack,
  error,
}: PlanScreenProps) {
  const contentDuration = clips.reduce((sum, c) => sum + c.planned_duration, 0);
  const estimatedTotal = introSeconds + contentDuration + outroSeconds;

  return (
    <div className="max-w-2xl w-full mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Your Reel Story</h2>
        <p className="text-[var(--color-text-secondary)] text-sm">
          {clips.length} clip{clips.length !== 1 ? "s" : ""} of product content, framed by your branded intro and outro
        </p>
      </div>

      {(introSeconds > 0 || outroSeconds > 0) && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">{targetDuration}s Reel</h3>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Intro</dt>
              <dd className="text-[var(--color-text-primary)]">{introSeconds.toFixed(1)}s</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Product Content</dt>
              <dd className="text-[var(--color-text-primary)]">{contentDuration.toFixed(1)}s</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Outro</dt>
              <dd className="text-[var(--color-text-primary)]">{outroSeconds.toFixed(1)}s</dd>
            </div>
            <div className="flex justify-between pt-1.5 mt-1.5 border-t border-[var(--color-border)] font-medium">
              <dt className="text-[var(--color-text-primary)]">Total</dt>
              <dd className="text-[var(--color-text-primary)]">{estimatedTotal.toFixed(1)}s</dd>
            </div>
          </dl>
        </div>
      )}

      <ol className="space-y-3">
        {clips.map((clip, i) => (
          <li
            key={`${clip.source_file}-${clip.original_start}-${i}`}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-background)] text-sm font-semibold text-[var(--color-text-primary)]">
              {String(i + 1).padStart(2, "0")}
            </span>

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[var(--color-background)] text-[var(--color-text-secondary)]">
              ▶
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{ROLE_LABEL[clip.shot_role]}</p>
              <p className="text-xs text-[var(--color-text-secondary)] truncate">
                {clip.source_file} · {clip.planned_duration.toFixed(1)}s · score {clip.score}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onMoveUp(i)}
                disabled={i === 0}
                className="h-7 w-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => onMoveDown(i)}
                disabled={i === clips.length - 1}
                className="h-7 w-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => onRemove(i)}
                className="h-7 w-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                aria-label="Remove clip"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ol>

      {clips.length === 0 && (
        <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
          No clips left in the plan. Go back and choose a target duration.
        </p>
      )}

      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium px-6 py-2.5 hover:border-[var(--color-brand-primary)] transition-colors"
        >
          Back
        </button>
        <button
          onClick={onGenerate}
          disabled={clips.length === 0}
          className="flex-1 rounded-md bg-[var(--color-brand-primary)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-secondary)] text-white font-medium py-2.5 hover:opacity-90 transition-opacity"
        >
          Generate Reel
        </button>
      </div>
    </div>
  );
}
