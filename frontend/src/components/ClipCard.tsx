import { useEffect, useState } from "react";
import type { ClipData } from "../types";
import { useDialogFocus } from "../hooks/useDialogFocus";

interface ClipCardProps {
  clip: ClipData;
  file?: File;
  onToggle: () => void;
}

function scoreColor(score: number): string {
  if (score >= 80) {
    return "text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10";
  }

  if (score >= 60) {
    return "text-[var(--color-warning)] border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10";
  }

  return "text-[var(--color-error)] border-[var(--color-error)]/40 bg-[var(--color-error)]/10";
}

const STATUS_LABEL: Record<string, string> = {
  selected: "Selected",
  rejected_low_quality: "Low quality",
  rejected_duplicate: "Duplicate",
  rejected_not_selected: "Not selected",
};

export default function ClipCard({
  clip,
  file,
  onToggle,
}: ClipCardProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const closePreview = () => setIsPreviewOpen(false);
  const previewDialogRef = useDialogFocus<HTMLDivElement>(isPreviewOpen, closePreview);

  useEffect(() => {
    if (!file) {
      setVideoUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <>
      {/* =========================
          CLIP CARD
      ========================= */}
      <div
        className={
          "rounded-lg border p-4 space-y-3 transition-colors bg-[var(--color-surface)] " +
          (clip.selected
            ? "border-[var(--color-brand-primary)]/50 bg-[var(--color-brand-primary)]/5"
            : "border-[var(--color-border)]")
        }
      >
        {/* CLIP INFO */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {clip.source_file}
            </p>

            <p className="text-xs text-[var(--color-text-secondary)]">
              {clip.start_time.toFixed(1)}s –{" "}
              {clip.end_time.toFixed(1)}s ·{" "}
              {clip.duration.toFixed(1)}s
            </p>
          </div>

          {/* SCORE */}
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreColor(
              clip.score
            )}`}
          >
            {clip.score}
          </span>
        </div>

        {/* =========================
            VIDEO THUMBNAIL
        ========================= */}
        <div className="relative h-16 overflow-hidden rounded-md bg-[var(--color-background)]">
          {videoUrl ? (
            <>
              <video
                src={videoUrl}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = clip.start_time;
                }}
              />

              {/* PLAY BUTTON */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPreviewOpen(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-2xl hover:bg-black/30 transition-colors"
                aria-label="Preview clip"
              >
                ▶
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] text-2xl">
              ▶
            </div>
          )}
        </div>

        {/* REASONS */}
        <div className="flex flex-wrap gap-1.5">
          {clip.reasons.map((reason) => (
            <span
              key={reason}
              className="text-[11px] rounded-full bg-[var(--color-background)] text-[var(--color-text-secondary)] px-2 py-0.5"
            >
              {reason}
            </span>
          ))}
        </div>

        {/* STATUS + ACTION */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
  {clip.selected ? "Selected" : "Not selected"}
</span>

          <button
            type="button"
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

      {/* =========================
          VIDEO PREVIEW MODAL
      ========================= */}
      {isPreviewOpen && videoUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setIsPreviewOpen(false)}
        >
          {/* MODAL */}
          <div
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview clip ${clip.source_file}`}
            tabIndex={-1}
            className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {clip.source_file}
                </p>

                <p className="text-xs text-[var(--color-text-secondary)]">
                  {clip.start_time.toFixed(1)}s –{" "}
                  {clip.end_time.toFixed(1)}s
                </p>
              </div>

              {/* CLOSE */}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>

            {/* VIDEO */}
            <div className="flex items-center justify-center bg-black p-3">
              <video
                src={videoUrl}
                className="max-h-[70vh] w-full rounded-lg object-contain"
                controls
                autoPlay
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = clip.start_time;
                }}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget;

                  if (
                    clip.end_time > clip.start_time &&
                    video.currentTime >= clip.end_time
                  ) {
                    video.pause();
                    video.currentTime = clip.start_time;
                  }
                }}
              />
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
              <div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  Duration
                </span>

                <span className="ml-2 text-sm font-medium text-[var(--color-text-primary)]">
                  {clip.duration.toFixed(1)}s
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
