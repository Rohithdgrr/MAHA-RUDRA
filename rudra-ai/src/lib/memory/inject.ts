import { estimateTokens } from "../utils/tokens";
import type { Memory, MemoryCategory } from "./types";
import { formatMemoryValue } from "./types";

export const DEFAULT_MEMORY_BUDGET = 800;
const STALE_MS = 182 * 24 * 60 * 60 * 1000;
const RESUME_CAP = 3;

const WEIGHT: Record<MemoryCategory, number> = {
  identity: 0,
  preferences: 1,
  social: 2,
  projects: 3,
  achievements: 4,
  resume: 5,
  cv: 6,
  custom: 7,
  contact: 8,
};

export interface InjectOpts {
  budgetTokens?: number;
  includeSensitive?: boolean;
  now?: number;
}

export interface InjectResult {
  /** Empty string when nothing qualifies. */
  block: string;
  used: Memory[];
  dropped: { id: string; reason: "sensitive" | "stale" | "budget" }[];
}

function labelOf(m: Memory): string {
  return m.key.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Ranked, budgeted `## About the user` block. Pure. */
export function buildMemoryBlock(memories: Memory[], opts: InjectOpts = {}): InjectResult {
  const budget = opts.budgetTokens ?? DEFAULT_MEMORY_BUDGET;
  const includeSensitive = opts.includeSensitive ?? false;
  const now = opts.now ?? Date.now();
  const dropped: InjectResult["dropped"] = [];
  const eligible = memories.filter((m) => {
    if (m.status !== "active") return false;
    if (m.sensitive && !includeSensitive) {
      dropped.push({ id: m.id, reason: "sensitive" });
      return false;
    }
    if (m.category !== "identity" && now - m.lastConfirmedAt > STALE_MS) {
      dropped.push({ id: m.id, reason: "stale" });
      return false;
    }
    return true;
  });
  eligible.sort(
    (a, b) => WEIGHT[a.category] - WEIGHT[b.category] || b.lastConfirmedAt - a.lastConfirmedAt,
  );

  const lines: string[] = [];
  const used: Memory[] = [];
  const resumeSeen = new Map<string, number>();
  let resumeSkipped = 0;
  const header = "## About the user";
  for (const m of eligible) {
    if ((m.category === "resume" || m.category === "cv") && (resumeSeen.get(m.category) ?? 0) >= RESUME_CAP) {
      resumeSkipped++;
      dropped.push({ id: m.id, reason: "budget" });
      continue;
    }
    const line = `- ${labelOf(m)}: ${formatMemoryValue(m.value)}`;
    const candidate = lines.length === 0 ? `${header}\n${line}` : `${header}\n${lines.join("\n")}\n${line}`;
    if (estimateTokens(candidate) > budget) {
      dropped.push({ id: m.id, reason: "budget" });
      continue;
    }
    lines.push(line);
    used.push(m);
    if (m.category === "resume" || m.category === "cv") {
      resumeSeen.set(m.category, (resumeSeen.get(m.category) ?? 0) + 1);
    }
  }
  if (resumeSkipped > 0) lines.push(`- (+${resumeSkipped} more resume/CV entries in Settings)`);
  return { block: lines.length === 0 ? "" : `${header}\n${lines.join("\n")}`, used, dropped };
}

/** Merge a persona system prompt with the memory block. Never drops the persona. */
export function mergeSystemPrompt(
  personaSystem?: string,
  memoryBlock?: string,
): string | undefined {
  const persona = personaSystem?.trim() ? personaSystem.trim() : undefined;
  const block = memoryBlock?.trim() ? memoryBlock.trim() : undefined;
  if (persona && block) return `${persona}\n\n${block}`;
  return persona ?? block;
}
