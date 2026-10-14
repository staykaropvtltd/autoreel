import type { AnalysisSummary, ClipData } from "./types";

export type CompletedAnalysisSummary = AnalysisSummary & { clips: ClipData[] };
export type AnalysisRequest = (jobId: string, signal: AbortSignal) => Promise<unknown>;
export type AnalysisSleep = (delayMs: number, signal: AbortSignal) => Promise<void>;

export const DEFAULT_ANALYSIS_TIMEOUT_MS = 16 * 60 * 1000;
const INITIAL_DELAY_MS = 1000;
export const MAX_ANALYSIS_POLL_DELAY_MS = 8000;
const VALID_STAGES = ["queued", "analyzing", "selecting_clips", "completed", "failed"];
const VALID_CLIP_STATUSES = ["selected", "rejected_low_quality", "rejected_duplicate", "rejected_not_selected"];

export function configuredAnalysisTimeout(): number {
  const value = Number(import.meta.env.VITE_ANALYSIS_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_ANALYSIS_TIMEOUT_MS;
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("isAxiosError" in error) || error.isAxiosError !== true) {
    return false;
  }
  const response = "response" in error ? error.response : undefined;
  if (!response || typeof response !== "object" || !("status" in response)) return true;
  const status = response.status;
  return status === 408 || status === 429 || (typeof status === "number" && status >= 500);
}

function defaultSleep(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Analysis polling was cancelled", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delay);
    const abort = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("Analysis polling was cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validClip(value: unknown): value is ClipData {
  if (!isRecord(value) || !isRecord(value.metrics)) return false;
  const metrics = value.metrics;
  const numericFields = ["start_time", "end_time", "duration", "score"];
  const metricFields = ["avg_sharpness", "avg_brightness", "dark_frame_ratio", "avg_motion", "sampled_frame_count"];
  return typeof value.clip_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.clip_id) &&
    typeof value.source_file === "string" &&
    numericFields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field])) &&
    metricFields.every((field) => typeof metrics[field] === "number" && Number.isFinite(metrics[field])) &&
    Array.isArray(value.reasons) && value.reasons.every((reason) => typeof reason === "string") &&
    typeof value.perceptual_hash === "string" && typeof value.status === "string" &&
    VALID_CLIP_STATUSES.includes(value.status) &&
    typeof value.selected === "boolean" && typeof value.locked === "boolean" &&
    (value.duplicate_of === undefined || value.duplicate_of === null || typeof value.duplicate_of === "string") &&
    (value.closest_neighbor_distance === undefined || value.closest_neighbor_distance === null ||
      (typeof value.closest_neighbor_distance === "number" && Number.isFinite(value.closest_neighbor_distance)));
}

export function validateAnalysisSummary(value: unknown, jobId: string): AnalysisSummary {
  if (!isRecord(value)) throw new Error("The server returned an invalid analysis response.");
  const summary = value as Partial<AnalysisSummary>;
  if (summary.job_id !== jobId) {
    throw new Error("The server returned an analysis response for an unexpected job.");
  }
  if (!["queued", "processing", "completed", "failed"].includes(String(summary.status))) {
    throw new Error("The server returned an unrecognized analysis status.");
  }
  if (summary.stage !== undefined && (typeof summary.stage !== "string" || !VALID_STAGES.includes(summary.stage))) {
    throw new Error("The server returned an unrecognized analysis stage.");
  }
  if (summary.status === "failed" && summary.error !== undefined && typeof summary.error !== "string") {
    throw new Error("The server returned an invalid analysis error.");
  }
  if (summary.status === "completed") {
    if (!Array.isArray(summary.clips) || !summary.clips.every(validClip)) {
      throw new Error("Analysis completed, but the server returned an invalid clips list.");
    }
    if (new Set(summary.clips.map((clip) => clip.clip_id)).size !== summary.clips.length) {
      throw new Error("Analysis completed, but the server returned duplicate clip IDs. Please analyze the footage again.");
    }
    // FastAPI's response_model_exclude_none=True omits nullable BatchClip fields
    // from nested clip objects. Normalize those optional fields for consumers.
    summary.clips = summary.clips.map((clip) => ({
      ...clip,
      duplicate_of: clip.duplicate_of ?? null,
      closest_neighbor_distance: clip.closest_neighbor_distance ?? null,
    }));
  }
  return summary as AnalysisSummary;
}

export interface PollAnalysisOptions {
  timeoutMs?: number;
  now?: () => number;
  sleep?: AnalysisSleep;
  onProgress?: (summary: AnalysisSummary) => void;
}

export async function pollAnalysisUntilTerminal(
  jobId: string,
  signal: AbortSignal,
  request: AnalysisRequest,
  options: PollAnalysisOptions = {},
): Promise<CompletedAnalysisSummary> {
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw new Error("The server did not return an analysis job ID. Please try again.");
  }

  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const deadline = now() + (options.timeoutMs ?? configuredAnalysisTimeout());
  let delay = INITIAL_DELAY_MS;

  while (!signal.aborted && now() < deadline) {
    await sleep(Math.min(delay, Math.max(0, deadline - now())), signal);
    if (now() >= deadline) break;

    const remaining = deadline - now();
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(remaining)]);
    try {
      const response = await request(jobId, requestSignal);
      if (signal.aborted) throw new DOMException("Analysis polling was cancelled", "AbortError");
      if (requestSignal.aborted || now() >= deadline) break;
      const summary = validateAnalysisSummary(response, jobId);
      options.onProgress?.(summary);
      if (summary.status === "completed") return summary as CompletedAnalysisSummary;
      if (summary.status === "failed") {
        throw new Error(summary.error || "Footage analysis failed. Please try again.");
      }
      delay = INITIAL_DELAY_MS;
    } catch (error) {
      if (signal.aborted) throw new DOMException("Analysis polling was cancelled", "AbortError");
      if (requestSignal.aborted || now() >= deadline) break;
      if (!isRetryable(error)) throw error;
      delay = Math.min(delay * 2, MAX_ANALYSIS_POLL_DELAY_MS);
    }
  }

  if (signal.aborted) throw new DOMException("Analysis polling was cancelled", "AbortError");
  throw new Error("Analysis is taking longer than expected and timed out. Please try again.");
}
