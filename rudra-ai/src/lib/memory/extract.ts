import type { MessageWithParts } from "../backend/types";
import { extractText } from "../utils/markdown";
import { normalizeKey } from "./store";
import { isMemoryCategory } from "./types";
import type { ExtractedCandidate } from "./normalize";
import { redactCheck } from "./redact";

const MAX_TURNS = 10;
const MAX_CHARS = 4000;

function roleOf(m: MessageWithParts): string {
  return ((m.info as unknown as { role?: string }).role === "user" ? "user" : "assistant");
}

/** Last N turns as `user: … / assistant: …` lines, truncated. Pure. */
export function buildTranscript(messages: MessageWithParts[]): string {
  const tail = messages.slice(-MAX_TURNS);
  const lines: string[] = [];
  for (const m of tail) {
    const text = extractText((m.parts ?? []) as { type: string; text?: string }[]).trim();
    if (!text) continue;
    lines.push(`${roleOf(m)}: ${text.slice(0, 800)}`);
  }
  return lines.join("\n").slice(0, MAX_CHARS);
}

function clampConfidence(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6;
}

/**
 * Parse the model's JSON array. Tolerant of fences/prose; strict on shape.
 * Drops blocked secrets and invalid categories — never throws for bad input.
 */
export function parseExtractionJson(raw: string): ExtractedCandidate[] {
  if (!raw.trim()) return [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ExtractedCandidate[] = [];
  for (const item of parsed.slice(0, 20)) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (!isMemoryCategory(r.category)) continue;
    const key = normalizeKey(typeof r.key === "string" ? r.key : "");
    if (!key) continue;
    const value = (r.value ?? "") as ExtractedCandidate["value"];
    if (redactCheck(value).blocked) continue;
    if (typeof r.excerpt === "string" && redactCheck(r.excerpt).blocked) continue;
    out.push({
      category: r.category,
      key,
      value: typeof value === "string" ? value.slice(0, 2000) : value,
      confidence: clampConfidence(r.confidence),
      excerpt: typeof r.excerpt === "string" ? r.excerpt.slice(0, 280) : "",
    });
  }
  return out;
}
