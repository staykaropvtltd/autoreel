export interface IdentifiedClip {
  clip_id: string;
}

export function selectedClipsById<T extends IdentifiedClip>(
  clips: readonly T[],
  selectedIds: readonly string[],
): T[] {
  const selected = new Set(selectedIds);
  return clips.filter((clip) => selected.has(clip.clip_id));
}

export function assertPlanMatchesSelection(
  selectedIds: readonly string[],
  plannedClips: readonly IdentifiedClip[],
): void {
  if (selectedIds.length === 0) {
    throw new Error("Select at least one clip before creating a reel plan.");
  }
  const selected = new Set(selectedIds);
  const planned = new Set(plannedClips.map((clip) => clip.clip_id));
  if (
    selected.size !== selectedIds.length ||
    planned.size !== plannedClips.length ||
    selected.size !== planned.size ||
    [...selected].some((id) => !planned.has(id))
  ) {
    throw new Error(
      "The reel plan did not include every selected clip. Choose fewer clips or increase the target duration and try again.",
    );
  }
}
