import { For, Show } from "solid-js";
import { Brain, Check, ChevronRight, Cpu, Server, Zap } from "lucide-solid";
import type { EngineEntry } from "../../lib/opencode/engineMeta";

function categoryIcon(cat: string) {
  switch (cat) {
    case "fast":
      return <Zap size={15} style="color:var(--rudra-orange)" />;
    case "reasoning":
      return <Brain size={15} style="color:#818cf8" />;
    case "local":
      return <Server size={15} style="color:var(--success)" />;
    default:
      return <Cpu size={15} style="color:var(--muted)" />;
  }
}

function tagStyle(tag: string): string {
  const base =
    "font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;border:1px solid;white-space:nowrap;";
  switch (tag) {
    case "Active":
      return `${base}background:var(--rudra-orange);border-color:transparent;color:#fff;`;
    case "Recommended":
      return `${base}background:rgba(255,77,28,0.1);border-color:rgba(255,77,28,0.3);color:var(--rudra-orange);`;
    case "New":
      return `${base}background:rgba(234,179,8,0.12);border-color:rgba(234,179,8,0.35);color:#ca8a04;`;
    case "Thinking":
    case "Local Daemon":
      return `${base}background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.3);color:#8b5cf6;`;
    case "High Speed":
    case "Open Weights":
      return `${base}background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.3);color:#3b82f6;`;
    case "Local":
      return `${base}background:rgba(63,185,80,0.1);border-color:rgba(63,185,80,0.3);color:var(--success);`;
    default:
      return `${base}background:var(--bg);border-color:var(--border);color:var(--muted);`;
  }
}

const ctxStyle =
  "font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap;";

/** One model row in the engine picker. Controlled: parent owns selection. */
export function EngineCard(props: {
  entry: EngineEntry;
  highlighted: boolean;
  onSelect: (value: string) => void;
  onHover: () => void;
}) {
  const entry = () => props.entry;
  return (
    <button
      type="button"
      onClick={() => props.onSelect(entry().option.value)}
      onMouseMove={() => props.onHover()}
      style={`display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid ${entry().active ? "rgba(255,77,28,0.4)" : props.highlighted ? "var(--rudra-orange)" : "var(--border)"};background:${entry().active ? "rgba(255,77,28,0.06)" : "var(--surface)"};cursor:pointer;transition:border-color var(--transition-fast)`}
    >
      <span
        style={`width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg);border:1px solid var(--border);flex-shrink:0`}
      >
        {categoryIcon(entry().meta.category)}
      </span>
      <span style="flex:1;min-width:0">
        <span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:800">{entry().option.modelName}</span>
          <Show when={entry().active}>
            <span style={tagStyle("Active")}>Active</span>
          </Show>
          <For each={entry().meta.tags}>
            {(t) => <span style={tagStyle(t)}>{t}</span>}
          </For>
          <Show when={entry().meta.ctx}>
            <span style={ctxStyle}>{entry().meta.ctx}</span>
          </Show>
        </span>
        <span style="display:block;margin-top:2px;font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          {entry().option.providerName} · {entry().meta.blurb}
        </span>
      </span>
      <Show
        when={entry().active}
        fallback={<ChevronRight size={14} style="color:var(--muted);flex-shrink:0" />}
      >
        <span
          style="width:22px;height:22px;border-radius:50%;border:1.5px solid var(--rudra-orange);color:var(--rudra-orange);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </Show>
    </button>
  );
}
