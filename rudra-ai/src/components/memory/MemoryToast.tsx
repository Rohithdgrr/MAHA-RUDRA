import { Show, createSignal, onCleanup } from "solid-js";
import { strings } from "../../lib/i18n/en";
import { uiStore } from "../../lib/stores/ui.store";

export interface MemoryToastData {
  title: string;
  body: string;
  onUndo?: () => void;
}

const [toast, setToast] = createSignal<MemoryToastData | undefined>(undefined);
let timer: ReturnType<typeof setTimeout> | undefined;

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
}

/** Show a bottom-right memory toast for 8s. Replaces any previous one. */
export function showMemoryToast(data: MemoryToastData): void {
  clearTimer();
  setToast(data);
  timer = setTimeout(() => setToast(undefined), 8000);
}

export function dismissMemoryToast(): void {
  clearTimer();
  setToast(undefined);
}

/** Bottom-right toast with View + Undo. Mount once in AppShell. */
export function MemoryToast() {
  onCleanup(clearTimer);
  return (
    <Show when={toast()}>
      {(t) => (
        <div
          role="status"
          style="position:fixed;right:16px;bottom:48px;z-index:80;max-width:340px;padding:12px 14px;border-radius:12px;background:var(--surface-2, var(--surface));border:1px solid var(--border);border-left:3px solid var(--rudra-orange);box-shadow:var(--shadow-lg);font-size:12px"
        >
          <div style="font-weight:800;margin-bottom:2px">✓ {t().title}</div>
          <div style="color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            {t().body}
          </div>
          <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
            <button
              type="button"
              onClick={() => {
                dismissMemoryToast();
                uiStore.setSettingsOpen(true);
              }}
              style="background:none;border:none;color:var(--rudra-orange);cursor:pointer;font-size:12px;font-weight:700"
            >
              {strings.memoryView}
            </button>
            <Show when={t().onUndo}>
              <button
                type="button"
                onClick={() => {
                  t().onUndo?.();
                  dismissMemoryToast();
                }}
                style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-weight:700"
              >
                {strings.memoryUndo}
              </button>
            </Show>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissMemoryToast}
              style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </Show>
  );
}
