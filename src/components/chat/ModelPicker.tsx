import { createQuery } from "@tanstack/solid-query";
import { For, Show, createSignal } from "solid-js";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import {
  formatSelection,
  getModelSelection,
  setModelSelection,
  toModelOptions,
} from "../../lib/opencode/models";

/**
 * Model picker: lists every provider/model the server knows
 * (`GET /config/providers`). The pick is persisted to localStorage and
 * attached to every prompt; empty = server default.
 */
export function ModelPicker(props: { compact?: boolean }) {
  const [value, setValue] = createSignal(formatSelection(getModelSelection()));
  const query = createQuery(() => ({
    queryKey: ["providers"],
    queryFn: () => adapter.listProviders(),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  }));

  const options = () => toModelOptions(query.data?.providers ?? []);

  function onChange(next: string) {
    setValue(next);
    if (!next) {
      setModelSelection(undefined);
      return;
    }
    const slash = next.indexOf("/");
    setModelSelection({ providerID: next.slice(0, slash), modelID: next.slice(slash + 1) });
  }

  const compact = () => props.compact === true;
  return (
    <label
      style={
        compact()
          ? "display:inline-flex;align-items:center;gap:6px"
          : "display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)"
      }
      title={strings.selectModel}
    >
      <Show when={!compact()}>{strings.selectModel}</Show>
      <select
        value={value()}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={query.isPending}
        aria-label={strings.selectModel}
        style={
          compact()
            ? "max-width:190px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:999px;padding:5px 10px;font-size:12px;font-family:inherit;font-weight:600;transition:all var(--transition-fast)"
            : "max-width:280px;background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit"
        }
      >
        <option value="">{strings.serverDefaultModel}</option>
        <For each={options()}>{(o) => <option value={o.value}>{o.label}</option>}</For>
      </select>
      <Show when={query.isError}>
        <span title={strings.modelsUnavailable}>⚠</span>
      </Show>
    </label>
  );
}
