import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Show, onCleanup, onMount } from "solid-js";
import { FolderOpen } from "lucide-solid";
import { adapter } from "../../lib/backend";
import { getAgentSelection, resolveStoredAgent } from "../../lib/opencode/agents";
import { getModelSelection } from "../../lib/opencode/models";
import { isDesktop, notePromptSent, openInFileManager } from "../../lib/tauri/desktop";
import { messageStore } from "../../lib/stores/message.store";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { logger } from "../../lib/utils/logger";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";

/**
 * Chat view for one session. The initial load is a plain fetch; afterwards
 * SSE `message.part.updated` events patch the store token-by-token and
 * `session.idle` reconciles with server truth.
 */
export function ChatView(props: { sessionID: string }) {
  const queryClient = useQueryClient();
  const query = createQuery(() => ({
    queryKey: ["messages", props.sessionID],
    queryFn: async () => {
      const messages = await adapter.getMessages(props.sessionID);
      messageStore.setMessages(props.sessionID, messages);
      return messages;
    },
    retry: false,
    refetchOnWindowFocus: false,
  }));

  const streaming = () => sessionStore.isBusy(props.sessionID);
  const session = () => sessionStore.state.sessions.find((s) => s.id === props.sessionID);
  const directory = () => session()?.directory;

  async function onRevealInFileManager() {
    const dir = directory();
    if (!dir) {
      uiStore.toast("No folder for this session", "info");
      return;
    }
    const ok = await openInFileManager(dir);
    if (!ok) uiStore.toast(isDesktop() ? "Could not open file manager" : "File manager is desktop-only", "error");
  }

  async function onStop() {
    if (!streaming()) return;
    try {
      await adapter.abortSession(props.sessionID);
    } catch (err) {
      logger.error(err);
      uiStore.toast((err as Error).message, "error");
    }
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      // The palette owns Escape while open.
      if (e.key === "Escape" && !uiStore.state.paletteOpen) void onStop();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  async function onSend(text: string) {
    messageStore.setSending(true);
    messageStore.setError(undefined);
    notePromptSent(props.sessionID);
    try {
      // The picked model/agent (if any) ride along so the server generates
      // with them instead of the possibly-broken defaults.
      await adapter.sendPrompt({
        sessionID: props.sessionID,
        text,
        model: getModelSelection(),
        ...resolveStoredAgent(getAgentSelection()),
      });
      // Fetch current truth (includes the user message); streamed
      // assistant deltas arrive via SSE, `session.idle` reconciles.
      await queryClient.invalidateQueries({ queryKey: ["messages", props.sessionID] });
    } catch (err) {
      logger.error(err);
      const msg = (err as Error).message;
      messageStore.setError(msg);
      uiStore.toast(msg, "error");
    } finally {
      messageStore.setSending(false);
    }
  }

  return (
    <div style="display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg)">
      <Show when={directory()}>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 20px;border-bottom:1px solid var(--border);background:var(--surface);font-size:12px;color:var(--muted);min-width:0">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0" title={directory()}>
            {directory()}
          </span>
          <Show when={isDesktop()}>
            <button
              type="button"
              onClick={onRevealInFileManager}
              title="Open this folder in the file manager"
              style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0"
            >
              <FolderOpen size={12} />
              File manager
            </button>
          </Show>
        </div>
      </Show>
      <Show when={messageStore.state.error}>
        <p style="color:var(--danger);font-size:12px;padding:8px 20px 0">{messageStore.state.error}</p>
      </Show>
      <MessageList
        messages={messageStore.messagesFor(props.sessionID)}
        loading={query.isPending}
        streaming={streaming()}
      />
      <PromptInput
        sending={messageStore.state.sending}
        streaming={streaming()}
        onSend={onSend}
        onStop={onStop}
      />
    </div>
  );
}
