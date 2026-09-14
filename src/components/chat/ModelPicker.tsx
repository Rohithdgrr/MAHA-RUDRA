import { createQuery } from "@tanstack/solid-query";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { ChevronUp } from "lucide-solid";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import {
  formatSelection,
  getModelSelection,
  setModelSelection,
  toModelOptions,
} from "../../lib/opencode/models";
import { EngineModal } from "./EngineModal";

/**
 * Model picker: lists every provider/model the server knows
 * (`GET /config/providers`). The pick is persisted to localStorage and
 * attached to every prompt; empty = server default.
 * Renders as an inline dropdown button when `compact` (bottom toolbar).
 */
export function ModelPicker(props: { compact?: boolean }) {
  const [value, setValue] = createSignal(formatSelection(getModelSelection()));
  const [modalOpen, setModalOpen] = createSignal(false);
  const query = createQuery(() => ({
    queryKey: ["providers"],
    queryFn: () => adapter.listProviders(),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  }));

  const options = () => toModelOptions(query.data?.providers ?? []);

  /** Re-read storage (EngineModal writes through it). */
  function refresh() {
    setValue(formatSelection(getModelSelection()));
  }

  onMount(() => {
    window.addEventListener("rudra:model-changed", refresh);
    onCleanup(() => window.removeEventListener("rudra:model-changed", refresh));
  });

  function onChange(next: string) {
    setValue(next);
    if (!next) {
      setModelSelection(undefined);
      return;
    }
    const slash = next.indexOf("/");
    setModelSelection({ providerID: next.slice(0, slash), modelID: next.slice(slash + 1) });
  }

  const label = () => {
    const v = value();
    if (!v) return "Claude 3.5 Sonnet";
    const opt = options().find((o) => o.value === v);
    return opt?.label ?? v.split("/").pop() ?? v;
  };

  const compact = () => props.compact === true;

  if (!compact()) {
    return (
      <label style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)" title={strings.selectModel}>
        {strings.selectModel}
        <select
          value={value()}
          onChange={(e) => onChange(e.currentTarget.value)}
          disabled={query.isPending}
          aria-label={strings.selectModel}
          style="max-width:280px;background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit"
        >
          <option value="">{strings.serverDefaultModel}</option>
          <For each={options()}>{(o) => <option value={o.value}>{o.label}</option>}</For>
        </select>
        <Show when={query.isError}><span title={strings.modelsUnavailable}>⚠</span></Show>
      </label>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={query.isPending}
        title={strings.selectEngine}
        class="model-pill"
        style="max-width:260px;overflow:hidden;text-overflow:ellipsis"
      >
        <span style="width:7px;height:7px;border-radius:50%;background:#e8490f;display:inline-block;flex-shrink:0" />
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{label()}</span>
        <span style="color:var(--muted);font-weight:400;white-space:nowrap">· 12.4k tok</span>
        <ChevronUp size={12} style="flex-shrink:0;color:var(--muted);transform:rotate(180deg)" />
      </button>
      <EngineModal
        open={modalOpen()}
        onClose={() => {
          setModalOpen(false);
          refresh();
        }}
      />
      <Show when={query.isError}><span title={strings.modelsUnavailable} style="margin-left:4px;font-size:10px">⚠</span></Show>
    </>
  );
}
