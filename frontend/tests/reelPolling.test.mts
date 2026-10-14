import assert from "node:assert/strict";
import test from "node:test";
import { waitForReelResult, type ReelJobStatus } from "../src/reelPolling.ts";
import type { ReelResult } from "../src/types.ts";

const result: ReelResult = {
  reel_id: "reel-1", status: "completed", download_url: "/api/reels/reel-1/download",
  duration: 12, width: 1080, height: 1920, video_codec: "h264", audio_codec: null,
  clip_count: 1, processing_time_seconds: 72, target_duration: 12, duration_status: "ok",
};

function status(overrides: Partial<ReelJobStatus> = {}): ReelJobStatus {
  return {
    reel_id: result.reel_id, status: "processing", stage: "rendering", error: null, result: null,
    ...overrides,
  };
}

test("polls past 48 seconds, reports backend stages, and returns the completed result", async () => {
  let elapsed = 0;
  let attempts = 0;
  const stages: string[] = [];
  const output = await waitForReelResult(
    async () => ++attempts < 45
      ? status({ stage: "rendering" })
      : status({ status: "completed", stage: "completed", result }),
    (stage) => stages.push(stage),
    { now: () => elapsed, sleep: async (ms) => { elapsed += ms; }, timeoutMs: 300000 },
  );
  assert.equal(output, result);
  assert.ok(elapsed > 48000);
  assert.equal(stages.at(-1), "completed");
});

test("recovers from transient status errors and retries only the status request", async () => {
  let attempts = 0;
  const output = await waitForReelResult(async () => {
    attempts += 1;
    if (attempts === 1) throw { response: { status: 503 } };
    if (attempts === 2) throw new Error("network unavailable");
    return status({ status: "completed", stage: "completed", result });
  }, undefined, { sleep: async () => undefined });
  assert.equal(output, result);
  assert.equal(attempts, 3);
});

test("fails with backend error, rejects missing completed results, and times out", async () => {
  await assert.rejects(
    waitForReelResult(async () => status({ status: "failed", stage: "failed", error: "Render failed" })),
    /Render failed/,
  );
  await assert.rejects(
    waitForReelResult(async () => status({ status: "completed", stage: "completed" })),
    /without returning its result/,
  );
  let elapsed = 0;
  await assert.rejects(
    waitForReelResult(async () => status(), undefined, {
      timeoutMs: 1000, now: () => elapsed, sleep: async (ms) => { elapsed += ms; },
    }),
    /timed out/,
  );
});

test("does not retry non-retryable status errors", async () => {
  let attempts = 0;
  await assert.rejects(
    waitForReelResult(async () => {
      attempts += 1;
      throw { response: { status: 404 } };
    }),
  );
  assert.equal(attempts, 1);
});
