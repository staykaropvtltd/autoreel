export interface UploadedFileInfo {
  filename: string;
  size: number;
}

export interface UploadResponse {
  job_id: string;
  status: string;
  files: UploadedFileInfo[];
}

export interface QualityMetrics {
  avg_sharpness: number;
  avg_brightness: number;
  dark_frame_ratio: number;
  avg_motion: number;
  sampled_frame_count: number;
}

export interface ClipData {
  source_file: string;
  start_time: number;
  end_time: number;
  duration: number;
  score: number;
  metrics: QualityMetrics;
  reasons: string[];
  perceptual_hash: string;
  status: string;
  selected: boolean;
  locked: boolean;
  duplicate_of: string | null;
  closest_neighbor_distance: number | null;
}

export type AnalysisStatus = "queued" | "processing" | "completed" | "failed";

export interface AnalysisSummary {
  job_id: string;
  status: AnalysisStatus;
  stage: string;
  videos_analyzed?: number;
  total_segments?: number;
  accepted_before_dedupe?: number;
  duplicates_removed?: number;
  final_selected_count?: number;
  processing_time_seconds?: number;
  clips?: ClipData[];
  error?: string;
}

export interface ProductInfo {
  product_name: string;
  material: string;
  color: string;
  product_code: string;
  price: string;
  category: string;
}

export type ShotRole =
  | "HERO"
  | "FULL_VIEW"
  | "MOVEMENT"
  | "DETAIL"
  | "SIDE_VIEW"
  | "PRODUCT_SHOWCASE"
  | "ENDING"
  | "UNKNOWN";

export type TransitionType = "none" | "fade" | "zoom_in" | "zoom_out" | "slide_left" | "slide_right";

export interface TransitionConfig {
  type: TransitionType;
  duration: number;
}

export interface PlannedReelClip {
  position: number;
  source_file: string;
  original_start: number;
  original_end: number;
  planned_start: number;
  planned_end: number;
  planned_duration: number;
  score: number;
  shot_role: ShotRole;
  role_confidence: number;
  transition_in: TransitionConfig;
  thumbnail_url: string | null;
}

export interface BrandingConfig {
  brand_name: string;
  brand_color: string | null;
  logo_path: string | null;
  logo_position: string;
  logo_size: number;
  show_logo_at_start: boolean;
  show_logo_at_end: boolean;
  show_watermark: boolean;
  intro_duration: number;
}

export interface FontConfig {
  font_family: string | null;
  headline_size: number;
  body_size: number;
  price_size: number;
  font_weight: string;
  text_color: string;
  accent_color: string | null;
}

// brand_placement:    beginning | end | beginning_and_end | watermark | none
// product_placement:  beginning | end | none
// material_placement: selected_clip | detail_clip | beginning | end | none
// price_placement:    final_clip | end | beginning | none
export interface OverlayConfig {
  brand_placement: string;
  product_placement: string;
  material_placement: string;
  material_clip_position: number | null;
  price_placement: string;
  material_duration: number;
  price_duration: number;
}

export interface MusicSelection {
  track_id: string;
  track_name: string;
  source_path: string;
  source_duration: number;
  start_time: number;
  end_time: number | null;
  volume: number;
  loop_if_needed: boolean;
  preserve_original_audio: boolean;
}

export interface MusicTrack {
  id: string;
  filename: string;
  display_name: string;
  duration: number;
  format: string;
}

export interface ReelPlan {
  target_duration: number;
  estimated_duration: number;
  duration_difference: number;
  clips: PlannedReelClip[];
  processing_time_seconds: number;
  branding: BrandingConfig;
  product: ProductOverlayInfo;
  overlays: OverlayConfig;
  font: FontConfig;
  content_duration: number;
  transition_overlap_duration: number;
  estimated_final_duration: number;
  music: MusicSelection | null;
  duration_status: string;
  template_seconds: number;
  intro_seconds: number;
  outro_seconds: number;
  end_card_seconds: number;
}

export interface ProductOverlayInfo {
  product_name: string | null;
  material: string | null;
  color: string | null;
  product_code: string | null;
  price: string | null;
  category: string | null;
}

export interface ReelResult {
  reel_id: string;
  status: string;
  download_url: string;
  output_path: string;
  duration: number;
  width: number;
  height: number;
  video_codec: string;
  audio_codec: string | null;
  clip_count: number;
  processing_time_seconds: number;
  target_duration: number | null;
  duration_status: string;
}
