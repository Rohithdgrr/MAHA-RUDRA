import { adapter } from "../backend";
import { strings } from "../i18n/en";
import { messageStore } from "../stores/message.store";
import { sessionStore } from "../stores/session.store";
import { uiStore } from "../stores/ui.store";
import { logger } from "../utils/logger";
import {
  nextSessionAfterDelete,
  normalizeDirectory,
  resolveFolderOpen,
  saveLastDirectory,
} from "./folders";

export type Navigate = (to: string) => void;
export type InvalidateSessions = () => Promise<unknown> | unknown;

/**
 * Shared session/folder workflow. Route params own `activeID` (Workspace
 * syncs it); these helpers only navigate + keep the store/query warm so
 * every entry point (sidebar, palette, deep link, delete) behaves the same.
 */

export function switchSession(navigate: Navigate, id: string): void {
  messageStore.setError(undefined);
  sessionStore.setActive(id);
  navigate(`/s/${id}`);
}

export async function createSessionAndGo(
  navigate: Navigate,
  invalidate?: InvalidateSessions,
  directory?: string,
): Promise<void> {
  const normalized = normalizeDirectory(directory);
  try {
    const session = await adapter.createSession({
      title: strings.newSessionTitle,
      ...(normalized ? { directory: normalized } : {}),
    });
    if (normalized) saveLastDirectory(normalized);
    sessionStore.addSession(session);
    try {
      await invalidate?.();
    } catch (err) {
      logger.warn(`Session list refresh failed: ${(err as Error).message}`);
    }
    switchSession(navigate, session.id);
  } catch (err) {
    logger.error(err);
    uiStore.toast((err as Error).message, "error");
  }
}

/**
 * Open a folder: switch to the existing session for that directory when
 * there is one, otherwise create a scoped session. Prevents duplicate
 * sessions piling up for the same folder.
 */
export async function openFolderSession(
  navigate: Navigate,
  invalidate?: InvalidateSessions,
  directory?: string,
  opts: { forceNew?: boolean } = {},
): Promise<void> {
  const normalized = normalizeDirectory(directory);
  if (!normalized) {
    uiStore.toast(strings.folderPathRequired, "error");
    return;
  }
  if (!opts.forceNew) {
    const decision = resolveFolderOpen(sessionStore.state.sessions, normalized);
    if (decision.action === "switch") {
      uiStore.toast(strings.folderSessionReused, "info");
      switchSession(navigate, decision.sessionID);
      return;
    }
  }
  await createSessionAndGo(navigate, invalidate, normalized);
}

/** Delete a session; when it was active, land on the next session or home. */
export async function deleteSessionAndLeave(
  navigate: Navigate,
  id: string,
  invalidate?: InvalidateSessions,
): Promise<void> {
  const wasActive = sessionStore.state.activeID === id;
  const fallback = wasActive ? nextSessionAfterDelete(sessionStore.state.sessions, id) : undefined;
  try {
    await adapter.deleteSession(id);
    sessionStore.removeSession(id);
    try {
      await invalidate?.();
    } catch (err) {
      logger.warn(`Session list refresh failed: ${(err as Error).message}`);
    }
    if (wasActive) {
      messageStore.setError(undefined);
      if (fallback) switchSession(navigate, fallback);
      else {
        sessionStore.setActive(undefined);
        navigate("/");
      }
    }
    uiStore.toast(strings.sessionDeleted, "success");
  } catch (err) {
    logger.error(err);
    uiStore.toast((err as Error).message, "error");
  }
}

/**
 * Ensure the routed session exists locally (deep link / reload before the
 * list arrives). Returns false when the id is unknown — the caller should
 * navigate home.
 */
export async function ensureSessionLoaded(id: string): Promise<boolean> {
  if (sessionStore.state.sessions.some((s) => s.id === id)) return true;
  try {
    const session = await adapter.getSession(id);
    sessionStore.upsertSession(session);
    return true;
  } catch {
    return false;
  }
}
