// Google Identity Services (GSI) Helper for React & Vite

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export interface GoogleUserPayload {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  email: string;
  picture?: string;
  email_verified?: boolean;
}

export function parseGoogleJwt(token: string): GoogleUserPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as GoogleUserPayload;
  } catch (err) {
    console.error("Failed to decode Google JWT credential:", err);
    return null;
  }
}

let gsiScriptLoaded = false;
let gsiLoadPromise: Promise<boolean> | null = null;

export function loadGoogleGsiScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (gsiScriptLoaded) return Promise.resolve(true);

  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gsiScriptLoaded = true;
      resolve(true);
    };
    script.onerror = () => {
      console.warn("Could not load Google GSI script.");
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

export function getGoogleClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID;
}
