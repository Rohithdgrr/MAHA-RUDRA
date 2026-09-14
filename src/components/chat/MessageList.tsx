import { For, Show, createEffect } from "solid-js";
import { Bot, Sparkles } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import type { MessageWithParts } from "../../lib/backend/types";
import { extractText } from "../../lib/utils/markdown";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: MessageWithParts[];
  loading: boolean;
  streaming?: boolean;
  onRetry?: (text: string) => void;
}

function createdOf(m: MessageWithParts): number {
  return (m.info as unknown as { time?: { created?: number } }).time?.created ?? 0;
}

function isUserMsg(m: MessageWithParts): boolean {
  return (m.info as unknown as { role?: string }).role === "user";
}

/** Vertical message feed with sticky auto-scroll, rich empty state and streaming indicator. */
export function MessageList(props: MessageListProps) {
  let scrollRef: HTMLDivElement | undefined;

  function signature(): string {
    const last = props.messages[props.messages.length - 1];
    const lastPart = last?.parts[last.parts.length - 1] as { text?: string } | undefined;
    const tail = typeof lastPart?.text === "string" ? lastPart.text.length : last?.parts.length ?? 0;
    return `${props.messages.length}:${tail}`;
  }

  createEffect(() => {
    signature();
    const el = scrollRef;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  });

  return (
    <div ref={scrollRef} style="flex:1;overflow-y:auto;background:var(--bg)" class="rudra-scroll">
      <div class="chat-col">
      <Show when={props.loading}>
        <div style="display:flex;align-items:center;gap:10px;padding:16px;color:var(--muted);font-size:13px">
          <span style="width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--rudra-orange);border-radius:50%;display:inline-block;animation:rudra-spin 0.7s linear infinite" />
          {strings.loading}
        </div>
      </Show>
      <Show when={!props.loading && props.messages.length === 0}>
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center;min-height:340px" class="rudra-fade-in">
          <span style="width:64px;height:64px;border-radius:18px;background:var(--rudra-gradient);display:inline-flex;align-items:center;justify-content:center;color:white;box-shadow:var(--shadow-glow);margin-bottom:16px">
            <Bot size={28} />
          </span>
          <h3 style="margin:0;font-size:15px;font-weight:800;letter-spacing:-0.01em">Start a conversation</h3>
          <p style="margin:8px 0 0;max-width:420px;font-size:13px;line-height:1.6;color:var(--muted)">
            {strings.noMessages} Ask anything — explain code, refactor files, or plan a feature. Pick a model and agent above.
          </p>
          <div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:11px;color:var(--muted);font-weight:600">
            <Sparkles size={12} />
            {strings.promptPlaceholder}
          </div>
        </div>
      </Show>
      <For each={props.messages}>
        {(m, i) => {
          const prevUsers = () =>
            props.messages.slice(0, i()).filter(isUserMsg);
          const lastUser = () => {
            const users = prevUsers();
            return users[users.length - 1];
          };
          const retryText = () => {
            const u = lastUser();
            return !isUserMsg(m) && u
              ? extractText(
                  u.parts as { type: string; text?: string }[],
                )
              : "";
          };
          const latency = () => {
            const u = lastUser();
            return !isUserMsg(m) && u && createdOf(m) > 0 && createdOf(u) > 0
              ? createdOf(m) - createdOf(u)
              : undefined;
          };
          return (
            <MessageBubble
              message={m}
              live={props.streaming && i() === props.messages.length - 1}
              latencyMs={latency()}
              retryText={retryText() || undefined}
              onRetry={props.onRetry}
            />
          );
        }}
      </For>
      <Show when={props.streaming}>
        <div style="display:flex;align-items:center;gap:10px;margin:14px 0 4px">
          <span
            style="width:26px;height:26px;border-radius:8px;background:#fde9e2;border:1px solid rgba(255,77,28,0.25);display:inline-flex;align-items:center;justify-content:center;color:#cf3a12"
          >
            <Bot size={14} />
          </span>
          <span style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:12px;color:var(--muted);font-weight:600;box-shadow:var(--shadow-sm)">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--rudra-orange);display:inline-block;animation:rudra-pulse 1.2s infinite" />
            {strings.streaming}
          </span>
        </div>
      </Show>
      </div>
    </div>
  );
}
