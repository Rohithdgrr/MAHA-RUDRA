import { Show } from "solid-js";
import { Bot, Brain, ChevronUp, FileCode, Hammer, Layers, RefreshCw } from "lucide-solid";
import type { Part } from "../../lib/backend/types";
import { strings } from "../../lib/i18n/en";
import { handleCodeCardClick, renderRichMarkdown } from "../../lib/utils/markdown";
import { ToolView } from "./ToolView";

const MARKDOWN_STYLE =
  "[&>p]:my-2 [&>p]:leading-7 [&>pre]:overflow-x-auto [&>pre]:bg-[var(--bg)] [&>pre]:border [&>pre]:border-[var(--border)] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:my-3 [&>code]:bg-[var(--bg)] [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:text-[13px] [&>code]:border [&>code]:border-[var(--border)] [&>ul]:my-2 [&>ul]:pl-5 [&>ul]:list-disc [&>ol]:my-2 [&>ol]:pl-5 [&>ol]:list-decimal [&>h1]:text-[18px] [&>h2]:text-[16px] [&>h3]:text-[14px] [&>h1]:font-bold [&>h2]:font-semibold [&>blockquote]:border-l-2 [&>blockquote]:border-[var(--rudra-orange)] [&>blockquote]:pl-3 [&>blockquote]:my-2 [&>blockquote]:text-[var(--muted)]";

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
