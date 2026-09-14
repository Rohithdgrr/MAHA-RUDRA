/** Reasoning discipline (Phase 3, Layer 4): route by task type, cap thinking,
 *  structure plans as JSON, sample once unless the stakes demand more. Pure.
 */
import type { TaskKind } from "../routing/tiers";
import { isMechanical } from "../routing/tiers";

export type Complexity = "mechanical" | "light" | "full";

/** Mechanical → no CoT; debug/ambiguous → full CoT; routine edits → light. */
export function classifyComplexity(kind: TaskKind): Complexity {
  if (isMechanical(kind)) return "mechanical";
  if (kind === "debug" || kind === "ambiguous-intent") return "full";
  return "light";
}

/** Thinking-token budgets per complexity. Mechanical commits immediately. */
export const REASONING_BUDGETS: Record<Complexity, number> = {
  mechanical: 0,
  light: 500,
  full: 4000,
};

export function budgetFor(kind: TaskKind): number {
  return REASONING_BUDGETS[classifyComplexity(kind)];
}

export interface PlanSkeleton {
  goal: string;
  steps: string[];
  risks: string[];
  chosen: number;
}

/** Structured plan (JSON) instead of 800 words of "let me think…". Pure. */
export function buildPlanSkeleton(goal: string, steps: string[], risks: string[] = []): string {
  const g = goal.trim().slice(0, 300);
  if (!g) throw new Error("goal must be non-empty");
  const cleanSteps = steps.map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (cleanSteps.length === 0) throw new Error("at least one step is required");
  const plan: PlanSkeleton = { goal: g, steps: cleanSteps, risks: risks.map((r) => r.trim()).filter(Boolean).slice(0, 5), chosen: 0 };
  return JSON.stringify(plan);
}

/** Parse back a plan skeleton; undefined on malformed input (never throws). */
export function parsePlanSkeleton(raw: string): PlanSkeleton | undefined {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p["goal"] !== "string" || !Array.isArray(p["steps"])) return undefined;
    const steps = (p["steps"] as unknown[]).filter((s): s is string => typeof s === "string" && !!s.trim());
    if (!p["goal"].trim() || steps.length === 0) return undefined;
    const risks = Array.isArray(p["risks"])
      ? (p["risks"] as unknown[]).filter((r): r is string => typeof r === "string")
      : [];
    const chosen = typeof p["chosen"] === "number" && p["chosen"] >= 0 && p["chosen"] < steps.length ? Math.floor(p["chosen"]) : 0;
    return { goal: p["goal"], steps, risks, chosen };
  } catch {
    return undefined;
  }
}

/** Self-consistency samples: 3 only for high-stakes calls, else single pass. */
export function sampleCount(kind: TaskKind, highStakes: boolean): 1 | 3 {
  if (!highStakes) return 1;
  return classifyComplexity(kind) === "mechanical" ? 1 : 3;
}
