import { For, Show, createSignal } from "solid-js";
import { strings } from "../../../lib/i18n/en";
import { listAudit } from "../../../lib/memory/audit";

/** Phase 7: collapsible audit trail (capped ring, newest first). */
export function AuditLog() {
  const [open, setOpen] = createSignal(false);
  const entries = () => listAudit().slice(0, 20);
  const total = () => listAudit().length;

  function fmt(ts: number): string {
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return String(ts);
    }
  }

  return (
    <section style="margin-bottom:16px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
        style="width:100%;display:flex;align-items:center;gap:8px;padding:12px;background:none;border:none;color:var(--fg);cursor:pointer;font-size:13px;font-weight:700"
      >
        <span style={`display:inline-block;transition:transform var(--transition-fast);transform:rotate(${open() ? "90deg" : "0deg"})`}>▸</span>
        {strings.memoryAudit} {total() > 0 ? `(${total()})` : ""}
      </button>
      <Show when={open()}>
        <div style="padding:0 12px 12px">
          <Show
            when={entries().length > 0}
            fallback={<p style="margin:0;font-size:12px;color:var(--muted)">{strings.memoryAuditEmpty}</p>}
          >
            <div style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto" class="rudra-scroll">
              <For each={entries()}>
                {(e) => (
                  <div style="display:flex;gap:8px;font-size:11px;font-family:ui-monospace,monospace;color:var(--muted)">
                    <span style="flex-shrink:0">{fmt(e.ts)}</span>
                    <span style="flex-shrink:0;color:var(--fg);font-weight:700">{e.action}</span>
                    <Show when={e.memoryId}>
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{e.memoryId}</span>
                    </Show>
                    <Show when={e.detail}>
                      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">· {e.detail}</span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </section>
  );
}
