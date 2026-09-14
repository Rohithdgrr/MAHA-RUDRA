import { Show } from "solid-js";
import { Toggle } from "../ui/Toggle";

export function Section(props: { title: string; right?: unknown; children: unknown }) {
  return (
    <section style="margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
        <h3 style="margin:0;font-size:13px;font-weight:800;letter-spacing:-0.01em">
          {props.title}
        </h3>
        <Show when={props.right}>{props.right as never}</Show>
      </div>
      {props.children as never}
    </section>
  );
}

export function Card(props: { children: unknown }) {
  return (
    <div
      style="padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface)"
    >
      {props.children as never}
    </div>
  );
}

export function ToggleRow(props: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-bottom:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">{props.title}</div>
        <div style="margin-top:2px;font-size:11px;color:var(--muted);line-height:1.5">{props.hint}</div>
      </div>
      <Toggle checked={props.checked} onChange={props.onChange} label={props.title} />
    </div>
  );
}
