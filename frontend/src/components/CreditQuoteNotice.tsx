import { getExpectedCreditBalance } from "../creditAvailability";

interface CreditQuoteNoticeProps {
  credits: number | null;
  cost: number | null;
  loading: boolean;
  error: string | null;
  canGenerate: boolean;
  onRetry: () => void;
}

export default function CreditQuoteNotice({
  credits,
  cost,
  loading,
  error,
  canGenerate,
  onRetry,
}: CreditQuoteNoticeProps) {
  if (loading) {
    return <p role="status" className="text-sm text-[var(--color-text-secondary)]">Loading credit balance and reel cost…</p>;
  }

  if (error || credits === null || cost === null) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-error)]">
        <span>{error || "Credit information is unavailable."}</span>
        <button type="button" onClick={onRetry} className="font-medium underline">Retry</button>
      </div>
    );
  }

  if (!canGenerate) {
    return (
      <p role="alert" className="text-sm text-[var(--color-error)]">
        This reel costs {cost} credits. Your balance is {credits}; add credits before generating.
      </p>
    );
  }

  return (
    <p role="status" className="text-sm text-[var(--color-text-secondary)]">
      Reel cost: {cost} credits · Available: {credits} · After generation: {getExpectedCreditBalance(credits, cost)}
    </p>
  );
}
