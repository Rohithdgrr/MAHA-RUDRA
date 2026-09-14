import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Show, createEffect, onCleanup, onMount } from "solid-js";
import { Bot, Copy, RotateCcw } from "lucide-solid";
import { adapter } from "../../lib/backend";
import { getAgentSelection, resolveStoredAgent } from "../../lib/opencode/agents";
import { handleExplicitMemory } from "../../lib/memory/explicit";
import { buildMemoryBlock, mergeSystemPrompt } from "../../lib/memory/inject";
import { usageStore } from "../../lib/metrics/usage-store";
import { traceInjection } from "../../lib/memory/injectionTrace";
import { memoryStore } from "../../lib/memory/memory.store";
import { getModelSelection } from "../../lib/opencode/models";
import { notePromptSent } from "../../lib/tauri/desktop";
import { messageStore } from "../../lib/stores/message.store";
import { sessionStore } from "../../lib/stores/session.store";
import { uiStore } from "../../lib/stores/ui.store";
import { logger } from "../../lib/utils/logger";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import { QuestionList } from "./QuestionList";
import { TodoList } from "./TodoList";

/**
 * Chat view for one session. The initial load is a plain fetch; afterwards
 * SSE `message.part.updated` events patch the store token-by-token and
 * `session.idle` reconciles with server truth.
 */
export function DemoConversation() {
  return (
    <div style="flex:1;overflow-y:auto;background:var(--bg)" class="rudra-scroll">
      <div class="chat-col">
        <div class="msg-row msg-user">
          <div class="msg-user-head">
            YOU <span class="t">· 14:34</span>
          </div>
          <div class="msg-user-card">
            Execute the test suite for <span class="md-icode">rudra-server</span>, inspect uncommitted git diffs, and generate the SQL migration for OAuth refresh tokens.
          </div>
        </div>
        <div class="msg-row">
          <div class="assistant-body">
            <div class="meta-row">
              <span class="meta-avatar">
                <Bot size={14} />
              </span>
              <span class="meta-name">RUDRA</span>
              <span style="color:var(--muted)">·</span>
              <span class="lat-chip">810ms latency</span>
              <span style="color:var(--muted)">·</span>
              <span class="tok-chip">684 tok</span>
              <span class="meta-actions">
                <button type="button" title="Copy">
                  <Copy size={12} /> Copy
                </button>
                <button type="button" title="Retry">
                  <RotateCcw size={12} /> Retry
                </button>
              </span>
            </div>
            <div class="md-prose">
              <p>
                I ran the automated unit tests and verified working tree modifications with <span class="md-icode">git diff</span>. All 14 tests passed with zero regressions.
              </p>
            </div>
            <div class="shell-card">
              <pre>
                <span class="sc-prompt">$ </span>npm run build{"\n\n"}&gt; rudra-ai@0.0.0 build{"\n"}&gt; tsc -b &amp;&amp; vite build{"\n\n"}vite v8.3.0 building client environment for production...{"\n"}transforming...{"\n"}✓ 2218 modules transformed.
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatView(props: { sessionID: string }) {
  const isDemo = () => props.sessionID.startsWith("demo");
  const queryClient = useQueryClient();
  // Switching sessions must not leak the previous session's banner.
  createEffect(() => {
    void props.sessionID;
    messageStore.setError(undefined);
  });
  const query = createQuery(() => ({
    queryKey: ["messages", props.sessionID],
    queryFn: async () => {
      if (isDemo()) return [];
      const messages = await adapter.getMessages(props.sessionID);
      messageStore.setMessages(props.sessionID, messages);
      return messages;
    },
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !isDemo(),
  }));

  const streaming = () => sessionStore.isBusy(props.sessionID);

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

  async function onRetry(text: string) {
    if (!text.trim() || props.sessionID === undefined) return;
    await onSend(text);
  }

  async function onSend(text: string) {    messageStore.setSending(true);
    messageStore.setError(undefined);
    // Phase 2: explicit `remember …` / `/memory` commands save locally first.
    // Slash commands and blocked secrets never reach the server.
    try {
      const explicit = await handleExplicitMemory(text, { sessionID: props.sessionID });
      if (explicit.intercept) {
        messageStore.setSending(false);
        return;
      }
    } catch (err) {
      logger.warn(`Explicit memory failed: ${(err as Error).message}`);
    }
    notePromptSent(props.sessionID);
    try {
      // Phase 5: merge the memory block with the persona system prompt.
      // Personas win on behavior; memory only adds user facts. Budget-capped.
      const persona = resolveStoredAgent(getAgentSelection());
      let system = persona.system;
      try {
        if (uiStore.state.prefs.memoryEnabled) {
          await memoryStore.load().catch(() => undefined);
          const prefs = uiStore.state.prefs;
          const { block, used, dropped } = buildMemoryBlock(memoryStore.active(), {
            budgetTokens: prefs.memoryBudgetTokens,
            includeSensitive: prefs.includeSensitiveMemory,
          });
          traceInjection(props.sessionID, block ? used : []);
          if (block) {
            system = mergeSystemPrompt(persona.system, block);
            // Phase 0 ledger: local estimate of the system-bucket cost.
            usageStore.reportMemoryBlock(props.sessionID, block);
            if (dropped.length > 0) {
              logger.debug(`Memory injection dropped ${dropped.length} facts (budget/sensitive/stale)`);
            }
          }
        } else {
          traceInjection(props.sessionID, []);
        }
      } catch (err) {
        logger.warn(`Memory injection failed: ${(err as Error).message}`);
      }
      // The picked model/agent (if any) ride along so the server generates
      // with them instead of the possibly-broken defaults.
      await adapter.sendPrompt({
        sessionID: props.sessionID,
        text,
        model: getModelSelection(),
        ...(persona.agent ? { agent: persona.agent } : {}),
        ...(persona.tools ? { tools: persona.tools } : {}),
        ...(system ? { system } : {}),
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
      <Show when={messageStore.state.error}>
        <p style="color:var(--danger);font-size:12px;padding:8px 20px 0">{messageStore.state.error}</p>
      </Show>
      <Show when={isDemo()} fallback={
        <MessageList
          messages={messageStore.messagesFor(props.sessionID)}
          sessionId={props.sessionID}
          loading={query.isPending}
          streaming={streaming()}
          onRetry={onRetry}
        />
      }>
        <DemoConversation />
      </Show>
      <TodoList sessionID={props.sessionID} />
      <QuestionList sessionID={props.sessionID} />
      <PromptInput
        sending={messageStore.state.sending}
        streaming={streaming()}
        onSend={onSend}
        onStop={onStop}
      />
    </div>
  );
}
