import { useEffect, useState } from "react";
import {
  listMusic,
  musicPreviewUrl,
  uploadMusic,
  getCredits,
  getReelCost,
} from "../api";
import type {
  MusicTrack,
  PlannedReelClip,
  ShotRole,
} from "../types";

interface PlanScreenProps {
  targetDuration: number;
  estimatedFinalDuration: number;
  templateSeconds: number;
  introSeconds: number;
  outroSeconds: number;
  endCardSeconds: number;
  durationStatus: string;
  clips: PlannedReelClip[];
  files: File[];
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onGenerate: () => void;
  onBack: () => void;
  error: string | null;
  credits?: number | null;
  reelCost?: number | null;

  selectedMusic: MusicTrack | null;
  onMusicChange: (track: MusicTrack | null) => void;
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
  estimatedFinalDuration,
  templateSeconds,
  introSeconds,
  outroSeconds,
  endCardSeconds,
  durationStatus,
  clips,
  files,
  onRemove,
  onMoveUp,
  onMoveDown,
   onGenerate,
  onBack,
  error,
  credits: propsCredits,
  reelCost: propsReelCost,
  selectedMusic,
  onMusicChange,
}: PlanScreenProps) {
  const [localCredits, setLocalCredits] = useState<number | null>(null);
  const [localReelCost, setLocalReelCost] = useState<number | null>(null);

  const credits = propsCredits !== undefined ? propsCredits : localCredits;
  const reelCost = propsReelCost !== undefined ? propsReelCost : localReelCost;

  useEffect(() => {
    if (propsCredits !== undefined && propsReelCost !== undefined) return;
    let mounted = true;
    Promise.all([
      getCredits().catch(() => null),
      getReelCost().catch(() => null),
    ]).then(([credRes, costRes]) => {
      if (!mounted) return;
      if (credRes && typeof credRes.credits === "number") setLocalCredits(credRes.credits);
      if (costRes && typeof costRes.cost === "number") setLocalReelCost(costRes.cost);
    });
    return () => {
      mounted = false;
    };
  }, [propsCredits, propsReelCost]);

  const hasInsufficientCredits =
    credits !== null && reelCost !== null && credits < reelCost;
    const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicLoading, setMusicLoading] = useState(true);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [musicUploading, setMusicUploading] = useState(false);
    useEffect(() => {
    let cancelled = false;

    setMusicLoading(true);
    setMusicError(null);

    listMusic()
      .then((tracks) => {
        if (!cancelled) {
          setMusicTracks(tracks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMusicError("Could not load background music.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMusicLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);
  const handleMusicUpload = async (
  event: React.ChangeEvent<HTMLInputElement>,
) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  try {
    setMusicUploading(true);
    setMusicError(null);

    await uploadMusic(file);

    const updatedTracks = await listMusic();

    setMusicTracks(updatedTracks);
  } catch (error) {
    console.error("Music upload failed:", error);

    setMusicError(
      "Failed to upload music. Please try again.",
    );
  } finally {
    setMusicUploading(false);

    event.target.value = "";
  }
};
  const contentDuration = clips.reduce(
    (sum, clip) => sum + clip.planned_duration,
    0
  );

  return (
    <div className="max-w-2xl w-full mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Your Reel Story
        </h2>

        <p className="text-[var(--color-text-secondary)] text-sm">
          {clips.length} clip{clips.length !== 1 ? "s" : ""} of product
          content in the planned final reel
        </p>
      </div>

      {/* Duration Summary */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
          {targetDuration}s Reel
        </h3>

        <dl className="space-y-1.5 text-sm">
          {templateSeconds > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Template</dt>
              <dd className="text-[var(--color-text-primary)]">{templateSeconds.toFixed(1)}s</dd>
            </div>
          )}

          {introSeconds > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Intro</dt>
              <dd className="text-[var(--color-text-primary)]">{introSeconds.toFixed(1)}s</dd>
            </div>
          )}

          <div className="flex justify-between">
            <dt className="text-[var(--color-text-secondary)]">Product Content</dt>
            <dd className="text-[var(--color-text-primary)]">{contentDuration.toFixed(1)}s</dd>
          </div>

          {outroSeconds > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--color-text-secondary)]">Outro</dt>
              <dd className="text-[var(--color-text-primary)]">{outroSeconds.toFixed(1)}s</dd>
            </div>
          )}

          <div className="flex justify-between">
            <dt className="text-[var(--color-text-secondary)]">End card</dt>
            <dd className="text-[var(--color-text-primary)]">{endCardSeconds.toFixed(1)}s</dd>
          </div>

          <div className="flex justify-between pt-1.5 mt-1.5 border-t border-[var(--color-border)] font-medium">
            <dt className="text-[var(--color-text-primary)]">Estimated total</dt>
            <dd className="text-[var(--color-text-primary)]">{estimatedFinalDuration.toFixed(1)}s</dd>
          </div>
        </dl>
        {durationStatus === "insufficient_content" && (
          <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
            Available footage is shorter than the requested total duration.
          </p>
        )}
      </div>
            {/* Background Music */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Background Music
          </h3>
          <div className="music-upload-row">
  <label className="music-upload-button">
    {musicUploading ? "Uploading..." : "＋ Upload Your Music"}

    <input
      type="file"
      accept=".mp3,.wav,.m4a,.aac,audio/*"
      onChange={handleMusicUpload}
      disabled={musicUploading}
      hidden
    />
  </label>
</div>

          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Choose a soundtrack for your Reel.
          </p>
        </div>

        {/* No Music */}
        <button
          type="button"
          onClick={() => {
            onMusicChange(null);
            setPlayingTrackId(null);
          }}
          className={`w-full flex items-center gap-3 rounded-lg border p-3 mb-3 text-left transition-colors ${
            selectedMusic === null
              ? "border-[var(--color-brand-primary)] bg-[var(--color-background)]"
              : "border-[var(--color-border)] hover:border-[var(--color-brand-primary)]"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-background)] text-sm">
            🔇
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              No Background Music
            </p>

            <p className="text-xs text-[var(--color-text-secondary)]">
              Keep the original video audio
            </p>
          </div>

          <span
            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
              selectedMusic === null
                ? "border-[var(--color-brand-primary)]"
                : "border-[var(--color-border)]"
            }`}
          >
            {selectedMusic === null && (
              <span className="h-2 w-2 rounded-full bg-[var(--color-brand-primary)]" />
            )}
          </span>
        </button>

        {musicLoading && (
          <p className="text-xs text-[var(--color-text-secondary)] py-3">
            Loading music library...
          </p>
        )}

        {musicError && (
          <p className="text-xs text-[var(--color-error)] py-3">
            {musicError}
          </p>
        )}

        {!musicLoading && !musicError && musicTracks.length === 0 && (
          <p className="text-xs text-[var(--color-text-secondary)] py-3">
            No music tracks found.
          </p>
        )}

        <div className="space-y-2">
          {musicTracks.map((track) => {
            const isSelected = selectedMusic?.id === track.id;
            const isPlaying = playingTrackId === track.id;

            return (
              <MusicTrackRow
                key={track.id}
                track={track}
                selected={isSelected}
                playing={isPlaying}
                onSelect={() => {
                  onMusicChange(track);
                }}
                onTogglePlay={() => {
                  setPlayingTrackId(
                    isPlaying ? null : track.id
                  );
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Clip List */}
      <ol className="space-y-3">
        {clips.map((clip, i) => {
          const matchingFile = files.find(
            (file) => file.name === clip.source_file
          );

          return (
            <li
              key={`${clip.source_file}-${clip.original_start}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              {/* Clip Number */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-background)] text-sm font-semibold text-[var(--color-text-primary)]">
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Video Preview */}
              {matchingFile ? (
                <ClipPreview
                  file={matchingFile}
                  startTime={clip.original_start}
                  endTime={
                    clip.original_end ??
                    clip.original_start + clip.planned_duration
                  }
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[var(--color-background)] text-[var(--color-text-secondary)]">
                  ▶
                </div>
              )}

              {/* Clip Information */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {ROLE_LABEL[clip.shot_role]}
                </p>

                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {clip.source_file} ·{" "}
                  {clip.planned_duration.toFixed(1)}s ·{" "}
                  <span className="font-semibold text-[var(--color-accent)]">
                    Score {clip.score}/100
                  </span>
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onMoveUp(i)}
                  disabled={i === 0}
                  className="h-7 w-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Move up"
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() => onMoveDown(i)}
                  disabled={i === clips.length - 1}
                  className="h-7 w-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-background)] disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Move down"
                >
                  ↓
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="h-7 w-7 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]"
                  aria-label="Remove clip"
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Empty State */}
      {clips.length === 0 && (
        <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">
          No clips left in the plan. Go back and choose a target duration.
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Credit & Cost Information */}
      <div className="flex flex-wrap items-center justify-between p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
        <span className="text-[var(--color-text-secondary)]">
          Reel Cost: <strong className="text-[var(--color-text-primary)]">{reelCost !== null ? `${reelCost} credits` : "…"}</strong>
        </span>
        <span className="text-[var(--color-text-secondary)]">
          Available Balance: <strong className="text-[var(--color-text-primary)]">{credits !== null ? `${credits} credits` : "…"}</strong>
        </span>
      </div>

      {hasInsufficientCredits && (
        <p
          role="alert"
          className="text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-md px-3 py-2 text-center"
        >
          Insufficient credits. Generation requires {reelCost} credits (current balance: {credits}).
        </p>
      )}

      {/* Bottom Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium px-6 py-2.5 hover:border-[var(--color-brand-primary)] transition-colors"
        >
          Back
        </button>

        <button
          type="button"
          onClick={onGenerate}
          disabled={clips.length === 0 || hasInsufficientCredits}
          className="flex-1 rounded-md bg-[var(--color-brand-primary)] disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-secondary)] text-white font-medium py-2.5 hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
        >
          Generate Reel
        </button>
      </div>
    </div>
  );
}


/* =========================================================
   Clip Preview
   ========================================================= */

function ClipPreview({
  file,
  startTime,
  endTime,
}: {
  file: File;
  startTime: number;
  endTime: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);

    setVideoUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!videoUrl) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[var(--color-background)] text-[var(--color-text-secondary)]">
        ▶
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--color-background)]">
      <video
        src={videoUrl}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;

          video.currentTime = Math.max(0, startTime);
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;

          if (video.currentTime >= endTime) {
            video.pause();
            video.currentTime = Math.max(0, startTime);
            setPlaying(false);
          }
        }}
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
        }}
      />

      {/* Play / Pause Overlay */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();

          const video =
            event.currentTarget.previousElementSibling as
              | HTMLVideoElement
              | null;

          if (!video) return;

          if (video.paused) {
            video.currentTime = Math.max(0, startTime);

            void video.play();
          } else {
            video.pause();
          }
        }}
        className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"
        aria-label={playing ? "Pause clip" : "Play clip"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
    </div>
  );
}
function MusicTrackRow({
  track,
  selected,
  playing,
  onSelect,
  onTogglePlay,
}: {
  track: MusicTrack;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onTogglePlay: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        selected
          ? "border-[var(--color-brand-primary)] bg-[var(--color-background)]"
          : "border-[var(--color-border)] hover:border-[var(--color-brand-primary)]"
      }`}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-background)] text-sm text-[var(--color-text-primary)] hover:opacity-80"
        aria-label={
          playing
            ? `Pause ${track.display_name}`
            : `Preview ${track.display_name}`
        }
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {track.display_name}
        </p>

        <p className="text-xs text-[var(--color-text-secondary)]">
          {formatMusicDuration(track.duration)} · {track.format.toUpperCase()}
        </p>

        {playing && (
          <audio
            src={musicPreviewUrl(track.id)}
            autoPlay
            onEnded={onTogglePlay}
            className="hidden"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onSelect}
        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
          selected
            ? "bg-[var(--color-brand-primary)] text-white"
            : "border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)]"
        }`}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </div>
  );
}

function formatMusicDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
