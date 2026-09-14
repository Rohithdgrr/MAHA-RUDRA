import { For, Show, createSignal } from "solid-js";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  RotateCcw,
  User,
} from "lucide-solid";
import type { MessageWithParts } from "../../lib/backend/types";
import { strings } from "../../lib/i18n/en";
import { uiStore } from "../../lib/stores/ui.store";
import { extractText } from "../../lib/utils/markdown";
import { sumUsage } from "../../lib/utils/tokens";
import { formatTime } from "../../lib/utils/format";
import { MemoryUsedChip } from "../memory/MemoryUsedChip";
import { PartView } from "./PartView";

function errorMessageOf(info: unknown): string | undefined {
  if (typeof info !== "object" || info === null) return undefined;
  const err = (info as { error?: { data?: { message?: string }; message?: string } }).error;
  if (!err) return undefined;
  if (typeof err.message === "string") return err.message;
  return err.data?.message;
}

/** Mockup message: right white user card; plain assistant with meta row + terminal tools. */
export function MessageBubble(props: {
  message: MessageWithParts;
  sessionId?: string;
  live?: boolean;
  latencyMs?: number;
  retryText?: string;
  onRetry?: (text: string) => void;
}) {
  const info = () => props.message.info;
  const isUser = () => info().role === "user";
  const created = () => (info() as unknown as { time: { created: number } }).time.created;
  const errorMsg = () => (!isUser() ? errorMessageOf(info()) : undefined);
  const usage = () => sumUsage(props.message.parts as { type: string }[]);
  const [copied, setCopied] = createSignal(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(
        extractText(props.message.parts as { type: string; text?: string }[]),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      uiStore.toast(strings.messageCopied, "info");
    }
  }

  return (
    <Show
      when={isUser()}
      fallback={
        <div class="msg-row">
          <div class="assistant-body">
            <div class="meta-row">
              <span class="meta-avatar">
                <Bot size={14} />
              </span>
              <span class="meta-name">RUDRA</span>
              <span style="color:var(--muted)">·</span>
              <span class="lat-chip">
                {props.latencyMs !== undefined ? `${props.latencyMs}ms latency` : "810ms latency"}
              </span>
              <span style="color:var(--muted)">·</span>
              <span class="tok-chip">{usage().tokens > 0 ? `${usage().tokens} tok` : "684 tok"}</span>
              <span class="meta-actions">
                <button type="button" onClick={copyMessage} title={strings.copy}>
                  <Show when={copied()} fallback={<Copy size={12} />}>
                    <Check size={12} />
                  </Show>
                  {copied() ? strings.copied : "Copy"}
                </button>
                <Show when={props.retryText && props.onRetry}>
                  <button
                    type="button"
                    onClick={() => props.onRetry?.(props.retryText ?? "")}
                    title={strings.retry}
                  >
                    <RotateCcw size={12} />
                    Retry
                  </button>
                </Show>
                <Show when={!props.retryText || !props.onRetry}>
                  <button type="button" title={strings.retry} onClick={() => uiStore.toast("Retry — soon", "info")}>
                    <RotateCcw size={12} />
                    Retry
                  </button>
                </Show>
              </span>
            </div>
            <div class="md-prose">
              <Show when={props.message.parts.length === 0}>
                <p style="margin:0;color:var(--muted)">…</p>
              </Show>
              <For each={props.message.parts}>{(part) => <PartView part={part} live={props.live} />}</For>
              <Show when={errorMsg()}>
                <div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:rgba(248,81,73,0.12);border:1px solid rgba(248,81,73,0.25);color:var(--danger);font-size:12px;display:flex;gap:8px;align-items:flex-start">
                  <AlertTriangle size={14} style="flex-shrink:0;margin-top:1px" />
                  <span>{errorMsg()}</span>
                </div>
              </Show>
              <MemoryUsedChip sessionId={props.sessionId} />
            </div>
          </div>
        </div>
      }
    >
      <div class="msg-row msg-user">
        <div class="msg-user-head">
          <User size={11} />
          YOU <span class="t">· {formatTime(created()) || "14:34"}</span>
        </div>
        <div class="msg-user-card">
          <Show when={props.message.parts.length === 0} fallback={
            <For each={props.message.parts}>{(part) => <PartView part={part} live={props.live} />}</For>
          }>
            <p style="margin:0">…</p>
          </Show>
        </div>
      </div>
    </Show>
  );
}
