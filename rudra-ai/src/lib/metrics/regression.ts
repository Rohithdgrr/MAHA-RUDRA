/** Phase 0: regression alerts + A/B prompt comparison. Pure. */

/** Relative change baseline→current. 0/0 = 0; x/0 = +Infinity (never NaN). Pure. */
export function relativeChange(baseline: number, current: number): number {
  if (!(baseline > 0)) return current > 0 ? Number.POSITIVE_INFINITY : 0;
  if (!Number.isFinite(current) || current < 0) return 0;
  return (current - baseline) / baseline;
}

/** Most "improvements" are token regressions: flag rises over threshold. */
export const REGRESSION_THRESHOLD = 0.15;

export interface RegressionVerdict {
  regressed: boolean;
  change: number;
  threshold: number;
}

export function flagRegression(
  baselineTokensPerTask: number,
  currentTokensPerTask: number,
  threshold = REGRESSION_THRESHOLD,
): RegressionVerdict {
  const change = relativeChange(baselineTokensPerTask, currentTokensPerTask);
  return { regressed: change > threshold, change, threshold };
}

export interface VariantStats {
  tasksSucceeded: number;
  tasksTotal: number;
  tokens: number;
}

/** The only metric that matters per variant: success_rate / tokens. */
export function variantScore(v: VariantStats): number {
  if (v.tasksTotal <= 0 || v.tokens <= 0) return 0;
  return v.tasksSucceeded / v.tasksTotal / v.tokens;
}

export interface ABResult {
  winner: "a" | "b" | "tie";
  scoreA: number;
  scoreB: number;
}

/** Compare two prompt variants on identical tasks. Ties when scores equal (incl. 0/0). */
export function abCompare(a: VariantStats, b: VariantStats): ABResult {
  const scoreA = variantScore(a);
  const scoreB = variantScore(b);
  if (scoreA === scoreB) return { winner: "tie", scoreA, scoreB };
  return scoreA > scoreB ? { winner: "a", scoreA, scoreB } : { winner: "b", scoreA, scoreB };
}
