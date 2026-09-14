import { Show, onMount } from "solid-js";
import { memoryStore } from "../../lib/memory/memory.store";
import { uiStore } from "../../lib/stores/ui.store";

/** Orange count dot on the TopBar settings icon when items await review. */
export function ReviewQueueBadge() {
  onMount(() => void memoryStore.load());
  const count = () => memoryStore.state.memories.filter((m) => m.status === "pending").length;
  return (
    <Show when={count() > 0}>
      <button
        type="button"
        onClick={() => uiStore.setSettingsOpen(true)}
        title={`${count()} memories awaiting review`}
        aria-label={`${count()} memories awaiting review`}
        style="position:absolute;top:2px;right:2px;min-width:16px;height:16px;border-radius:999px;background:var(--warning, #d97706);color:white;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--bg);cursor:pointer"
      >
        {count()}
      </button>
    </Show>
  );
}
