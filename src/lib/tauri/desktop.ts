import { sessionStore } from "../stores/session.store";
import { isTauri } from "../utils/env";
import { logger } from "../utils/logger";

export const LONG_TURN_MS = 30_000;

export type Unlisten = () => void;
const noopUnlisten: Unlisten = () => undefined;

export function isDesktop(): boolean {
  return isTauri();
}

async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/**
 * Subscribe to a Rust-emitted event. Web-safe: no Tauri runtime, no
 * subscription — returns a no-op cleanup. The dynamic import keeps
 * `@tauri-apps/api` out of the web bundle path until used.
 */
export function onDesktopEvent<T>(event: string, cb: (payload: T) => void): Unlisten {
  if (!isDesktop()) return noopUnlisten;
  let unlisten: Unlisten | undefined;
  void (async () => {
    try {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<T>(event, (e) => cb(e.payload));
    } catch (err) {
      logger.warn(`desktop listen failed for ${event}: ${(err as Error).message}`);
    }
  })();
  return () => unlisten?.();
}

/** Native folder picker. Null on web or cancel. */
export async function pickFolder(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return await invokeCmd<string | null>("pick_workspace_folder");
  } catch (err) {
    logger.warn(`pick folder failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Open a folder (or file) in the OS file manager (Explorer/Finder/xdg-open).
 * Returns true when the native command was dispatched. False on web or error.
 */
export async function openInFileManager(path: string): Promise<boolean> {
  if (!isDesktop()) return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  try {
    await invokeCmd("open_path_in_file_manager", { path: trimmed });
    return true;
  } catch (err) {
    logger.warn(`open in file manager failed: ${(err as Error).message}`);
    return false;
  }
}

export interface UpdateStatus {
  state: "uptodate" | "downloaded" | "error";
  version?: string;
  detail?: string;
}

/** Updater check. Never throws — errors come back as `{ state: "error" }`. */
export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!isDesktop()) return { state: "error", detail: "desktop-only" };
  try {
    return await invokeCmd<UpdateStatus>("check_for_updates");
  } catch (err) {
    return { state: "error", detail: (err as Error).message };
  }
}

/** First-launch open target (CLI folder arg or `rudra://` URL), one-shot. */
export async function takeStartupPath(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return await invokeCmd<string | null>("take_startup_path");
  } catch {
    return null;
  }
}

async function notifyTurnComplete(title: string, body: string): Promise<void> {
  if (!isDesktop()) return;
  try {
    await invokeCmd("notify_turn_complete", { title, body });
  } catch (err) {
    logger.warn(`notify failed: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Open-target parsing (`rudra://session/<id>`, `rudra://open?path=…`, or a
// raw folder path from CLI / single-instance forwarding). Pure, tested.
// ---------------------------------------------------------------------------

export type OpenTarget =
  | { kind: "session"; id: string }
  | { kind: "path"; path: string };

export function parseOpenTarget(raw: string | null | undefined): OpenTarget | undefined {
  if (!raw) return undefined;
  const input = raw.trim().replace(/^["']|["']$/g, "");
  if (!input) return undefined;
  try {
    if (input.startsWith("rudra://")) {
      const url = new URL(input);
      if (url.hostname === "session" && url.pathname.length > 1) {
        return { kind: "session", id: decodeURIComponent(url.pathname.slice(1)) };
      }
      if (url.hostname === "open") {
        const path = url.searchParams.get("path");
        if (path) return { kind: "path", path };
      }
      return undefined;
    }
  } catch {
    return undefined;
  }
  if (/^[a-zA-Z]+:\/\//.test(input)) return undefined;
  return { kind: "path", path: input };
}

// ---------------------------------------------------------------------------
// Long-turn notifications (>30s, window in background). Pure timing core,
// tested; the Tauri call stays guarded.
// ---------------------------------------------------------------------------

const turnStart = new Map<string, number>();

export function notePromptSent(sessionID: string): void {
  turnStart.set(sessionID, Date.now());
}

export function consumeTurnElapsed(sessionID: string): number | undefined {
  const started = turnStart.get(sessionID);
  turnStart.delete(sessionID);
  return started === undefined ? undefined : Date.now() - started;
}

export async function maybeNotifyTurnComplete(
  sessionID: string,
  turnTitle: string,
  turnBody: (title: string, secs: number) => string,
): Promise<void> {
  const elapsed = consumeTurnElapsed(sessionID);
  if (elapsed === undefined || elapsed < LONG_TURN_MS || !isDesktop()) return;
  if (typeof document !== "undefined" && !document.hidden) return;
  const session = sessionStore.state.sessions.find((s) => s.id === sessionID);
  const title = session?.title?.trim() || sessionID;
  await notifyTurnComplete(turnTitle, turnBody(title, Math.round(elapsed / 1000)));
}
