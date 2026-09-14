/** History compaction (Phase 2): rolling summary with pinned anchors + sliding window.
 *
 *  Raw history grows linearly; this keeps it flat. Pinned anchors survive every
 *  compaction: the original goal, the scratchpad plan, decisions, and failed
 *  attempts. Everything else compresses to one line per turn. Deterministic
 *  and extractive — no LLM call, so compaction itself costs ~0 tokens.
 */

export interface HistoryTurn {
  role: "user" | "assistant" | "tool";
  /** Raw text of the turn (message, reasoning excerpt, or tool result). */
  text: string;
  /** Tool name for tool turns; undefined otherwise. */
  tool?: string;
  /** Whether the turn carried a pass/fail verdict. */
  verdict?: "pass" | "fail";
}

export interface PinnedAnchors {
  goal?: string;
  plan?: string;
  decisions?: string;
  failedAttempts?: string;
}

/** Build anchors from scratchpad values (caller reads the store). Pure. */
export function anchorsFromScratchpad(values: Record<string, string | undefined>): PinnedAnchors {
  const pick = (k: string) => {
    const v = (values[k] ?? "").trim();
    return v ? v.slice(0, 2000) : undefined;
  };
  return { goal: pick("goal"), plan: pick("plan"), decisions: pick("decisions"), failedAttempts: pick("failed_attempts") };
}

function oneLine(text: string, max = 160): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Compress one non-pinned turn to a single line. Pure. */
export function compressTurn(turn: HistoryTurn): string {
  if (turn.role === "tool") {
    const name = turn.tool?.trim() || "tool";
    const mark = turn.verdict === "pass" ? "✓" : turn.verdict === "fail" ? "×" : "•";
    return `${mark} ${name}: ${oneLine(turn.text, 120)}`;
  }
  if (turn.role === "user") return `user: ${oneLine(turn.text, 140)}`;
  return `assistant: ${oneLine(turn.text, 140)}`;
}

export interface CompactedHistory {
  anchors: PinnedAnchors;
  summary: string[];
  kept: HistoryTurn[];
  dropped: number;
}

/** Roll turns beyond `keepRecent` into one-line summaries. Anchors always survive. */
export function compactTurns(
  turns: HistoryTurn[],
  anchors: PinnedAnchors,
  keepRecent = 4,
): CompactedHistory {
  if (!Number.isInteger(keepRecent) || keepRecent < 0) keepRecent = 4;
  if (turns.length <= keepRecent) {
    return { anchors, summary: [], kept: [...turns], dropped: 0 };
  }
  const cutoff = turns.length - keepRecent;
  const summary = turns.slice(0, cutoff).map(compressTurn);
  return { anchors, summary, kept: turns.slice(cutoff), dropped: cutoff };
}

/** Sliding window: current turn + plan context + last N tool results. Pure. */
export function slidingWindow(turns: HistoryTurn[], lastToolResults = 2): HistoryTurn[] {
  if (!Number.isInteger(lastToolResults) || lastToolResults < 0) lastToolResults = 2;
  if (turns.length === 0) return [];
  const current = turns[turns.length - 1];
  if (!current) return [];
  // Note: slice(-0) === slice(0), so zero must short-circuit explicitly.
  const tools = lastToolResults <= 0 ? [] : turns.filter((t) => t.role === "tool").slice(-lastToolResults);
  const out: HistoryTurn[] = [];
  const seen = new Set<HistoryTurn>();
  for (const t of [...tools, current]) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** Render compacted history back to prompt text. Anchors first (frozen order). */
export function renderCompacted(c: CompactedHistory): string {
  const lines: string[] = [];
  if (c.anchors.goal) lines.push(`Goal: ${oneLine(c.anchors.goal, 300)}`);
  if (c.anchors.plan) lines.push(`Plan: ${oneLine(c.anchors.plan, 500)}`);
  if (c.anchors.decisions) lines.push(`Decisions: ${oneLine(c.anchors.decisions, 500)}`);
  if (c.anchors.failedAttempts) lines.push(`Failed (do not retry): ${oneLine(c.anchors.failedAttempts, 500)}`);
  if (c.summary.length > 0) {
    lines.push(`Earlier (${c.dropped} turns):`);
    for (const s of c.summary.slice(-30)) lines.push(`- ${s}`);
  }
  return lines.join("\n");
}
