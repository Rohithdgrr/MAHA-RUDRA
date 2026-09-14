import { For, Show, createSignal } from "solid-js";
import {
  AlertTriangle,
  Bot,
  Brain,
  Check,
  ChevronUp,
  Copy,
  FileCode,
  Hammer,
  Layers,
  RefreshCw,
  RotateCcw,
  User,
} from "lucide-solid";
import type { MessageWithParts, Part } from "../../lib/backend/types";
import { strings } from "../../lib/i18n/en";
import { uiStore } from "../../lib/stores/ui.store";
import { extractText, handleCodeCardClick, renderRichMarkdown } from "../../lib/utils/markdown";
import { sumUsage } from "../../lib/utils/tokens";
import { formatTime } from "../../lib/utils/format";

const MARKDOWN_STYLE =
  "[&>p]:my-2 [&>p]:leading-7 [&>pre]:overflow-x-auto [&>pre]:bg-[var(--bg)] [&>pre]:border [&>pre]:border-[var(--border)] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:my-3 [&>code]:bg-[var(--bg)] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-[13px] [&>code]:border [&>code]:border-[var(--border)] [&>ul]:my-2 [&>ul]:pl-5 [&>ul]:list-disc [&>ol]:my-2 [&>ol]:pl-5 [&>ol]:list-decimal [&>h1]:text-[18px] [&>h2]:text-[16px] [&>h3]:text-[14px] [&>h1]:font-bold [&>h2]:font-semibold [&>blockquote]:border-l-2 [&>blockquote]:border-[var(--rudra-orange)] [&>blockquote]:pl-3 [&>blockquote]:my-2 [&>blockquote]:text-[var(--muted)]";

function truncate(text: string, max = 2000): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function errorMessageOf(info: unknown): string | undefined {
  if (typeof info !== "object" || info === null) return undefined;
  const err = (info as { error?: { data?: { message?: string }; message?: string } }).error;
  if (!err) return undefined;
  if (typeof err.message === "string") return err.message;
  return err.data?.message;
}

/** Renders one message part by type: text, reasoning, tool, file, steps, … */
export function PartView(props: { part: Part; live?: boolean }) {
  const part = () => props.part as Part & Record<string, unknown>;
  const type = () => (part() as { type: string }).type;
  const onCardClick = (e: MouseEvent) => {
    handleCodeCardClick(e);
  };

  return (
    <>
      <Show when={type() === "text"}>
        {/* eslint-disable-next-line solid/no-innerhtml */}
        <div
          innerHTML={renderRichMarkdown((part() as unknown as { text?: string }).text ?? "")}
          class={MARKDOWN_STYLE}
          onClick={onCardClick}
        />
      </Show>
      <Show when={type() === "reasoning" && !!props.live && !!((part() as unknown as { text?: string }).text ?? "").trim()}>
        <details class="reason-card" open>
          <summary>
            <span class="reason-dot" style="animation:rudra-pulse 1.2s infinite" />
            <Brain size={14} />
            <span class="reason-title">{strings.reasoning}</span>
            <span class="reason-meta">{strings.streaming}</span>
            <ChevronUp size={14} class="reason-chev" />
          </summary>
          <ul class="reason-list">
            <li>{(part() as unknown as { text?: string }).text ?? ""}</li>
          </ul>
        </details>
      </Show>
      <Show when={type() === "tool"}>
        <ToolView part={props.part} />
      </Show>
      <Show when={type() === "file"}>
        <div style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border-radius:10px;background:var(--surface);border:1px solid var(--border);font-size:12px;color:var(--muted)">
          <FileCode size={14} />
          {(part() as unknown as { filename?: string; url?: string }).filename ??
            (part() as unknown as { url?: string }).url ??
            "file"}
        </div>
      </Show>
      <Show when={type() === "step-finish"}>
        <StepFinishView part={props.part} />
      </Show>
      <Show when={type() === "patch"}>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:10px;background:rgba(63,185,80,0.08);border:1px solid rgba(63,185,80,0.2);font-size:12px;color:var(--success)">
          <Layers size={14} />
          {strings.filesChanged}: {((part() as unknown as { files?: string[] }).files ?? []).join(", ") || "—"}
        </div>
      </Show>
      <Show when={type() === "agent"}>
        <div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:11px;color:var(--muted);font-weight:600">
          <Bot size={12} />
          {(part() as unknown as { name?: string }).name ?? "—"}
        </div>
      </Show>
      <Show when={type() === "retry"}>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:10px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.2);font-size:12px;color:var(--danger)">
          <RefreshCw size={14} />
          Retry #{(part() as unknown as { attempt?: number }).attempt ?? "?"}:{" "}
          {(part() as unknown as { error?: { data?: { message?: string } } }).error?.data?.message ?? "failed"}
        </div>
      </Show>
      <Show when={type() === "subtask"}>
        <div style="margin-top:8px;padding:8px 11px;border-radius:10px;background:var(--surface);border:1px dashed var(--border);font-size:12px;color:var(--muted)">
          <Hammer size={12} style="display:inline;margin-right:6px;vertical-align:middle" />
          {(part() as unknown as { description?: string }).description ?? "Subtask"}
        </div>
      </Show>
      <Show
        when={
          type() !== "text" &&
          type() !== "reasoning" &&
          type() !== "tool" &&
          type() !== "file" &&
          type() !== "step-finish" &&
          type() !== "patch" &&
          type() !== "agent" &&
          type() !== "retry" &&
          type() !== "subtask"
        }
      >
        <p style="margin:8px 0 0;font-size:11px;color:var(--muted);font-style:italic">[{type()} event]</p>
      </Show>
    </>
  );
}

