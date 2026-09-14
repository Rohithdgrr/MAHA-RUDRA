import { createQuery } from "@tanstack/solid-query";
import { For, Show, createSignal } from "solid-js";
import { strings } from "../../lib/i18n/en";
import {
  findChoice,
  getAgentSelection,
  setAgentSelection,
  toAgentChoices,
} from "../../lib/opencode/agents";
import { fetchServerAgents } from "../../lib/opencode/agents";

/**
 * Agent picker: server agents (`GET /agent`) plus local personas.
 * Persisted to localStorage; empty = server default.
 */
export function AgentPicker(props: { compact?: boolean }) {
  const [value, setValue] = createSignal(getAgentSelection() ?? "");
  const query = createQuery(() => ({
    queryKey: ["agents"],
    queryFn: fetchServerAgents,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  }));

  const choices = () => toAgentChoices(query.data ?? []);
  // If the stored pick vanished (server reconfigured), fall back silently.
  const effective = () => (findChoice(choices(), value()) ? value() : "");

  function onChange(next: string) {
    setValue(next);
    setAgentSelection(next || undefined);
  }

  const compact = () => props.compact === true;
  return (
    <label
      style={
        compact()
          ? "display:inline-flex;align-items:center;gap:6px"
          : "display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)"
      }
      title={strings.selectAgent}
    >
      <Show when={!compact()}>{strings.selectAgent}</Show>
      <select
        value={effective()}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={query.isPending}
        aria-label={strings.selectAgent}
        style={
          compact()
            ? "max-width:170px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:999px;padding:5px 10px;font-size:12px;font-family:inherit;font-weight:600;transition:all var(--transition-fast)"
            : "max-width:220px;background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit"
        }
      >
        <option value="">{strings.serverDefaultAgent}</option>
        <For each={choices()}>{(c) => <option value={c.id}>{c.name}</option>}</For>
      </select>
      <Show when={query.isError}>
        <span title={strings.agentsUnavailable}>⚠</span>
      </Show>
    </label>
  );
}
