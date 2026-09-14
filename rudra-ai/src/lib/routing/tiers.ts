/** Model routing (Phase 3, Layer 8): cheap model for mechanical work, frontier for
 *  judgment. Cascade: try cheap first, escalate on low confidence or failed
 *  verification. Pure — the caller applies the returned ModelSelection.
 */
import type { ModelSelection, Provider } from "../backend/types";

/** Mechanical = extraction/classification/formatting/ranking/parsing. No CoT needed. */
export type MechanicalTask = "extract" | "summarize" | "rank" | "parse-logs" | "normalize-lint";
/** Judgment = edits, refactors, novel debugging, ambiguous intent, review. */
export type JudgmentTask = "edit" | "refactor" | "debug" | "review" | "ambiguous-intent";

export type TaskKind = MechanicalTask | JudgmentTask;

const MECHANICAL: ReadonlySet<string> = new Set<string>(["extract", "summarize", "rank", "parse-logs", "normalize-lint"]);

export function isMechanical(kind: TaskKind): boolean {
  return MECHANICAL.has(kind);
}

/** Ordered cheap-model hints (provider id fragment, model id fragment). */
const CHEAP_HINTS: Array<[string, string]> = [
  ["anthropic", "haiku"],
  ["openai", "gpt-4o-mini"],
  ["openai", "gpt-4.1-mini"],
  ["google", "flash-lite"],
  ["google", "flash"],
  ["openrouter", "haiku"],
  ["openrouter", "mini"],
  ["ollama", ""],
  ["lmstudio", ""],
];

/** Pick the first installed cheap model. Undefined = no cheap tier; use default. */
export function pickCheapModel(providers: Provider[]): ModelSelection | undefined {
  for (const [provHint, modelHint] of CHEAP_HINTS) {
    for (const p of providers) {
      if (!p.id.toLowerCase().includes(provHint)) continue;
      const ids = Object.keys(p.models ?? {});
      const hit =
        ids.find((id) => id.toLowerCase().includes(modelHint)) ?? (modelHint === "" ? ids[0] : undefined);
      // Never emit an empty modelID — an unnamed override would break the call.
      if (hit) return { providerID: p.id, modelID: hit };
    }
  }
  return undefined;
}

export interface RouteDecision {
  /** Model override for this call. Undefined = server default (frontier). */
  model: ModelSelection | undefined;
  tier: "cheap" | "frontier";
}

export function routeTask(kind: TaskKind, providers: Provider[]): RouteDecision {
  if (!isMechanical(kind)) return { model: undefined, tier: "frontier" };
  const cheap = pickCheapModel(providers);
  if (!cheap) return { model: undefined, tier: "frontier" };
  return { model: cheap, tier: "cheap" };
}

export interface CascadeResult {
  confidence?: number;
  verified?: boolean;
}

/** Escalate to frontier when cheap output is unsure or fails verification. */
export function shouldEscalate(result: CascadeResult, minConfidence = 0.6): boolean {
  if (result.verified === false) return true;
  if (result.confidence !== undefined && result.confidence < minConfidence) return true;
  return false;
}
