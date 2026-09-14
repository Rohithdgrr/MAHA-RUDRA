import type { Session } from "../backend/types";

export const LAST_DIRECTORY_KEY = "rudra.lastDirectory";

/**
 * Normalize a user-typed folder path for the server.
 * Trims whitespace/quotes, unifies slashes for comparison, and drops a
 * trailing separator (except drive/root). Returns undefined when empty.
 */
export function normalizeDirectory(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  let dir = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!dir) return undefined;
  // Collapse repeated separators but keep UNC (`\\server`) and protocol-free roots intact.
  dir = dir.replace(/\/{2,}/g, "/").replace(/\\{2,}/g, "\\");
  // Drop trailing slash/backslash except for `/`, `C:\`, `C:/`, `\\server\share\` roots.
  if (dir.length > 1 && /[/\\]$/.test(dir) && !/^[A-Za-z]:[/\\]$/.test(dir) && dir !== "/") {
    dir = dir.replace(/[/\\]+$/, "");
  }
  return dir || undefined;
}

/** Last segment of a folder path (`C:\proj\app` → `app`). Pure. */
export function folderBasename(directory: string | null | undefined): string {
  const dir = (directory ?? "").trim().replace(/^["']+|["']+$/g, "");
  if (!dir) return "";
  const cleaned = dir.replace(/[/\\]+$/, "");
  const parts = cleaned.split(/[/\\]+/).filter(Boolean);
  if (parts.length === 0) return cleaned || dir;
  // Keep Windows drive roots readable (`C:` → `C:\`).
  const last = parts[parts.length - 1] as string;
  if (parts.length === 1 && /^[A-Za-z]:$/.test(last)) return `${last}\\`;
  return last;
}

/** Case-insensitive on Windows drives, slash-insensitive everywhere. Pure. */
export function directoriesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeDirectory(a);
  const nb = normalizeDirectory(b);
  if (!na || !nb) return false;
  const unified = (s: string) => s.replace(/\\/g, "/");
  // Windows paths compare case-insensitively; POSIX keeps case.
  if (/^[A-Za-z]:\//.test(unified(na)) && /^[A-Za-z]:\//.test(unified(nb))) {
    return unified(na).toLowerCase() === unified(nb).toLowerCase();
  }
  return unified(na) === unified(nb);
}

export type FolderOpenDecision =
  | { action: "switch"; sessionID: string }
  | { action: "create" };

/**
 * Opening a folder reuses the most recently-updated session already scoped
 * to that directory instead of spawning duplicates. Pure — the caller
 * performs the switch or the create.
 */
export function resolveFolderOpen(
  sessions: Pick<Session, "id" | "directory" | "time">[],
  directory: string | null | undefined,
): FolderOpenDecision {
  const normalized = normalizeDirectory(directory);
  if (!normalized) return { action: "create" };
  const matches = sessions.filter((s) =>
    directoriesEqual((s as { directory?: string }).directory, normalized),
  );
  if (matches.length === 0) return { action: "create" };
  matches.sort((x, y) => (y.time?.updated ?? 0) - (x.time?.updated ?? 0));
  const winner = matches[0];
  if (!winner) return { action: "create" };
  return { action: "switch", sessionID: winner.id };
}

/** Most recent session still present after a delete — the switch target. Pure. */
export function nextSessionAfterDelete(
  sessions: Pick<Session, "id" | "time">[],
  deletedID: string,
): string | undefined {
  const rest = sessions
    .filter((s) => s.id !== deletedID)
    .sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0));
  return rest[0]?.id;
}

export function loadLastDirectory(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    return window.localStorage.getItem(LAST_DIRECTORY_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveLastDirectory(directory: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const normalized = normalizeDirectory(directory);
    if (normalized) window.localStorage.setItem(LAST_DIRECTORY_KEY, normalized);
  } catch {
    // storage unavailable — non-fatal
  }
}
