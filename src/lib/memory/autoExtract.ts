import { adapter } from "../backend";
import type { Unsubscribe } from "../backend/types";
import { messageStore } from "../stores/message.store";
import { uiStore } from "../stores/ui.store";
import { extractText } from "../utils/markdown";
import { logger } from "../utils/logger";
import { showMemoryToast } from "../../components/memory/MemoryToast";
import { strings } from "../i18n/en";
import { buildTranscript, parseExtractionJson } from "./extract";
import { EXTRACT_SYSTEM_PROMPT, buildExtractionText } from "./extract.prompt";
import { memoryStore } from "./memory.store";
import { classifyCandidate, dedupeCandidates } from "./normalize";
import { isSuppressed, REVIEW_THRESHOLD, routeCandidate } from "./policy";
import { isSensitive } from "./redact";

const DEBOUNCE_MS = 45000;
const IDLE_WAIT_MS = 90000;
const EXTRACT_TITLE = "memory-extract";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const ignored = new Set<string>();
let running = false;

function clearTimer(sessionId: string): void {
  const t = timers.get(sessionId);
  if (t) {
    clearTimeout(t);
    timers.delete(sessionId);
  }
}

function waitForIdle(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsub();
      resolve();
    }, IDLE_WAIT_MS);
    const unsub = adapter.subscribeToEvents((e) => {
      if (e.type === "session.idle" && e.properties.sessionID === sessionId) {
        clearTimeout(timeout);
        unsub();
        resolve();
      }
    });
  });
}

function lastAssistantText(
  messages: { info: { role?: string } | unknown; parts: { type: string; text?: string }[] }[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m) continue;
    if ((m.info as { role?: string }).role === "user") continue;
    const text = extractText(m.parts ?? []).trim();
    if (text) return text;
  }
  return "";
}

/** Run one review-only extraction pass for a session. Everything lands in pending. */
export async function runExtraction(sessionId: string): Promise<number> {
  if (running || !adapter.isConnected() || ignored.has(sessionId)) return 0;
  const transcript = buildTranscript(messageStore.messagesFor(sessionId));
  if (transcript.trim().length < 20) return 0;
  running = true;
  let extractId: string | undefined;
  try {
    await memoryStore.load().catch(() => undefined);
    const session = await adapter.createSession({ title: EXTRACT_TITLE });
    extractId = session.id;
    ignored.add(extractId);
    await adapter.sendPrompt({
      sessionID: extractId,
      text: buildExtractionText(transcript),
      system: EXTRACT_SYSTEM_PROMPT,
    });
    await waitForIdle(extractId);
    const messages = await adapter.getMessages(extractId);
    const candidates = dedupeCandidates(parseExtractionJson(lastAssistantText(messages as never[])));
    const autoSave = uiStore.state.prefs.memoryAutoSave;
    let queued = 0;
    const savedIds: string[] = [];
    for (const c of candidates) {
      if (c.confidence < REVIEW_THRESHOLD) continue;
      if (isSuppressed(c.key)) continue;
      const sensitive = isSensitive(c.category, c.key);
      const cls = classifyCandidate(memoryStore.state.memories, c);
      if (cls.action === "confirm" && cls.existingId) {
        await memoryStore.confirm(cls.existingId).catch(() => undefined);
        continue;
      }
      const source = { sessionId, messageId: `extract_${Date.now()}`, excerpt: c.excerpt, timestamp: Date.now() };
      // Conflicts always need a human pick — never silent-overwrite.
      if (cls.action === "conflict") {
        await memoryStore
          .propose({ category: c.category, key: c.key, value: c.value, confidence: c.confidence, sensitive, source })
          .catch(() => undefined);
        queued++;
        continue;
      }
      const route = autoSave ? routeCandidate(c.confidence, sensitive) : "review";
      if (route === "drop") continue;
      if (route === "auto") {
        const saved = await memoryStore
          .add({ category: c.category, key: c.key, value: c.value, confidence: c.confidence, sensitive: false, source })
          .catch(() => undefined);
        if (saved) savedIds.push(saved.id);
      } else {
        await memoryStore
          .propose({ category: c.category, key: c.key, value: c.value, confidence: c.confidence, sensitive, source })
          .catch(() => undefined);
        queued++;
      }
    }
    if (savedIds.length > 0) {
      showMemoryToast({
        title: `${strings.memoryToastSaved} (${savedIds.length})`,
        body: strings.memoryFromSession,
        onUndo: () => {
          void (async () => {
            for (const id of savedIds) await memoryStore.remove(id).catch(() => undefined);
            uiStore.toast(strings.memoryToastUndone, "success");
          })();
        },
      });
    }
    if (queued > 0) uiStore.toast(`${queued} memories awaiting review`, "info");
    return queued + savedIds.length;
  } catch (err) {
    logger.warn(`Memory extraction failed: ${(err as Error).message}`);
    return 0;
  } finally {
    running = false;
    if (extractId) {
      ignored.delete(extractId);
      await adapter.deleteSession(extractId).catch(() => undefined);
    }
  }
}

function schedule(sessionId: string): void {
  if (!sessionId || sessionId.startsWith("demo") || ignored.has(sessionId)) return;
  clearTimer(sessionId);
  timers.set(
    sessionId,
    setTimeout(() => {
      timers.delete(sessionId);
      void runExtraction(sessionId);
    }, DEBOUNCE_MS),
  );
}

/** Subscribe once from AppShell. Debounced 45s after each turn idle. */
export function initMemoryExtraction(): Unsubscribe {
  void memoryStore.load().catch(() => undefined);
  const unsub = adapter.subscribeToEvents((e) => {
    if (e.type === "session.idle") schedule(e.properties.sessionID);
  });
  return () => {
    unsub();
    for (const id of [...timers.keys()]) clearTimer(id);
  };
}
