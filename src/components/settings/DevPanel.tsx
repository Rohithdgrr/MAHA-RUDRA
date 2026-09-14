import { For, Show } from "solid-js";
import { strings } from "../../lib/i18n/en";
import { clearRawEvents, listRawEvents } from "../../lib/backend/eventLog";
import { devMode, setDevMode } from "../../lib/utils/devmode";
import { setVerbose } from "../../lib/utils/logger";
import { Section } from "./controls";
import { Toggle } from "../ui/Toggle";

function fmt(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
}

/** Developer toggle + live raw-event viewer. Off by default; persisted. */
export function DevPanel() {
  function onToggle(on: boolean) {
    setDevMode(on);
    setVerbose(on);
    if (!on) clearRawEvents();
  }

  return (
    <Section title={strings.devMode}>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--muted);line-height:1.5">{strings.devModeHint}</div>
        </div>
        <Toggle checked={devMode()} onChange={onToggle} label={strings.devMode} />
      </div>
      <Show when={devMode()}>
        <div style="display:flex;align-items:center;gap:8px;margin:8px 0 6px">
          <span style="font-size:11px;font-weight:700">{strings.devEventLog}</span>
          <span style="flex:1" />
          <button
            type="button"
            onClick={clearRawEvents}
            style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px"
          >
            {strings.devClearLog}
          </button>
        </div>
        <div
          style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;padding:8px;border-radius:10px;background:var(--bg);border:1px solid var(--border);font-family:ui-monospace,monospace;font-size:10px;color:var(--muted)"
          class="rudra-scroll"
        >
          <For each={listRawEvents()} fallback={<span>No events yet — send a prompt.</span>}>
            {(e) => (
              <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                <span style="color:var(--rudra-orange)">{fmt(e.ts)}</span> [{e.source}] {e.summary}
              </div>
            )}
          </For>
        </div>
      </Show>
    </Section>
  );
}
