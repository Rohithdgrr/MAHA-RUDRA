import { For, Show } from "solid-js";
import { uiStore } from "../../lib/stores/ui.store";
import { getTrace } from "../../lib/memory/injectionTrace";

/** Subtle `· used X, Y ·` chip under assistant replies that consumed memory. */
export function MemoryUsedChip(props: { sessionId: string | undefined }) {
  const used = () => getTrace(props.sessionId);
  return (
    <Show when={used().length > 0}>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <span style="font-size:11px;color:var(--muted)">· used</span>
        <For each={used().slice(0, 4)}>
          {(m) => (
            <button
              type="button"
              title={`${m.category} · ${m.key} — open in Settings`}
              onClick={() => uiStore.setSettingsOpen(true)}
              style="font-size:11px;padding:2px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--border);color:var(--muted);cursor:pointer"
            >
              {m.key}
            </button>
          )}
        </For>
        <Show when={used().length > 4}>
          <span style="font-size:11px;color:var(--muted)">+{used().length - 4} ·</span>
        </Show>
        <Show when={used().length <= 4}>
          <span style="font-size:11px;color:var(--muted)">·</span>
        </Show>
      </div>
    </Show>
  );
}
