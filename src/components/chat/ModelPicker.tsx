import { createQuery } from "@tanstack/solid-query";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { Zap, ChevronDown } from "lucide-solid";
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
 * Renders as an inline dropdown button when `compact` (bottom toolbar).
 */
export function ModelPicker(props: { compact?: boolean }) {
  const [value, setValue] = createSignal(formatSelection(getModelSelection()));
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;
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
    setOpen(false);
    if (!next) {
      setModelSelection(undefined);
      return;
    }
    const slash = next.indexOf("/");
    setModelSelection({ providerID: next.slice(0, slash), modelID: next.slice(slash + 1) });
  }

  const label = () => {
    const v = value();
    if (!v) return "Server default";
    const opt = options().find((o) => o.value === v);
    return opt?.label ?? v.split("/").pop() ?? v;
  };

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
    <div ref={containerRef} style="position:relative;display:inline-flex;align-items:center">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        disabled={query.isPending}
        title={strings.selectModel}
        style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all var(--transition-fast);white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis"
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
        <Zap size={13} style="color:var(--rudra-orange);flex-shrink:0" />
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{label()}</span>
        <ChevronDown size={12} style={`flex-shrink:0;transition:transform var(--transition-fast);${open() ? "transform:rotate(180deg)" : ""}`} />
      </button>
      <Show when={open()}>
        <div style="position:absolute;top:calc(100% + 6px);left:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);padding:4px;min-width:220px;max-width:340px;z-index:100;animation:rudra-scaleIn 0.15s ease-out">
          <button
            type="button"
            onClick={() => onChange("")}
            style={`width:100%;display:block;text-align:left;padding:7px 10px;border:none;border-radius:6px;background:${value() === "" ? "rgba(255,77,28,0.1)" : "transparent"};color:${value() === "" ? "var(--rudra-orange)" : "var(--fg)"};font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background var(--transition-fast)`}
            onMouseEnter={(e) => { if (value() !== "") (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { if (value() !== "") (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            {strings.serverDefaultModel}
          </button>
          <For each={options()}>
            {(o) => (
              <button
                type="button"
                onClick={() => onChange(o.value)}
                style={`width:100%;display:block;text-align:left;padding:7px 10px;border:none;border-radius:6px;background:${value() === o.value ? "rgba(255,77,28,0.1)" : "transparent"};color:${value() === o.value ? "var(--rudra-orange)" : "var(--fg)"};font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background var(--transition-fast)`}
                onMouseEnter={(e) => { if (value() !== o.value) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
                onMouseLeave={(e) => { if (value() !== o.value) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {o.label}
              </button>
            )}
          </For>
        </div>
      </Show>
      <Show when={query.isError}><span title={strings.modelsUnavailable} style="margin-left:4px;font-size:10px">⚠</span></Show>
    </div>
  );
}
