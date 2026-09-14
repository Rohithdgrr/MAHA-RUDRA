import { describe, expect, it } from "vitest";
import {
  defaultAgents,
  findChoice,
  resolveAgentPrompt,
  resolveStoredAgent,
  toAgentChoices,
} from "./agents";
import type { Agent } from "../backend/types";

function serverAgent(name: string, mode: Agent["mode"] = "primary"): Agent {
  return { name, mode, builtIn: true, permission: { edit: "ask", bash: {} } } as unknown as Agent;
}

describe("toAgentChoices", () => {
  it("lists server agents first, skips subagents, appends local personas", () => {
    const choices = toAgentChoices([serverAgent("build"), serverAgent("helper", "subagent")]);
    expect(choices.map((c) => c.id)).toEqual([
      "server:build",
      ...defaultAgents.map((p) => `local:${p.id}`),
    ]);
    expect(choices[0]).toMatchObject({ kind: "server", name: "build" });
  });

  it("works with no server agents", () => {
    expect(toAgentChoices([]).every((c) => c.kind === "local")).toBe(true);
  });
});

describe("resolveAgentPrompt", () => {
  it("passes server agent names through", () => {
    expect(resolveAgentPrompt({ kind: "server", id: "server:build", name: "build" })).toEqual({
      agent: "build",
    });
  });

  it("expands local personas to system prompts", () => {
    const out = resolveAgentPrompt({
      kind: "local",
      id: "local:rudra-default",
      name: "Rudra",
      persona: defaultAgents[0]!,
    });
    expect(out.system).toContain("RUDRA");
    expect(out.agent).toBeUndefined();
  });

  it("returns empty for no choice", () => {
    expect(resolveAgentPrompt(undefined)).toEqual({});
  });
});

describe("resolveStoredAgent", () => {
  it("resolves stored ids without a server round-trip", () => {
    expect(resolveStoredAgent("server:build")).toEqual({ agent: "build" });
    expect(resolveStoredAgent("local:rudra-reviewer").system).toContain("reviewer");
    expect(resolveStoredAgent(undefined)).toEqual({});
    expect(resolveStoredAgent("local:nope")).toEqual({});
    expect(resolveStoredAgent("garbage")).toEqual({});
  });

  it("findChoice matches stored ids", () => {
    const choices = toAgentChoices([serverAgent("build")]);
    expect(findChoice(choices, "server:build")?.name).toBe("build");
    expect(findChoice(choices, "server:gone")).toBeUndefined();
    expect(findChoice(choices, undefined)).toBeUndefined();
  });
});
