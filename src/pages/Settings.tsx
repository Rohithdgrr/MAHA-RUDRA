import { createSignal, For, Match, Show, Switch, onCleanup, onMount, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Check,
  Coins,
  Copy,
  Cpu,
  Eye,
  Info,
  Moon,
  Server,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  X,
  Zap,
} from "lucide-solid";
import { strings } from "../lib/i18n/en";
import {
  DEFAULT_PREFS,
  uiStore,
  type ApprovalMode,
  type Prefs,
} from "../lib/stores/ui.store";
import { getServerUrl } from "../lib/utils/env";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { Segmented } from "../components/ui/Segmented";
import { SettingsTabs } from "../components/ui/Tabs";
import { Slider } from "../components/ui/Slider";
import { Toggle } from "../components/ui/Toggle";
import { ModelPicker } from "../components/chat/ModelPicker";

export type SettingsTabId = "general" | "models" | "tools" | "daemon" | "cost";

const APPROVAL_HINTS: Record<ApprovalMode, string> = {
  "always-ask": strings.approvalAlwaysAskHint,
  "read-only": strings.approvalReadOnlyHint,
  autonomous: strings.approvalAutonomousHint,
};

// ---------------------------------------------------------------------------
// Draft: local signals initialized from prefs; Save writes them back.
// ---------------------------------------------------------------------------

export interface SettingsDraft {
  tab: () => SettingsTabId;
  setTab: (t: SettingsTabId) => void;
  approvalMode: () => ApprovalMode;
  setApprovalMode: (v: ApprovalMode) => void;
  compressionThreshold: () => number;
  setCompressionThreshold: (v: number) => void;
  daemonAutoConnect: () => boolean;
  setDaemonAutoConnect: (v: boolean) => void;
  daemonHost: () => string;
  setDaemonHost: (v: string) => void;
  daemonPort: () => string;
  setDaemonPort: (v: string) => void;
  telemetryAlertAt: () => string;
  setTelemetryAlertAt: (v: string) => void;
  tokenBudget: () => string;
  setTokenBudget: (v: string) => void;
  fallbackModel: () => string;
  setFallbackModel: (v: string) => void;
  confirmBash: () => boolean;
  setConfirmBash: (v: boolean) => void;
  confirmWrite: () => boolean;
  setConfirmWrite: (v: boolean) => void;
  confirmNetwork: () => boolean;
  setConfirmNetwork: (v: boolean) => void;
  dirty: () => boolean;
  save: (close?: () => void) => void;
  reset: () => void;
}

function snapshotPrefs(get: {
  approvalMode: ApprovalMode;
  compressionThreshold: number;
  daemonAutoConnect: boolean;
  daemonHost: string;
  daemonPort: string;
  telemetryAlertAt: string;
  tokenBudget: string;
  fallbackModel: string;
  confirmBash: boolean;
  confirmWrite: boolean;
  confirmNetwork: boolean;
}): Prefs {
  return {
    ...get,
    daemonHost: get.daemonHost.trim() || DEFAULT_PREFS.daemonHost,
    daemonPort: get.daemonPort.trim() || DEFAULT_PREFS.daemonPort,
    telemetryAlertAt: get.telemetryAlertAt.trim() || DEFAULT_PREFS.telemetryAlertAt,
    tokenBudget: get.tokenBudget.trim(),
    fallbackModel: get.fallbackModel.trim(),
    effort: uiStore.state.prefs.effort,
  };
}

