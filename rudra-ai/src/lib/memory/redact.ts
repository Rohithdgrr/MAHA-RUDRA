import type { MemoryCategory } from "./types";

/**
 * Synchronous client-side secret filter. Runs BEFORE any server round-trip
 * (including the Phase 3 extraction pass) — a blocked value must never be
 * stored OR sent to the server for extraction.
 */

const PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /sk-(ant|proj)-[A-Za-z0-9-_]{8,}|sk-[A-Za-z0-9]{16,}/, reason: "api-key" },
  { re: /ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{10,}/, reason: "github-token" },
  { re: /xox[bap]-?[A-Za-z0-9-]{8,}/, reason: "slack-token" },
  { re: /AKIA[0-9A-Z]{16}/, reason: "aws-key" },
  { re: /eyJ[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]{8,}\.[A-Za-z0-9-_]{8,}/, reason: "jwt" },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, reason: "private-key" },
  { re: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, reason: "card-number" },
  { re: /\b[-\u2011]?\d{1,3}\.\d{5,},\s*[-\u2011]?\d{1,3}\.\d{5,}\b/, reason: "coordinates" },
];

const PASSWORD_HINT = /(password|passwd|secret|api[_-]?key|auth[_-]?token)\s*[:=]\s*\S+/i;

export interface RedactResult {
  blocked: boolean;
  reason?: string;
}

function flatten(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

/** True when the raw text looks like a secret that must never be stored. */
export function redactCheck(value: unknown): RedactResult {
  const text = flatten(value);
  if (!text) return { blocked: false };
  for (const p of PATTERNS) {
    if (p.re.test(text)) return { blocked: true, reason: p.reason };
  }
  if (PASSWORD_HINT.test(text)) return { blocked: true, reason: "password" };
  return { blocked: false };
}

/** Contact + precise-location keys always need review + opt-in injection. */
export function isSensitive(category: MemoryCategory, key: string): boolean {
  if (category === "contact") return true;
  const k = key.toLowerCase();
  return (
    k.includes("email") ||
    k.includes("phone") ||
    k.includes("address") ||
    k.includes("employer") ||
    k.includes("location")
  );
}
