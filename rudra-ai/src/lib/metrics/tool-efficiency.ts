/** Phase 0: tool efficiency ranking — tokens per useful result. Pure. */
import { estimateTokens } from "../utils/tokens";

export interface ToolStat {
  tool: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  useful: number;
}

export interface RankedTool extends ToolStat {
  totalTokens: number;
  /** Mean tokens per useful result. Undefined when nothing useful yet. */
  tokensPerUseful: number | undefined;
}

/** Estimate I/O tokens for one tool call from its text. Pure. */
export function measureToolIO(inputText: string, outputText: string): { tokensIn: number; tokensOut: number } {
  return { tokensIn: estimateTokens(inputText), tokensOut: estimateTokens(outputText) };
}

/** Fold one call into the stats list (immutable). `useful` = the result changed
 *  the agent's next move (verdict consumed, not a duplicate re-read). */
export function recordToolCall(
  stats: ToolStat[],
  tool: string,
  tokensIn: number,
  tokensOut: number,
  useful: boolean,
): ToolStat[] {
  const name = tool.trim() || "unknown";
  const safe = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
  const idx = stats.findIndex((s) => s.tool === name);
  if (idx < 0) {
    return [...stats, { tool: name, calls: 1, tokensIn: safe(tokensIn), tokensOut: safe(tokensOut), useful: useful ? 1 : 0 }];
  }
  const prev = stats[idx];
  if (!prev) return stats;
  const next = [...stats];
  next[idx] = {
    tool: name,
    calls: prev.calls + 1,
    tokensIn: prev.tokensIn + safe(tokensIn),
    tokensOut: prev.tokensOut + safe(tokensOut),
    useful: prev.useful + (useful ? 1 : 0),
  };
  return next;
}

/** Worst offenders first (highest tokens/useful). Zero-useful tools rank top —
 *  they burn tokens with no payoff and get compressed first. Pure. */
export function rankTools(stats: ToolStat[]): RankedTool[] {
  return stats
    .map((s) => {
      const totalTokens = s.tokensIn + s.tokensOut;
      return {
        ...s,
        totalTokens,
        tokensPerUseful: s.useful > 0 ? totalTokens / s.useful : undefined,
      };
    })
    .sort((a, b) => {
      const av = a.tokensPerUseful ?? Number.POSITIVE_INFINITY;
      const bv = b.tokensPerUseful ?? Number.POSITIVE_INFINITY;
      if (av !== bv) return bv - av;
      return b.totalTokens - a.totalTokens;
    });
}

function isToolStat(raw: unknown): raw is ToolStat {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  return typeof r["tool"] === "string" && !!r["tool"] && num(r["calls"]) && num(r["tokensIn"]) && num(r["tokensOut"]) && num(r["useful"]);
}

/** Restore persisted stats; corrupt entries dropped, never throw. */
export function restoreToolStats(raw: unknown): ToolStat[] {
  try {
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).filter(isToolStat).slice(0, 100);
  } catch {
    return [];
  }
}
