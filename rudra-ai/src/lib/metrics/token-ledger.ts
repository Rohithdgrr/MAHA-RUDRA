/** Phase 0: per-session token ledger. Pure — no DOM, no stores. All updates immutable. */

export type TokenBucket =
  | "system"
  | "tools"
  | "history"
  | "tool_out"
  | "reasoning"
  | "output"
  | "cached"
  | "unattributed";

export const TOKEN_BUCKETS: TokenBucket[] = [
  "system",
  "tools",
  "history",
  "tool_out",
  "reasoning",
  "output",
  "cached",
  "unattributed",
];

/** How a bucket's number was obtained. Server step-finish totals that can't be
 *  split honestly land in `unattributed` as `reported`; local estimates (memory
 *  block size, tool I/O text) are `estimated`. Never fabricate a split. */
export type BucketSource = "reported" | "estimated";

export interface BucketEntry {
  tokens: number;
  cost: number;
  source: BucketSource;
}

export interface SessionLedger {
  sessionID: string;
  buckets: Record<TokenBucket, BucketEntry>;
  tasksTotal: number;
  tasksSucceeded: number;
  updatedAt: number;
}

export const MAX_STORED_SESSIONS = 50;

function entry(tokens = 0, cost = 0, source: BucketSource = "reported"): BucketEntry {
  return { tokens, cost, source };
}

export function emptyLedger(sessionID: string, now = Date.now()): SessionLedger {
  return {
    sessionID,
    buckets: {
      system: entry(),
      tools: entry(),
      history: entry(),
      tool_out: entry(),
      reasoning: entry(),
      output: entry(),
      cached: entry(),
      unattributed: entry(),
    },
    tasksTotal: 0,
    tasksSucceeded: 0,
    updatedAt: now,
  };
}

export interface RecordOpts {
  cost?: number;
  source?: BucketSource;
}

/** Add tokens to one bucket. Negative/NaN inputs are ignored (never throw). */
export function recordUsage(
  ledger: SessionLedger,
  bucket: TokenBucket,
  tokens: number,
  opts: RecordOpts = {},
  now = Date.now(),
): SessionLedger {
  if (!Number.isFinite(tokens) || tokens <= 0) return ledger;
  const cost = opts.cost ?? 0;
  const prev = ledger.buckets[bucket];
  return {
    ...ledger,
    buckets: {
      ...ledger.buckets,
      [bucket]: {
        tokens: prev.tokens + Math.round(tokens),
        cost: prev.cost + (Number.isFinite(cost) && cost > 0 ? cost : 0),
        source: opts.source ?? prev.source,
      },
    },
    updatedAt: now,
  };
}

/** Replace the reported buckets from a fresh server-truth recompute (idempotent).
 *  Estimated buckets (system/tools/tool_out) and task counters are preserved. */
export function resetReported(
  ledger: SessionLedger,
  reported: Partial<Record<TokenBucket, { tokens: number; cost: number }>>,
  now = Date.now(),
): SessionLedger {
  const next = { ...ledger.buckets };
  for (const b of TOKEN_BUCKETS) {
    const r = reported[b];
    if (next[b].source === "estimated" && r === undefined) continue;
    if (r !== undefined) {
      next[b] = { tokens: Math.max(0, Math.round(r.tokens)), cost: Math.max(0, r.cost), source: "reported" };
    } else if (next[b].source === "reported") {
      next[b] = entry();
    }
  }
  return { ...ledger, buckets: next, updatedAt: now };
}

export interface TurnAttribution {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  cost?: number;
}

/** Fold one server `step-finish` turn into the ledger. Input totals that can't be
 *  split go to `unattributed`; output goes to `output`; cached (when present) to
 *  `cached`. Turn cost rides with `unattributed` (it covers the whole turn). */
export function syncStepFinish(
  ledger: SessionLedger,
  turn: TurnAttribution,
  now = Date.now(),
): SessionLedger {
  let next = ledger;
  if (Number.isFinite(turn.inputTokens) && turn.inputTokens > 0) {
    next = recordUsage(next, "unattributed", turn.inputTokens, { cost: turn.cost, source: "reported" }, now);
  }
  if (Number.isFinite(turn.outputTokens) && turn.outputTokens > 0) {
    next = recordUsage(next, "output", turn.outputTokens, { source: "reported" }, now);
  }
  if (turn.reasoningTokens !== undefined && Number.isFinite(turn.reasoningTokens) && turn.reasoningTokens > 0) {
    next = recordUsage(next, "reasoning", turn.reasoningTokens, { source: "reported" }, now);
  }
  if (turn.cachedTokens !== undefined && Number.isFinite(turn.cachedTokens) && turn.cachedTokens > 0) {
    next = recordUsage(next, "cached", turn.cachedTokens, { source: "reported" }, now);
  }
  return { ...next, updatedAt: now };
}

