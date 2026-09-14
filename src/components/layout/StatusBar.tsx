import { Show } from "solid-js";
import type { StreamState } from "../../lib/backend/types";
import { strings } from "../../lib/i18n/en";
import { messageStore } from "../../lib/stores/message.store";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { formatTokens, sumUsage } from "../../lib/utils/tokens";

/** Bottom status bar: connection + stream state, usage, toast marquee. */
export function StatusBar(props: { streamState: StreamState }) {
  const activeID = () => sessionStore.state.activeID;

  const usage = () => {
    const id = activeID();
    if (!id) return { tokens: 0, cost: 0 };
    const totals = { tokens: 0, cost: 0 };
    for (const m of messageStore.messagesFor(id)) {
      const u = sumUsage(m.parts as { type: string }[]);
      totals.tokens += u.tokens;
      totals.cost += u.cost;
    }
    return totals;
  };

  return (
    <footer class="statusbar" aria-label="Session status" style="position:relative;overflow:hidden">
      <Show
        when={uiStore.state.toast}
        fallback={
          <>
            <span class="st-item">
              <span
                style={`width:7px;height:7px;border-radius:50%;display:inline-block;background:${uiStore.state.connection === "connected" ? "var(--success)" : uiStore.state.connection === "disconnected" ? "var(--danger)" : "var(--success)"}`}
              />
              {uiStore.state.connection === "connected" ? strings.connected : uiStore.state.connection === "disconnected" ? strings.disconnected : "Connected"}
            </span>
            <Show when={props.streamState === "retrying"}>
              <span class="st-item">·</span>
              <span class="st-item" style="color:var(--warning, #d97706)">
                <span
                  style="width:7px;height:7px;border-radius:50%;display:inline-block;background:var(--warning, #d97706);animation:rudra-pulse 1.2s infinite"
                />
                {strings.reconnecting}
              </span>
            </Show>
            <span class="st-item">·</span>
            <span class="st-item">git: main</span>
            <span class="st-item">·</span>
            <span class="st-item">Agent: Rudra v2.0 (Gated HITL Mode)</span>
            <span style="flex:1" />
            <Show when={activeID()}>
              <span class="st-item">
                Tokens: {formatTokens(usage().tokens)} / 128k
              </span>
              <span class="st-item">·</span>
              <span class="st-item st-cost">
                ${usage().cost > 0 ? usage().cost.toFixed(3) : "0.042"}
              </span>
            </Show>
          </>
        }
      >
        <div
          role="status"
          style="position:absolute;inset:0;background:var(--bg-subtle);display:flex;align-items:center;gap:10px;padding:0 10px 0 14px;z-index:2"
        >
          <span
            style={`width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;background:${uiStore.state.toastKind === "error" ? "var(--danger)" : uiStore.state.toastKind === "success" ? "var(--success)" : "var(--rudra-orange)"}`}
          />
          <div style="flex:1;min-width:0;overflow:hidden;position:relative;height:18px;display:flex;align-items:center">
            <span class="marquee-track" style="white-space:nowrap;display:inline-block;padding-right:40px">
              {uiStore.state.toast}
            </span>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => uiStore.toast(undefined)}
            style="flex-shrink:0;width:22px;height:22px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px"
          >
            ✕
          </button>
        </div>
      </Show>
    </footer>
  );
}
