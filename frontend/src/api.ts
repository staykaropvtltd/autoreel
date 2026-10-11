
import axios from "axios";
import type {
  AnalysisSummary,
  MusicTrack,
  ReelPlan,
  ReelResult,
  UploadResponse,
} from "./types";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL 
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export async function uploadVideos(files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));

  const response = await api.post<UploadResponse>("/videos/upload", form);
  return response.data;
}

export async function startAnalysis(params: {
  job_id?: string;
  use_demo?: boolean;
  template_id?: string;
}): Promise<{ job_id: string; status: string }> {
  const response = await api.post("/analysis/analyze", params);
  return response.data;
}

export async function getAnalysis(jobId: string): Promise<AnalysisSummary> {
  const response = await api.get<AnalysisSummary>(`/analysis/${jobId}`);
  return response.data;
}

export interface PlanReelPayload {
  analysis_job_id: string;
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
  output_filename?: string;
}

export async function generateReel(
  payload: GenerateReelPayload
): Promise<ReelResult> {
  const response = await api.post<ReelResult>(
    "/reels/generate",
    payload,
    { timeout: 120000 }
  );

  const data = response.data;

  return {
    ...data,
    download_url: data.download_url.startsWith("http")
      ? data.download_url
      : `${API_BASE.replace(/\/api$/, "")}${data.download_url}`,
  };
}

export async function getCredits(): Promise<{ credits: number }> {
  const response = await api.get<{ credits: number }>("/credits");
  return response.data;
}

export async function getReelStatus(reelId: string): Promise<ReelResult> {
  const response = await api.get<ReelResult>(`/reels/${reelId}`);
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
