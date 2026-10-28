import { useEffect, useState } from "react";
import { downloadAuthenticatedVideo, listMusic, musicPreviewUrl, reelFileUrl } from "../api";
import AuthenticatedVideoPreview from "./AuthenticatedVideoPreview";
import type {
  MusicTrack,
  PlannedReelClip,
  ReelPlan,
  ReelResult,
  ShotRole,
  TransitionType,
} from "../types";
import CreditQuoteNotice from "./CreditQuoteNotice";

interface EditorScreenProps {
  reel: ReelResult;
  plan: ReelPlan;
  onPlanChange: (updater: (prev: ReelPlan) => ReelPlan) => void;
  onGenerateUpdated: () => void;
  generating: boolean;
  error: string | null;
  credits: number | null;
  reelCost: number | null;
  creditsLoading: boolean;
  creditsError: string | null;
  canGenerate: boolean;
  onRetryCredits: () => void;
}

const ROLE_LABEL: Record<ShotRole, string> = {
  HERO: "Hero",
  FULL_VIEW: "Full",
  MOVEMENT: "Move",
  DETAIL: "Detail",
  SIDE_VIEW: "Side",
  PRODUCT_SHOWCASE: "Showcase",
  ENDING: "Ending",
  UNKNOWN: "Clip",
};

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "zoom_out", label: "Zoom Out" },
  { value: "slide_left", label: "Slide Left" },
  { value: "slide_right", label: "Slide Right" },
];

const DURATION_OPTIONS = [0.5, 1.0, 1.5, 2.0];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-md bg-[var(--color-background)] border border-[var(--color-border)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]";

