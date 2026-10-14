export interface SavedReelProject {
  id: string;
  title: string;
  category: string;
  durationSeconds: number;
  resolution: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  viewsCount?: string;
  status: "ready" | "rendering" | "draft";
  productPrice?: string;
}

export interface CompletedReelDetails {
  reel_id?: string | null;
  download_url?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}

export function createSavedReelProject(
  result: CompletedReelDetails,
  metadata: { title: string; category: string; productPrice?: string },
): SavedReelProject | null {
  if (!result.reel_id || !result.download_url) return null;

  const dimensions = result.width && result.height
    ? `${result.width}x${result.height}`
    : "Video";

  return {
    id: result.reel_id,
    title: metadata.title.trim() || "Untitled Reel",
    category: metadata.category,
    durationSeconds: Math.max(0, Math.round(result.duration ?? 0)),
    resolution: dimensions,
    videoUrl: result.download_url,
    thumbnailUrl: "",
    createdAt: "Just now",
    status: "ready",
    productPrice: metadata.productPrice ?? "",
  };
}

export function upsertSavedReel<T extends { id: string }>(
  projects: readonly T[],
  reel: T,
): T[] {
  return [reel, ...projects.filter((project) => project.id !== reel.id)];
}