export function createSettingsDraft(): SettingsDraft {
  const p = () => uiStore.state.prefs;
  const [tab, setTab] = createSignal<SettingsTabId>("general");
  const [approvalMode, setApprovalMode] = createSignal<ApprovalMode>(p().approvalMode);
  const [compressionThreshold, setCompressionThreshold] = createSignal<number>(
    p().compressionThreshold,
  );
  const [daemonAutoConnect, setDaemonAutoConnect] = createSignal<boolean>(p().daemonAutoConnect);
  const [daemonHost, setDaemonHost] = createSignal<string>(p().daemonHost);
  const [daemonPort, setDaemonPort] = createSignal<string>(p().daemonPort);
  const [telemetryAlertAt, setTelemetryAlertAt] = createSignal<string>(p().telemetryAlertAt);
  const [tokenBudget, setTokenBudget] = createSignal<string>(p().tokenBudget);
  const [fallbackModel, setFallbackModel] = createSignal<string>(p().fallbackModel);
  const [confirmBash, setConfirmBash] = createSignal<boolean>(p().confirmBash);
  const [confirmWrite, setConfirmWrite] = createSignal<boolean>(p().confirmWrite);
  const [confirmNetwork, setConfirmNetwork] = createSignal<boolean>(p().confirmNetwork);

  const draft = {
    tab,
    setTab,
    approvalMode,
    setApprovalMode,
    compressionThreshold,
    setCompressionThreshold,
    daemonAutoConnect,
    setDaemonAutoConnect,
    daemonHost,
    setDaemonHost,
    daemonPort,
    setDaemonPort,
    telemetryAlertAt,
    setTelemetryAlertAt,
    tokenBudget,
    setTokenBudget,
    fallbackModel,
    setFallbackModel,
    confirmBash,
    setConfirmBash,
    confirmWrite,
    setConfirmWrite,
    confirmNetwork,
    setConfirmNetwork,
  };

  const snap = (): Prefs =>
    snapshotPrefs({
      approvalMode: approvalMode(),
      compressionThreshold: compressionThreshold(),
      daemonAutoConnect: daemonAutoConnect(),
      daemonHost: daemonHost(),
      daemonPort: daemonPort(),
      telemetryAlertAt: telemetryAlertAt(),
      tokenBudget: tokenBudget(),
      fallbackModel: fallbackModel(),
      confirmBash: confirmBash(),
      confirmWrite: confirmWrite(),
      confirmNetwork: confirmNetwork(),
    });

  const dirty = () => JSON.stringify(snap()) !== JSON.stringify({ ...uiStore.state.prefs });

  function save(close?: () => void) {
    uiStore.setPrefs(snap());
    uiStore.toast(strings.prefsSaved, "success");
    close?.();
  }

  function reset() {
    uiStore.resetPrefs();
    const d = uiStore.state.prefs;
    setApprovalMode(d.approvalMode);
    setCompressionThreshold(d.compressionThreshold);
    setDaemonAutoConnect(d.daemonAutoConnect);
    setDaemonHost(d.daemonHost);
    setDaemonPort(d.daemonPort);
    setTelemetryAlertAt(d.telemetryAlertAt);
    setTokenBudget(d.tokenBudget);
    setFallbackModel(d.fallbackModel);
    setConfirmBash(d.confirmBash);
    setConfirmWrite(d.confirmWrite);
    setConfirmNetwork(d.confirmNetwork);
    uiStore.toast(strings.prefsReset, "info");
  }

  return { ...draft, dirty, save, reset };
}

