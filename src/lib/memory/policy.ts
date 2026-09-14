/** Phase 4: auto-save routing + 24h suppression. Pure except suppression storage. */

export const AUTO_SAVE_THRESHOLD = 0.8;
export const REVIEW_THRESHOLD = 0.4;
const SUPPRESS_KEY = "rudra.memory.suppressed.v1";
const SUPPRESS_TTL_MS = 24 * 60 * 60 * 1000;

export type Route = "auto" | "review" | "drop";

/** conf ≥ 0.8 + not sensitive → auto; ≥ 0.4 or sensitive → review; else drop. */
export function routeCandidate(confidence: number, sensitive: boolean): Route {
  if (sensitive) return confidence >= REVIEW_THRESHOLD ? "review" : "drop";
  if (confidence >= AUTO_SAVE_THRESHOLD) return "auto";
  if (confidence >= REVIEW_THRESHOLD) return "review";
  return "drop";
}

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SUPPRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUPPRESS_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — non-fatal
  }
}

export function suppressKey(key: string): void {
  const k = key.trim().toLowerCase();
  if (!k) return;
  const map = readMap();
  map[k] = Date.now() + SUPPRESS_TTL_MS;
  writeMap(map);
}

export function isSuppressed(key: string, now = Date.now()): boolean {
  const k = key.trim().toLowerCase();
  if (!k) return false;
  const map = readMap();
  const exp = map[k];
  if (exp === undefined) return false;
  if (exp <= now) {
    delete map[k];
    writeMap(map);
    return false;
  }
  return true;
}
