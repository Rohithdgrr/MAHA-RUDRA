import { For, Show } from "solid-js";
import type { JSX } from "solid-js";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: () => JSX.Element;
  title?: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}

/** Segmented control (e.g. Always Ask / Safe Read-Only / Autonomous). Controlled. */
export function Segmented<T extends string>(props: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={props.label ?? "Options"}
      style="display:flex;gap:4px;padding:4px;border-radius:12px;background:var(--bg-subtle);border:1px solid var(--border)"
    >
      <For each={props.options}>
        {(opt) => {
          const active = () => props.value === opt.value;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={active()}
              title={opt.title ?? opt.label}
              onClick={() => props.onChange(opt.value)}
              style={`flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 10px;border:none;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:all var(--transition-fast);background:${active() ? "var(--surface)" : "transparent"};color:${active() ? "var(--fg)" : "var(--muted)"};box-shadow:${active() ? "var(--shadow-sm)" : "none"}`}
              onMouseEnter={(e) => {
                if (!active()) (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
              }}
              onMouseLeave={(e) => {
                if (!active()) (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
              }}
            >
              <Show when={opt.icon}>{opt.icon!()}</Show>
              {opt.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}