/** ⌘S / Ctrl+S saves when dirty. Mount-gated by the caller. */
function useSaveShortcut(draft: SettingsDraft, onSave: () => void) {
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (draft.dirty()) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function Section(props: { title: string; right?: unknown; children: unknown }) {
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

function Card(props: { children: unknown }) {
  return (
    <div
      style="padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--surface)"
    >
      {props.children as never}
    </div>
  );
}

function ToggleRow(props: {
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

const inputStyle =
  "width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--fg);font-size:13px;font-family:inherit;outline:none";

function TextField(props: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div style="margin-bottom:12px">
      <label style="display:block;font-size:12px;font-weight:700;margin-bottom:6px">{props.label}</label>
      <input
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder={props.placeholder}
        style={inputStyle}
      />
      <Show when={props.hint}>
        <p style="margin:6px 0 0;font-size:11px;color:var(--muted);line-height:1.5">{props.hint}</p>
      </Show>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab panels
// ---------------------------------------------------------------------------

function ThemeSection() {
  const theme = () => uiStore.state.theme;
  const card = (which: "dark" | "light") =>
    `display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1.5px solid ${theme() === which ? "var(--rudra-orange)" : "var(--border)"};background:${theme() === which ? "rgba(255,77,28,0.08)" : "var(--bg)"};cursor:pointer;transition:all var(--transition-fast);text-align:left;width:100%`;
  return (
    <Section title={strings.theme}>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button type="button" onClick={() => uiStore.setTheme("dark")} style={card("dark")}>
          <span
            style={`width:32px;height:32px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:${theme() === "dark" ? "var(--rudra-orange)" : "var(--surface)"};color:${theme() === "dark" ? "white" : "var(--muted)"}`}
          >
            <Moon size={15} />
          </span>
          <span style="flex:1">
            <span style="display:block;font-size:13px;font-weight:700">{strings.dark}</span>
            <span style="display:block;font-size:11px;color:var(--muted)">Midnight coding</span>
          </span>
          <Show when={theme() === "dark"}>
            <Check size={15} style="color:var(--rudra-orange)" />
          </Show>
        </button>
        <button type="button" onClick={() => uiStore.setTheme("light")} style={card("light")}>
          <span
            style={`width:32px;height:32px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:${theme() === "light" ? "var(--rudra-orange)" : "var(--surface)"};color:${theme() === "light" ? "white" : "var(--muted)"}`}
          >
            <Sun size={15} />
          </span>
          <span style="flex:1">
            <span style="display:block;font-size:13px;font-weight:700">{strings.light}</span>
            <span style="display:block;font-size:11px;color:var(--muted)">Sacred ash</span>
          </span>
          <Show when={theme() === "light"}>
            <Check size={15} style="color:var(--rudra-orange)" />
          </Show>
        </button>
      </div>
      <p style="margin:8px 0 0;font-size:11px;color:var(--muted)">{strings.appearanceHint}</p>
    </Section>
  );
}

function ShortcutsSection() {
  return (
    <Section title={strings.keyboardShortcuts}>
      <div style="display:flex;flex-direction:column;gap:8px">
        <For
          each={[
            ["Ctrl / ⌘ + Enter", "Send prompt"],
            ["Ctrl / ⌘ + K", "Command palette"],
            ["Ctrl / ⌘ + N", "New session"],
            ["Ctrl / ⌘ + S", "Save settings"],
            ["Esc", "Stop current stream"],
          ]}
        >
          {([k, v]) => (
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:10px;background:var(--surface);border:1px solid var(--border)">
              <span style="font-size:12px;font-weight:500">{v}</span>
              <kbd style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:7px;background:var(--bg);border:1px solid var(--border);border-bottom-width:2px;color:var(--muted);font-family:inherit">
                {k}
              </kbd>
            </div>
          )}
        </For>
      </div>
    </Section>
  );
}

function GeneralTab(props: { draft: SettingsDraft }) {
  const d = () => props.draft;
  return (
    <div>
      <Section
        title={strings.toolApprovalMode}
        right={
          <span style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);font-weight:700">
            {strings.gatingStrategy}
          </span>
        }
      >
        <Segmented
          label={strings.toolApprovalMode}
          value={d().approvalMode()}
          onChange={(v) => d().setApprovalMode(v)}
          options={[
            { value: "always-ask", label: strings.approvalAlwaysAsk, icon: () => <ShieldCheck size={13} /> },
            { value: "read-only", label: strings.approvalReadOnly, icon: () => <Eye size={13} /> },
            { value: "autonomous", label: strings.approvalAutonomous, icon: () => <Zap size={13} /> },
          ]}
        />
        <p style="margin:8px 0 0;font-size:11px;color:var(--muted);line-height:1.5">
          {APPROVAL_HINTS[d().approvalMode()]}
        </p>
      </Section>

      <Section title={strings.defaultAgentModel}>
        <Card>
          <ModelPicker />
        </Card>
      </Section>

      <Section
        title={strings.contextCompression}
        right={
          <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:7px;background:rgba(255,77,28,0.1);border:1px solid rgba(255,77,28,0.25);color:var(--rudra-orange);font-family:ui-monospace,monospace">
            {d().compressionThreshold()}% {strings.threshold}
          </span>
        }
      >
        <Slider
          label={strings.contextCompression}
          min={50}
          max={95}
          value={d().compressionThreshold()}
          onChange={(v) => d().setCompressionThreshold(v)}
        />
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--muted);font-family:ui-monospace,monospace">
          <span>{strings.compressionConservative}</span>
          <span>{strings.compressionOptimized}</span>
          <span>{strings.compressionAggressive}</span>
        </div>
      </Section>

      <ThemeSection />
      <ShortcutsSection />
    </div>
  );
}

function ModelsTab(props: { draft: SettingsDraft }) {
  const d = () => props.draft;
  return (
    <div>
      <Section title={strings.defaultAgentModel}>
        <Card>
          <ModelPicker />
        </Card>
      </Section>
      <Section title={strings.fallbackModel}>
        <Card>
          <TextField
            label={strings.fallbackModel}
            value={d().fallbackModel()}
            onInput={(v) => d().setFallbackModel(v)}
            placeholder={strings.fallbackModelPlaceholder}
            hint={strings.fallbackModelHint}
          />
        </Card>
      </Section>
    </div>
  );
}

function ToolsTab(props: { draft: SettingsDraft }) {
  const d = () => props.draft;
  return (
    <div>
      <Section title={strings.toolApprovalMode}>
        <Segmented
          label={strings.toolApprovalMode}
          value={d().approvalMode()}
          onChange={(v) => d().setApprovalMode(v)}
          options={[
            { value: "always-ask", label: strings.approvalAlwaysAsk, icon: () => <ShieldCheck size={13} /> },
            { value: "read-only", label: strings.approvalReadOnly, icon: () => <Eye size={13} /> },
            { value: "autonomous", label: strings.approvalAutonomous, icon: () => <Zap size={13} /> },
          ]}
        />
        <p style="margin:8px 0 0;font-size:11px;color:var(--muted);line-height:1.5">
          {APPROVAL_HINTS[d().approvalMode()]}
        </p>
      </Section>
      <ToggleRow
        title={strings.confirmBash}
        hint={strings.confirmBashHint}
        checked={d().confirmBash()}
        onChange={(v) => d().setConfirmBash(v)}
      />
      <ToggleRow
        title={strings.confirmWrite}
        hint={strings.confirmWriteHint}
        checked={d().confirmWrite()}
        onChange={(v) => d().setConfirmWrite(v)}
      />
      <ToggleRow
        title={strings.confirmNetwork}
        hint={strings.confirmNetworkHint}
        checked={d().confirmNetwork()}
        onChange={(v) => d().setConfirmNetwork(v)}
      />
    </div>
  );
}

function ServerCard() {
  const [copied, setCopied] = createSignal(false);
  const serverUrl = () => getServerUrl();
  const connected = () => uiStore.state.connection === "connected";
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(serverUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }
  return (
    <Card>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="width:32px;height:32px;border-radius:10px;background:var(--bg);border:1px solid var(--border);display:inline-flex;align-items:center;justify-content:center;color:var(--muted)">
          <Server size={16} />
        </span>
        <h4 style="margin:0;font-size:13px;font-weight:700">Server</h4>
        <span
          style={`margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;padding:4px 8px;border-radius:999px;background:${connected() ? "rgba(63,185,80,0.1)" : "rgba(248,81,73,0.1)"};border:1px solid ${connected() ? "rgba(63,185,80,0.2)" : "rgba(248,81,73,0.2)"};color:${connected() ? "var(--success)" : "var(--danger)"}`}
        >
          <span
            style={`width:6px;height:6px;border-radius:50%;background:${connected() ? "var(--success)" : "var(--danger)"};display:inline-block;animation:rudra-pulse 2s infinite`}
          />
          {connected() ? strings.connected : strings.disconnected}
          <Show when={connected() && uiStore.state.serverVersion}>
            {` · v${uiStore.state.serverVersion}`}
          </Show>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--border)">
        <code style="flex:1;min-width:0;font-size:12px;word-break:break-all">{serverUrl()}</code>
        <Button variant="ghost" size="sm" onClick={copyUrl} style="flex-shrink:0;gap:6px">
          <Show when={copied()} fallback={<Copy size={13} />}>
            <Check size={13} />
          </Show>
          {copied() ? "Copied" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}

function DaemonTab(props: { draft: SettingsDraft }) {
  const d = () => props.draft;
  return (
    <div>
      <div style="margin-bottom:16px">
        <ServerCard />
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-bottom:16px">
        <span style="width:36px;height:36px;border-radius:10px;background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.25);display:inline-flex;align-items:center;justify-content:center;color:var(--success);flex-shrink:0">
          <Server size={17} />
        </span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700">
            {strings.daemonAutoConnect}
            <span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.25);color:var(--success)">
              ● Active
            </span>
          </div>
          <div style="margin-top:2px;font-size:11px;color:var(--muted)">
            {strings.daemonAutoConnectHint}
          </div>
        </div>
        <Toggle
          checked={d().daemonAutoConnect()}
          onChange={(v) => d().setDaemonAutoConnect(v)}
          label={strings.daemonAutoConnect}
        />
      </div>
      <Section title={strings.tabDaemon}>
        <Card>
          <div style="display:grid;grid-template-columns:1fr 120px;gap:10px">
            <TextField
              label={strings.daemonHost}
              value={d().daemonHost()}
              onInput={(v) => d().setDaemonHost(v)}
              hint={strings.daemonHostHint}
            />
            <TextField
              label={strings.daemonPort}
              value={d().daemonPort()}
              onInput={(v) => d().setDaemonPort(v)}
            />
          </div>
        </Card>
      </Section>
    </div>
  );
}

function CostTab(props: { draft: SettingsDraft }) {
  const d = () => props.draft;
  return (
    <div>
      <Section title={strings.tabCost}>
        <Card>
          <TextField
            label={strings.tokenBudget}
            value={d().tokenBudget()}
            onInput={(v) => d().setTokenBudget(v)}
            placeholder={strings.tokenBudgetPlaceholder}
            hint={strings.tokenBudgetHint}
          />
          <div style="display:flex;align-items:center;gap:10px">
            <label style="font-size:12px;font-weight:700;white-space:nowrap">{strings.alertAt}</label>
            <div style="position:relative;flex:1;max-width:160px">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--muted)">
                $
              </span>
              <input
                value={d().telemetryAlertAt()}
                onInput={(e) => d().setTelemetryAlertAt(e.currentTarget.value)}
                inputmode="decimal"
                style={`${inputStyle};padding-left:24px`}
              />
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body: nav + panel
// ---------------------------------------------------------------------------

function tabDefs(): { id: SettingsTabId; label: string; icon: () => JSX.Element; dot?: boolean }[] {
  return [
    { id: "general", label: strings.tabGeneral, icon: () => <SlidersHorizontal size={15} /> },
    { id: "models", label: strings.tabModels, icon: () => <Cpu size={15} /> },
    { id: "tools", label: strings.tabTools, icon: () => <ShieldCheck size={15} /> },
    {
      id: "daemon",
      label: strings.tabDaemon,
      icon: () => <Server size={15} />,
      dot: uiStore.state.prefs.daemonAutoConnect,
    },
    { id: "cost", label: strings.tabCost, icon: () => <Coins size={15} /> },
  ];
}

function SettingsBody(props: { draft: SettingsDraft }) {
  const d = () => props.draft;
  const version = () => uiStore.state.serverVersion;
  return (
    <div style="display:flex;gap:0;min-height:440px">
      <div
        style="width:220px;min-width:220px;border-right:1px solid var(--border);padding:6px 12px 12px 0;margin-right:20px;display:flex;flex-direction:column"
      >
        <SettingsTabs tabs={tabDefs()} active={d().tab()} onChange={(t) => d().setTab(t)} />
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
          <Match when={d().tab() === "general"}>
            <GeneralTab draft={d()} />
          </Match>
          <Match when={d().tab() === "models"}>
            <ModelsTab draft={d()} />
          </Match>
          <Match when={d().tab() === "tools"}>
            <ToolsTab draft={d()} />
          </Match>
          <Match when={d().tab() === "daemon"}>
            <DaemonTab draft={d()} />
          </Match>
          <Match when={d().tab() === "cost"}>
            <CostTab draft={d()} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header + footer
// ---------------------------------------------------------------------------

function SettingsHeader(props: { onClose: () => void }) {
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

function SettingsFooter(props: { draft: SettingsDraft; onClose: () => void }) {
  const d = () => props.draft;
  return (
    <div style="display:flex;align-items:center;gap:10px">
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);font-family:ui-monospace,monospace">
        <Info size={13} />
        {strings.changesApply}
      </span>
      <span style="flex:1" />
      <Button variant="ghost" size="sm" onClick={() => d().reset()}>
        {strings.resetDefaults}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => props.onClose()}>
        {strings.cancel}
      </Button>
      <Button variant="primary" size="sm" onClick={() => d().save(() => props.onClose())} style="gap:6px">
        {strings.saveChanges}
        <kbd style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,0.2);font-family:inherit">
          ⌘S
        </kbd>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exports: dialog + page
// ---------------------------------------------------------------------------

/** Modal settings (AppShell). Owns the draft; unmount on close discards it. */
export function SettingsDialog(props: { open: boolean; onClose: () => void }) {
  const draft = createSettingsDraft();
  useSaveShortcut(draft, () => draft.save(props.onClose));
  return (
    <Dialog
      open={props.open}
      title={strings.workspaceSettings}
      onClose={() => props.onClose()}
      size="lg"
      hideHeader
      footer={<SettingsFooter draft={draft} onClose={() => props.onClose()} />}
    >
      <div style="margin:-4px -4px 0">
        <SettingsHeader onClose={() => props.onClose()} />
      </div>
      <div style="padding-top:16px">
        <SettingsBody draft={draft} />
      </div>
    </Dialog>
  );
}

/** Page route: wide card reusing the same body + inline footer. */
export function Settings() {
  const navigate = useNavigate();
  const draft = createSettingsDraft();
  const close = () => navigate("/");
  useSaveShortcut(draft, () => draft.save(close));
  return (
    <div
      style="flex:1;display:flex;align-items:flex-start;justify-content:center;padding:24px;background:radial-gradient(1200px 600px at 50% -20%, rgba(255,77,28,0.08), transparent 60%), var(--bg);overflow-y:auto"
      class="rudra-scroll"
    >
      <div
        class="rudra-slide-up"
        style="width:min(900px,100%);background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow-lg);overflow:hidden"
      >
        <SettingsHeader onClose={close} />
        <div style="padding:20px">
          <SettingsBody draft={draft} />
        </div>
        <div style="padding:14px 20px;border-top:1px solid var(--border);background:var(--bg-subtle)">
          <SettingsFooter draft={draft} onClose={close} />
        </div>
      </div>
    </div>
  );
}
