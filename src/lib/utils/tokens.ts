/** Rough token estimate for the composer counter (~4 chars per token). Pure. */
export function estimateTokens(text: string): number {
  const len = text.trim().length;
  if (len === 0) return 0;
  return Math.max(1, Math.ceil(len / 4));
}

export interface UsageTotals {
  tokens: number;
  cost: number;
}

interface UsagePart {
  type: string;
  reason?: string;
  cost?: number;
  tokens?: { input?: number; output?: number };
}

/** Sum `step-finish` tokens + cost across message parts. Pure. */
export function sumUsage(parts: UsagePart[]): UsageTotals {
  let tokens = 0;
  let cost = 0;
  for (const p of parts ?? []) {
    if (p?.type !== "step-finish") continue;
    tokens += (p.tokens?.input ?? 0) + (p.tokens?.output ?? 0);
    if (typeof p.cost === "number" && Number.isFinite(p.cost)) cost += p.cost;
  }
  return { tokens, cost };
}

/** Format a token count compactly (12.4k). Pure. */
export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}
