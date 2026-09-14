import { strings } from "../i18n/en";
import { logger } from "../utils/logger";
import { memoryStore } from "./memory.store";
import { parseRemember } from "./parseRemember";
import { suppressKey } from "./policy";
import { isSensitive, redactCheck } from "./redact";
import { showMemoryToast } from "../../components/memory/MemoryToast";
import { uiStore } from "../stores/ui.store";

export interface ExplicitResult {
  handled: boolean;
  /** True for /memory slash commands: skip the server send entirely. */
  intercept: boolean;
}

function excerptOf(text: string): string {
  return text.trim().slice(0, 140);
}

/**
 * Handle explicit memory commands before the prompt is sent.
 * Secrets are never stored AND never sent (intercepted).
 * Sensitive facts go to pending review; the rest save immediately.
 */
export async function handleExplicitMemory(
  text: string,
  ctx: { sessionID: string },
): Promise<ExplicitResult> {
  const parsed = parseRemember(text);
  if (!parsed) return { handled: false, intercept: false };
  const slash = text.trim().startsWith("/memory");
  await memoryStore.load().catch(() => undefined);

  if (parsed.kind === "forget") {
    if (!parsed.key) {
      uiStore.toast(strings.memoryToastNothing, "info");
      return { handled: true, intercept: slash };
    }
    const matches = memoryStore.state.memories.filter(
      (m) => m.status === "active" && (m.key === parsed.key || m.key.includes(parsed.key)),
    );
    if (matches.length === 0) {
      uiStore.toast(strings.memoryToastNothing, "info");
      return { handled: true, intercept: slash };
    }
    const ids = matches.map((m) => m.id);
    for (const id of ids) {
      try {
        await memoryStore.setStatus(id, "archived");
      } catch (err) {
        logger.warn(`Memory forget failed: ${(err as Error).message}`);
      }
    }
    // Suppress re-extraction for 24h so "don't remember that" sticks.
    suppressKey(parsed.key);
    showMemoryToast({
      title: `${strings.memoryToastForgotten}: ${parsed.rawKey}`,
      body: `${matches.length} ${strings.memoryActive} → archived`,
      onUndo: () => {
        void (async () => {
          for (const id of ids) {
            try {
              await memoryStore.setStatus(id, "active");
            } catch {
              // already removed — non-fatal
            }
          }
          uiStore.toast(strings.memoryToastUndone, "success");
        })();
      },
    });
    return { handled: true, intercept: slash };
  }

  // Save path: redact BEFORE storage and before any server send.
  const blocked = redactCheck(parsed.value);
  if (blocked.blocked) {
    showMemoryToast({ title: strings.memoryToastBlocked, body: `${parsed.rawKey} (${blocked.reason ?? "secret"})` });
    logger.warn(`Memory blocked (${blocked.reason}): ${parsed.key}`);
    return { handled: true, intercept: true };
  }

  const source = {
    sessionId: ctx.sessionID,
    messageId: `msg_${Date.now()}`,
    excerpt: excerptOf(text),
    timestamp: Date.now(),
  };
  try {
    if (isSensitive(parsed.category, parsed.key)) {
      const mem = await memoryStore.propose({
        category: parsed.category,
        key: parsed.key,
        value: parsed.value,
        confidence: parsed.confidence,
        sensitive: true,
        source,
      });
      showMemoryToast({
        title: `${strings.memoryToastQueued}: ${parsed.rawKey} → ${parsed.value}`,
        body: strings.memoryReviewQueue,
        onUndo: () => void memoryStore.remove(mem.id).catch(() => undefined),
      });
    } else {
      const mem = await memoryStore.add({
        category: parsed.category,
        key: parsed.key,
        value: parsed.value,
        confidence: parsed.confidence,
        source,
      });
      showMemoryToast({
        title: `${strings.memoryToastSaved}: ${parsed.rawKey} → ${parsed.value}`,
        body: `${mem.category} · ${mem.key}`,
        onUndo: () => void memoryStore.remove(mem.id).catch(() => undefined),
      });
    }
  } catch (err) {
    uiStore.toast((err as Error).message, "error");
  }
  return { handled: true, intercept: slash };
}
