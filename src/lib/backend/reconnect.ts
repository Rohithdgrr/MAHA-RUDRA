/**
 * Exponential-backoff reconnect delays for the multiplexed SSE stream.
 * Pure — the adapter owns timers, this owns the math.
 */

export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_CAP_MS = 30000;
const JITTER_RATIO = 0.25;
const MIN_DELAY_MS = 250;

/**
 * Delay before reconnect attempt `n` (0-based): base·2ⁿ capped at 30s,
 * ±25% jitter. Pass a fixed `rand` in tests for determinism.
 */
export function nextReconnectDelay(attempt: number, rand: () => number = Math.random): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const exp = Math.min(RECONNECT_BASE_MS * 2 ** n, RECONNECT_CAP_MS);
  const jitter = exp * JITTER_RATIO * (rand() * 2 - 1);
  return Math.max(MIN_DELAY_MS, Math.round(exp + jitter));
}
