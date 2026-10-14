export interface TemplateImageCandidate {
  type: string;
  size: number;
  name?: string;
  lastModified?: number;
}

export function isSameTemplateImage(
  current: TemplateImageCandidate | null,
  next: TemplateImageCandidate | null,
): boolean {
  return current === next || Boolean(
    current && next && current.name === next.name && current.type === next.type &&
    current.size === next.size && current.lastModified === next.lastModified,
  );
}

const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TEMPLATE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateTemplateImage(file: TemplateImageCandidate): string | null {
  if (!ALLOWED_TEMPLATE_TYPES.has(file.type)) {
    return "Choose a JPG, PNG, or WEBP template image.";
  }
  if (file.size <= 0) {
    return "The selected template image is empty.";
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return "Template images must be 20 MB or smaller.";
  }
  return null;
}

export function buildAnalysisStartPayload(
  uploadJobId: string | null,
  templateId: string | null,
): { job_id?: string; use_demo?: boolean; template_id?: string } {
  return {
    ...(uploadJobId ? { job_id: uploadJobId } : { use_demo: true }),
    ...(templateId ? { template_id: templateId } : {}),
  };
}
