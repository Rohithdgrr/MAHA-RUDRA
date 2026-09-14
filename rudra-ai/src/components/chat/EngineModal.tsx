import { createQuery } from "@tanstack/solid-query";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-solid";
import { adapter } from "../../lib/backend";
import { strings } from "../../lib/i18n/en";
import {
  formatSelection,
  getModelSelection,
  setModelSelection,
  toModelOptions,
} from "../../lib/opencode/models";
import {
  classifyEngine,
  filterEngines,
  type EngineEntry,
  type EngineTab,
} from "../../lib/opencode/engineMeta";
import { Dialog } from "../ui/Dialog";
import { EngineCard } from "./EngineCard";

/**
 * Select Active Engine modal (mockup 3): search + category tabs + rich
 * model cards. Writes through `setModelSelection()` and notifies compact
 * pickers via a `rudra:model-changed` window event.
 */
export function EngineModal(props: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = createSignal("");
  const [tab, setTab] = createSignal<EngineTab>("all");
  const [index, setIndex] = createSignal(0);
  let searchRef: HTMLInputElement | undefined;

  const providers = createQuery(() => ({
    queryKey: ["providers"],
    queryFn: () => adapter.listProviders(),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  }));

  const activeValue = () => formatSelection(getModelSelection());

  const entries = (): EngineEntry[] =>
    toModelOptions(providers.data?.providers ?? []).map((option) => ({
      option,
      meta: classifyEngine(option),
      active: option.value === activeValue(),
    }));

  const filtered = () => filterEngines(entries(), query(), tab());
  const total = () => entries().length;

  function select(value: string) {
    if (!value) {
      setModelSelection(undefined);
    } else {
      const slash = value.indexOf("/");
      setModelSelection({ providerID: value.slice(0, slash), modelID: value.slice(slash + 1) });
    }
    window.dispatchEvent(new CustomEvent("rudra:model-changed"));
    props.onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (!props.open) return;
    const list = filtered();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const entry = list[index()];
      if (entry) {
        e.preventDefault();
        select(entry.option.value);
      }
    }
  }

  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));

  createEffect(() => {
    // Reset cursor + focus search whenever the query/tab changes or modal opens.
    query();
    tab();
    props.open;
    setIndex(0);
    if (props.open) setTimeout(() => searchRef?.focus(), 30);
  });

  const tabs: { id: EngineTab; label: string; dot?: boolean }[] = [
    { id: "all", label: strings.all },
    { id: "fast", label: strings.fast },
    { id: "reasoning", label: strings.reasoning },
    { id: "local", label: strings.localOllama, dot: true },
  ];

  return (
    <Dialog open={props.open} title={strings.selectEngine} onClose={props.onClose} size="md" hideHeader>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <SlidersHorizontal size={14} style="color:var(--rudra-orange)" />
        <span style="font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">
          {strings.selectEngine}
        </span>
        <span style="flex:1" />
        <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-family:ui-monospace,monospace">
          {total()} {strings.available}
        </span>
      </div>

      <div style="position:relative;margin-bottom:10px">
        <Search
          size={15}
          style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none"
        />
        <input
          ref={searchRef}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder={strings.engineSearchFull}
          aria-label={strings.engineSearchFull}
          style="width:100%;box-sizing:border-box;padding:10px 12px 10px 36px;border-radius:11px;border:1.5px solid var(--rudra-orange);background:var(--bg);color:var(--fg);font-size:13px;font-family:inherit;outline:none"
        />
      </div>

      <div style="display:flex;align-items:center;gap:4px;margin-bottom:10px">
        <For each={tabs}>
          {(t) => (
            <button
              type="button"
              onClick={() => setTab(t.id)}
              style={`display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9px;border:none;font-size:12px;font-weight:${tab() === t.id ? "800" : "600"};font-family:inherit;cursor:pointer;transition:all var(--transition-fast);background:${tab() === t.id ? "rgba(255,77,28,0.1)" : "transparent"};color:${tab() === t.id ? "var(--rudra-orange)" : "var(--muted)"}`}
            >
              <Show when={t.dot}>
                <span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block" />
              </Show>
              {t.label}
            </button>
          )}
        </For>
      </div>

      <div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:8px" class="rudra-scroll">
        <Show
          when={filtered().length > 0}
          fallback={<p style="margin:8px 0;font-size:12px;color:var(--muted)">{strings.noEngines}</p>}
        >
          <button
            type="button"
            onClick={() => select("")}
            onMouseMove={() => setIndex(-1)}
            style={`display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface);cursor:pointer;${index() === -1 ? "border-color:var(--rudra-orange);" : ""}`}
          >
            <span style="font-size:12px;font-weight:700">{strings.serverDefaultModel}</span>
          </button>
          <For each={filtered()}>
            {(entry, i) => (
              <EngineCard
                entry={entry}
                highlighted={index() === i()}
                onSelect={select}
                onHover={() => setIndex(i())}
              />
            )}
          </For>
        </Show>
      </div>

      <div
        style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:9px 12px;border-radius:10px;background:var(--bg-subtle);border:1px solid var(--border);font-size:11px;color:var(--muted);font-family:ui-monospace,monospace"
      >
        <Settings2 size={12} style="flex-shrink:0" />
        <span style="flex:1">{strings.configureKeysHint}</span>
        <span style="white-space:nowrap">{strings.hintNavigate}</span>
      </div>
    </Dialog>
  );
}
