import { For, Show, createSignal } from "solid-js";
import { Check, ChevronDown, HelpCircle, ShieldCheck, X } from "lucide-solid";
import type { Permission } from "@opencode-ai/sdk/client";
import { adapter } from "../../lib/backend";
import { permissionStore } from "../../lib/stores/permission.store";
import { uiStore } from "../../lib/stores/ui.store";
import { logger } from "../../lib/utils/logger";

const DEMO_QUESTIONS: Permission[] = [
  {
    id: "demo-q1",
    type: "edit",
    sessionID: "demo",
    messageID: "m1",
    callID: "c1",
    title: "Allow RUDRA to edit src/App.tsx?",
    pattern: "src/App.tsx",
    metadata: {},
    time: { created: Date.now() },
  } as unknown as Permission,
  {
    id: "demo-q2",
    type: "bash",
    sessionID: "demo",
    messageID: "m1",
    title: "Allow running `npm run build`?",
    pattern: "npm run build",
    metadata: {},
    time: { created: Date.now() },
  } as unknown as Permission,
];

/** Questions / HITL approvals — opencode desktop style, rendered just above the composer like todos. */
export function QuestionList(props: { sessionID: string }) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [busy, setBusy] = createSignal<string | null>(null);

  const pending = (): Permission[] => {
    const live = permissionStore.pendingFor(props.sessionID);
    if (live.length > 0) return live;
    if (props.sessionID.startsWith("demo")) return DEMO_QUESTIONS;
    return live;
  };

  async function reply(p: Permission, response: "once" | "always" | "reject") {
    if (props.sessionID.startsWith("demo")) {
      // demo: just remove locally
      permissionStore.remove(p.sessionID, p.id);
      uiStore.toast(response === "reject" ? "Rejected" : "Approved", response === "reject" ? "error" : "success");
      return;
    }
    setBusy(p.id);
    try {
      await adapter.replyPermission(p.sessionID, p.id, response);
      // SSE will fire permission.replied and clear it; optimistic fallback:
      permissionStore.remove(p.sessionID, p.id);
      uiStore.toast(response === "reject" ? "Rejected" : response === "always" ? "Always allowed" : "Allowed", "success");
    } catch (err) {
      logger.error(err);
      uiStore.toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Show when={pending().length > 0}>
      <div class="question-wrap">
        <div class="question-panel">
          <button type="button" class="question-head" onClick={() => setCollapsed(!collapsed())} aria-expanded={!collapsed()}>
            <span class="question-head-left">
              <span class="q-icon">
                <HelpCircle size={14} />
              </span>
              Question
              <span class="q-count">{pending().length}</span>
            </span>
            <span class="question-head-right">
              <span class="q-hint">{pending().length === 1 ? "needs your approval" : `${pending().length} need attention`}</span>
              <ChevronDown size={14} class={`todo-chev ${collapsed() ? "" : "open"}`} />
            </span>
          </button>
          <Show when={!collapsed()}>
            <div class="question-list">
              <For each={pending()}>
                {(q) => (
                  <div class="question-item">
                    <div class="question-item-head">
                      <span class="q-item-icon">
                        <ShieldCheck size={13} />
                      </span>
                      <span class="q-title">{q.title}</span>
                    </div>
                    <Show when={q.pattern}>
                      <div class="q-pattern">{Array.isArray(q.pattern) ? (q.pattern as string[]).join(", ") : String(q.pattern)}</div>
                    </Show>
                    <div class="q-actions">
                      <button
                        type="button"
                        class="q-btn primary"
                        disabled={busy() === q.id}
                        onClick={() => void reply(q, "once")}
                      >
                        <Check size={12} /> Allow
                      </button>
                      <button type="button" class="q-btn ghost" disabled={busy() === q.id} onClick={() => void reply(q, "always")}>
                        Always
                      </button>
                      <button type="button" class="q-btn danger" disabled={busy() === q.id} onClick={() => void reply(q, "reject")}>
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
