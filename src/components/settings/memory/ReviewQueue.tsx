import { For, Show } from "solid-js";
import { strings } from "../../../lib/i18n/en";
import { formatMemoryValue } from "../../../lib/memory/types";
import { memoryStore } from "../../../lib/memory/memory.store";
import { uiStore } from "../../../lib/stores/ui.store";

/** Phase 3: review-only queue. Nothing here auto-saves; user approves each item. */
export function ReviewQueue() {
  const pending = () => memoryStore.state.memories.filter((m) => m.status === "pending");
  const conflictOf = (category: string, key: string) =>
    memoryStore.state.memories.find((m) => m.status === "active" && m.category === category && m.key === key);

  async function approveAll() {
    for (const m of pending()) {
      try {
        await memoryStore.approve(m.id);
      } catch {
        // continue with the rest
      }
    }
    uiStore.toast(strings.memorySaved, "success");
  }

  return (
    <Show when={pending().length > 0}>
      <section style="margin-bottom:16px;padding:12px;border:1px solid var(--warning, #d97706);border-radius:12px;background:var(--surface)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <strong style="font-size:13px">⚠ {strings.memoryReviewQueue} ({pending().length})</strong>
          <span style="margin-left:auto" />
          <button
            type="button"
            onClick={approveAll}
            style="background:none;border:none;color:var(--rudra-orange);cursor:pointer;font-size:11px;font-weight:700"
          >
            {strings.memoryApproveAll}
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <For each={pending()}>
            {(m) => {
              const conflict = () => conflictOf(m.category, m.key);
              return (
                <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg)">
                  <div style="font-size:12px;font-weight:700">
                    {m.sensitive ? "🔒 " : ""}{m.category} · {m.key}
                  </div>
                  <div style="font-size:12px;margin-top:2px">{formatMemoryValue(m.value)}</div>
                  <Show when={conflict()}>
                    {(old) => (
                      <div style="font-size:11px;color:var(--warning, #d97706);margin-top:4px">
                        Was: {formatMemoryValue(old().value)} → New: {formatMemoryValue(m.value)}
                      </div>
                    )}
                  </Show>
                  <Show when={m.source.excerpt}>
                    <div style="font-size:11px;color:var(--muted);margin-top:4px">“{m.source.excerpt}”</div>
                  </Show>
                  <div style="display:flex;gap:10px;margin-top:8px;justify-content:flex-end">
                    <button
                      type="button"
                      onClick={() => void memoryStore.approve(m.id)}
                      style="background:none;border:none;color:var(--success);cursor:pointer;font-size:12px;font-weight:700"
                    >
                      ✓ {strings.memoryApprove}
                    </button>
                    <button
                      type="button"
                      onClick={() => void memoryStore.reject(m.id)}
                      style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px"
                    >
                      ✗ {strings.memoryReject}
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </section>
    </Show>
  );
}
