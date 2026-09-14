import { Match, Switch, type JSX } from "solid-js";
import {
  Brain,
  Cpu,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Settings as SettingsIcon,
} from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { memoryStore } from "../../lib/memory/memory.store";
import { uiStore } from "../../lib/stores/ui.store";
import { SettingsTabs } from "../ui/Tabs";
import { AgentTab } from "./AgentTab";
import { GeneralTab } from "./GeneralTab";
import { ModelTab } from "./ModelTab";
import { MemoryTab } from "./memory/MemoryTab";

export type SettingsTabId = "general" | "model" | "agent" | "memory";

function tabDefs(): { id: SettingsTabId; label: string; icon: () => JSX.Element; dot?: boolean }[] {
  return [
    { id: "general", label: strings.tabGeneral, icon: () => <SlidersHorizontal size={15} /> },
    { id: "model", label: strings.tabModels, icon: () => <Cpu size={15} /> },
    { id: "agent", label: strings.tabAgent, icon: () => <ShieldCheck size={15} /> },
    {
      id: "memory",
      label: strings.tabMemory,
      icon: () => <Brain size={15} />,
      dot: memoryStore.state.memories.some((m) => m.status === "pending"),
    },
  ];
}

export function SettingsBody(props: { tab: SettingsTabId; setTab: (t: SettingsTabId) => void }) {
  const version = () => uiStore.state.serverVersion;
  return (
    <div style="display:flex;gap:0;min-height:440px">
      <div
        style="width:220px;min-width:220px;border-right:1px solid var(--border);padding:6px 12px 12px 0;margin-right:20px;display:flex;flex-direction:column"
      >
        <SettingsTabs tabs={tabDefs()} active={props.tab} onChange={props.setTab} />
        <div style="margin-top:auto;padding:12px 4px 0;border-top:1px solid var(--border);font-size:10px;color:var(--muted);font-family:ui-monospace,monospace;line-height:1.7">
          <div style="display:flex;justify-content:space-between">
            <span>{strings.settingsRuntime}</span>
            <span style="color:var(--fg)">Rust Tokio</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span>{strings.settingsDaemon}</span>
            <span style="color:var(--success)">v{version() ?? "?.?.?"} (PID 4910)</span>
          </div>
        </div>
      </div>
      <div style="flex:1;min-width:0">
        <Switch>
          <Match when={props.tab === "general"}>
            <GeneralTab />
          </Match>
          <Match when={props.tab === "model"}>
            <ModelTab />
          </Match>
          <Match when={props.tab === "agent"}>
            <AgentTab />
          </Match>
          <Match when={props.tab === "memory"}>
            <MemoryTab />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export function SettingsHeader(props: { onClose: () => void }) {
  return (
    <div style="display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--border);flex-shrink:0">
      <span style="width:36px;height:36px;border-radius:12px;background:var(--rudra-gradient);display:inline-flex;align-items:center;justify-content:center;color:white;flex-shrink:0;box-shadow:var(--shadow-glow)">
        <SettingsIcon size={18} />
      </span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px">
          <h2 style="margin:0;font-size:16px;font-weight:800;letter-spacing:-0.02em">
            {strings.workspaceSettings}
          </h2>
          <span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:999px;border:1px solid var(--border);color:var(--muted)">
            {strings.globalScope}
          </span>
        </div>
        <p style="margin:3px 0 0;font-size:12px;color:var(--muted)">{strings.settingsSubtitle}</p>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={() => props.onClose()}
        style="width:32px;height:32px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all var(--transition-fast)"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)";
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
