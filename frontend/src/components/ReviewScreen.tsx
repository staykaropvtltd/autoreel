import type { AnalysisSummary, ClipData } from "../types";
import ClipCard from "./ClipCard";

const DURATION_PRESETS = [15, 30, 45, 60];

interface PlanPreview {
  estimated_duration: number;
  clip_count: number;
}

interface ReviewScreenProps {
  summary: AnalysisSummary;
  clips: ClipData[];
  files: File[];
  onToggleClip: (index: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  targetDuration: number;
  onTargetDurationChange: (duration: number) => void;
  planPreview: PlanPreview | null;
  planLoading: boolean;
  onContinue: () => void;
  error: string | null;
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center">
      <p className="text-lg font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>

      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
        {label}
      </p>
    </div>
  );
}

export default function ReviewScreen({
  summary,
  clips,
  files,
  onToggleClip,
  onSelectAll,
  onClearAll,
  targetDuration,
  onTargetDurationChange,
  planPreview,
  planLoading,
  onContinue,
  error,
}: ReviewScreenProps) {
  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-10 space-y-8">
      {/* HEADER */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Review Best Clips
        </h2>

        <p className="text-[var(--color-text-secondary)] text-sm">
          The system selects, trims, and orders clips automatically to match
          your target duration
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat
          label="Videos analyzed"
          value={summary.videos_analyzed ?? 0}
        />

        <Stat
          label="Scenes detected"
          value={summary.total_segments ?? 0}
        />

        <Stat
          label="Usable clips"
          value={summary.accepted_before_dedupe ?? 0}
        />

        <Stat
          label="Duplicates removed"
          value={summary.duplicates_removed ?? 0}
        />

        <Stat
          label="Processing time"
          value={`${(summary.processing_time_seconds ?? 0).toFixed(1)}s`}
        />
      </div>

      {/* REEL DURATION */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Reel Duration
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => onTargetDurationChange(preset)}
              className={
                "rounded-md px-4 py-2 text-sm font-medium transition-colors " +
                (targetDuration === preset
                  ? "bg-[var(--color-brand-primary)] text-white"
                  : "bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]")
              }
            >
              {preset}s
            </button>
          ))}

          <div className="flex items-center gap-2 ml-2">
            <label className="text-xs text-[var(--color-text-secondary)]">
              Custom:
            </label>

            <input
              type="number"
              min={5}
              max={180}
              value={targetDuration}
              onChange={(e) =>
                onTargetDurationChange(Number(e.target.value) || 0)
              }
              className="w-20 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
            />

            <span className="text-xs text-[var(--color-text-secondary)]">
              seconds
            </span>
          </div>
        </div>

        {/* DURATION SUMMARY */}
        <div className="flex flex-wrap gap-6 text-sm pt-1">
          <span className="text-[var(--color-text-secondary)]">
            Target duration:{" "}
            <span className="text-[var(--color-text-primary)] font-medium">
              {targetDuration} seconds
            </span>
          </span>

          <span className="text-[var(--color-text-secondary)]">
            Selected:{" "}
            <span className="text-[var(--color-text-primary)] font-medium">
              {planLoading ? "…" : planPreview?.clip_count ?? 0} clips
            </span>
          </span>

          <span className="text-[var(--color-text-secondary)]">
            Estimated:{" "}
            <span className="text-[var(--color-text-primary)] font-medium">
              {planLoading
                ? "…"
                : `${(planPreview?.estimated_duration ?? 0).toFixed(1)}s`}
            </span>
          </span>
        </div>
      </div>

      {/* CLIPS HEADER */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Clips
        </h3>

        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs font-medium rounded-md px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)]"
          >
            Select All
          </button>

          <button
            onClick={onClearAll}
            className="text-xs font-medium rounded-md px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)]"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* CLIPS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clips.map((clip, i) => (
          <ClipCard
  key={`${clip.source_file}-${clip.start_time}`}
  clip={clip}
  file={files.find((file) => {
    const sourceName =
      clip.source_file.split(/[\\/]/).pop() ?? "";

    return (
      file.name === clip.source_file ||
      file.name === sourceName
    );
  })}
  onToggle={() => onToggleClip(i)}
/>
        ))}
      </div>

      {/* ERROR */}
      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* CONTINUE */}
      <div className="sticky bottom-4 flex justify-center">
        <button
          onClick={onContinue}
          disabled={
            planLoading ||
            !planPreview ||
            planPreview.clip_count === 0
          }
          className="rounded-md bg-[var(--color-brand-primary)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-secondary)] text-white font-medium px-8 py-3 shadow-lg hover:opacity-90 transition-opacity"
        >
          Continue
        </button>
      </div>
    </div>
  );
}