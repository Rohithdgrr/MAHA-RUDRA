import { For, Show } from "solid-js";
import { AlertTriangle, Bot, Brain, FileCode, Hammer, Layers, RefreshCw, User, Wrench } from "lucide-solid";
import type { MessageWithParts, Part } from "../../lib/backend/types";
import { strings } from "../../lib/i18n/en";
import { renderMarkdown } from "../../lib/utils/markdown";
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
export function PartView(props: { part: Part }) {
  const part = () => props.part as Part & Record<string, unknown>;
  const type = () => (part() as { type: string }).type;

  return (
    <>
      <Show when={type() === "text"}>
        {/* eslint-disable-next-line solid/no-innerhtml */}
        <div innerHTML={renderMarkdown((part() as unknown as { text?: string }).text ?? "")} style={MARKDOWN_STYLE} />
      </Show>
      <Show when={type() === "reasoning"}>
        <details
          style="margin-top:10px;border:1px solid var(--border);border-radius:12px;background:var(--bg);overflow:hidden"
          open={false}
        >
          <summary
            style="cursor:pointer;padding:10px 12px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--muted);list-style:none;transition:all var(--transition-fast)"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--fg)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--muted)")}
          >
            <Brain size={14} />
            {strings.reasoning}
            <span style="margin-left:auto;font-size:11px;opacity:0.7">click to expand</span>
          </summary>
          <div style="padding:12px;border-top:1px solid var(--border)">
            {/* eslint-disable-next-line solid/no-innerhtml */}
            <div innerHTML={renderMarkdown((part() as unknown as { text?: string }).text ?? "")} style={`color:var(--muted);${MARKDOWN_STYLE}`} />
          </div>
        </details>
      </Show>
      <Show when={type() === "tool"}>
        <ToolView part={props.part} />
      </Show>
      <Show when={type() === "file"}>
        <div style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border-radius:10px;background:var(--bg);border:1px solid var(--border);font-size:12px;color:var(--muted)">
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
        <div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:var(--bg);border:1px solid var(--border);font-size:11px;color:var(--muted);font-weight:600">
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
        <div style="margin-top:8px;padding:8px 11px;border-radius:10px;background:var(--bg);border:1px dashed var(--border);font-size:12px;color:var(--muted)">
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
  const statusInfo = () => {
    switch (state().status) {
      case "completed":
        return { label: strings.toolCompleted, color: "var(--success)", bg: "rgba(63,185,80,0.1)", icon: "✓" };
      case "error":
        return { label: strings.toolError, color: "var(--danger)", bg: "rgba(248,81,73,0.1)", icon: "✕" };
      case "running":
        return { label: strings.toolRunning, color: "var(--rudra-orange)", bg: "rgba(255,77,28,0.1)", icon: "◷" };
      default:
        return { label: strings.toolPending, color: "var(--muted)", bg: "var(--bg)", icon: "○" };
    }
  };
  return (
    <div
      style="margin-top:12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--bg);box-shadow:var(--shadow-sm);transition:all var(--transition-fast)"
    >
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--border)">
        <span
          style={`width:28px;height:28px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:${statusInfo().bg};color:${statusInfo().color};border:1px solid var(--border);font-size:12px`}
        >
          <Wrench size={13} />
        </span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px">
            {tool().tool}
            <span
              style={`font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${statusInfo().bg};color:${statusInfo().color};border:1px solid currentColor;opacity:0.9`}
            >
              {statusInfo().label}
            </span>
          </div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            {(state().title ?? truncate(JSON.stringify(state().input ?? {}), 80)) || "—"}
          </div>
        </div>
      </div>
      <Show when={state().status === "running" || state().status === "pending"}>
        <div style="padding:10px 12px">
          <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;color:var(--muted);max-height:120px;overflow-y:auto" class="rudra-scroll">
            {truncate(JSON.stringify(state().input ?? {}, null, 2), 600)}
          </pre>
        </div>
      </Show>
      <Show when={state().status === "completed" && typeof state().output === "string"}>
        <div style="padding:10px 12px">
          <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;line-height:1.5;max-height:220px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px" class="rudra-scroll">
            {truncate(state().output as string)}
          </pre>
        </div>
      </Show>
      <Show when={state().status === "error"}>
        <div style="padding:10px 12px;display:flex;gap:8px;align-items:flex-start;color:var(--danger);font-size:12px">
          <AlertTriangle size={14} style="flex-shrink:0;margin-top:1px" />
          <span>{state().error}</span>
        </div>
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
    <div style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:var(--bg);border:1px solid var(--border);font-size:11px;color:var(--muted)">
      <span style="width:6px;height:6px;border-radius:50%;background:var(--success);display:inline-block" />
      {strings.stepFinished} · {s().reason} · {total()} {strings.tokens}
      <Show when={typeof s().cost === "number"}> · ${Number(s().cost).toFixed(4)}</Show>
    </div>
  );
}

/** Renders one message (user or assistant) with avatar, bubble and entrance animation. */
export function MessageBubble(props: { message: MessageWithParts }) {
  const info = () => props.message.info;
  const isUser = () => info().role === "user";
  const created = () => (info() as unknown as { time: { created: number } }).time.created;
  const errorMsg = () => (!isUser() ? errorMessageOf(info()) : undefined);

  return (
    <div
      class="rudra-slide-up"
      style={`display:flex;gap:10px;align-items:flex-start;margin:14px 0;flex-direction:${isUser() ? "row-reverse" : "row"};animation-duration:0.35s`}
    >
      <span
        style={`width:32px;height:32px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;border:1px solid var(--border);box-shadow:var(--shadow-sm);background:${isUser() ? "var(--rudra-gradient)" : "var(--surface)"};color:${isUser() ? "white" : "var(--rudra-orange)"}`}
      >
        {isUser() ? <User size={15} /> : <Bot size={15} />}
      </span>
      <div
        style={`flex:1;min-width:0;max-width:min(78%,680px);padding:14px 16px;border-radius:18px;font-size:14px;line-height:1.65;box-shadow:var(--shadow-sm);border:1px solid ${isUser() ? "transparent" : "var(--border)"};background:${isUser() ? "var(--rudra-gradient)" : "var(--surface)"};color:${isUser() ? "white" : "var(--fg)"};position:relative;overflow:hidden`}
      >
        <Show when={isUser()}>
          <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%);pointer-events:none" />
        </Show>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;position:relative">
          <span style={`font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;opacity:${isUser() ? 0.95 : 0.9};color:${isUser() ? "white" : "var(--muted)"}`}>
            {isUser() ? "You" : "RUDRA"}
          </span>
          <span style={`font-size:11px;opacity:0.7;color:${isUser() ? "rgba(255,255,255,0.85)" : "var(--muted)"}`}>{formatTime(created())}</span>
        </div>
        <Show when={props.message.parts.length === 0}>
          <p style="margin:0;font-size:13px;opacity:0.7">…</p>
        </Show>
        <For each={props.message.parts}>{(part) => <PartView part={part} />}</For>
        <Show when={errorMsg()}>
          <div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:rgba(248,81,73,0.12);border:1px solid rgba(248,81,73,0.25);color:var(--danger);font-size:12px;display:flex;gap:8px;align-items:flex-start">
            <AlertTriangle size={14} style="flex-shrink:0;margin-top:1px" />
            <span>{errorMsg()}</span>
          </div>
        </Show>
      </div>
    </div>
  );
}
