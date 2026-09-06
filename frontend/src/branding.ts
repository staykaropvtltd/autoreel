// Single source of truth for brand identity across the website. The actual
// name/tagline/colors are never hard-coded here (or anywhere else in the
// frontend) - they're fetched from the backend's GET /api/branding, which
// in turn reads assets/branding/brand.json. Changing that one config file
// changes the whole website, with no frontend code change.
import axios from "axios";

const API_BASE = "http://localhost:8000/api";

// The logo endpoint URL never changes regardless of which brand is
// configured - it always serves whatever assets/branding/brand.json points
// to - so this alone is safe to keep as a constant.
export const LOGO_URL = `${API_BASE}/branding/logo`;

// Shown only if /api/branding can't be reached at all (backend down, or
// misconfigured) - a safe, generic placeholder, never a real client name.
export const FALLBACK_BRANDING: BrandingInfo = {
  name: "Auto-Reel Studio",
  tagline: null,
  logo_url: LOGO_URL,
  primary_color: null,
  secondary_color: null,
  text_color: null,
};

export interface BrandingInfo {
  name: string;
  tagline: string | null;
  logo_url: string;
  primary_color: string | null;
  secondary_color: string | null;
  text_color: string | null;
}

export async function fetchBranding(): Promise<BrandingInfo> {
  const response = await axios.get<BrandingInfo>(`${API_BASE}/branding`);
  // The backend returns logo_url as a path relative to itself
  // ("/api/branding/logo"), correct for a same-origin deployment - but in
  // dev the frontend and API run on different origins/ports, so a relative
  // <img src> would resolve against the frontend's own origin instead.
  // LOGO_URL is already the correct absolute URL for this API, so use it
  // rather than trusting the relative path verbatim.
  return { ...response.data, logo_url: LOGO_URL };
}
