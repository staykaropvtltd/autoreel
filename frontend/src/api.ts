
import axios, { isAxiosError } from "axios";
import type {
  AnalysisSummary,
  MusicTrack,
  ReelPlan,
  ReelResult,
  UploadResponse,
} from "./types.ts";
import { waitForReelResult } from "./reelPolling.ts";
import type { ReelJobStatus } from "./reelPolling.ts";
export type { ReelJobStatus } from "./reelPolling.ts";

const API_BASE = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || ""
).replace(/\/+$/, "");

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  brandName?: string | null;
  provider: "email" | "google";
  avatar?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  brand_name?: string;
}

export interface UserPreferences {
  user_id: string;
  theme: "dark" | "light";
  default_target_duration: number;
  default_aspect_ratio: "9:16" | "1:1" | "16:9" | "4:5";
  default_resolution: "1080x1920" | "1080x1080" | "1920x1080" | "1080x1350";
  default_frame_rate: 24 | 25 | 30 | 50 | 60;
  preferred_music_track_id: string | null;
  preferred_template_id: string | null;
  auto_save: boolean;
  notifications: boolean;
  compact_layout: boolean;
  created_at: string;
  updated_at: string;
}

export type UserPreferencesUpdate = Partial<Omit<UserPreferences, "user_id" | "created_at" | "updated_at">>;

export async function getUserPreferences(): Promise<UserPreferences> {
  return (await api.get<UserPreferences>("/preferences")).data;
}

export async function updateUserPreferences(changes: UserPreferencesUpdate): Promise<UserPreferences> {
  return (await api.put<UserPreferences>("/preferences", changes)).data;
}

export async function updateUserProfile(name: string, brand_name: string): Promise<void> {
  await api.put("/preferences/profile", { name, brand_name });
}

const AUTH_TOKEN_KEY = "autoreel_access_token";

export function saveAuthToken(token: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }
  return null;
}

export async function signupWithEmail(
  payload: SignupPayload
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/auth/signup",
    payload
  );

  saveAuthToken(response.data.access_token);
  return response.data;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(
    "/auth/login",
    { email, password }
  );

  saveAuthToken(response.data.access_token);
  return response.data;
}

export async function loginWithGoogleCredential(
  credential: string,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/google", { credential });
  saveAuthToken(response.data.access_token);
  return response.data;
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      console.warn(
        `[Auth] 401 Unauthorized from ${error.config?.url || "request"}. Bearer token may be missing or expired.`
      );
    }
    return Promise.reject(error);
  }
);


const SENSITIVE_ERROR_DETAIL =
  /(traceback|stack trace|authorization|bearer\s|password|secret|token|\bat\s+[^\s]+\s*\()/i;
const FILESYSTEM_PATH = /(?:^|\s)(?:[A-Za-z]:\\|\\\\|\/)[^\s]*/;

export function apiErrorMessage(
  error: unknown,
  fallback: string
): string {
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
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function uploadVideos(files: File[], signal?: AbortSignal): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));

  const response = await api.post<UploadResponse>("/videos/upload", form, { signal });
  return response.data;
}

