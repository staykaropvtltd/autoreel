import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_ANALYSIS_POLL_DELAY_MS,
  pollAnalysisUntilTerminal,
  type AnalysisRequest,
} from "../src/analysisPolling.ts";

const JOB_ID = "123e4567-e89b-12d3-a456-426614174000";

function completed(clips: unknown[] = []) {
  return { job_id: JOB_ID, status: "completed", stage: "completed", clips };
}

function clip() {
  return {
    clip_id: "123e4567-e89b-12d3-a456-426614174001",
    source_file: "video.mp4",
    start_time: 0,
    end_time: 2,
    duration: 2,
    score: 80,
    metrics: {
      avg_sharpness: 1,
      avg_brightness: 1,
      dark_frame_ratio: 0,
      avg_motion: 0.3,
      sampled_frame_count: 4,
    },
    reasons: [],
    perceptual_hash: "abc123",
    status: "selected",
    selected: true,
    locked: false,
    duplicate_of: null,
    closest_neighbor_distance: null,
  };
}

function axiosError(status?: number) {
  return Object.assign(new Error("request failed"), {
    isAxiosError: true,
    ...(status === undefined ? {} : { response: { status, data: { detail: "try again" } } }),
  });
}

function virtualClock() {
  let time = 0;
  const delays: number[] = [];
  return {
    delays,
    now: () => time,
    sleep: async (delay: number) => {
      delays.push(delay);
      time += delay;
    },
  };
}

test("completes after the former 48-second cutoff", async () => {
  const clock = virtualClock();
  let calls = 0;
  const request: AnalysisRequest = async () => {
    calls++;
    return calls <= 52
      ? { job_id: JOB_ID, status: "processing", stage: "analyzing" }
      : completed([clip()]);
  };

  const result = await pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, request, {
    timeoutMs: 90_000,
    now: clock.now,
    sleep: clock.sleep,
  });

  assert.equal(calls, 53);
  assert.equal(clock.now(), 53_000);
  assert.equal(result.clips.length, 1);
});

test("accepts and normalizes the completed backend response contract", async () => {
  const backendClip = clip();
  // FastAPI's analysis route has response_model_exclude_none=True, so these
  // nullable BatchClip fields are omitted from its actual JSON response.
  delete (backendClip as Partial<typeof backendClip>).duplicate_of;
  delete (backendClip as Partial<typeof backendClip>).closest_neighbor_distance;

  const result = await pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal,
    async () => completed([backendClip]), { timeoutMs: 1000, sleep: async () => {} });

  assert.deepEqual(result.clips, [{ ...clip() }]);
});

test("recovers from network and retryable HTTP errors without reposting analysis", async () => {
  const clock = virtualClock();
  let calls = 0;
  const request: AnalysisRequest = async () => {
    calls++;
    if (calls === 1) throw axiosError();
    if (calls === 2) throw axiosError(503);
    if (calls === 3) throw axiosError(429);
    return completed([]);
  };

  const result = await pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, request, {
    timeoutMs: 30_000,
    now: clock.now,
    sleep: clock.sleep,
  });

  assert.equal(calls, 4);
  assert.deepEqual(clock.delays, [1000, 2000, 4000, 8000]);
  assert.deepEqual(result.clips, []);
});

test("fails promptly on non-retryable HTTP errors", async () => {
  const clock = virtualClock();
  let calls = 0;
  await assert.rejects(
    pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => {
      calls++;
      throw axiosError(400);
    }, { timeoutMs: 10_000, now: clock.now, sleep: clock.sleep }),
    /request failed/,
  );
  assert.equal(calls, 1);
});

test("times out without another request and caps backoff", async () => {
  const clock = virtualClock();
  let calls = 0;
  await assert.rejects(
    pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => {
      calls++;
      throw axiosError(503);
    }, { timeoutMs: 20_000, now: clock.now, sleep: clock.sleep }),
    /timed out/,
  );
  assert.ok(clock.delays.every((delay) => delay <= MAX_ANALYSIS_POLL_DELAY_MS));
  assert.equal(clock.now(), 20_000);
  assert.equal(calls, 4);
});

test("cancellation clears the pending poll wait", async () => {
  const controller = new AbortController();
  let cleanedUp = false;
  const pendingSleep = (_delay: number, signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
    const onAbort = () => {
      cleanedUp = true;
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  const polling = pollAnalysisUntilTerminal(JOB_ID, controller.signal, async () => completed(), {
    timeoutMs: 1000,
    sleep: pendingSleep,
  });
  controller.abort();
  await assert.rejects(polling, { name: "AbortError" });
  assert.equal(cleanedUp, true);
});

test("aborts an in-flight status request at the overall deadline", async () => {
  let requestAborted = false;
  await assert.rejects(
    pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, (_id, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        requestAborted = true;
        reject(new DOMException("deadline", "TimeoutError"));
      }, { once: true });
    }), { timeoutMs: 80, sleep: async () => {} }),
    /timed out/,
  );
  assert.equal(requestAborted, true);
});

test("rejects missing IDs, malformed responses, and unexpected statuses", async () => {
  const request: AnalysisRequest = async () => completed();
  const options = { timeoutMs: 1000, sleep: async () => {} };
  await assert.rejects(pollAnalysisUntilTerminal("", new AbortController().signal, request, options), /job ID/);
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => null, options), /invalid analysis response/);
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => ({ ...completed(), status: "cancelled" }), options), /unrecognized analysis status/);
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => completed([{}]), options), /invalid clips list/);
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => completed([clip(), clip()]), options), /duplicate clip IDs/);
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => {
    const invalid = clip() as Record<string, unknown>;
    invalid.duplicate_of = 42;
    return completed([invalid]);
  }, options), /invalid clips list/);
});

test("surfaces backend terminal failure and preserves real stage progress", async () => {
  const stages: string[] = [];
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => ({
    job_id: JOB_ID,
    status: "failed",
    stage: "failed",
    error: "Analysis timed out. Please try again.",
  }), {
    timeoutMs: 1000,
    sleep: async () => {},
    onProgress: (summary) => stages.push(summary.stage),
  }), /Analysis timed out/);
  assert.deepEqual(stages, ["failed"]);
});

test("does not retry an unknown backend stage", async () => {
  let calls = 0;
  await assert.rejects(pollAnalysisUntilTerminal(JOB_ID, new AbortController().signal, async () => {
    calls++;
    return { job_id: JOB_ID, status: "processing", stage: "invented_percent_75" };
  }, { timeoutMs: 1000, sleep: async () => {} }), /unrecognized analysis stage/);
  assert.equal(calls, 1);
});