/** Record a finished task. Only metric that matters is tokens per *successful* task. */
export function recordTask(ledger: SessionLedger, success: boolean, now = Date.now()): SessionLedger {
  return {
    ...ledger,
    tasksTotal: ledger.tasksTotal + 1,
    tasksSucceeded: ledger.tasksSucceeded + (success ? 1 : 0),
    updatedAt: now,
  };
}

export function ledgerTotal(ledger: SessionLedger): { tokens: number; cost: number } {
  let tokens = 0;
  let cost = 0;
  for (const b of TOKEN_BUCKETS) {
    tokens += ledger.buckets[b].tokens;
    cost += ledger.buckets[b].cost;
  }
  return { tokens, cost };
}

/** Mean tokens per successful task. Undefined until at least one success. */
export function tokensPerTask(ledger: SessionLedger): number | undefined {
  if (ledger.tasksSucceeded <= 0) return undefined;
  return ledgerTotal(ledger).tokens / ledger.tasksSucceeded;
}

/** Successes per kilo-token (higher is better). Undefined with no tokens. */
export function successPerKiloToken(ledger: SessionLedger): number | undefined {
  const { tokens } = ledgerTotal(ledger);
  if (tokens <= 0) return undefined;
  return ledger.tasksSucceeded / (tokens / 1000);
}

/** Cache hit rate: share of prompt input served from cache. Undefined with no input. */
export function cacheHitRate(ledger: SessionLedger): number | undefined {
  const input = ledger.buckets.unattributed.tokens;
  const cached = ledger.buckets.cached.tokens;
  if (input <= 0) return undefined;
  return Math.min(1, cached / input);
}
/** Sum ledgers (e.g. global view). Task counters add; bucket sources merge to estimated on conflict. */
export function mergeLedgers(ledgers: SessionLedger[]): Omit<SessionLedger, "sessionID"> & { sessionID: string } {
  const merged = emptyLedger("merged");
  for (const l of ledgers) {
    for (const b of TOKEN_BUCKETS) {
      const cur = merged.buckets[b];
      const inc = l.buckets[b];
      merged.buckets[b] = {
        tokens: cur.tokens + inc.tokens,
        cost: cur.cost + inc.cost,
        source: cur.source === inc.source ? cur.source : "estimated",
      };
    }
    merged.tasksTotal += l.tasksTotal;
    merged.tasksSucceeded += l.tasksSucceeded;
  }
  return merged;
}

/** Keep the newest N session ledgers. Pure. */
export function capLedgers(ledgers: SessionLedger[], max = MAX_STORED_SESSIONS): SessionLedger[] {
  if (ledgers.length <= max) return [...ledgers];
  return [...ledgers].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, max);
}

function isBucketEntry(raw: unknown): raw is BucketEntry {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r["tokens"] === "number" &&
    Number.isFinite(r["tokens"]) &&
    typeof r["cost"] === "number" &&
    Number.isFinite(r["cost"]) &&
    (r["source"] === "reported" || r["source"] === "estimated")
  );
}

/** Restore a persisted ledger; corrupt input yields undefined (never throw). */
export function restoreLedger(raw: unknown): SessionLedger | undefined {
  try {
    if (typeof raw !== "object" || raw === null) return undefined;
    const r = raw as Record<string, unknown>;
    if (typeof r["sessionID"] !== "string" || !r["sessionID"]) return undefined;
    const buckets = r["buckets"] as Record<string, unknown> | undefined;
    if (typeof buckets !== "object" || buckets === null) return undefined;
    const ledger = emptyLedger(r["sessionID"]);
    for (const b of TOKEN_BUCKETS) {
      if (isBucketEntry(buckets[b])) ledger.buckets[b] = buckets[b];
    }
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    ledger.tasksTotal = num(r["tasksTotal"]);
    ledger.tasksSucceeded = Math.min(num(r["tasksSucceeded"]), ledger.tasksTotal || num(r["tasksSucceeded"]));
    ledger.updatedAt = typeof r["updatedAt"] === "number" && Number.isFinite(r["updatedAt"]) ? r["updatedAt"] : Date.now();
    return ledger;
  } catch {
    return undefined;
  }
}
