import axios from "axios";
import type { AnalysisSummary, MusicTrack, ReelPlan, ReelResult, UploadResponse } from "./types";

const API_BASE = "http://localhost:8000/api";

export async function uploadVideos(files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  const response = await axios.post<UploadResponse>(`${API_BASE}/videos/upload`, form);
  return response.data;
}

export async function startAnalysis(
  params: {
    job_id?: string;
    use_demo?: boolean;
    template_id?: string;
  }
): Promise<{
  job_id: string;
  status: string;
}> {
  const response = await axios.post(`${API_BASE}/analysis/analyze`, params);
  return response.data;
}

export async function getAnalysis(jobId: string): Promise<AnalysisSummary> {
  const response = await axios.get<AnalysisSummary>(`${API_BASE}/analysis/${jobId}`);
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
  const response = await axios.post<ReelPlan>(`${API_BASE}/reels/plan`, payload);
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
  const response = await axios.post<ReelResult>(
    `${API_BASE}/reels/generate`,
    payload,
    { timeout: 120000 }
  );

  const data = response.data;

  return {
    ...data,
    download_url: data.download_url.startsWith("http")
      ? data.download_url
      : `${API_BASE.replace("/api", "")}${data.download_url}`,
  };
}

export async function getReelStatus(reelId: string): Promise<ReelResult> {
  const response = await axios.get<ReelResult>(`${API_BASE}/reels/${reelId}`);
  return response.data;
}

export async function getDemoStatus(): Promise<{ available: boolean }> {
  const response = await axios.get(`${API_BASE}/demo/status`);
  return response.data;
}

// Same endpoint serves both inline preview (<video src>) and the Download
// button (<a download>) - Content-Disposition isn't set, so the browser
// decides based on how the URL is used.
export function reelFileUrl(reelId: string): string {
  return `${API_BASE}/reels/${reelId}/download`;
}

export async function listMusic(): Promise<MusicTrack[]> {
  const response = await axios.get<MusicTrack[]>(`${API_BASE}/music`);
  return response.data;
}

export function musicPreviewUrl(trackId: string): string {
  return `${API_BASE}/music/${trackId}/preview`;
}
export async function uploadMusic(file: File): Promise<void> {
  const formData = new FormData();

  formData.append("file", file);

  await axios.post(
    `${API_BASE}/music/upload`,
    formData,
  );
}
