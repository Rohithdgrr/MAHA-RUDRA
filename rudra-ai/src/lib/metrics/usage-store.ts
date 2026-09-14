/** Phase 0: reactive usage store — ledger sync, persistence, baselines. */
import { createStore } from "solid-js/store";
import { estimateTokens } from "../utils/tokens";
import {
  emptyLedger,
  ledgerTotal,
  mergeLedgers,
  recordTask,
  recordUsage,
  resetReported,
  restoreLedger,
  tokensPerTask,
  type SessionLedger,
} from "./token-ledger";
import { recordToolCall, restoreToolStats, type ToolStat } from "./tool-efficiency";

export const METRICS_STORAGE_KEY = "rudra.metrics.v1";

export interface MetricsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): MetricsStorage | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function memoryStorage(): MetricsStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

interface PersistedMetrics {
  ledgers: unknown[];
  toolStats: unknown[];
  baselines: Record<string, number>;
}

export interface StepFinishSums {
  input: number;
  output: number;
  reasoning: number;
  cached: number;
  cacheWrite: number;
  cost: number;
}

/** Sum step-finish tokens across raw message parts (tolerates unknown shapes). Pure.
 *  Matches the server `StepFinishPart` shape: tokens {input, output, reasoning,
 *  cache: {read, write}}. Legacy flat `cached` fields are still honored. */
export function sumStepFinish(parts: unknown): StepFinishSums {
  const out: StepFinishSums = { input: 0, output: 0, reasoning: 0, cached: 0, cacheWrite: 0, cost: 0 };
  if (!Array.isArray(parts)) return out;
  for (const p of parts as Array<Record<string, unknown>>) {
    if (p === null || typeof p !== "object" || p["type"] !== "step-finish") continue;
    const t = (p["tokens"] ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
    out.input += num(t["input"]);
    out.output += num(t["output"]);
    out.reasoning += num(t["reasoning"]);
    const cache = t["cache"] as Record<string, unknown> | undefined;
    if (cache !== null && typeof cache === "object") {
      out.cached += num(cache["read"]);
      out.cacheWrite += num(cache["write"]);
    }
    out.cached += num(t["cached"]); // legacy flat shape
    const c = p["cost"];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) out.cost += c;
  }
  return out;
}

export interface UsageState {
  ledgers: Record<string, SessionLedger>;
  toolStats: ToolStat[];
  baselines: Record<string, number>;
}

function loadPersisted(storage: MetricsStorage | undefined): UsageState {
  const fallback: UsageState = { ledgers: {}, toolStats: [], baselines: {} };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(METRICS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedMetrics>;
    const ledgers: Record<string, SessionLedger> = {};
    if (Array.isArray(parsed.ledgers)) {
      for (const item of parsed.ledgers.slice(0, 50)) {
        const l = restoreLedger(item);
        if (l) ledgers[l.sessionID] = l;
      }
    }
    const baselines: Record<string, number> = {};
    if (parsed.baselines !== null && typeof parsed.baselines === "object") {
      for (const [k, v] of Object.entries(parsed.baselines)) {
        if (typeof v === "number" && Number.isFinite(v) && v > 0) baselines[k] = v;
      }
    }
    return { ledgers, toolStats: restoreToolStats(parsed.toolStats), baselines };
  } catch {
    return fallback;
  }
}

export function createUsageStore(storage?: MetricsStorage) {
  const backing = storage ?? browserStorage();
  const [state, setState] = createStore<UsageState>(loadPersisted(backing));

  function persist(): void {
    if (!backing) return;
    try {
      const payload: PersistedMetrics = {
        ledgers: Object.values(state.ledgers),
        toolStats: state.toolStats,
        baselines: state.baselines,
      };
      backing.setItem(METRICS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage unavailable (private mode) — metrics stay in memory
    }
  }

  function ensure(sessionID: string): SessionLedger {
    return state.ledgers[sessionID] ?? emptyLedger(sessionID);
  }

  return {
    state,
    /** Idempotent rebuild of reported buckets from message parts. Safe in effects. */
    syncSession(sessionID: string, messages: Array<{ parts?: unknown }>): void {
      let input = 0;
      let output = 0;
      let reasoning = 0;
      let cached = 0;
      let cost = 0;
      for (const m of messages) {
        const s = sumStepFinish(m.parts);
        input += s.input;
        output += s.output;
        reasoning += s.reasoning;
        cached += s.cached;
        cost += s.cost;
      }
      // Rebuild is idempotent: same messages always produce the same buckets,
      // so this is safe to call from reactive effects without double-counting.
      const next = resetReported(ensure(sessionID), {
        unattributed: { tokens: input, cost },
        output: { tokens: output, cost: 0 },
        reasoning: { tokens: reasoning, cost: 0 },
        cached: { tokens: cached, cost: 0 },
      });
      setState("ledgers", sessionID, next);
      persist();
    },
    /** Local estimate: injected memory-block size feeds the `system` bucket. */
    reportMemoryBlock(sessionID: string, blockText: string): void {
      if (!blockText.trim()) return;
      setState("ledgers", sessionID, recordUsage(ensure(sessionID), "system", estimateTokens(blockText), { source: "estimated" }));
      persist();
    },
    /** Local estimate: agent-tool I/O text feeds `tools`/`tool_out` + ranking. */
    reportToolCall(sessionID: string, tool: string, inputText: string, outputText: string, useful: boolean): void {
      const tokensIn = estimateTokens(inputText);
      const tokensOut = estimateTokens(outputText);
      let next = recordUsage(ensure(sessionID), "tools", tokensIn, { source: "estimated" });
      next = recordUsage(next, "tool_out", tokensOut, { source: "estimated" });
      setState("ledgers", sessionID, next);
      setState("toolStats", recordToolCall(state.toolStats, tool, tokensIn, tokensOut, useful));
      persist();
    },
    reportTask(sessionID: string, success: boolean): void {
      setState("ledgers", sessionID, recordTask(ensure(sessionID), success));
      persist();
    },
    setBaseline(scope: string, tokensPerTaskValue: number): void {
      if (!scope.trim() || !Number.isFinite(tokensPerTaskValue) || tokensPerTaskValue <= 0) return;
      setState("baselines", scope.trim(), tokensPerTaskValue);
      persist();
    },
    global(): { tokens: number; cost: number; tasksTotal: number; tasksSucceeded: number; perTask: number | undefined } {
      const all = Object.values(state.ledgers);
      if (all.length === 0) return { tokens: 0, cost: 0, tasksTotal: 0, tasksSucceeded: 0, perTask: undefined };
      const m = mergeLedgers(all);
      return { ...ledgerTotal(m), tasksTotal: m.tasksTotal, tasksSucceeded: m.tasksSucceeded, perTask: tokensPerTask(m) };
    },
  };
}

export type UsageStore = ReturnType<typeof createUsageStore>;

/** App singleton (browser-persisted). Tests should use `createUsageStore(memoryStorage())`. */
export const usageStore = createUsageStore();
