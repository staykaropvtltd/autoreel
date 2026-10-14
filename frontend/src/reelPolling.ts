import type { ReelResult } from "./types";

export interface ReelJobStatus {
  reel_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: "queued" | "preparing" | "rendering" | "finalizing" | "completed" | "failed";
  error: string | null;
  result: ReelResult | null;
}

type PollError = { response?: { status?: number } };

export async function waitForReelResult(
  fetchStatus: () => Promise<ReelJobStatus>,
  onStage?: (stage: ReelJobStatus["stage"]) => void,
  options: {
    timeoutMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<ReelResult> {
  const timeoutMs = options.timeoutMs ?? 2 * 60 * 60 * 1000 + 5 * 60 * 1000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const startedAt = now();
  let delay = 800;

  while (now() - startedAt < timeoutMs) {
    await sleep(delay);
    let status: ReelJobStatus;
    try {
      status = await fetchStatus();
    } catch (error) {
      const responseStatus = (error as PollError | null)?.response?.status;
      if (responseStatus !== undefined && responseStatus !== 408 && responseStatus !== 429 && responseStatus < 500) {
        throw error;
      }
      delay = Math.min(5000, Math.round(delay * 1.4));
      continue;
    }
    onStage?.(status.stage);
    if (status.status === "failed") {
      throw new Error(status.error || "Reel rendering failed. Please try again.");
    }
    if (status.status === "completed") {
      if (!status.result) throw new Error("The server completed the reel without returning its result.");
      return status.result;
    }
    delay = Math.min(5000, Math.round(delay * 1.4));
  }
  throw new Error("Reel rendering timed out while waiting for the server.");
}
