import { adapter } from "../backend";
import type { RudraEvent, Unsubscribe } from "../backend/types";
import { messageStore } from "../stores/message.store";
import { sessionStore } from "../stores/session.store";
import { uiStore } from "../stores/ui.store";
import { maybeNotifyTurnComplete } from "../tauri/desktop";
import { logger } from "../utils/logger";
import { strings } from "../i18n/en";

interface QueryInvalidator {
  invalidateQueries: (filters: { queryKey: unknown[] }) => unknown;
}

/**
 * Single fan-out point for server SSE: patch the local stores live so the
 * UI streams, and invalidate TanStack queries where server truth wins
 * (session list changes, end-of-turn reconciliation).
 */
export function handleRudraEvent(event: RudraEvent, queries?: QueryInvalidator): void {
  switch (event.type) {
    case "session.created":
      if (event.properties.session) sessionStore.upsertSession(event.properties.session);
      void queries?.invalidateQueries({ queryKey: ["sessions"] });
      break;
    case "session.updated":
      if (event.properties.session) sessionStore.upsertSession(event.properties.session);
      else void queries?.invalidateQueries({ queryKey: ["sessions"] });
      break;
    case "session.deleted":
      sessionStore.removeSession(event.properties.sessionID);
      void queries?.invalidateQueries({ queryKey: ["sessions"] });
      break;
    case "session.status":
      sessionStore.setStatus(event.properties.sessionID, event.properties.status);
      break;
    case "session.idle":
      sessionStore.markIdle(event.properties.sessionID);
      // Reconcile with server truth at end of turn (covers missed deltas).
      void queries?.invalidateQueries({ queryKey: ["messages", event.properties.sessionID] });
      void queries?.invalidateQueries({ queryKey: ["sessions"] });
      // Desktop: native notification for long background turns.
      void maybeNotifyTurnComplete(
        event.properties.sessionID,
        strings.turnComplete,
        (title, secs) => `${title} · ${secs}s`,
      );
      break;
    case "session.error":
      logger.error(event.properties.message);
      uiStore.toast(event.properties.message, "error");
      if (event.properties.sessionID) sessionStore.markIdle(event.properties.sessionID);
      break;
    case "message.updated":
      messageStore.upsertMessage(event.properties.sessionID, event.properties.message);
      break;
    case "message.removed":
      messageStore.removeMessage(event.properties.sessionID, event.properties.messageID);
      break;
    case "message.part.updated":
      messageStore.upsertPart(
        event.properties.sessionID,
        event.properties.part,
        event.properties.delta,
      );
      break;
    case "message.part.removed":
      messageStore.removePart(
        event.properties.sessionID,
        event.properties.messageID,
        event.properties.partID,
      );
      break;
    case "tool.execution.started":
    case "tool.execution.completed":
      // Legacy aliases: modern servers send message.part.updated for tools.
      void queries?.invalidateQueries({ queryKey: ["messages", event.properties.sessionID] });
      break;
    case "server.connected":
    case "error":
      if (event.properties && "message" in event.properties && event.properties.message) {
        uiStore.toast(event.properties.message, "error");
      }
      break;
  }
}

/** Subscribe the app shell once; returns the unsubscribe function. */
export function subscribeAppEvents(queries?: QueryInvalidator): Unsubscribe {
  return adapter.subscribeToEvents((event) => handleRudraEvent(event, queries));
}
