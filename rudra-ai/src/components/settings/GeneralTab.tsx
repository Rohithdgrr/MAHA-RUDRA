import { For, Show, createSignal, onCleanup } from "solid-js";
import { Check, Moon, Sun } from "lucide-solid";
import { strings } from "../../lib/i18n/en";
import { uiStore } from "../../lib/stores/ui.store";
import { Button } from "../ui/Button";
import { Section } from "./controls";
import { DevPanel } from "./DevPanel";
import { TokenUsageSection } from "./TokenUsageSection";

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

function DangerZone() {
  const [armed, setArmed] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  function onReset() {
    if (!armed()) {
      setArmed(true);
      timer = setTimeout(() => setArmed(false), 5000);
      return;
    }
    if (timer) clearTimeout(timer);
    setArmed(false);
    uiStore.resetPrefs();
    uiStore.toast(strings.prefsReset, "info");
  }

  return (
    <Section title={strings.dangerZone}>
      <Button variant="ghost" size="sm" onClick={onReset}>
        {armed() ? strings.resetConfirm : strings.resetAllSettings}
      </Button>
    </Section>
  );
}

export function GeneralTab() {
  return (
    <div>
      <ThemeSection />
      <ShortcutsSection />
      <TokenUsageSection />
      <DevPanel />
      <DangerZone />
    </div>
  );
}
