import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, getCredits, getReelCost } from "../api";
import { getCreditGate, loadCreditQuote } from "../creditAvailability";

export function useCreditQuote(enabled = true) {
  const [credits, setCredits] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<{ promise: Promise<void>; controller: AbortController } | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback((): Promise<void> => {
    if (requestRef.current) return requestRef.current.promise;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const promise = loadCreditQuote(
      () => getCredits(controller.signal),
      () => getReelCost(controller.signal),
    ).then((quote) => {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      setCredits(quote.credits);
      setCost(quote.cost);
    }).catch((requestError: unknown) => {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      controller.abort();
      setCredits(null);
      setCost(null);
      setError(apiErrorMessage(requestError, "Could not load your credit balance and generation cost."));
    }).finally(() => {
      if (requestRef.current?.promise === promise) requestRef.current = null;
      if (requestId === requestIdRef.current) setLoading(false);
    });

    requestRef.current = { promise, controller };
    return promise;
  }, []);

  const cancelRefresh = useCallback(() => {
    requestIdRef.current++;
    requestRef.current?.controller.abort();
    requestRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return cancelRefresh;
  }, [enabled, refresh, cancelRefresh]);

  const gate = getCreditGate(credits, cost, loading, error);

  return {
    credits,
    cost,
    loading,
    error,
    canGenerate: gate.allowed,
    blockedMessage: gate.message,
    refresh,
  };
}
