
import axios from "axios";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

export const LOGO_URL = `${API_BASE}/branding/logo`;

export interface BrandingInfo {
  name: string;
  tagline: string | null;
  logo_url: string;
  primary_color: string | null;
  secondary_color: string | null;
  text_color: string | null;
}

export const FALLBACK_BRANDING: BrandingInfo = {
  name: "Auto-Reel Studio",
  tagline: null,
  logo_url: LOGO_URL,
  primary_color: null,
  secondary_color: null,
  text_color: null,
};

export async function fetchBranding(): Promise<BrandingInfo> {
  const response = await axios.get<BrandingInfo>(
    `${API_BASE}/branding`
  );

  return {
    ...response.data,
    logo_url: LOGO_URL,
  };
}
