/** Loop guards (Layers 6.2–6.5): failed-attempt memory, step budget, convergence.
 *
 *  Failed attempts live in the scratchpad `failed_attempts` key so they survive
 *  summarization and get injected next turn. Budgets and convergence are pure
 *  value objects the orchestrator checks before each tool call.
 */
import { shortHash } from "./content-cache";
import { MemoryKV, scratchpad, type KeyValueStorage } from "./scratchpad";

export interface FailedAttempt {
  tried: string;
  failedBecause: string;
  at: number;
}

const FAILED_KEY = "failed_attempts";
const MAX_ATTEMPTS = 20;

/** Append `{tried, failedBecause}`; prunes oldest beyond cap. Never throws. */
export function recordFailedAttempt(
  store: KeyValueStorage,
  tried: string,
  failedBecause: string,
): FailedAttempt[] {
  const list = getFailedAttempts(store);
  const t = tried.trim().slice(0, 500);
  const f = failedBecause.trim().slice(0, 500);
  if (!t || !f) return list;
  // dedupe identical consecutive retries — the loop itself is the signal
  const last = list[list.length - 1];
  if (last && last.tried === t && last.failedBecause === f) return list;
  list.push({ tried: t, failedBecause: f, at: Date.now() });
  const pruned = list.slice(-MAX_ATTEMPTS);
  scratchpad(store, { op: "write", key: FAILED_KEY, value: JSON.stringify(pruned) });
  return pruned;
}

/** Read attempts; corrupt payloads yield [] (and are cleared). */
export function getFailedAttempts(store: KeyValueStorage): FailedAttempt[] {
  const raw = store.get(`scratchpad:${FAILED_KEY}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Array<Record<string, unknown>>)
      .filter((a) => typeof a["tried"] === "string" && typeof a["failedBecause"] === "string")
      .map((a) => ({
        tried: String(a["tried"]).slice(0, 500),
        failedBecause: String(a["failedBecause"]).slice(0, 500),
        at: typeof a["at"] === "number" ? a["at"] : 0,
      }))
      .slice(-MAX_ATTEMPTS);
  } catch {
    return [];
  }
}

/** Prompt-ready rendering for next-turn injection. Empty string when none. */
export function renderFailedAttempts(store: KeyValueStorage): string {
  const list = getFailedAttempts(store);
  if (list.length === 0) return "";
  return `Previously failed (do not retry as-is):\n${list.map((a) => `- tried "${a.tried}" → failed: ${a.failedBecause}`).join("\n")}`;
}

export function failedAttemptsStore(): KeyValueStorage {
  return new MemoryKV();
}

export type BudgetState = "ok" | "wrap-up" | "exceeded";

export interface StepBudget {
  max: number;
  warnAt: number;
}

/** Hard step budget (default 25/20). Pure. */
export function checkBudget(budget: StepBudget, stepsUsed: number): BudgetState {
  if (!Number.isFinite(stepsUsed) || stepsUsed < 0) return "ok";
  if (stepsUsed >= budget.max) return "exceeded";
  if (stepsUsed >= budget.warnAt) return "wrap-up";
  return "ok";
}

export const DEFAULT_BUDGET: StepBudget = { max: 25, warnAt: 20 };

export interface EditRecord {
  file: string;
  passed: boolean;
}

/** Breaks thrashing: 3 consecutive failing edits to the same file force a review. */
export class ConvergenceTracker {
  private trail: EditRecord[] = [];

  record(file: string, passed: boolean): { thrashing: boolean; streak: number } {
    const key = file.replace(/\\/g, "/");
    this.trail.push({ file: key, passed });
    if (this.trail.length > 10) this.trail = this.trail.slice(-10);
    if (passed) return { thrashing: false, streak: 0 };
    let streak = 0;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const r = this.trail[i];
      if (!r || r.passed || r.file !== key) break;
      streak++;
    }
    return { thrashing: streak >= 3, streak };
  }

  reset(): void {
    this.trail = [];
  }
}

/** No re-verification of unchanged state: track last-verified content hash per file. */
export class VerifiedState {
  private hashes = new Map<string, string>();

  markVerified(file: string, content: string): void {
    this.hashes.set(file.replace(/\\/g, "/"), shortHash(content));
  }

  /** True when content matches the last verified hash — skip re-lint/re-test. */
  isStillVerified(file: string, content: string): boolean {
    const prev = this.hashes.get(file.replace(/\\/g, "/"));
    return prev !== undefined && prev === shortHash(content);
  }

  forget(file: string): void {
    this.hashes.delete(file.replace(/\\/g, "/"));
  }
}
