import assert from "node:assert/strict";
import { test } from "node:test";
import { AxiosError } from "axios";
import { api, clearAuthToken, getAuthToken, getTemplatePreview, listTemplates, loginWithGoogleCredential, saveAuthToken } from "../src/api.ts";
import { fetchBranding } from "../src/branding.ts";

test("email token storage is used by the shared Axios request interceptor", async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });

  try {
    saveAuthToken("test-backend-jwt");
    assert.equal(getAuthToken(), "test-backend-jwt");
    let authorization = "";
    await api.get("/test-auth", {
      adapter: async (config) => {
        authorization = String(config.headers.get("Authorization") ?? "");
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      },
    });
    assert.equal(authorization, "Bearer test-backend-jwt");
  } finally {
    clearAuthToken();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("Google credential is exchanged for a backend token before login completes", async () => {
  const originalPost = api.post;
  const storage = new Map<string, string>();
  let postedUrl = "";
  let postedBody: unknown;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  api.post = (async (url: string, data: unknown) => {
    postedUrl = url;
    postedBody = data;
    return {
      data: {
        access_token: "backend-signed-google-token",
        token_type: "bearer",
        user: { id: "42", name: "Verified", email: "verified@example.test", provider: "google" },
      },
    };
  }) as typeof api.post;

  try {
    await loginWithGoogleCredential("signed-google-id-token-from-gsi");
    assert.equal(postedUrl, "/auth/google");
    assert.deepEqual(postedBody, { credential: "signed-google-id-token-from-gsi" });
    assert.equal(getAuthToken(), "backend-signed-google-token");
  } finally {
    api.post = originalPost;
    clearAuthToken();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("template library and private previews use authenticated template API routes", async () => {
  const originalGet = api.get;
  const paths: string[] = [];
  api.get = (async (url: string) => {
    paths.push(url);
    return { data: url.endsWith("/preview") ? new Blob(["private image"]) : [] } as Awaited<ReturnType<typeof originalGet>>;
  }) as typeof api.get;
  try {
    assert.deepEqual(await listTemplates(), []);
    const preview = await getTemplatePreview("id/encoded");
    assert.equal(preview.size, "private image".length);
    assert.deepEqual(paths, ["/templates", "/templates/id%2Fencoded/preview"]);
  } finally {
    api.get = originalGet;
  }
});

test("branding tolerates an absent optional logo and avoids proxy call without a backend token", async () => {
  const originalGet = api.get;
  const calls: string[] = [];
  api.get = (async (url: string) => {
    calls.push(url);
    return {
      data: { name: "Studio", tagline: null, logo_url: "/api/branding/logo" },
    } as Awaited<ReturnType<typeof originalGet>>;
  }) as typeof api.get;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });

  try {
    const branding = await fetchBranding();
    assert.equal(branding.logo_url, "");
    assert.deepEqual(calls, ["/branding"]);
  } finally {
    api.get = originalGet;
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("branding treats authenticated 404 from the private logo proxy as optional", async () => {
  const originalGet = api.get;
  const storage = new Map<string, string>([["autoreel_access_token", "test-jwt"]]);
  const calls: string[] = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  api.get = (async (url: string) => {
    calls.push(url);
    if (url === "/branding/logo") {
      throw new AxiosError("Not found", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { detail: "Brand logo not configured" },
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: {} },
      });
    }
    return { data: { name: "Studio", tagline: null, logo_url: "/api/branding/logo" } } as Awaited<ReturnType<typeof originalGet>>;
  }) as typeof api.get;

  try {
    const branding = await fetchBranding();
    assert.equal(branding.logo_url, "");
    assert.deepEqual(calls, ["/branding", "/branding/logo"]);
    calls.length = 0;
    const repeated = await fetchBranding();
    assert.equal(repeated.logo_url, "");
    assert.deepEqual(calls, ["/branding"]);
  } finally {
    api.get = originalGet;
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});
