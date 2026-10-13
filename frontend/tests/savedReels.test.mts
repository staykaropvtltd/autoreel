import assert from "node:assert/strict";
import { test } from "node:test";
import { createSavedReelProject, upsertSavedReel } from "../src/savedReels.ts";

const generated = (reel_id: string, download_url: string) => createSavedReelProject(
  { reel_id, download_url, duration: 12.4, width: 1080, height: 1920 },
  { title: "  New collection  ", category: "Sarees", productPrice: "₹12,000" },
);

test("successful generation creates a saved entry using the backend ID and playback URL", () => {
  const project = generated("reel-123", "/api/reels/reel-123/download");
  assert.deepEqual(project, {
    id: "reel-123",
    title: "New collection",
    category: "Sarees",
    durationSeconds: 12,
    resolution: "1080x1920",
    videoUrl: "/api/reels/reel-123/download",
    thumbnailUrl: "",
    createdAt: "Just now",
    status: "ready",
    productPrice: "₹12,000",
  });
  assert.equal(project?.videoUrl, "/api/reels/reel-123/download");
});

test("failed or incomplete generation results cannot create a ready project", () => {
  assert.equal(createSavedReelProject({}, { title: "Failed", category: "Other" }), null);
  assert.equal(createSavedReelProject({ reel_id: "reel-1" }, { title: "Failed", category: "Other" }), null);
});

test("upserting preserves other projects, places the newest first, and deduplicates by reel ID", () => {
  const older = generated("reel-old", "/api/reels/reel-old/download")!;
  const newest = generated("reel-new", "/api/reels/reel-new/download")!;
  const refreshedNewest = { ...newest, title: "Updated title" };
  const first = upsertSavedReel([older], newest);
  const duplicate = upsertSavedReel(first, refreshedNewest);

  assert.deepEqual(duplicate.map(({ id }) => id), ["reel-new", "reel-old"]);
  assert.equal(duplicate[0].title, "Updated title");
});

test("saved reel metadata survives JSON persistence and retains the backend playback URL", () => {
  const project = generated("reel-persisted", "/api/reels/reel-persisted/download")!;
  const restored = JSON.parse(JSON.stringify([project])) as typeof project[];
  assert.equal(restored[0].id, "reel-persisted");
  assert.equal(restored[0].videoUrl, "/api/reels/reel-persisted/download");
});
