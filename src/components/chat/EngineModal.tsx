import { createQuery } from "@tanstack/solid-query";
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
  Brain,
  Check,
  ChevronRight,
  Cpu,
  Search,
  Server,
  Settings2,
  SlidersHorizontal,
  Zap,
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

function categoryIcon(cat: string) {
  switch (cat) {
    case "fast":
      return <Zap size={15} style="color:var(--rudra-orange)" />;
    case "reasoning":
      return <Brain size={15} style="color:#818cf8" />;
    case "local":
      return <Server size={15} style="color:var(--success)" />;
    default:
      return <Cpu size={15} style="color:var(--muted)" />;
  }
}

function tagStyle(tag: string): string {
  const base =
    "font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;border:1px solid;white-space:nowrap;";
  switch (tag) {
    case "Active":
      return `${base}background:var(--rudra-orange);border-color:transparent;color:#fff;`;
    case "Recommended":
      return `${base}background:rgba(255,77,28,0.1);border-color:rgba(255,77,28,0.3);color:var(--rudra-orange);`;
    case "New":
      return `${base}background:rgba(234,179,8,0.12);border-color:rgba(234,179,8,0.35);color:#ca8a04;`;
    case "Thinking":
    case "Local Daemon":
      return `${base}background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.3);color:#8b5cf6;`;
    case "High Speed":
    case "Open Weights":
      return `${base}background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:#3b82f6;`;
    case "Local":
      return `${base}background:rgba(63,185,80,0.1);border-color:rgba(63,185,80,0.3);color:var(--success);`;
    default:
      return `${base}background:var(--bg);border-color:var(--border);color:var(--muted);`;
  }
}

const ctxStyle =
  "font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap;";

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
            {(entry, i) => {
              const selected = () => index() === i();
              return (
                <button
                  type="button"
                  onClick={() => select(entry.option.value)}
                  onMouseMove={() => setIndex(i())}
                  style={`display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid ${entry.active ? "rgba(255,77,28,0.4)" : selected() ? "var(--rudra-orange)" : "var(--border)"};background:${entry.active ? "rgba(255,77,28,0.06)" : "var(--surface)"};cursor:pointer;transition:border-color var(--transition-fast)`}
                >
                  <span
                    style={`width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--border);flex-shrink:0`}
                  >
                    {categoryIcon(entry.meta.category)}
                  </span>
                  <span style="flex:1;min-width:0">
                    <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <span style="font-size:13px;font-weight:800">{entry.option.modelName}</span>
                      <Show when={entry.active}>
                        <span style={tagStyle("Active")}>Active</span>
                      </Show>
                      <For each={entry.meta.tags}>
                        {(t) => <span style={tagStyle(t)}>{t}</span>}
                      </For>
                      <Show when={entry.meta.ctx}>
                        <span style={ctxStyle}>{entry.meta.ctx}</span>
                      </Show>
                    </span>
                    <span style="display:block;margin-top:2px;font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                      {entry.option.providerName} · {entry.meta.blurb}
                    </span>
                  </span>
                  <Show
                    when={entry.active}
                    fallback={<ChevronRight size={14} style="color:var(--muted);flex-shrink:0" />}
                  >
                    <span
                      style="width:22px;height:22px;border-radius:50%;border:1.5px solid var(--rudra-orange);color:var(--rudra-orange);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                  </Show>
                </button>
              );
            }}
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
