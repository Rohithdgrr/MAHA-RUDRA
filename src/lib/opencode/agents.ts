import { adapter } from "../backend";
import type { Agent, SendPromptInput } from "../backend/types";

const AGENT_KEY = "rudra.agent";

export interface AgentPersona {
  id: string;
  name: string;
  systemPrompt: string;
  model?: { providerID: string; modelID: string };
  allowedTools?: Record<string, boolean>;
}

/** Local personas: work on any server via the prompt `system` override. */
export const defaultAgents: AgentPersona[] = [
  {
    id: "rudra-default",
    name: "Rudra",
    systemPrompt: "You are RUDRA, a terse senior engineer. Answer with code first, minimal prose.",
  },
  {
    id: "rudra-explainer",
    name: "Explainer",
    systemPrompt:
      "You are RUDRA Explainer, a patient teacher. Explain concepts with simple analogies, then concrete examples. Avoid jargon unless you define it.",
  },
  {
    id: "rudra-reviewer",
    name: "Reviewer",
    systemPrompt:
      "You are RUDRA Reviewer, a strict code reviewer. List issues by severity (blocker/major/minor), cite the exact code, and propose concrete fixes. Praise nothing without reason.",
  },
];

export type AgentChoice =
  | { kind: "server"; id: string; name: string; description?: string }
  | { kind: "local"; id: string; name: string; persona: AgentPersona };

/** Server agents first (they run natively), local personas as fallback. Pure, tested. */
export function toAgentChoices(server: Agent[], local: AgentPersona[] = defaultAgents): AgentChoice[] {
  const choices: AgentChoice[] = [];
  for (const a of server ?? []) {
    if (!a || typeof a.name !== "string" || !a.name) continue;
    if (a.mode === "subagent") continue;
    choices.push({ kind: "server", id: `server:${a.name}`, name: a.name, description: a.description });
  }
  choices.sort((x, y) => x.name.localeCompare(y.name));
  for (const p of local ?? []) {
    choices.push({ kind: "local", id: `local:${p.id}`, name: `${p.name} (local)`, persona: p });
  }
  return choices;
}

/** Map a choice to prompt fields. Pure, tested. */
export function resolveAgentPrompt(
  choice: AgentChoice | undefined,
): Pick<SendPromptInput, "agent" | "system" | "tools"> {
  if (!choice) return {};
  if (choice.kind === "server") return { agent: choice.name };
  const out: Pick<SendPromptInput, "agent" | "system" | "tools"> = {
    system: choice.persona.systemPrompt,
  };
  if (choice.persona.allowedTools) out.tools = choice.persona.allowedTools;
  return out;
}

export function findChoice(choices: AgentChoice[], stored: string | undefined): AgentChoice | undefined {
  if (!stored) return undefined;
  return choices.find((c) => c.id === stored);
}

/**
 * Resolve a stored selection id to prompt fields without a server round-trip:
 * `server:<name>` passes the agent name through (the server validates it),
 * `local:<id>` expands the persona. Unknown ids fall back to server default.
 */
export function resolveStoredAgent(
  stored: string | undefined,
  local: AgentPersona[] = defaultAgents,
): Pick<SendPromptInput, "agent" | "system" | "tools"> {
  if (!stored) return {};
  if (stored.startsWith("server:")) {
    const name = stored.slice("server:".length);
    return name ? { agent: name } : {};
  }
  if (stored.startsWith("local:")) {
    const persona = local.find((p) => p.id === stored.slice("local:".length));
    if (!persona) return {};
    return resolveAgentPrompt({ kind: "local", id: stored, name: persona.name, persona });
  }
  return {};
}

/** Stored choice id (`server:<name>` / `local:<id>`). Undefined = server default. */
export function getAgentSelection(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(AGENT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setAgentSelection(id: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (!id) window.localStorage.removeItem(AGENT_KEY);
    else window.localStorage.setItem(AGENT_KEY, id);
  } catch {
    // storage unavailable — non-fatal
  }
}

export function listAgents(): AgentPersona[] {
  return defaultAgents;
}

export async function fetchServerAgents(): Promise<Agent[]> {
  return adapter.listAgents();
}
