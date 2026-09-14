import type { Memory } from "./types";
import { CATEGORY_LABELS, formatMemoryValue } from "./types";

/** Phase 7: portable exports. Pure. */

export function memoryToJson(memories: Memory[]): string {
  return JSON.stringify(memories, null, 2);
}

function valueLine(m: Memory): string {
  const v = formatMemoryValue(m.value);
  const lock = m.sensitive ? " 🔒" : "";
  return `- **${m.key}**${lock}: ${v}`;
}

/** Active memories grouped by category; pending listed separately for review context. */
export function memoryToMarkdown(memories: Memory[]): string {
  const lines = ["# RUDRA Memory Export", ""];
  const active = memories.filter((m) => m.status === "active");
  const pending = memories.filter((m) => m.status === "pending");
  if (active.length === 0 && pending.length === 0) {
    lines.push("_No memories stored._", "");
    return lines.join("\n");
  }
  const cats = [...new Set(active.map((m) => m.category))].sort();
  for (const c of cats) {
    lines.push(`## ${CATEGORY_LABELS[c] ?? c}`, "");
    for (const m of active.filter((m) => m.category === c)) lines.push(valueLine(m));
    lines.push("");
  }
  if (pending.length > 0) {
    lines.push("## Awaiting review", "");
    for (const m of pending) lines.push(valueLine(m));
    lines.push("");
  }
  return lines.join("\n");
}