export default function EditorScreen({
  reel,
  plan,
  onPlanChange,
  onGenerateUpdated,
  generating,
  error,
  credits,
  reelCost,
  creditsLoading,
  creditsError,
  canGenerate,
  onRetryCredits,
}: EditorScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const clips = plan.clips;
  const selected = selectedIndex !== null ? clips[selectedIndex] : null;

  useEffect(() => {
    listMusic()
      .then(setMusicTracks)
      .catch(() => setMusicTracks([]));
  }, []);

  const updateClips = (next: PlannedReelClip[]) => {
    onPlanChange((prev) => {
      const renumbered = next.map((c, i) => ({
        ...c,
        position: i + 1,
      }));

      const contentDuration = renumbered.reduce(
        (sum, c) => sum + c.planned_duration,
        0
      );

      const overlap = renumbered.reduce(
        (sum, c, i) =>
          i > 0 &&
          (c.transition_in.type === "fade" ||
            c.transition_in.type === "slide_left" ||
            c.transition_in.type === "slide_right")
            ? sum + c.transition_in.duration
            : sum,
        0
      );

      return {
        ...prev,
        clips: renumbered,
        content_duration: contentDuration,
        transition_overlap_duration: overlap,
        estimated_final_duration: contentDuration - overlap,
      };
    });
  };

  const removeClip = (index: number) => {
    updateClips(clips.filter((_, i) => i !== index));
    setSelectedIndex(null);
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= clips.length) return;

    const next = [...clips];
    [next[index], next[target]] = [next[target], next[index]];

    updateClips(next);
    setSelectedIndex(target);
  };

  const setTransition = (
    index: number,
    type: TransitionType,
    duration: number
  ) => {
    const next = clips.map((c, i) =>
      i === index
        ? {
            ...c,
            transition_in: {
              type,
              duration,
            },
          }
        : c
    );

    updateClips(next);
  };

  const updateBranding = (
    patch: Partial<ReelPlan["branding"]>
  ) => {
    onPlanChange((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        ...patch,
      },
    }));
  };

  const updateProduct = (
    patch: Partial<ReelPlan["product"]>
  ) => {
    onPlanChange((prev) => ({
      ...prev,
      product: {
        ...prev.product,
        ...patch,
      },
    }));
  };

  const updateOverlays = (
    patch: Partial<ReelPlan["overlays"]>
  ) => {
    onPlanChange((prev) => ({
      ...prev,
      overlays: {
        ...prev.overlays,
        ...patch,
      },
    }));
  };

  const selectTrack = (track: MusicTrack) => {
    onPlanChange((prev) => {
      const start = 0;
      const segmentLength = Math.min(
        track.duration,
        prev.target_duration
      );
      const end = start + segmentLength;

      return {
        ...prev,
        music: {
          track_id: track.id,
          track_name: track.display_name,
          source_path: track.filename,
          source_duration: track.duration,
          start_time: start,
          end_time: end,
          volume: 0.7,
          loop_if_needed: true,
          preserve_original_audio: false,
        },
      };
    });
  };

  const updateMusic = (
    patch: Partial<NonNullable<ReelPlan["music"]>>
  ) => {
    onPlanChange((prev) =>
      prev.music
        ? {
            ...prev,
            music: {
              ...prev.music,
              ...patch,
            },
          }
        : prev
    );
  };

  const clearMusic = () =>
    onPlanChange((prev) => ({
      ...prev,
      music: null,
    }));

  return (
    <div className="max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
      {/* HEADER */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Reel Editor
        </h2>

        <p className="text-[var(--color-text-secondary)] text-sm">
          Target {plan.target_duration}s · Last render{" "}
          {reel.duration.toFixed(1)}s
          {plan.transition_overlap_duration > 0.05 && (
            <>
              {" "}
              · transitions add{" "}
              {plan.transition_overlap_duration.toFixed(1)}s of overlap,
              automatically compensated
            </>
          )}
        </p>

        {reel.duration_status === "insufficient_content" && (
          <p className="text-xs text-[var(--color-warning)]">
            Not enough high-quality footage to reach{" "}
            {plan.target_duration}s without padding with weak clips - the
            Reel came out shorter instead.
          </p>
        )}
      </div>

      {/* VIDEO PREVIEW */}
      <div className="mx-auto w-full max-w-[240px]">
        <div className="aspect-9/16 rounded-xl overflow-hidden border border-[var(--color-border)] bg-black">
          <AuthenticatedVideoPreview
            key={reel.reel_id}
            videoUrl={reelFileUrl(reel.reel_id)}
            title="Reel Preview"
            controls
            className="h-full w-full object-contain"
          />
        </div>

        <p className="text-center text-xs text-[var(--color-text-secondary)] mt-2">
          {reel.duration.toFixed(1)}s · {reel.width}×{reel.height} ·{" "}
          {reel.video_codec.toUpperCase()}/
          {reel.audio_codec?.toUpperCase() ?? "none"}
        </p>
      </div>

      {/* TIMELINE */}
      <div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
          Timeline
        </h3>

        <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
          {clips.map((clip, i) => (
            <div
              key={clip.clip_id}
              className="flex items-stretch gap-1 shrink-0"
            >
              {i > 0 && (
                <button
                  onClick={() => setSelectedIndex(i)}
                  className={
                    "self-center text-[10px] rounded-full px-2 py-1 whitespace-nowrap border " +
                    (clip.transition_in.type !== "none"
                      ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)]")
                  }
                >
                  {clip.transition_in.type !== "none"
                    ? TRANSITION_OPTIONS.find(
                        (t) =>
                          t.value === clip.transition_in.type
                      )?.label
                    : "+ Transition"}
                </button>
              )}

              <button
                onClick={() => setSelectedIndex(i)}
                className={
                  "w-24 shrink-0 rounded-lg border overflow-hidden text-left transition-colors " +
                  (selectedIndex === i
                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand-primary)]")
                }
              >
                <div className="h-14 w-full bg-[var(--color-background)] flex items-center justify-center overflow-hidden">
                  {clip.thumbnail_url ? (
                    <img
                      src={`${(import.meta.env.VITE_API_BASE_URL as string).replace(/\/api\/?$/, "")}${clip.thumbnail_url}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[var(--color-text-secondary)] text-lg">
                      ▶
                    </span>
                  )}
                </div>

                <div className="px-1.5 py-1">
                  <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">
                    {String(clip.position).padStart(2, "0")}{" "}
                    {ROLE_LABEL[clip.shot_role]}
                  </p>

                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {clip.planned_duration.toFixed(1)}s
                  </p>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SELECTED CLIP DETAILS */}
      {selected && selectedIndex !== null && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Clip {selected.position} ·{" "}
            {ROLE_LABEL[selected.shot_role]}
          </h3>

          <p className="text-xs text-[var(--color-text-secondary)]">
            {selected.source_file} ·{" "}
            {selected.planned_duration.toFixed(1)}s · score{" "}
            {selected.score}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => moveClip(selectedIndex, -1)}
              disabled={selectedIndex === 0}
              className="rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-3 py-1.5 disabled:opacity-30 hover:border-[var(--color-brand-primary)]"
            >
              ← Move Left
            </button>

            <button
              onClick={() => moveClip(selectedIndex, 1)}
              disabled={selectedIndex === clips.length - 1}
              className="rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-3 py-1.5 disabled:opacity-30 hover:border-[var(--color-brand-primary)]"
            >
              Move Right →
            </button>

            <button
              onClick={() => removeClip(selectedIndex)}
              className="rounded-md border border-[var(--color-error)]/40 text-[var(--color-error)] text-xs px-3 py-1.5 hover:border-[var(--color-error)]"
            >
              Remove
            </button>
          </div>

          {selectedIndex > 0 && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--color-border)]">
              <Field label="Transition In">
                <select
                  value={selected.transition_in.type}
                  onChange={(e) =>
                    setTransition(
                      selectedIndex,
                      e.target.value as TransitionType,
                      selected.transition_in.duration || 1.0
                    )
                  }
                  className={inputClass}
                >
                  {TRANSITION_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Duration">
                <select
                  value={
                    selected.transition_in.duration || 1.0
                  }
                  onChange={(e) =>
                    setTransition(
                      selectedIndex,
                      selected.transition_in.type,
                      Number(e.target.value)
                    )
                  }
                  disabled={
                    selected.transition_in.type === "none"
                  }
                  className={
                    inputClass + " disabled:opacity-40"
                  }
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d.toFixed(1)}s
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>
      )}

      {/* BRANDING */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Branding
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Brand Name">
            <input
              value={plan.branding.brand_name}
              onChange={(e) =>
                updateBranding({
                  brand_name: e.target.value,
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Logo Path (optional)">
            <input
              value={plan.branding.logo_path ?? ""}
              onChange={(e) =>
                updateBranding({
                  logo_path: e.target.value || null,
                })
              }
              placeholder="assets/branding/logo.jpeg"
              className={inputClass}
            />
          </Field>

          <Field label="Brand Color (accent, optional)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={
                  plan.branding.brand_color ?? "#c9a227"
                }
                onChange={(e) =>
                  updateBranding({
                    brand_color: e.target.value,
                  })
                }
                className="h-9 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-background)]"
              />

              {plan.branding.brand_color && (
                <button
                  onClick={() =>
                    updateBranding({
                      brand_color: null,
                    })
                  }
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-error)] underline"
                >
                  Clear
                </button>
              )}
            </div>
          </Field>

          <Field label="Brand Placement">
            <select
              value={plan.overlays.brand_placement}
              onChange={(e) =>
                updateOverlays({
                  brand_placement: e.target.value,
                })
              }
              className={inputClass}
            >
              <option value="none">None</option>
              <option value="beginning">Beginning</option>
              <option value="end">End</option>
              <option value="beginning_and_end">
                Beginning &amp; End
              </option>
              <option value="watermark">Watermark</option>
            </select>
          </Field>

          <Field label="Intro Duration">
            <select
              value={plan.branding.intro_duration}
              onChange={(e) =>
                updateBranding({
                  intro_duration: Number(e.target.value),
                })
              }
              className={inputClass}
            >
              {[1, 1.5, 2, 2.5, 3].map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-primary)]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.branding.show_logo_at_start}
              onChange={(e) =>
                updateBranding({
                  show_logo_at_start: e.target.checked,
                })
              }
            />
            Show logo at start
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.branding.show_logo_at_end}
              onChange={(e) =>
                updateBranding({
                  show_logo_at_end: e.target.checked,
                })
              }
            />
            Show logo at end
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plan.branding.show_watermark}
              onChange={(e) =>
                updateBranding({
                  show_watermark: e.target.checked,
                })
              }
            />
            Watermark
          </label>
        </div>
      </div>

      {/* PRODUCT */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Product
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Product Name">
            <input
              value={plan.product.product_name ?? ""}
              onChange={(e) =>
                updateProduct({
                  product_name: e.target.value || null,
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Category">
            <input
              value={plan.product.category ?? ""}
              onChange={(e) =>
                updateProduct({
                  category: e.target.value || null,
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Material">
            <div className="flex gap-2">
              <input
                value={plan.product.material ?? ""}
                onChange={(e) =>
                  updateProduct({
                    material: e.target.value || null,
                  })
                }
                className={inputClass}
              />

              <select
                value={plan.overlays.material_placement}
                onChange={(e) =>
                  updateOverlays({
                    material_placement: e.target.value,
                  })
                }
                className={
                  inputClass + " w-32 shrink-0"
                }
              >
                <option value="none">None</option>
                <option value="beginning">Beginning</option>
                <option value="end">End</option>
                <option value="detail_clip">
                  Detail clip
                </option>
              </select>
            </div>
          </Field>

          <Field label="Color">
            <input
              value={plan.product.color ?? ""}
              onChange={(e) =>
                updateProduct({
                  color: e.target.value || null,
                })
              }
              className={inputClass}
            />
          </Field>

          <Field label="Price">
            <div className="flex gap-2">
              <input
                value={plan.product.price ?? ""}
                onChange={(e) =>
                  updateProduct({
                    price: e.target.value || null,
                  })
                }
                className={inputClass}
              />

              <select
                value={plan.overlays.price_placement}
                onChange={(e) =>
                  updateOverlays({
                    price_placement: e.target.value,
                  })
                }
                className={
                  inputClass + " w-32 shrink-0"
                }
              >
                <option value="none">None</option>
                <option value="beginning">Beginning</option>
                <option value="end">End</option>
                <option value="final_clip">
                  Final clip
                </option>
              </select>
            </div>
          </Field>

          <Field label="Product Code">
            <input
              value={plan.product.product_code ?? ""}
              onChange={(e) =>
                updateProduct({
                  product_code: e.target.value || null,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* MUSIC */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Music
        </h3>

        {!plan.music && (
          <div className="space-y-2">
            {musicTracks.length === 0 && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                No music tracks available.
              </p>
            )}

            {musicTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div>
                  <p className="text-sm text-[var(--color-text-primary)]">
                    {track.display_name}
                  </p>

                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {Math.floor(track.duration / 60)}:
                    {String(
                      Math.round(track.duration % 60)
                    ).padStart(2, "0")}
                  </p>
                </div>

                <button
                  onClick={() => selectTrack(track)}
                  className="rounded-md bg-[var(--color-brand-primary)] text-white text-xs font-medium px-3 py-1.5 hover:opacity-90"
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        )}

        {plan.music && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {plan.music.track_name}
                </p>

                <p className="text-xs text-[var(--color-text-secondary)]">
                  Reel duration: {plan.target_duration}s · Song
                  segment: {plan.music.start_time.toFixed(0)}s
                  →{" "}
                  {(
                    plan.music.end_time ??
                    plan.music.source_duration
                  ).toFixed(0)}
                  s
                </p>
              </div>

              <button
                onClick={clearMusic}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-error)] underline"
              >
                Remove
              </button>
            </div>

            <audio
              controls
              src={musicPreviewUrl(plan.music.track_id)}
              className="w-full h-9"
            />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Segment Start">
                <input
                  type="number"
                  min={0}
                  max={plan.music.source_duration}
                  step={1}
                  value={plan.music.start_time}
                  onChange={(e) => {
                    const start =
                      Number(e.target.value) || 0;

                    updateMusic({
                      start_time: start,
                      end_time:
                        start + plan.target_duration,
                    });
                  }}
                  className={inputClass}
                />
              </Field>

              <Field label="Segment End">
                <input
                  type="number"
                  min={0}
                  max={plan.music.source_duration}
                  step={1}
                  value={
                    plan.music.end_time ??
                    plan.music.source_duration
                  }
                  onChange={(e) =>
                    updateMusic({
                      end_time:
                        Number(e.target.value) ||
                        plan.music!.source_duration,
                    })
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label={`Volume: ${Math.round(
                plan.music.volume * 100
              )}%`}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={plan.music.volume}
                onChange={(e) =>
                  updateMusic({
                    volume: Number(e.target.value),
                  })
                }
                className="w-full"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={
                  plan.music.preserve_original_audio
                }
                onChange={(e) =>
                  updateMusic({
                    preserve_original_audio:
                      e.target.checked,
                  })
                }
              />
              Mix in original clip audio (quiet, beneath the
              music)
            </label>
          </div>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <CreditQuoteNotice
        credits={credits}
        cost={reelCost}
        loading={creditsLoading}
        error={creditsError}
        canGenerate={canGenerate}
        onRetry={onRetryCredits}
      />

      {/* ACTIONS */}
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() =>
            void downloadAuthenticatedVideo(
              reelFileUrl(reel.reel_id),
              `reel_${reel.reel_id.slice(0, 8)}.mp4`
            )
          }
          className="rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium px-6 py-3 hover:border-[var(--color-brand-primary)] transition-colors cursor-pointer"
        >
          Download
        </button>

        <button
          onClick={onGenerateUpdated}
          disabled={generating || clips.length === 0 || !canGenerate}
          className="rounded-md bg-[var(--color-brand-primary)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-secondary)] text-white font-medium px-8 py-3 shadow-lg hover:opacity-90 transition-colors"
        >
          {generating
            ? "Generating…"
            : "Generate Updated Reel"}
        </button>
      </div>
    </div>
  );
}
