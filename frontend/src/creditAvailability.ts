export interface CreditGate {
  allowed: boolean;
  message: string | null;
}

export interface CreditQuote {
  credits: number;
  cost: number;
}

export async function loadCreditQuote(
  fetchBalance: () => Promise<{ credits: number }>,
  fetchCost: () => Promise<{ cost: number }>,
): Promise<CreditQuote> {
  const [balance, quote] = await Promise.all([fetchBalance(), fetchCost()]);
  if (!Number.isFinite(balance.credits) || balance.credits < 0 ||
      !Number.isFinite(quote.cost) || quote.cost <= 0) {
    throw new Error("The server returned invalid credit information.");
  }
  return { credits: balance.credits, cost: quote.cost };
}

export function getCreditGate(
  credits: number | null,
  cost: number | null,
  loading: boolean,
  error: string | null,
): CreditGate {
  if (loading) return { allowed: false, message: "Checking your credit balance and generation cost." };
  if (error || credits === null || cost === null) {
    return { allowed: false, message: error || "Credit information is unavailable. Try again." };
  }
  if (credits < cost) {
    return {
      allowed: false,
      message: `Insufficient credits: this reel requires ${cost} credits, and your available balance is ${credits}.`,
    };
  }
  return { allowed: true, message: null };
}

export function getExpectedCreditBalance(credits: number, cost: number): number | null {
  return credits >= cost ? credits - cost : null;
}
