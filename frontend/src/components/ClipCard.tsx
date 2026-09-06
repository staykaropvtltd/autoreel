import type { ClipData } from "../types";

interface ClipCardProps {
  clip: ClipData;
  onToggle: () => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10";
  if (score >= 60) return "text-[var(--color-warning)] border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10";
  return "text-[var(--color-error)] border-[var(--color-error)]/40 bg-[var(--color-error)]/10";
}

const STATUS_LABEL: Record<string, string> = {
  selected: "Selected",
  rejected_low_quality: "Low quality",
  rejected_duplicate: "Duplicate",
  rejected_not_selected: "Not selected",
};

export default function ClipCard({ clip, onToggle }: ClipCardProps) {
  return (
    <div
      className={
        "rounded-lg border p-4 space-y-3 transition-colors bg-[var(--color-surface)] " +
        (clip.selected ? "border-[var(--color-brand-primary)]/50 bg-[var(--color-brand-primary)]/5" : "border-[var(--color-border)]")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{clip.source_file}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {clip.start_time.toFixed(1)}s – {clip.end_time.toFixed(1)}s · {clip.duration.toFixed(1)}s
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreColor(clip.score)}`}>
          {clip.score}
        </span>
      </div>

      <div className="flex h-16 items-center justify-center rounded-md bg-[var(--color-background)] text-[var(--color-text-secondary)] text-2xl">
        ▶
      </div>

      <div className="flex flex-wrap gap-1.5">
        {clip.reasons.map((reason) => (
          <span key={reason} className="text-[11px] rounded-full bg-[var(--color-background)] text-[var(--color-text-secondary)] px-2 py-0.5">
            {reason}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-[var(--color-text-secondary)]">{STATUS_LABEL[clip.status] ?? clip.status}</span>
        <button
          onClick={onToggle}
          className={
            "text-xs font-medium rounded-md px-3 py-1.5 transition-colors " +
            (clip.selected
              ? "bg-[var(--color-background)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
              : "bg-[var(--color-brand-primary)] text-white hover:opacity-90")
          }
        >
          {clip.selected ? "Deselect" : "Select"}
        </button>
      </div>
    </div>
  );
}
