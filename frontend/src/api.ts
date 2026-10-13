
import axios, { isAxiosError } from "axios";
import type {
  AnalysisSummary,
  MusicTrack,
  ReelPlan,
  ReelResult,
  UploadResponse,
} from "./types";
import { waitForReelResult } from "./reelPolling";
import type { ReelJobStatus } from "./reelPolling";
export type { ReelJobStatus } from "./reelPolling";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL 
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

const SENSITIVE_ERROR_DETAIL =
  /(traceback|stack trace|authorization|bearer\s|password|secret|token|\bat\s+[^\s]+\s*\()/i;
const FILESYSTEM_PATH = /(?:^|\s)(?:[A-Za-z]:\\|\\\\|\/)[^\s]*/;

export function apiErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Unable to connect to the server. Check your connection and try again.";
    }

    const detail = error.response.data?.detail;
    if (
      typeof detail === "string" &&
      detail.length > 0 &&
      detail.length <= 240 &&
      !/[\r\n]/.test(detail) &&
      !SENSITIVE_ERROR_DETAIL.test(detail) &&
      !FILESYSTEM_PATH.test(detail)
    ) {
      return detail;
    }
  }

  return fallback;
}

export async function uploadVideos(files: File[], signal?: AbortSignal): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));

  const response = await api.post<UploadResponse>("/videos/upload", form, { signal });
  return response.data;
}

export async function uploadTemplateImage(
  file: File,
  signal?: AbortSignal,
): Promise<{ template_id: string; status: "uploaded"; filename: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<{ template_id: string; status: "uploaded"; filename: string; size: number }>(
    "/templates/upload",
    form,
    { signal },
  );
  return response.data;
}

export async function deleteTemplateImage(templateId: string): Promise<void> {
  await api.delete(`/templates/${encodeURIComponent(templateId)}`);
}

export async function startAnalysis(params: {
  job_id?: string;
  use_demo?: boolean;
  template_id?: string;
}, signal?: AbortSignal): Promise<{ job_id: string; status: string }> {
  const response = await api.post("/analysis/analyze", params, { signal });
  return response.data;
}

export async function getAnalysis(
  jobId: string,
  signal?: AbortSignal,
): Promise<AnalysisSummary> {
  const response = await api.get<AnalysisSummary>(`/analysis/${jobId}`, { signal });
  return response.data;
}

export interface PlanReelPayload {
  analysis_job_id: string;
  selected_clip_ids?: string[];
  target_duration: number;
  min_clip_duration?: number;
  max_clip_duration?: number;
  min_quality_score?: number;
}

export async function planReel(payload: PlanReelPayload): Promise<ReelPlan> {
  const response = await api.post<ReelPlan>("/reels/plan", payload);
  return response.data;
}

export interface GenerateReelPayload {
  reel_plan: ReelPlan;
  analysis_job_id: string;
  selected_clip_ids?: string[];
  output_filename?: string;
}

export async function generateReel(
  payload: GenerateReelPayload,
  onStage?: (stage: ReelJobStatus["stage"]) => void,
): Promise<ReelResult> {
  const requestId = crypto.randomUUID();
  const accepted = await api.post<{ reel_id: string; status: "queued" }>(
    "/reels/generate",
    { ...payload, request_id: requestId },
    { timeout: 30000 }
  );
  const data = await waitForReelResult(
    async () => (await api.get<ReelJobStatus>(`/reels/${accepted.data.reel_id}`)).data,
    onStage,
  );
  return {
    ...data,
    download_url: data.download_url.startsWith("http")
      ? data.download_url
      : `${API_BASE.replace(/\/api$/, "")}${data.download_url}`,
  };
}

export async function getCredits(signal?: AbortSignal): Promise<{ user_id: string; credits: number }> {
  const response = await api.get<{ user_id: string; credits: number }>("/credits", { signal });
  return response.data;
}

export async function getReelCost(signal?: AbortSignal): Promise<{ cost: number }> {
  const response = await api.get<{ cost: number }>("/credits/reel-cost", { signal });
  return response.data;
}

export async function getReelStatus(reelId: string): Promise<ReelJobStatus> {
  const response = await api.get<ReelJobStatus>(`/reels/${reelId}`);
  return response.data;
}

export async function getDemoStatus(): Promise<{ available: boolean }> {
  const response = await api.get("/demo/status");
  return response.data;
}

export function reelFileUrl(reelId: string): string {
  return `${API_BASE}/reels/${reelId}/download`;
}

export async function listMusic(): Promise<MusicTrack[]> {
  const response = await api.get<MusicTrack[]>("/music");
  return response.data;
}

export function musicPreviewUrl(trackId: string): string {
  return `${API_BASE}/music/${trackId}/preview`;
}

export async function uploadMusic(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  await api.post("/music/upload", formData);
}

export async function uploadBrandLogo(
  file: File,
  placement: "start" | "entire"
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("placement", placement);

  await api.post("/branding/logo", formData);
}
