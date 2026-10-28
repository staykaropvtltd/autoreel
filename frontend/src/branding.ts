
import { api, getAuthToken } from "./api.ts";
import { isAxiosError } from "axios";

const API_BASE = (
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || ""
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
  logo_url: "",
  primary_color: null,
  secondary_color: null,
  text_color: null,
};

let missingLogoToken: string | null = null;

export function invalidateMissingBrandLogoCache(): void {
  missingLogoToken = null;
}

export async function fetchBranding(): Promise<BrandingInfo> {
  const response = await api.get<BrandingInfo>("/branding");
  let logoUrl = "";
  const token = getAuthToken();
  if (!token || !response.data.logo_url || missingLogoToken === token) {
    return { ...response.data, logo_url: "" };
  }
  try {
    const logo = await api.get<Blob>("/branding/logo", { responseType: "blob" });
    logoUrl = URL.createObjectURL(logo.data);
    missingLogoToken = null;
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 404) throw error;
    // An absent user logo is an expected optional state.
    missingLogoToken = token;
  }

  return {
    ...response.data,
    logo_url: logoUrl,
  };
}
