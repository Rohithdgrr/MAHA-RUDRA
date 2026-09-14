import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRudraEvent } from "./events";
import type { Message, Part, Session } from "../backend/types";
import { messageStore } from "../stores/message.store";
import { sessionStore } from "../stores/session.store";

const queries = () => ({ invalidateQueries: vi.fn() });

function userMessage(sessionID: string, id: string): Message {
  return {
    id,
    sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "default",
    model: { providerID: "p", modelID: "m" },
  } as unknown as Message;
}

function textPart(sessionID: string, messageID: string, id: string, text: string): Part {
  return { id, sessionID, messageID, type: "text", text } as unknown as Part;
}

function session(id: string): Session {
  return {
    id,
    projectID: "prj",
    directory: "/tmp",
    title: "t",
    version: "1",
    time: { created: 1, updated: 2 },
  } as unknown as Session;
}

beforeEach(() => {
  messageStore.setSending(false);
  messageStore.setError(undefined);
});

describe("handleRudraEvent", () => {
  it("streams text deltas by appending to the existing part", () => {
    const sid = "evt-delta";
    messageStore.setMessages(sid, [{ info: userMessage(sid, "m1"), parts: [] }]);
    const q = queries();
    handleRudraEvent(
      {
        type: "message.part.updated",
        properties: { sessionID: sid, messageID: "m1", partID: "p1", part: textPart(sid, "m1", "p1", "hello") },
      },
      q,
    );
    handleRudraEvent(
      {
        type: "message.part.updated",
        properties: {
          sessionID: sid,
          messageID: "m1",
          partID: "p1",
          part: textPart(sid, "m1", "p1", "hello"),
          delta: " world",
        },
      },
      q,
    );
    const parts = messageStore.messagesFor(sid)[0]?.parts as Array<{ text: string }>;
    expect(parts).toHaveLength(1);
    expect(parts[0]?.text).toBe("hello world");
  });

  it("replaces tool parts wholesale (no text append)", () => {
    const sid = "evt-tool";
    messageStore.setMessages(sid, [{ info: userMessage(sid, "m1"), parts: [] }]);
    const running = {
      id: "t1",
      sessionID: sid,
      messageID: "m1",
      type: "tool",
      callID: "c1",
      tool: "bash",
      state: { status: "running", input: { cmd: "ls" }, time: { start: 1 } },
    } as unknown as Part;
    const done = {
      id: "t1",
      sessionID: sid,
      messageID: "m1",
      type: "tool",
      callID: "c1",
      tool: "bash",
      state: { status: "completed", input: { cmd: "ls" }, output: "ok", title: "ls", metadata: {}, time: { start: 1, end: 2 } },
    } as unknown as Part;
    handleRudraEvent(
      { type: "message.part.updated", properties: { sessionID: sid, messageID: "m1", partID: "t1", part: running } },
      queries(),
    );
    handleRudraEvent(
      { type: "message.part.updated", properties: { sessionID: sid, messageID: "m1", partID: "t1", part: done } },
      queries(),
    );
    const parts = messageStore.messagesFor(sid)[0]?.parts as Array<{ state: { status: string } }>;
    expect(parts).toHaveLength(1);
    expect(parts[0]?.state.status).toBe("completed");
  });

  it("tracks session busy status and reconciles on idle", () => {
    const sid = "evt-status";
    const q = queries();
    handleRudraEvent(
      { type: "session.status", properties: { sessionID: sid, status: { type: "busy" } } },
      q,
    );
    expect(sessionStore.isBusy(sid)).toBe(true);
    handleRudraEvent({ type: "session.idle", properties: { sessionID: sid } }, q);
    expect(sessionStore.isBusy(sid)).toBe(false);
    expect(q.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["messages", sid] });
  });

  it("upserts sessions from created events and invalidates the list", () => {
    const sid = "evt-created";
    const q = queries();
    handleRudraEvent({ type: "session.created", properties: { sessionID: sid, session: session(sid) } }, q);
    expect(sessionStore.state.sessions.some((s) => s.id === sid)).toBe(true);
    expect(q.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["sessions"] });
    sessionStore.removeSession(sid);
  });

  it("removes messages and parts", () => {
    const sid = "evt-remove";
    messageStore.setMessages(sid, [
      { info: userMessage(sid, "m1"), parts: [textPart(sid, "m1", "p1", "hi")] },
    ]);
    const q = queries();
    handleRudraEvent({ type: "message.part.removed", properties: { sessionID: sid, messageID: "m1", partID: "p1" } }, q);
    expect(messageStore.messagesFor(sid)[0]?.parts).toHaveLength(0);
    handleRudraEvent({ type: "message.removed", properties: { sessionID: sid, messageID: "m1" } }, q);
    expect(messageStore.messagesFor(sid)).toHaveLength(0);
  });
});
