interface ProgressScreenProps {
  title: string;
  stages: { key: string; label: string }[];
  currentStage: string;
  error?: string | null;
}

export default function ProgressScreen({
  title,
  stages,
  currentStage,
  error,
}: ProgressScreenProps) {
  const currentIndex = stages.findIndex((s) => s.key === currentStage);

  return (
    <div className="max-w-md w-full mx-auto px-4 py-16">
      {!error && (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {currentIndex >= 0 ? `${title}: ${stages[currentIndex]?.label}` : `${title} in progress`}
        </p>
      )}
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] text-center mb-8">
        {title}
      </h2>

      <ul className="space-y-3">
        {stages.map((stage, i) => {
          const done =
            currentIndex > i || (error != null && i < currentIndex);

          const active = i === currentIndex && !error;

          return (
            <li
              key={stage.key}
              aria-current={active ? "step" : undefined}
              className={
                "flex items-center gap-3 rounded-md px-4 py-3 border bg-[var(--color-surface)] " +
                (active
                  ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5"
                  : done
                    ? "border-[var(--color-border)]"
                    : "border-[var(--color-border)]/50")
              }
            >
              <span
                className={
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs " +
                  (done
                    ? "bg-[var(--color-brand-primary)] text-white"
                    : active
                      ? "border-2 border-[var(--color-brand-primary)] animate-pulse"
                      : "border border-[var(--color-border)]")
                }
              >
                {done ? "✓" : ""}
              </span>

              <span
                className={
                  done || active
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-6 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