export interface TemplateInfo {
  template_id: string;
  filename: string;
  content_type: string;
  size: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function listTemplates(signal?: AbortSignal): Promise<TemplateInfo[]> {
  const response = await api.get<TemplateInfo[]>("/templates", { signal });
  return response.data;
}

export async function getTemplatePreview(templateId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await api.get<Blob>(`/templates/${encodeURIComponent(templateId)}/preview`, {
    responseType: "blob",
    signal,
  });
  return response.data;
}

export async function uploadTemplateImage(
  file: File,
  signal?: AbortSignal,
): Promise<TemplateInfo & { status: "uploaded" }> {
  const form = new FormData();
  form.append("file", file);
  const response = await api.post<TemplateInfo & { status: "uploaded" }>(
    "/templates/upload",
    form,
    { signal },
  );
  return response.data;
}

export async function deleteTemplateImage(templateId: string): Promise<void> {
  await api.delete(`/templates/${encodeURIComponent(templateId)}`);
}

export interface EditorProjectRecord {
  id: string; title: string; category: string;
  slides: Array<{ id: string; asset_id: string; name: string; duration: number; motion: string; transition: string; fitMode: string }>;
  overlays: Record<string, unknown>; audio: Record<string, unknown>;
  settings: { aspect_ratio: string; width: number; height: number; fps: number; total_duration?: number };
  export_status: string; reel_id: string | null; export_error: string | null;
}
export async function listEditorProjects(): Promise<EditorProjectRecord[]> {
  return (await api.get<EditorProjectRecord[]>("/editor-projects")).data;
}
export async function getEditorProject(id: string): Promise<EditorProjectRecord> {
  return (await api.get<EditorProjectRecord>(`/editor-projects/${encodeURIComponent(id)}`)).data;
}
export async function saveEditorProject(id: string | null, payload: Omit<EditorProjectRecord, "id" | "export_status" | "reel_id" | "export_error">): Promise<EditorProjectRecord> {
  const response = id
    ? await api.put<EditorProjectRecord>(`/editor-projects/${encodeURIComponent(id)}`, payload)
    : await api.post<EditorProjectRecord>("/editor-projects", payload);
  return response.data;
}
export async function exportEditorProject(id: string): Promise<{status:string; reel_id:string; download_url:string}> {
  return (await api.post(`/editor-projects/${encodeURIComponent(id)}/export`, {}, { timeout: 0 })).data;
}
export async function deleteEditorProject(id: string): Promise<void> {
  await api.delete(`/editor-projects/${encodeURIComponent(id)}`);
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
  requestId?: string,
): Promise<ReelResult> {
  const effectiveRequestId = requestId || crypto.randomUUID();
  const accepted = await api.post<{ reel_id: string; status: "queued" }>(
    "/reels/generate",
    { ...payload, request_id: effectiveRequestId },
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
  const base = API_BASE.replace(/\/api\/?$/, "");
  return `${base}/api/reels/${reelId}/download`;
}

export async function downloadAuthenticatedVideo(
  videoUrl: string,
  filename: string,
): Promise<void> {
  try {
    const response = await api.get<Blob>(videoUrl, {
      responseType: "blob",
    });

    const objectUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename.toLowerCase().endsWith(".mp4")
      ? filename
      : `${filename}.mp4`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      console.error(
        "Authentication error (401 Unauthorized) while downloading reel. User may need to sign in again."
      );
    } else {
      console.error("Authenticated video download failed:", error);
    }
    throw error;
  }
}



const privateMusicPreviewUrls = new Map<string, string>();

export function musicPreviewUrl(trackId: string): string {
  return privateMusicPreviewUrls.get(trackId) || `${API_BASE}/music/${encodeURIComponent(trackId)}/preview`;
}

export async function uploadMusic(file: File): Promise<{id: string; filename: string; display_name: string; duration: number}> {
  const formData = new FormData();
  formData.append("file", file);

  const uploaded = (await api.post<{id: string; filename: string; display_name: string; duration: number; preview_url?: string}>("/music/upload", formData)).data;
  if (uploaded.preview_url) privateMusicPreviewUrls.set(uploaded.id, uploaded.preview_url);
  return uploaded;
}

export async function deleteMusic(trackId: string): Promise<void> {
  await api.delete(`/music/${encodeURIComponent(trackId)}`);
  privateMusicPreviewUrls.delete(trackId);
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

export async function listMusic(): Promise<MusicTrack[]> {
  const response = await api.get("/music");

  const data = response.data;

  const rememberPrivatePreviewUrls = (tracks: MusicTrack[]) => {
    for (const track of tracks) {
      if (track.is_custom && track.preview_url) privateMusicPreviewUrls.set(track.id, track.preview_url);
    }
    return tracks;
  };

  // Handle the supported API response formats.
  if (Array.isArray(data)) {
    return rememberPrivatePreviewUrls(data as MusicTrack[]);
  }

  if (data && typeof data === "object") {
    const wrapped = data as Record<string, unknown>;

    if (Array.isArray(wrapped.tracks)) {
      return rememberPrivatePreviewUrls(wrapped.tracks as MusicTrack[]);
    }

    if (Array.isArray(wrapped.data)) {
      return rememberPrivatePreviewUrls(wrapped.data as MusicTrack[]);
    }
  }

  console.error("Unexpected /music API response:", data);
  return [];
}
export interface ReelHistoryItem {
  reel_id: string;
  title: string;
  status: string;
  created_at: string;
  source?: "image_to_reel" | "reel_generation";
}

export interface ReelHistoryResponse {
  items: ReelHistoryItem[];
  total: number;
}

export async function getReelHistory(
  signal?: AbortSignal,
): Promise<ReelHistoryResponse> {
  const response = await api.get<ReelHistoryResponse>(
    "/reels/history",
    { signal },
  );

  return response.data;
}
