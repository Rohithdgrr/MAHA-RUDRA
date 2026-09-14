import { createStore } from "solid-js/store";
import type { Message, MessageWithParts, Part } from "../backend/types";

interface MessageState {
  bySession: Record<string, MessageWithParts[]>;
  sending: boolean;
  error: string | undefined;
}

const [state, setState] = createStore<MessageState>({
  bySession: {},
  sending: false,
  error: undefined,
});

function findIndex(sessionID: string, messageID: string): number {
  return (state.bySession[sessionID] ?? []).findIndex((m) => m.info.id === messageID);
}

export const messageStore = {
  get state() {
    return state;
  },
  messagesFor(sessionID: string | undefined): MessageWithParts[] {
    if (!sessionID) return [];
    return state.bySession[sessionID] ?? [];
  },
  setMessages(sessionID: string, messages: MessageWithParts[]) {
    setState("bySession", sessionID, messages);
  },
  /** Live-apply `message.updated`: insert or replace the message shell, keeping parts. */
  upsertMessage(sessionID: string, info: Message) {
    const list = state.bySession[sessionID] ?? [];
    const idx = list.findIndex((m) => m.info.id === info.id);
    if (idx === -1) {
      setState("bySession", sessionID, [...list, { info, parts: [] }]);
    } else {
      setState("bySession", sessionID, idx, "info", info);
    }
  },
  /**
   * Live-apply `message.part.updated`. When `delta` is present and the
   * existing part carries a `text` field, the delta is appended so the UI
   * streams token-by-token; otherwise the part is replaced wholesale.
   */
  upsertPart(sessionID: string, part: Part, delta?: string) {
    const list = state.bySession[sessionID] ?? [];
    const midx = list.findIndex((m) => m.info.id === part.messageID);
    if (midx === -1) return;
    const entry = list[midx];
    if (!entry) return;
    const parts = entry.parts;
    const pidx = parts.findIndex((p) => p.id === part.id);
    if (pidx === -1) {
      setState("bySession", sessionID, midx, "parts", [...parts, part]);
      return;
    }
    const existing = parts[pidx] as Record<string, unknown> | undefined;
    if (delta && existing && "text" in existing && "text" in (part as Record<string, unknown>)) {
      const prev = (existing as unknown as { text: string }).text ?? "";
      setState("bySession", sessionID, midx, "parts", pidx, { ...(part as object), text: prev + delta } as Part);
    } else {
      setState("bySession", sessionID, midx, "parts", pidx, part);
    }
  },
  removePart(sessionID: string, messageID: string, partID: string) {
    const idx = findIndex(sessionID, messageID);
    if (idx === -1) return;
    setState("bySession", sessionID, idx, "parts", (prev) => prev.filter((p) => p.id !== partID));
  },
  removeMessage(sessionID: string, messageID: string) {
    const list = state.bySession[sessionID] ?? [];
    if (!list.some((m) => m.info.id === messageID)) return;
    setState("bySession", sessionID, list.filter((m) => m.info.id !== messageID));
  },
  setSending(sending: boolean) {
    setState("sending", sending);
  },
  setError(error: string | undefined) {
    setState("error", error);
  },
};
