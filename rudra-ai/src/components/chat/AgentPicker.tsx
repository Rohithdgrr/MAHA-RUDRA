import { createQuery } from "@tanstack/solid-query";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { ChevronDown } from "lucide-solid";
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
 * Renders as an inline dropdown button when `compact` (bottom toolbar).
 */
export function AgentPicker(props: { compact?: boolean }) {
  const [value, setValue] = createSignal(getAgentSelection() ?? "");
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
  const query = createQuery(() => ({
    queryKey: ["agents"],
    queryFn: fetchServerAgents,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  }));

  const choices = () => toAgentChoices(query.data ?? []);
  const effective = () => (findChoice(choices(), value()) ? value() : "");
  const label = () => {
    const eff = effective();
    if (!eff) return "Build";
    const found = choices().find((c) => c.id === eff);
    return found?.name ?? "Build";
  };

  function onChange(next: string) {
    setValue(next);
    setAgentSelection(next || undefined);
    setOpen(false);
  }

  function handleClickOutside(e: MouseEvent) {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  }

  onMount(() => document.addEventListener("mousedown", handleClickOutside));
  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  const compact = () => props.compact === true;

  if (!compact()) {
    return (
      <label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)" title={strings.selectAgent}>
        {strings.selectAgent}
        <select
          value={effective()}
          onChange={(e) => onChange(e.currentTarget.value)}
          disabled={query.isPending}
          aria-label={strings.selectAgent}
          style="max-width:220px;background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit"
        >
          <option value="">{strings.serverDefaultAgent}</option>
          <For each={choices()}>{(c) => <option value={c.id}>{c.name}</option>}</For>
        </select>
        <Show when={query.isError}><span title={strings.agentsUnavailable}>⚠</span></Show>
      </label>
    );
  }

  return (
    <div ref={containerRef} style="position:relative;display:inline-flex;align-items:center">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        disabled={query.isPending}
        title={strings.selectAgent}
        style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all var(--transition-fast);white-space:nowrap"
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--border-hover)";
          el.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "var(--border)";
          el.style.background = "var(--surface)";
        }}
      >
        {label()}
        <ChevronDown size={12} style={`transition:transform var(--transition-fast);${open() ? "transform:rotate(180deg)" : ""}`} />
      </button>
      <Show when={open()}>
        <div style="position:absolute;top:calc(100% + 6px);left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);padding:4px;min-width:160px;z-index:100;animation:rudra-scaleIn 0.15s ease-out">
          <button
            type="button"
            onClick={() => onChange("")}
            style={`width:100%;display:block;text-align:left;padding:7px 10px;border:none;border-radius:6px;background:${effective() === "" ? "rgba(255,77,28,0.1)" : "transparent"};color:${effective() === "" ? "var(--rudra-orange)" : "var(--fg)"};font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background var(--transition-fast)`}
            onMouseEnter={(e) => { if (effective() !== "") (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { if (effective() !== "") (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {strings.serverDefaultAgent}
          </button>
          <For each={choices()}>
            {(c) => (
              <button
                type="button"
                onClick={() => onChange(c.id)}
                style={`width:100%;display:block;text-align:left;padding:7px 10px;border:none;border-radius:6px;background:${effective() === c.id ? "rgba(255,77,28,0.1)" : "transparent"};color:${effective() === c.id ? "var(--rudra-orange)" : "var(--fg)"};font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background var(--transition-fast)`}
                onMouseEnter={(e) => { if (effective() !== c.id) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
                onMouseLeave={(e) => { if (effective() !== c.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {c.name}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={query.isError}><span title={strings.agentsUnavailable} style="margin-left:4px;font-size:10px">⚠</span></Show>
    </div>
  );
}
