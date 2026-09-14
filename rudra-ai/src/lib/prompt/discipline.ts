/** Output discipline (Phase 3, Layer 5): cite, don't quote. Structured finals,
 *  no plan replays, no preamble, hard length caps. Pure formatters the loop
 *  applies to final responses — the diff already exists in the checkpoint.
 */
import { estimateTokens } from "../utils/tokens";

/** `src/api.ts:44` — a pointer, not a paste. Pure. */
export function citeRef(file: string, line: number): string {
  const f = file.replace(/\\/g, "/").trim() || "unknown";
  const l = Number.isInteger(line) && line > 0 ? line : 1;
  return `\`${f}:${l}\``;
}

const FILLER_OPENERS = [
  /^\s*(hi|hello|hey|thanks|thank you)[,.!\s]/i,
  /^\s*(i'll|i will|let me|i've|i have|i just|i'm going to|i am going to)\b/i,
  /^\s*(sure|certainly|absolutely|of course)[,.!\s]/i,
  /^\s*(here'?s|here is)\s+(what|the|an|a)\b/i,
];

/** Drop filler opener lines ("I'll now…", "Let me…", greetings). Keeps signal. */
export function stripPreamble(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i]?.trim() === "" || FILLER_OPENERS.some((re) => re.test(lines[i] ?? "")))) {
    i++;
  }
  return lines.slice(i).join("\n").trimStart();
}

export interface TaskResult {
  status: "done" | "partial" | "blocked" | "failed";
  artifacts: string[];
  note?: string;
}

/** Structured final: `{"status":"done","artifacts":[...]}` — never a replayed plan. */
export function taskResult(status: TaskResult["status"], artifacts: string[] = [], note?: string): string {
  const clean = artifacts.map((a) => a.trim()).filter(Boolean).slice(0, 20);
  const payload: TaskResult = note?.trim() ? { status, artifacts: clean, note: note.trim().slice(0, 300) } : { status, artifacts: clean };
  return JSON.stringify(payload);
}

/** Hard cap for summaries/status updates. Truncates with a marker, never throws. */
export function capOutput(text: string, maxTokens: number): string {
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) return "";
  const maxChars = Math.floor(maxTokens) * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + " …[capped]";
}

export const STATUS_UPDATE_TOKENS = 200;
export const SUMMARY_TOKENS = 500;

/** One-line status for progress surfaces. Pure. */
export function statusUpdate(text: string): string {
  const stripped = stripPreamble(text);
  const first = stripped.split("\n").filter((l) => l.trim())[0] ?? "";
  return capOutput(first.trim(), STATUS_UPDATE_TOKENS);
}

export function estimateOutputTokens(text: string): number {
  return estimateTokens(text);
}