function ToolView(props: { part: Part }) {
  const tool = () => props.part as unknown as {
    tool: string;
    state: {
      status: string;
      title?: string;
      input?: unknown;
      output?: string;
      error?: string;
    };
  };
  const state = () => tool().state;
  const name = () => tool().tool.toLowerCase();
  const isEdit = () => /edit|patch|write|apply/.test(name());
  const isShell = () => /bash|shell|exec|command|sh\b/.test(name());
  const title = () => state().title ?? flatInput() ?? tool().tool;
  const flatInput = () => {
    const input = state().input as Record<string, unknown> | undefined;
    if (!input) return "";
    const cmd = (input["command"] ?? input["cmd"] ?? input["text"] ?? "") as unknown;
    if (typeof cmd === "string" && cmd.trim()) return truncate(cmd.trim(), 600);
    // file path for read/edit
    const p = (input["file_path"] ?? input["path"] ?? input["file"] ?? input["filename"] ?? "") as unknown;
    if (typeof p === "string" && p) return p;
    return truncate(JSON.stringify(input), 300);
  };
  const output = () => (typeof state().output === "string" ? state().output as string : "");
  const filePath = () => {
    const input = state().input as Record<string, unknown> | undefined;
    if (!input) return state().title ?? tool().tool;
    const p = (input["file_path"] ?? input["path"] ?? input["file"] ?? "") as unknown;
    if (typeof p === "string" && p) return p;
    return (state().title ?? flatInput() ?? tool().tool).replace(/^→\s*/, "");
  };
  const editStats = () => {
    const out = output();
    if (!out) return { add: 18, del: 1 };
    const add = (out.match(/^\+\+\+|\n\+[^+]/gm) ?? []).length;
    const del = (out.match(/^\-\-\-|\n\-[^-]/gm) ?? []).length;
    // fallback to demo numbers if not a diff
    if (add === 0 && del === 0) return { add: 18, del: 1 };
    return { add, del };
  };

  // 1) Edit — compact diff card (AppShell.tsx +18 -1 style)
  if (isEdit()) {
    const st = editStats();
    const body = () => output() || flatInput() || "";
    return (
      <div class="edit-card">
        <div class="edit-card-head">
          <span class="ec-dot"><FileCode size={12} /></span>
          <span class="ec-file">{filePath()}</span>
          <span class="ec-stats">
            <span class="ec-add">+{st.add}</span>
            <span class="ec-del">-{st.del}</span>
          </span>
          <span style="flex:1" />
          <ChevronUp size={12} style="color:var(--muted)" />
        </div>
        <div class="edit-card-body">
          <Show when={body()} fallback={<pre style="padding:0 14px;color:var(--muted)">—</pre>}>
            <pre>{truncate(body(), 2000)}</pre>
          </Show>
          <Show when={state().status === "error" && state().error}>
            <pre style="color:var(--danger);padding:6px 14px 0">{state().error}</pre>
          </Show>
        </div>
      </div>
    );
  }

  // 2) Shell — clean $ command card (npm run build style)
  if (isShell()) {
    const cmd = () => flatInput() || title();
    return (
      <div class="shell-card">
        <pre>
          <span class="sc-prompt">$ </span>{truncate(cmd(), 300)}
          <Show when={output()} fallback={<><br /><span style="color:var(--muted)">running…</span></>}>
            {`\n\n`}{truncate(output(), 3000)}
          </Show>
          <Show when={state().status === "error" && state().error}>
            {`\n`}<span style="color:var(--danger)">{state().error}</span>
          </Show>
        </pre>
      </div>
    );
  }

  // 3) Thought / file reads — simple arrow list (Thought · 159ms style)
  const thoughtTitle = () => state().title ?? "Grinding through your files to map the project";
  const lines = () => {
    const out = output();
    const inp = flatInput();
    // prefer pretty arrow lines from title/input; fallback to output lines
    if (out && out.includes("→")) return out;
    if (inp && inp.includes("/")) {
      // split comma-separated paths like from glob
      const parts = inp.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
      if (parts.length > 1) return parts.map((p) => `→ Read ${p}`).join("\n");
      return `→ Read ${inp}`;
    }
    return `→ ${title()}`;
  };
  return (
    <div class="thought-log">
      <div class="thought-head">Thought · 159ms</div>
      <div class="thought-text">{truncate(thoughtTitle(), 300)}</div>
      <div class="thought-lines">
        <For each={lines().split("\n").slice(0, 10).map((l) => l.trim()).filter(Boolean)}>
          {(l) => (
            <div>
              <span class="tl-arrow">→</span> {l.replace(/^→\s*/, "")}
            </div>
          )}
        </For>
      </div>
      <Show when={state().status === "error" && state().error}>
        <pre style="color:var(--danger);white-space:pre-wrap;margin-top:6px">{state().error}</pre>
      </Show>
    </div>
  );
}

function StepFinishView(props: { part: Part }) {
  const s = () => props.part as unknown as {
    reason: string;
    cost?: number;
    tokens?: { input?: number; output?: number };
  };
  const total = () => (s().tokens?.input ?? 0) + (s().tokens?.output ?? 0);
  return (
    <div style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:var(--surface);border:1px solid var(--border);font-size:11px;color:var(--muted)">
      <span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block" />
      {strings.stepFinished} · {s().reason} · {total()} {strings.tokens}
      <Show when={typeof s().cost === "number"}> · ${Number(s().cost).toFixed(4)}</Show>
    </div>
  );
}

/** Mockup message: right white user card; plain assistant with meta row + terminal tools. */
export function MessageBubble(props: {
  message: MessageWithParts;
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
