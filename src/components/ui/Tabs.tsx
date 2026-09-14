import { For, Show } from "solid-js";
import type { JSX } from "solid-js";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: () => JSX.Element;
  dot?: boolean;
}

interface SettingsTabsProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (next: T) => void;
}

/** Vertical settings nav (General / Models & Fallbacks / …). Controlled. */
export function SettingsTabs<T extends string>(props: SettingsTabsProps<T>) {
  return (
    <nav aria-label="Settings sections" style="display:flex;flex-direction:column;gap:2px">
      <For each={props.tabs}>
        {(tab) => {
          const active = () => props.active === tab.id;
          return (
            <button
              type="button"
              onClick={() => props.onChange(tab.id)}
              aria-current={active() ? "page" : undefined}
              style={`display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 12px;border:none;border-radius:10px;font-size:13px;font-weight:${active() ? "700" : "500"};font-family:inherit;cursor:pointer;transition:all var(--transition-fast);background:${active() ? "var(--surface)" : "transparent"};color:${active() ? "var(--fg)" : "var(--muted)"};box-shadow:${active() ? "var(--shadow-sm)" : "none"};border-left:${active() ? "2px solid var(--rudra-orange)" : "2px solid transparent"}`}
              onMouseEnter={(e) => {
                if (!active()) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active()) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <Show when={tab.icon}>
                <span style="display:inline-flex;flex-shrink:0">{tab.icon!()}</span>
              </Show>
              <span style="flex:1">{tab.label}</span>
              <Show when={tab.dot}>
                <span
                  style="width:7px;height:7px;border-radius:50%;background:var(--success);flex-shrink:0"
                  title="Active"
                />
              </Show>
            </button>
          );
        }}
      </For>
    </nav>
  );
}
