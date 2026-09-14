import { Show } from "solid-js";
import { uiStore } from "../../lib/stores/ui.store";

/** Minimal toast reading uiStore. Full system with queue lands in Phase 3. */
export function Toast() {
  const toast = () => uiStore.state.toast;
  const kind = () => uiStore.state.toastKind;
  const color = () => (kind() === "error" ? "var(--danger)" : kind() === "success" ? "var(--success)" : "var(--rudra-orange)");
  return (
    <Show when={toast()}>
      <div
        role="status"
        style={`position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid ${color()};border-left:4px solid ${color()};color:var(--fg);padding:10px 16px;border-radius:8px;z-index:50;display:flex;gap:12px;align-items:center;max-width:min(90vw,560px)`}
      >
        <span style="font-size:13px">{toast()}</span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => uiStore.toast(undefined)}
          style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px"
        >
          ✕
        </button>
      </div>
    </Show>
  );
}
