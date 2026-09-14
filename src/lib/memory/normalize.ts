import type { JsonValue, Memory } from "./types";
import { normalizeKey } from "./store";

export interface ExtractedCandidate {
  category: Memory["category"];
  key: string;
  value: JsonValue;
  confidence: number;
  excerpt: string;
}

export type ClassifyAction = "confirm" | "conflict" | "insert";

export interface Classification {
  action: ClassifyAction;
  existingId?: string;
}

function valuesEqual(a: JsonValue, b: JsonValue): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Classify one candidate against known memories.
 * equal value -> confirm (bump lastConfirmedAt, no new record).
 * same (category,key), different value -> conflict (user picks).
 * otherwise -> insert as pending.
 */
export function classifyCandidate(existing: Memory[], candidate: ExtractedCandidate): Classification {
  const key = normalizeKey(candidate.key);
  const same = existing.find(
    (m) =>
      (m.status === "active" || m.status === "pending") &&
      m.category === candidate.category &&
      m.key === key,
  );
  if (!same) return { action: "insert" };
  if (valuesEqual(same.value, candidate.value)) return { action: "confirm", existingId: same.id };
  return { action: "conflict", existingId: same.id };
}

/** Last-wins per (category,key): user correcting themselves in one batch keeps the final value. */
export function dedupeCandidates(candidates: ExtractedCandidate[]): ExtractedCandidate[] {
  const bySlot = new Map<string, ExtractedCandidate>();
  for (const c of candidates) {
    bySlot.set(`${c.category}::${normalizeKey(c.key)}`, c);
  }
  return [...bySlot.values()];
}
