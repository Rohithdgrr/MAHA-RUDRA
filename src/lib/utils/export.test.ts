import { describe, expect, it } from "vitest";
import { sessionFilename, sessionToMarkdown } from "./export";
import type { MessageWithParts, Session } from "../backend/types";

function session(): Session {
  return {
    id: "ses_abc123",
    projectID: "p",
    directory: "/tmp",
    title: "My chat",
    version: "1",
    time: { created: 1, updated: 1700000000000 },
  } as unknown as Session;
}

function textMessage(role: "user" | "assistant", text: string): MessageWithParts {
  return {
    info: { id: `${role}-1`, sessionID: "ses_abc123", role, time: { created: 1 } },
    parts: [{ id: "p1", sessionID: "ses_abc123", messageID: `${role}-1`, type: "text", text }],
  } as unknown as MessageWithParts;
}

describe("sessionToMarkdown", () => {
  it("renders a transcript with role headings", () => {
    const md = sessionToMarkdown(session(), [textMessage("user", "hi"), textMessage("assistant", "hello")]);
    expect(md).toContain("# My chat");
    expect(md).toContain("## You");
    expect(md).toContain("## RUDRA");
    expect(md).toContain("hello");
  });

  it("summarizes non-text parts instead of dropping the turn", () => {
    const toolMsg: MessageWithParts = {
      info: { id: "a-1", sessionID: "s", role: "assistant", time: { created: 1 } },
      parts: [{ id: "t1", sessionID: "s", messageID: "a-1", type: "tool", tool: "bash" }],
    } as unknown as MessageWithParts;
    expect(sessionToMarkdown(undefined, [toolMsg])).toContain("[tool part]");
  });

  it("falls back to an untitled heading without a session", () => {
    expect(sessionToMarkdown(undefined, [])).toContain("# Untitled session");
  });
});

describe("sessionFilename", () => {
  it("slugifies the title", () => {
    expect(sessionFilename(session(), "ses_abc123")).toBe("rudra-my-chat-ses_abc1.md");
  });
});
