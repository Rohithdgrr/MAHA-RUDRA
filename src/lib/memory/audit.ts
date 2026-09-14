/** Phase 7: capped local audit ring. Sync, never throws — auditing must not break writes. */

export type AuditAction =
  | "add"
  | "propose"
  | "approve"
  | "reject"
  | "confirm"
  | "update"
  | "status"
  | "remove"
  | "clear"
  | "inject";

export interface AuditEntry {
  ts: number;
  action: AuditAction;
  memoryId?: string;
  sessionId?: string;
  detail?: string;
}

export const AUDIT_STORAGE_KEY = "rudra.memory.audit.v1";
export const AUDIT_CAP = 1000;

function readRaw(): unknown {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function valid(e: unknown): e is AuditEntry {
  if (typeof e !== "object" || e === null) return false;
  const r = e as Record<string, unknown>;
  return typeof r.ts === "number" && typeof r.action === "string";
}

/** Newest-first. Corrupt entries are dropped. */
export function listAudit(): AuditEntry[] {
  const raw = readRaw();
  if (!Array.isArray(raw)) return [];
  return raw.filter(valid).sort((a, b) => b.ts - a.ts);
}

export function logAudit(
  action: AuditAction,
  opts: { memoryId?: string; sessionId?: string; detail?: string } = {},
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = readRaw();
    const all: AuditEntry[] = Array.isArray(raw) ? raw.filter(valid) : [];
    all.push({ ts: Date.now(), action, ...opts });
    const trimmed = all.slice(-AUDIT_CAP);
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // auditing is best-effort
  }
}

export function clearAudit(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
